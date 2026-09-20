import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Observable } from 'rxjs';

export interface OrderGrpcService {
  createOrderStream(messages$: Observable<any>): Observable<any>;
  getOrderEventsStream(request: { order_id: string; include_historical?: boolean }): Observable<any>;
  orderProcessingSession(messages$: Observable<any>): Observable<any>;
}

@Injectable()
export class OrderGrpcClient implements OnModuleInit {
  private orderService: OrderGrpcService;

  constructor(@Inject('ORDER_SERVICE_GRPC') private readonly client: ClientGrpc) { }
  1
  onModuleInit() {
    this.orderService = this.client.getService<OrderGrpcService>('OrderService');
  }

  createOrderStream(messages$: Observable<any>): Observable<any> {
    return this.orderService.createOrderStream(messages$);
  }

  getOrderEventsStream(orderId: string, includeHistorical = true): Observable<any> {
    return this.orderService.getOrderEventsStream({
      order_id: orderId,
      include_historical: includeHistorical,
    });
  }

  orderProcessingSession(messages$: Observable<any>): Observable<any> {
    return this.orderService.orderProcessingSession(messages$);
  }
}
