import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { db } from 'src/db';
import { Profile } from 'src/db/schema';

@Injectable()
export class ProfileService {
    async getProfile(userId: string) {
        if (!userId) throw new Error('userId is required');
        const [profile] = await db
            .select()
            .from(Profile)
            .where(eq(Profile.userId, userId));

        // auto-create profile if it doesn't exist yet — happens on first login
        if (!profile) {
            const [created] = await db
                .insert(Profile)
                .values({ userId })
                .returning();
            return created;
        }

        return profile;
    }

    async updateProfile(userId: string, dto: UpdateProfileDto) {
        const [profile] = await db
            .select()
            .from(Profile)
            .where(eq(Profile.userId, userId));

        // create profile if it doesn't exist before updating
        if (!profile) {
            const [created] = await db
                .insert(Profile)
                .values({ userId, ...dto })
                .returning();
            return created;
        }

        const [updated] = await db
            .update(Profile)
            .set({ ...dto, updatedAt: new Date() })
            .where(eq(Profile.userId, userId))
            .returning();

        return updated;
    }
}