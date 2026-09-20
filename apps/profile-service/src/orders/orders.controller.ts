import { Controller, Post, Body, Get, Param, Query, Sse, MessageEvent, Logger } from '@nestjs/common';
import { from, Observable, map } from 'rxjs';
import { OrderGrpcClient } from '../client/order.client';

export interface CreateOrderStreamBody {
  idempotencyKey: string;
  metadata?: {
    currency?: string;
    note?: string;
    tags?: Record<string, string>;
  };
  customer: {
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

@Controller('orders')
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);

  constructor(private readonly orderGrpcClient: OrderGrpcClient) {}

  @Post('stream')
  createOrderStream(@Body() body: CreateOrderStreamBody): Observable<any> {
    this.logger.log(`HTTP POST /api/orders/stream received for customer: ${body.customer.customerId}`);

    const chunks: any[] = [];

    chunks.push({
      idempotency_key: body.idempotencyKey,
      metadata_chunk: {
        currency: body.metadata?.currency || 'USD',
        note: body.metadata?.note || '',
        tags: body.metadata?.tags || {},
      },
    });

    chunks.push({
      idempotency_key: body.idempotencyKey,
      customer_chunk: {
        customer_id: body.customer.customerId,
        shipping_address: body.customer.shippingAddress || '',
        billing_address: body.customer.billingAddress || '',
      },
    });

    for (const item of body.items) {
      chunks.push({
        idempotency_key: body.idempotencyKey,
        item_chunk: {
          product_id: item.productId,
          sku: item.sku,
          quantity: item.quantity,
          unit_price: item.unitPrice,
        },
      });
    }

    if (body.payment) {
      chunks.push({
        idempotency_key: body.idempotencyKey,
        payment_chunk: {
          payment_method: body.payment.paymentMethod,
          transaction_token: body.payment.transactionToken,
          amount: body.payment.amount,
        },
      });
    }

    const messages$ = from(chunks);
    return this.orderGrpcClient.createOrderStream(messages$);
  }

  @Sse(':id/events')
  getOrderEventsStream(
    @Param('id') id: string,
    @Query('historical') historical?: string,
  ): Observable<MessageEvent> {
    this.logger.log(`HTTP GET /api/orders/${id}/events SSE connection initiated`);
    const includeHistorical = historical !== 'false';

    return this.orderGrpcClient.getOrderEventsStream(id, includeHistorical).pipe(
      map((event) => ({
        data: event,
      } as MessageEvent)),
    );
  }
}
