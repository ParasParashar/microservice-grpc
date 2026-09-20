import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { Transport } from '@nestjs/microservices';
import {
  ORDER_PACKAGE_NAME,
  ORDER_PROTO_PATH,
  PROTO_INCLUDE_DIRS,
} from '@auth-profile/shared';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.connectMicroservice({
    transport: Transport.GRPC,
    options: {
      package: ORDER_PACKAGE_NAME,
      protoPath: ORDER_PROTO_PATH,
      loader: { includeDirs: PROTO_INCLUDE_DIRS },
      url: `0.0.0.0:${process.env.GRPC_PORT ?? 5003}`,
    },
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 3003);
  console.log(
    `Order service gRPC server running on port ${process.env.GRPC_PORT ?? 5003}, HTTP on port ${process.env.PORT ?? 3003}`,
  );
}
bootstrap();
