import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { db } from '../db';
import { orders, orderItems, orderEvents, payments, idempotencyKeys } from '../db/schema';
import { eq } from 'drizzle-orm';
import { Observable, Subject } from 'rxjs';

export interface CreateOrderAggregatedData {
  idempotencyKey: string;
  metadata?: {
    currency?: string;
    note?: string;
    tags?: Record<string, string>;
  };
  customer?: {
    customerId: string;
    shippingAddress?: string;
    billingAddress?: string;
  };
  items: Array<{
    productId: string;
    sku: string;
    quantity: number;
    unitPrice: number;
  }>;
  payment?: {
    paymentMethod: string;
    transactionToken: string;
    amount: number;
  };
}

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  async processClientStreamCreateOrder(data: CreateOrderAggregatedData) {
    const { idempotencyKey, metadata, customer, items, payment } = data;

    if (!idempotencyKey) {
      throw new BadRequestException('Missing idempotency key in stream');
    }

    // 1. Idempotency Check
    const existingKey = await db
      .select()
      .from(idempotencyKeys)
      .where(eq(idempotencyKeys.key, idempotencyKey))
      .limit(1);

    if (existingKey.length > 0) {
      this.logger.log(`Idempotent request hit for key: ${idempotencyKey}`);
      return existingKey[0].responsePayload;
    }

    if (!customer?.customerId) {
      throw new BadRequestException('Missing customer information in order stream');
    }

    if (!items || items.length === 0) {
      throw new BadRequestException('Order must contain at least one item');
    }

    // 2. Compute Totals
    const totalAmount = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const totalItemsCount = items.reduce((sum, item) => sum + item.quantity, 0);

    // 3. PostgreSQL Database Transaction
    const result = await db.transaction(async (tx) => {
      const [newOrder] = await tx
        .insert(orders)
        .values({
          idempotencyKey,
          customerId: customer.customerId,
          currency: metadata?.currency || 'USD',
          totalAmount,
          totalItems: totalItemsCount,
          status: 'CREATED',
          shippingAddress: customer.shippingAddress,
          billingAddress: customer.billingAddress,
          note: metadata?.note,
        })
        .returning();

      const itemRows = items.map((item) => ({
        orderId: newOrder.id,
        productId: item.productId,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      }));
      await tx.insert(orderItems).values(itemRows);

      if (payment) {
        await tx.insert(payments).values({
          orderId: newOrder.id,
          paymentMethod: payment.paymentMethod,
          transactionToken: payment.transactionToken,
          amount: payment.amount,
          status: 'CONFIRMED',
        });
      }

      await tx.insert(orderEvents).values({
        orderId: newOrder.id,
        eventType: 'ORDER_EVENT_CREATED',
        description: `Order ${newOrder.id} created via gRPC Client Streaming`,
        metadata: { currency: newOrder.currency, totalAmount: String(totalAmount) },
      });

      const responsePayload = {
        order_id: newOrder.id,
        status: newOrder.status,
        total_amount: newOrder.totalAmount,
        total_items: newOrder.totalItems,
        created_at: {
          seconds: Math.floor(newOrder.createdAt.getTime() / 1000),
          nanos: (newOrder.createdAt.getTime() % 1000) * 1000000,
        },
        idempotency_key: idempotencyKey,
      };

      await tx.insert(idempotencyKeys).values({
        key: idempotencyKey,
        orderId: newOrder.id,
        responsePayload,
      });

      return responsePayload;
    });

    this.logger.log(`Successfully persisted order ${result.order_id} from client stream`);
    return result;
  }

  getOrderEventsStream(orderId: string, includeHistorical = true): Observable<any> {
    return new Observable((subscriber) => {
      let isCancelled = false;

      const runStream = async () => {
        if (includeHistorical) {
          const historical = await db
            .select()
            .from(orderEvents)
            .where(eq(orderEvents.orderId, orderId));

          for (const evt of historical) {
            if (isCancelled) return;
            subscriber.next({
              event_id: evt.id,
              order_id: evt.orderId,
              event_type: evt.eventType,
              description: evt.description,
              timestamp: {
                seconds: Math.floor(evt.createdAt.getTime() / 1000),
                nanos: (evt.createdAt.getTime() % 1000) * 1000000,
              },
              metadata: evt.metadata as Record<string, string>,
            });
          }
        }

        const liveEvents = [
          { type: 'ORDER_EVENT_PAYMENT_PENDING', desc: 'Payment confirmation pending with gateway' },
          { type: 'ORDER_EVENT_PAYMENT_CONFIRMED', desc: 'Payment confirmed successfully' },
          { type: 'ORDER_EVENT_PROCESSING', desc: 'Order sent to fulfillment warehouse' },
          { type: 'ORDER_EVENT_PACKED', desc: 'Items packed in shipping container' },
          { type: 'ORDER_EVENT_SHIPPED', desc: 'Handed over to carrier logistics' },
          { type: 'ORDER_EVENT_DELIVERED', desc: 'Order delivered to destination' },
        ];

        for (let i = 0; i < liveEvents.length; i++) {
          if (isCancelled) return;
          await new Promise((res) => setTimeout(res, 800));
          if (isCancelled) return;

          const item = liveEvents[i];

          const [inserted] = await db
            .insert(orderEvents)
            .values({
              orderId,
              eventType: item.type,
              description: item.desc,
              metadata: { step: String(i + 1) },
            })
            .returning();

          subscriber.next({
            event_id: inserted.id,
            order_id: inserted.orderId,
            event_type: inserted.eventType,
            description: inserted.description,
            timestamp: {
              seconds: Math.floor(inserted.createdAt.getTime() / 1000),
              nanos: (inserted.createdAt.getTime() % 1000) * 1000000,
            },
            metadata: inserted.metadata as Record<string, string>,
          });
        }

        subscriber.complete();
      };

      runStream().catch((err) => subscriber.error(err));

      return () => {
        this.logger.log(`Client cancelled GetOrderEventsStream subscription for order ${orderId}`);
        isCancelled = true;
      };
    });
  }

  handleBidirectionalSession(messages$: Observable<any>): Observable<any> {
    const subject = new Subject<any>();
    let sessionId = '';
    let currentTotal = 100.0;
    let discountApplied = 0.0;

    messages$.subscribe({
      next: (cmd) => {
        this.logger.log(`Received session command: ${JSON.stringify(cmd)}`);
        sessionId = cmd.session_id || sessionId;

        const timestamp = {
          seconds: Math.floor(Date.now() / 1000),
          nanos: (Date.now() % 1000) * 1000000,
        };

        const commandType = typeof cmd.command_type === 'string' 
          ? cmd.command_type 
          : String(cmd.command_type);

        switch (commandType) {
          case 'CMD_START_SESSION':
          case '1':
            subject.next({
              session_id: sessionId,
              event_type: 'EVENT_SESSION_STARTED',
              message: `Bidirectional order processing session ${sessionId} initialized`,
              current_total: currentTotal,
              discount_applied: discountApplied,
              timestamp,
            });
            break;

          case 'CMD_UPDATE_QUANTITY':
          case '2':
            const qty = cmd.new_quantity || 1;
            currentTotal = qty * 25.0 - discountApplied;
            subject.next({
              session_id: sessionId,
              event_type: 'EVENT_ORDER_UPDATED',
              message: `Item quantity updated to ${qty}`,
              current_total: currentTotal,
              discount_applied: discountApplied,
              timestamp,
            });
            subject.next({
              session_id: sessionId,
              event_type: 'EVENT_PRICE_RECALCULATED',
              message: `Recalculated order total: $${currentTotal.toFixed(2)}`,
              current_total: currentTotal,
              discount_applied: discountApplied,
              timestamp,
            });
            break;

          case 'CMD_APPLY_COUPON':
          case '3':
            if (cmd.coupon_code === 'SAVE20') {
              discountApplied = currentTotal * 0.2;
              currentTotal -= discountApplied;
              subject.next({
                session_id: sessionId,
                event_type: 'EVENT_PRICE_RECALCULATED',
                message: `Coupon ${cmd.coupon_code} applied! 20% discount applied`,
                current_total: currentTotal,
                discount_applied: discountApplied,
                timestamp,
              });
            } else {
              subject.next({
                session_id: sessionId,
                event_type: 'EVENT_VALIDATION_FAILED',
                message: `Invalid coupon code: ${cmd.coupon_code}`,
                current_total: currentTotal,
                discount_applied: discountApplied,
                timestamp,
              });
            }
            break;

          case 'CMD_CONFIRM_PAYMENT':
          case '4':
            subject.next({
              session_id: sessionId,
              event_type: 'EVENT_PAYMENT_STATUS_CHANGED',
              message: 'Payment status changed to PROCESSING',
              current_total: currentTotal,
              discount_applied: discountApplied,
              timestamp,
            });
            subject.next({
              session_id: sessionId,
              event_type: 'EVENT_ORDER_CONFIRMED',
              message: `Order successfully confirmed in session ${sessionId}!`,
              current_total: currentTotal,
              discount_applied: discountApplied,
              timestamp,
            });
            break;

          case 'CMD_CANCEL_ORDER':
          case '5':
            subject.next({
              session_id: sessionId,
              event_type: 'EVENT_ORDER_CANCELLED',
              message: `Order cancelled by client in session ${sessionId}`,
              current_total: 0.0,
              discount_applied: 0.0,
              timestamp,
            });
            subject.complete();
            break;

          default:
            subject.next({
              session_id: sessionId,
              event_type: 'EVENT_VALIDATION_FAILED',
              message: `Unrecognized command type: ${cmd.command_type}`,
              current_total: currentTotal,
              discount_applied: discountApplied,
              timestamp,
            });
            break;
        }
      },
      error: (err) => {
        this.logger.error(`Bidirectional session error: ${err.message}`, err.stack);
        subject.error(err);
      },
      complete: () => {
        this.logger.log(`Bidirectional session ${sessionId} closed by client`);
        subject.complete();
      },
    });

    return subject.asObservable();
  }
}
