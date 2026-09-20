import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Transport } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';
import {
  AUTH_PACKAGE_NAME,
  AUTH_PROTO_PATH,
  PROTO_INCLUDE_DIRS,
} from '@auth-profile/shared';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.connectMicroservice({
    transport: Transport.GRPC,
    options: {
      package: AUTH_PACKAGE_NAME,
      protoPath: AUTH_PROTO_PATH,
      loader: { includeDirs: PROTO_INCLUDE_DIRS },
      url: `0.0.0.0:${process.env.GRPC_PORT ?? 5002}`,
    },
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 3001);
  console.log(`Auth service gRPC running on port ${process.env.GRPC_PORT ?? 5002}, HTTP on port ${process.env.PORT ?? 3001}`);
}
bootstrap();
