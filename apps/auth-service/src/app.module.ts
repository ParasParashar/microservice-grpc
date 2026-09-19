import { Module } from '@nestjs/common';
import { AuthService } from './app.service';
import { AuthController } from './app.controller';
import { JwtModule } from '@nestjs/jwt';
import { JwtGuard } from './guards/jwt-guard';
import { ProfileClient } from './client/profile.client';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtGuard, ProfileClient],
})
export class AppModule { }
