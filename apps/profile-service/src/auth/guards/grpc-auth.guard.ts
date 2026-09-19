import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthClient } from 'src/client/auth.client';
import { GRPC_PUBLIC_KEY } from '../decorator/grpc-public.decorator';

export interface GrpcAuthenticatedUser {
    userId: string;
    email: string;
}

export interface RequestWithUser extends Request {
    user: GrpcAuthenticatedUser;
}

@Injectable()
export class GrpcAuthGuard implements CanActivate {
    constructor(
        private readonly authClient: AuthClient,
        private readonly reflector: Reflector,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const isPublic = this.reflector.getAllAndOverride<boolean>(GRPC_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (isPublic) return true;

        const request = context.switchToHttp().getRequest<RequestWithUser>();
        const authHeader = request.headers['authorization'];

        if (!authHeader) {
            throw new UnauthorizedException('Authorization header missing');
        }

        const [bearer, token] = authHeader.split(' ');

        if (bearer !== 'Bearer' || !token) {
            throw new UnauthorizedException('Invalid authorization header format');
        }

        const user = await this.authClient.validateToken(token);
        request.user = user;

        return true;
    }
}