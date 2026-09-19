import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Transport } from '@nestjs/microservices';
import { join } from 'path';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.connectMicroservice({
    transport: Transport.GRPC,
    options: {
      package: 'auth',
      protoPath: join(process.cwd(), '../../libs/shared/src/proto/auth.proto'),
      url: `0.0.0.0:${process.env.GRPC_PORT ?? 5001}`,
    },
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));
  app.setGlobalPrefix('api');

  await app.startAllMicroservices();

  await app.listen(process.env.PORT ?? 3001);
  console.log('Auth service is running on port:', process.env.PORT ?? 3001);
}
bootstrap();
