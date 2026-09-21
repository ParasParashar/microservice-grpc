import { Module } from '@nestjs/common';
import { ProfileModule } from './profile/profile.module';
import { OrdersModule } from './orders/orders.module';

@Module({
  imports: [ProfileModule, OrdersModule],
})
export class AppModule { }
