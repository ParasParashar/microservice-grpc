import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { GrpcAuthenticatedUser, GrpcAuthGuard } from 'src/auth/guards/grpc-auth.guard';
import { CurrentUser } from 'src/auth/decorator/current-user.decorator';
import { ProfileService } from './profile.service';
import { GrpcMethod } from '@nestjs/microservices';
import { GrpcPublic } from 'src/auth/decorator/grpc-public.decorator';

@Controller('profile')
// every route validates token via gRPC call to auth-service
@UseGuards(GrpcAuthGuard)
export class ProfileController {
  constructor(private profileService: ProfileService) { }

  @Get()
  getProfile(@CurrentUser() user: GrpcAuthenticatedUser) {
    return this.profileService.getProfile(user.userId);
  }

  @Patch()
  updateProfile(
    @CurrentUser() user: GrpcAuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profileService.updateProfile(user.userId, dto);
  }

  // make a grpc controller for the getProfile


  @GrpcPublic()
  @GrpcMethod('ProfileService', 'getProfile')
  async getProfileGrpc(data: { userId: string }) {
    const d = await this.profileService.getProfile(data.userId);
    return {
      profile: d
    }
  }
}