import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { seconds, ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from 'nestjs-throttler-storage-redis';
import Redis from 'ioredis/built/Redis';
import { JwtGuard } from './auth/guards/jwt-guard';
import { Reflector } from '@nestjs/core';
import { GatewayController } from './gateway/gateway.controller';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: seconds(60),
          limit: 2
        }
      ],
      storage: new ThrottlerStorageRedisService(
        new Redis(process.env.REDIS_URL!)
      )
    })
  ],
  controllers: [GatewayController],
  providers: [JwtGuard, Reflector],
})
export class AppModule { }
