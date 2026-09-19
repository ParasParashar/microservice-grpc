import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { Metadata } from '@grpc/grpc-js';
import { AuthService } from './app.service';
import { Public } from './decorator/public.decorator';
import { JwtGuard } from './guards/jwt-guard';
import { LoginRegisterDto } from './dto/login-register.dto';
import { AuththenticatedUser, CurrentUser } from './decorator/current.decorator';

@Controller('auth')
@UseGuards(JwtGuard)
export class AuthController {
  constructor(private authService: AuthService) { }

  @Post('register')
  @Public()
  register(@Body() dto: LoginRegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @Public()
  login(@Body() dto: LoginRegisterDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  me(@CurrentUser() user: AuththenticatedUser) {
    /* call the profile service grpc method  */
    return this.authService.getMe(user.sub);
  }

  @GrpcMethod('AuthService', 'ValidateToken')
  @Public()
  validateToken(data: { token: string }, metadata: Metadata) {
    return this.authService.validateToken(data.token, metadata);
  }
}