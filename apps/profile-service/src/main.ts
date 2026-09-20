import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { Transport } from '@nestjs/microservices';
import {
  PROFILE_PACKAGE_NAME,
  PROFILE_PROTO_PATH,
  PROTO_INCLUDE_DIRS,
} from '@auth-profile/shared';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.connectMicroservice({
    transport: Transport.GRPC,
    options: {
      package: PROFILE_PACKAGE_NAME,
      protoPath: PROFILE_PROTO_PATH,
      loader: { includeDirs: PROTO_INCLUDE_DIRS },
      url: `0.0.0.0:${process.env.GRPC_PORT ?? 5001}`,
    },
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api');

  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 3002);
  console.log(
    `Profile service HTTP Gateway running on port ${process.env.PORT ?? 3002}, gRPC on ${process.env.GRPC_PORT ?? 5001}`,
  );
}
void bootstrap();