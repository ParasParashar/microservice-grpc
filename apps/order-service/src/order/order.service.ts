import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { db } from '../db';
import {
  orders,
  orderItems,
  orderEvents,
  payments,
  idempotencyKeys,
} from '../db/schema';
import { eq } from 'drizzle-orm';
import { Observable } from 'rxjs';

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
    console.log(data, 'of the order')
    const { idempotencyKey, metadata, customer, items, payment } = data;

    this.logger.debug(
      `Processing client stream order. Key=${idempotencyKey}, items=${items.length}`,
    );

    if (!idempotencyKey) {
      throw new BadRequestException('Missing idempotency key in stream');
    }

    // ─────────────────────────────────────────────
    // 1. Idempotency Check
    // ─────────────────────────────────────────────
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
      throw new BadRequestException(
        'Missing customer information in order stream',
      );
    }

    if (!items || items.length === 0) {
      throw new BadRequestException('Order must contain at least one item');
    }

    // ─────────────────────────────────────────────
    // 2. Compute Totals
    // ─────────────────────────────────────────────
    const totalAmount = items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );
    const totalItemsCount = items.reduce((sum, item) => sum + item.quantity, 0);

    // ─────────────────────────────────────────────
    // 3. Transaction: Persist Order + Items + Payment + Event + Idempotency
    // ─────────────────────────────────────────────
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
          shippingAddress: customer.shippingAddress ?? null,
          billingAddress: customer.billingAddress ?? null,
          note: metadata?.note ?? null,
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
        metadata: {
          currency: newOrder.currency,
          totalAmount: String(totalAmount),
        },
      });

      // Response payload — camelCase so gRPC (keepCase:false) serializes correctly
      const responsePayload = {
        orderId: newOrder.id,
        status: newOrder.status,
        totalAmount: newOrder.totalAmount,
        totalItems: newOrder.totalItems,
        createdAt: {
          seconds: Math.floor(newOrder.createdAt.getTime() / 1000),
          nanos: (newOrder.createdAt.getTime() % 1000) * 1_000_000,
        },
        idempotencyKey,
      };

      await tx.insert(idempotencyKeys).values({
        key: idempotencyKey,
        orderId: newOrder.id,
        responsePayload,
      });

      return responsePayload;
    });

    this.logger.log(
      `✅ Successfully persisted order ${result.orderId} from client stream`,
    );
    return result;
  }

  // ─────────────────────────────────────────────
  // Server Streaming: Order Events
  // ─────────────────────────────────────────────
  getOrderEventsStream(
    orderId: string,
    includeHistorical = true,
  ): Observable<any> {
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
              eventId: evt.id,
              orderId: evt.orderId,
              eventType: evt.eventType,
              description: evt.description,
              timestamp: {
                seconds: Math.floor(evt.createdAt.getTime() / 1000),
                nanos: (evt.createdAt.getTime() % 1000) * 1_000_000,
              },
              metadata: evt.metadata as Record<string, string>,
            });
          }
        }

        const liveEvents = [
          {
            type: 'ORDER_EVENT_PAYMENT_PENDING',
            desc: 'Payment confirmation pending with gateway',
          },
          {
            type: 'ORDER_EVENT_PAYMENT_CONFIRMED',
            desc: 'Payment confirmed successfully',
          },
          {
            type: 'ORDER_EVENT_PROCESSING',
            desc: 'Order sent to fulfillment warehouse',
          },
          {
            type: 'ORDER_EVENT_PACKED',
            desc: 'Items packed in shipping container',
          },
          {
            type: 'ORDER_EVENT_SHIPPED',
            desc: 'Handed over to carrier logistics',
          },
          {
            type: 'ORDER_EVENT_DELIVERED',
            desc: 'Order delivered to destination',
          },
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
            eventId: inserted.id,
            orderId: inserted.orderId,
            eventType: inserted.eventType,
            description: inserted.description,
            timestamp: {
              seconds: Math.floor(inserted.createdAt.getTime() / 1000),
              nanos: (inserted.createdAt.getTime() % 1000) * 1_000_000,
            },
            metadata: inserted.metadata as Record<string, string>,
          });
        }

        subscriber.complete();
      };

      runStream().catch((err) => subscriber.error(err));

      return () => {
        this.logger.log(
          `Client cancelled GetOrderEventsStream for order ${orderId}`,
        );
        isCancelled = true;
      };
    });
  }

  // ─────────────────────────────────────────────
  // Bidirectional Streaming: Raw handler
  // ─────────────────────────────────────────────
  handleBidirectionalSessionRaw(call: any): void {
    let sessionId = '';
    let currentTotal = 100.0;
    let discountApplied = 0.0;

    const emit = (event: any) => {
      const timestamp = {
        seconds: Math.floor(Date.now() / 1000),
        nanos: (Date.now() % 1000) * 1_000_000,
      };
      call.write({ ...event, timestamp });
    };

    call.on('data', (cmd: any) => {
      this.logger.log(`📥 Session command: ${JSON.stringify(cmd)}`);
      sessionId = cmd.sessionId || sessionId;

      const rawType = cmd.command_type ?? cmd.commandType;
      const commandType =
        typeof rawType === 'number'
          ? [
            'CMD_UNSPECIFIED',
            'CMD_START_SESSION',
            'CMD_UPDATE_QUANTITY',
            'CMD_APPLY_COUPON',
            'CMD_CONFIRM_PAYMENT',
            'CMD_CANCEL_ORDER',
          ][rawType] ?? 'CMD_UNSPECIFIED'
          : String(rawType ?? 'CMD_UNSPECIFIED');

      switch (commandType) {
        case 'CMD_START_SESSION':
          emit({
            sessionId,
            eventType: 'EVENT_SESSION_STARTED',
            message: `Session ${sessionId} initialized`,
            currentTotal,
            discountApplied,
          });
          break;

        case 'CMD_UPDATE_QUANTITY': {
          const qty = cmd.new_quantity ?? cmd.newQuantity ?? 1;
          currentTotal = qty * 25.0 - discountApplied;
          emit({
            sessionId,
            eventType: 'EVENT_ORDER_UPDATED',
            message: `Item quantity updated to ${qty}`,
            currentTotal,
            discountApplied,
          });
          emit({
            sessionId,
            eventType: 'EVENT_PRICE_RECALCULATED',
            message: `Recalculated order total: $${currentTotal.toFixed(2)}`,
            currentTotal,
            discountApplied,
          });
          break;
        }

        case 'CMD_APPLY_COUPON': {
          const coupon = cmd.coupon_code ?? cmd.couponCode;
          if (coupon === 'SAVE20') {
            discountApplied = currentTotal * 0.2;
            currentTotal -= discountApplied;
            emit({
              sessionId,
              eventType: 'EVENT_PRICE_RECALCULATED',
              message: `Coupon ${coupon} applied! 20% discount`,
              currentTotal,
              discountApplied,
            });
          } else {
            emit({
              sessionId,
              eventType: 'EVENT_VALIDATION_FAILED',
              message: `Invalid coupon code: ${coupon}`,
              currentTotal,
              discountApplied,
            });
          }
          break;
        }

        case 'CMD_CONFIRM_PAYMENT':
          emit({
            sessionId,
            eventType: 'EVENT_PAYMENT_STATUS_CHANGED',
            message: 'Payment status changed to PROCESSING',
            currentTotal,
            discountApplied,
          });
          emit({
            sessionId,
            eventType: 'EVENT_ORDER_CONFIRMED',
            message: `Order confirmed in session ${sessionId}!`,
            currentTotal,
            discountApplied,
          });
          break;

        case 'CMD_CANCEL_ORDER':
          emit({
            sessionId,
            eventType: 'EVENT_ORDER_CANCELLED',
            message: `Order cancelled in session ${sessionId}`,
            currentTotal: 0,
            discountApplied: 0,
          });
          call.end();
          break;

        default:
          emit({
            sessionId,
            eventType: 'EVENT_VALIDATION_FAILED',
            message: `Unrecognized command: ${rawType}`,
            currentTotal,
            discountApplied,
          });
      }
    });

    call.on('end', () => {
      this.logger.log(`Session ${sessionId} closed by client`);
    });

    call.on('error', (err: any) => {
      this.logger.error(`Session error: ${err.message}`, err.stack);
    });
  }
}