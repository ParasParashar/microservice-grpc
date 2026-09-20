import { OnModuleInit } from "@nestjs/common";
import { Client, ClientGrpc, Transport } from "@nestjs/microservices";
import { Observable, firstValueFrom } from 'rxjs';
import {
    PROFILE_PROTO_PATH,
    PROTO_INCLUDE_DIRS,
} from '@auth-profile/shared';


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
            protoPath: PROFILE_PROTO_PATH,
            loader: { includeDirs: PROTO_INCLUDE_DIRS },
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