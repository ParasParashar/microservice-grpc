import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Query,
  Sse,
  MessageEvent,
  Logger,
} from '@nestjs/common';
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

  constructor(private readonly orderGrpcClient: OrderGrpcClient) { }

  @Post('stream')
  createOrderStream(@Body() body: CreateOrderStreamBody): Observable<any> {
    this.logger.log(
      `HTTP POST /api/orders/stream received for customer: ${body.customer.customerId}`,
    );

    const chunks: any[] = [];

    // Chunk 1: metadata
    chunks.push({
      idempotencyKey: body.idempotencyKey,
      metadataChunk: {
        currency: body.metadata?.currency || 'USD',
        note: body.metadata?.note || '',
        tags: body.metadata?.tags || {},
      },
    });

    // Chunk 2: customer
    chunks.push({
      idempotencyKey: body.idempotencyKey,
      customerChunk: {
        customerId: body.customer.customerId,
        shippingAddress: body.customer.shippingAddress || '',
        billingAddress: body.customer.billingAddress || '',
      },
    });

    // Chunk(s): items
    for (const item of body.items) {
      chunks.push({
        idempotencyKey: body.idempotencyKey,
        itemChunk: {
          productId: item.productId,
          sku: item.sku,
          quantity: item.quantity,
          // Proto field name is snake_case: `unitPrice`
          unitPrice: item.unitPrice,
        },
      });
    }

    // Chunk: payment
    if (body.payment) {
      chunks.push({
        idempotencyKey: body.idempotencyKey,
        paymentChunk: {
          // Proto field names are snake_case
          paymentMethod: body.payment.paymentMethod,
          transactionToken: body.payment.transactionToken,
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

    return this.orderGrpcClient
      .getOrderEventsStream(id, includeHistorical)
      .pipe(map((event) => ({ data: event } as MessageEvent)));
  }
}