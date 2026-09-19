import { SetMetadata } from "@nestjs/common";

export const GRPC_PUBLIC_KEY = 'isGrpcPublic';
export const GrpcPublic = () => SetMetadata(GRPC_PUBLIC_KEY, true)