import { Metadata, status as grpcStatus } from '@grpc/grpc-js';
import {
    BadRequestException,
    ForbiddenException,
    GatewayTimeoutException,
    HttpException,
    Injectable,
    NotFoundException,
    OnModuleInit,
    ServiceUnavailableException,
    UnauthorizedException,
} from '@nestjs/common';
import { Client, type ClientGrpc, Transport } from '@nestjs/microservices';
import { randomUUID } from 'crypto';
import {
    AUTH_PROTO_PATH,
    PROTO_INCLUDE_DIRS,
} from '@auth-profile/shared';
import { Observable, firstValueFrom } from 'rxjs';
import { CircuitBreaker } from '../common/circuit-breaker';

interface AuthGrpcService {
    validateToken(
        data: { token: string },
        metadata?: Metadata,
        options?: { deadline?: number },
    ): Observable<{
        user?: {
            id: string;
            email: string;
        };
    }>;
}

@Injectable()
export class AuthClient implements OnModuleInit {
    @Client({
        transport: Transport.GRPC,
        options: {
            package: 'auth',
            protoPath: AUTH_PROTO_PATH,
            loader: { includeDirs: PROTO_INCLUDE_DIRS },
            url: process.env.AUTH_SERVICE_GRPC_URL ?? 'localhost:5001',
        },
    })
    private client!: ClientGrpc;

    private authService!: AuthGrpcService;
    private breaker = new CircuitBreaker(5, 30000);

    onModuleInit() {
        this.authService = this.client.getService<AuthGrpcService>('AuthService');
    }

    async validateToken(token: string) {
        const requestId = randomUUID();
        const metadata = new Metadata();
        metadata.set('authorization', `Bearer ${token}`);
        metadata.set('x-request-id', requestId);
        metadata.set('x-correlation-id', requestId);

        try {
            const result = await this.breaker.execute(() =>
                firstValueFrom(
                    this.authService.validateToken(
                        { token },
                        metadata,
                        { deadline: Date.now() + 2000 },
                    ),
                ),
            );

            if (!result?.user) {
                throw new UnauthorizedException('Invalid token');
            }

            return {
                userId: result.user.id,
                email: result.user.email,
            };
        } catch (error) {
            throw this.toHttpException(error);
        }
    }

    private toHttpException(error: unknown): HttpException {
        const code = this.getGrpcStatusCode(error);
        const details = this.getGrpcErrorDetails(error);

        switch (code) {
            case grpcStatus.UNAUTHENTICATED:
                return new UnauthorizedException(details ?? 'Invalid token');
            case grpcStatus.INVALID_ARGUMENT:
                return new BadRequestException(details ?? 'Invalid authentication request');
            case grpcStatus.PERMISSION_DENIED:
                return new ForbiddenException(details ?? 'Permission denied');
            case grpcStatus.NOT_FOUND:
                return new NotFoundException(details ?? 'User not found');
            case grpcStatus.DEADLINE_EXCEEDED:
                return new GatewayTimeoutException(
                    details ?? 'Authentication service deadline exceeded',
                );
            case grpcStatus.UNAVAILABLE:
                return new ServiceUnavailableException(
                    details ?? 'Authentication service unavailable',
                );
            default:
                return new HttpException(details ?? 'Authentication failed', 500);
        }
    }

    private getGrpcStatusCode(error: unknown): number | undefined {
        if (typeof error === 'object' && error !== null) {
            const maybeCode = (error as { code?: number; response?: { code?: number } })
                .code;
            const responseCode = (error as { response?: { code?: number } })?.response
                ?.code;

            if (typeof maybeCode === 'number') return maybeCode;
            if (typeof responseCode === 'number') return responseCode;
        }

        return undefined;
    }

    private getGrpcErrorDetails(error: unknown): string | undefined {
        if (typeof error === 'object' && error !== null) {
            const message = (error as { details?: string; message?: string; response?: { details?: string; message?: string } })
                ?.details;
            const responseMessage = (error as { response?: { details?: string; message?: string } })
                ?.response?.details;
            const rawMessage = (error as { message?: string })?.message;

            if (typeof message === 'string' && message.length > 0) return message;
            if (typeof responseMessage === 'string' && responseMessage.length > 0)
                return responseMessage;
            if (typeof rawMessage === 'string' && rawMessage.length > 0) return rawMessage;
        }

        return undefined;
    }
}