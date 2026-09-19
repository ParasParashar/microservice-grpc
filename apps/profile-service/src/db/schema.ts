import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const Profile = pgTable('profiles', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    firstName: text('first_name').notNull().default(''),
    lastName: text('last_name').notNull().default(''),
    bio: text('bio').notNull().default(''),
    avatarUrl: text('avatar_url').notNull().default(''),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
})