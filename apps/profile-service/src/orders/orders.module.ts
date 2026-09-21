import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import {
  ORDER_PACKAGE_NAME,
  ORDER_PROTO_PATH,
  PROTO_INCLUDE_DIRS,
} from '@auth-profile/shared';
import { OrdersController } from './orders.controller';
import { OrderGrpcClient } from '../client/order.client';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'ORDER_SERVICE_GRPC',
        transport: Transport.GRPC,
        options: {
          package: ORDER_PACKAGE_NAME,
          protoPath: ORDER_PROTO_PATH,
          loader: { includeDirs: PROTO_INCLUDE_DIRS },
          url: process.env.ORDER_SERVICE_URL || 'localhost:5003',
        },
      },
    ]),
  ],
  controllers: [OrdersController],
  providers: [OrderGrpcClient],
  exports: [OrderGrpcClient],
})
export class OrdersModule { }
