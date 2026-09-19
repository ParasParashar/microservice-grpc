import { Metadata, status as grpcStatus } from '@grpc/grpc-js';
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RpcException } from '@nestjs/microservices';
import * as bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { db } from 'src/db';
import { users } from 'src/db/schema';
import { AuththenticatedUser } from './decorator/current.decorator';
import { LoginRegisterDto } from './dto/login-register.dto';
import { ProfileClient } from './client/profile.client';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private readonly profileClient: ProfileClient,
  ) { }

  async register(dto: LoginRegisterDto) {
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, dto.email));

    if (existing) throw new ConflictException('Email already in use');

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const [user] = await db
      .insert(users)
      .values({ email: dto.email, password: hashedPassword })
      .returning();

    return {
      user: this.sanitize(user),
      token: this.generateToken(user),
    };
  }

  async login(dto: LoginRegisterDto) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, dto.email));

    if (!user) throw new UnauthorizedException('User not found wiht this email');

    const match = await bcrypt.compare(dto.password, user.password);

    if (!match) throw new UnauthorizedException('Invalid credentials');

    return {
      user: this.sanitize(user),
      token: this.generateToken(user),
    };
  }

  private generateToken(user: typeof users.$inferSelect) {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
    });
  }

  async validateToken(token?: string, metadata?: Metadata) {
    const authHeaderValue = metadata?.get('authorization')?.[0];
    const requestIdValue = metadata?.get('x-request-id')?.[0];
    const correlationIdValue = metadata?.get('x-correlation-id')?.[0];

    const authHeader =
      typeof authHeaderValue === 'string'
        ? authHeaderValue
        : authHeaderValue instanceof Buffer
          ? authHeaderValue.toString('utf8')
          : undefined;

    const requestId =
      typeof requestIdValue === 'string'
        ? requestIdValue
        : requestIdValue instanceof Buffer
          ? requestIdValue.toString('utf8')
          : 'unknown-request';

    const correlationId =
      typeof correlationIdValue === 'string'
        ? correlationIdValue
        : correlationIdValue instanceof Buffer
          ? correlationIdValue.toString('utf8')
          : undefined;

    const bearerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : undefined;

    const resolvedToken = (bearerToken ?? token ?? '').trim();

    if (!resolvedToken) {
      console.warn(
        '[auth-service] rejected empty token',
        JSON.stringify({ requestId, correlationId }),
      );
      throw new RpcException({
        code: grpcStatus.UNAUTHENTICATED,
        message: 'Invalid token',
      });
    }

    try {
      const payload = await this.jwtService.verifyAsync<AuththenticatedUser>(
        resolvedToken,
        {
          secret: process.env.JWT_SECRET!,
        },
      );

      return {
        user: {
          id: payload.sub,
          email: payload.email,
        },
      };
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }

      console.warn(
        '[auth-service] invalid token',
        JSON.stringify({ requestId, correlationId, status: 'unauthenticated' }),
      );

      throw new RpcException({
        code: grpcStatus.UNAUTHENTICATED,
        message: 'Invalid token',
      });
    }
  }

  private sanitize(user: typeof users.$inferSelect) {
    const { password, ...safe } = user;
    return safe;
  }

  getMe(userId: string) {
    return this.profileClient.getProfile(userId);
  }
}