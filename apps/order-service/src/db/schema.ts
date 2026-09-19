import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const Order = pgTable('orders', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    productName: text('product_name').notNull().default(''),
    price: text('price').notNull().default(''),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
})