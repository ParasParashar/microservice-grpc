import { Controller, HttpException, Logger } from '@nestjs/common';
import { GrpcMethod, GrpcStreamCall } from '@nestjs/microservices';
import type { ServerReadableStream, ServerDuplexStream, sendUnaryData, ServerUnaryCall } from '@grpc/grpc-js';
import { Observable } from 'rxjs';
import { OrderService, CreateOrderAggregatedData } from './order.service';

const MAX_STREAM_ITEMS = 100;

@Controller()
export class OrderController {
  private readonly logger = new Logger(OrderController.name);

  constructor(private readonly orderService: OrderService) { }

  // ═══════════════════════════════════════════════════════════
  // 1. Client Streaming: Use @GrpcStreamCall + raw grpc stream
  // ═══════════════════════════════════════════════════════════
  @GrpcStreamCall('OrderService', 'CreateOrderStream')
  createOrderStream(
    call: ServerReadableStream<any, any>,
    callback: sendUnaryData<any>,
  ): void {
    const aggregated: CreateOrderAggregatedData = {
      idempotencyKey: '',
      items: [],
    };

    this.logger.log('📥 CreateOrderStream (client streaming) started');

    call.on('data', (chunk: any) => {
      this.logger.debug(`Received chunk: ${JSON.stringify(chunk)}`);

      if (chunk.idempotencyKey && !aggregated.idempotencyKey) {
        aggregated.idempotencyKey = chunk.idempotencyKey;
      }

      if (chunk.metadataChunk) {
        aggregated.metadata = {
          currency: chunk.metadataChunk.currency,
          note: chunk.metadataChunk.note,
          tags: chunk.metadataChunk.tags,
        };
      } else if (chunk.customerChunk) {
        aggregated.customer = {
          customerId: chunk.customerChunk.customerId,
          shippingAddress: chunk.customerChunk.shippingAddress,
          billingAddress: chunk.customerChunk.billingAddress,
        };
      } else if (chunk.itemChunk) {
        if (aggregated.items.length >= MAX_STREAM_ITEMS) {
          this.logger.error(`Exceeded max items (${MAX_STREAM_ITEMS})`);
          call.emit('error', {
            code: 3, // INVALID_ARGUMENT
            message: `Exceeded maximum allowed stream items limit (${MAX_STREAM_ITEMS})`,
          });
          return;
        }
        aggregated.items.push({
          productId: chunk.itemChunk.productId,
          sku: chunk.itemChunk.sku,
          quantity: chunk.itemChunk.quantity,
          unitPrice: chunk.itemChunk.unitPrice ?? 0,
        });
      } else if (chunk.paymentChunk) {
        aggregated.payment = {
          paymentMethod: chunk.paymentChunk.paymentMethod,
          transactionToken: chunk.paymentChunk.transactionToken,
          amount: chunk.paymentChunk.amount,
        };
      }
    });

    call.on('end', async () => {
      this.logger.log(
        `🟢 Stream ended. Aggregated ${aggregated.items.length} items. Calling service...`,
      );
      try {
        const response =
          await this.orderService.processClientStreamCreateOrder(aggregated);
        this.logger.log(`✅ Service returned order `);
        callback(null, response);
      } catch (err: any) {
        this.logger.error(`❌ Service error: ${err.message}`, err.stack);
        callback({
          code: this.getGrpcErrorCode(err),
          message: err.message ?? 'Failed to process order',
        });
      }
    });

    call.on('error', (err: any) => {
      this.logger.error(`🔴 Stream error: ${err.message}`, err.stack);
      // stream already errored, no need to call callback
    });
  }

  // ═══════════════════════════════════════════════════════════
  // 2. Server Streaming: @GrpcMethod returning Observable
  // ═══════════════════════════════════════════════════════════
  @GrpcMethod('OrderService', 'GetOrderEventsStream')
  getOrderEventsStream(data: {
    orderId: string;
    include_historical?: boolean;
  }): Observable<any> {
    this.logger.log(`GetOrderEventsStream for orderId: ${data.orderId}`);
    return this.orderService.getOrderEventsStream(
      data.orderId,
      data.include_historical ?? true,
    );
  }

  // ═══════════════════════════════════════════════════════════
  // 3. Bidirectional Streaming: Use @GrpcStreamCall
  // ═══════════════════════════════════════════════════════════
  @GrpcStreamCall('OrderService', 'OrderProcessingSession')
  orderProcessingSession(call: ServerDuplexStream<any, any>): void {
    this.logger.log('🔄 OrderProcessingSession bidirectional stream started');

    // Delegate to service; service writes back via call.write()
    this.orderService.handleBidirectionalSessionRaw(call);
  }

  private getGrpcErrorCode(error: unknown): number {
    if (error instanceof HttpException) {
      switch (error.getStatus()) {
        case 400:
          return 3;
        case 401:
          return 16;
        case 403:
          return 7;
        case 404:
          return 5;
        case 409:
          return 6;
        case 408:
        case 504:
          return 4;
      }
    }

    return 13;
  }
}