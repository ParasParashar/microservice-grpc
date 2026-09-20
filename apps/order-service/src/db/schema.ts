import { pgTable, text, timestamp, uuid, integer, doublePrecision, jsonb } from 'drizzle-orm/pg-core';

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  idempotencyKey: text('idempotency_key').unique(),
  customerId: text('customer_id').notNull(),
  currency: text('currency').notNull().default('USD'),
  totalAmount: doublePrecision('total_amount').notNull().default(0),
  totalItems: integer('total_items').notNull().default(0),
  status: text('status').notNull().default('CREATED'),
  shippingAddress: text('shipping_address'),
  billingAddress: text('billing_address'),
  note: text('note'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId: text('product_id').notNull(),
  sku: text('sku').notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: doublePrecision('unit_price').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const orderEvents = pgTable('order_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  eventType: text('event_type').notNull(),
  description: text('description').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  paymentMethod: text('payment_method').notNull(),
  transactionToken: text('transaction_token').notNull(),
  amount: doublePrecision('amount').notNull(),
  status: text('status').notNull().default('PENDING'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const idempotencyKeys = pgTable('idempotency_keys', {
  key: text('key').primaryKey(),
  orderId: uuid('order_id').notNull(),
  responsePayload: jsonb('response_payload').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});