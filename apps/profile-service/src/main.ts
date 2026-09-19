import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { Transport } from '@nestjs/microservices';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.connectMicroservice({
    transport: Transport.GRPC,
    options: {
      package: 'profile',
      protoPath: join(process.cwd(), '../../libs/shared/src/proto/profile.proto'),
      url: `0.0.0.0:${process.env.GRPC_PORT ?? 5001}`,
    },
  });


  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api');



  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 3002);
  console.log(
    `Profile service running on http://localhost:${process.env.PORT ?? 3002}`,
  );
}
void bootstrap();