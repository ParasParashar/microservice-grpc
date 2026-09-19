import { OnModuleInit } from "@nestjs/common";
import { Client, ClientGrpc, Transport } from "@nestjs/microservices";
import { Observable, firstValueFrom } from 'rxjs';
import { join } from 'path';


interface ProfileGrpcService {
    getProfile(data: { userId: string }): Observable<{
        firstName: string;
        lastName: string;
        bio: string;
        avatarUrl: string;
        id: string;
        userId: string;
        updatedAt: Date;
        createdAt: Date;
    }>
}

export class ProfileClient implements OnModuleInit {
    @Client({
        transport: Transport.GRPC,
        options: {
            package: 'profile',
            protoPath: join(process.cwd(), '../../libs/shared/src/proto/profile.proto'),
            url: process.env.PROFILE_SERVICE_GRPC_URL ?? 'localhost:5001',

        }
    })
    private client!: ClientGrpc;
    private profileService!: ProfileGrpcService;

    // implement circuit breaker later
    onModuleInit() {
        this.profileService = this.client.getService<ProfileGrpcService>('ProfileService');
    }

    async getProfile(userId: string) {
        const profile = await firstValueFrom(this.profileService.getProfile({ userId }));
        return profile
    }

}