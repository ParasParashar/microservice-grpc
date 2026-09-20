import { Controller, Logger } from '@nestjs/common';
import { GrpcStreamMethod, GrpcMethod } from '@nestjs/microservices';
import { Observable } from 'rxjs';
import { OrderService, CreateOrderAggregatedData } from './order.service';

const MAX_STREAM_ITEMS = 100;

@Controller()
export class OrderController {
  private readonly logger = new Logger(OrderController.name);

  constructor(private readonly orderService: OrderService) {}

  // 1. Client Streaming RPC: CreateOrderStream
  @GrpcStreamMethod('OrderService', 'CreateOrderStream')
  createOrderStream(messages$: Observable<any>): Promise<any> {
    return new Promise((resolve, reject) => {
      const aggregated: CreateOrderAggregatedData = {
        idempotencyKey: '',
        items: [],
      };

      messages$.subscribe({
        next: (chunk) => {
          this.logger.debug(`Received stream chunk: ${JSON.stringify(chunk)}`);

          if (chunk.idempotency_key && !aggregated.idempotencyKey) {
            aggregated.idempotencyKey = chunk.idempotency_key;
          }

          if (chunk.metadata_chunk) {
            aggregated.metadata = {
              currency: chunk.metadata_chunk.currency,
              note: chunk.metadata_chunk.note,
              tags: chunk.metadata_chunk.tags,
            };
          } else if (chunk.customer_chunk) {
            aggregated.customer = {
              customerId: chunk.customer_chunk.customer_id,
              shippingAddress: chunk.customer_chunk.shipping_address,
              billingAddress: chunk.customer_chunk.billing_address,
            };
          } else if (chunk.item_chunk) {
            if (aggregated.items.length >= MAX_STREAM_ITEMS) {
              reject(new Error(`Exceeded maximum allowed stream items limit (${MAX_STREAM_ITEMS})`));
              return;
            }
            aggregated.items.push({
              productId: chunk.item_chunk.product_id,
              sku: chunk.item_chunk.sku,
              quantity: chunk.item_chunk.quantity,
              unitPrice: chunk.item_chunk.unit_price,
            });
          } else if (chunk.payment_chunk) {
            aggregated.payment = {
              paymentMethod: chunk.payment_chunk.payment_method,
              transactionToken: chunk.payment_chunk.transaction_token,
              amount: chunk.payment_chunk.amount,
            };
          }
        },
        error: (err) => {
          this.logger.error(`Error in CreateOrderStream: ${err.message}`, err.stack);
          reject(err);
        },
        complete: async () => {
          this.logger.log(`CreateOrderStream completed. Processing ${aggregated.items.length} items.`);
          try {
            const response = await this.orderService.processClientStreamCreateOrder(aggregated);
            resolve(response);
          } catch (err) {
            reject(err);
          }
        },
      });
    });
  }

  // 2. Server Streaming RPC: GetOrderEventsStream
  @GrpcMethod('OrderService', 'GetOrderEventsStream')
  getOrderEventsStream(data: { order_id: string; include_historical?: boolean }): Observable<any> {
    this.logger.log(`GetOrderEventsStream called for order_id: ${data.order_id}`);
    return this.orderService.getOrderEventsStream(data.order_id, data.include_historical ?? true);
  }

  // 3. Bidirectional Streaming RPC: OrderProcessingSession
  @GrpcStreamMethod('OrderService', 'OrderProcessingSession')
  orderProcessingSession(messages$: Observable<any>): Observable<any> {
    this.logger.log('OrderProcessingSession bidirectional stream established');
    return this.orderService.handleBidirectionalSession(messages$);
  }
}
