import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { GrpcAuthGuard } from 'src/auth/guards/grpc-auth.guard';
import { AuthClient } from 'src/client/auth.client';

@Module({
    controllers: [ProfileController],
    providers: [ProfileService, AuthClient, GrpcAuthGuard],
})
export class ProfileModule { }