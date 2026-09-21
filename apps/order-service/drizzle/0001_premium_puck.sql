ALTER TABLE "idempotency_keys" RENAME TO "idempotencyKeys";--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_idempotency_key_unique";--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "idempotencyKey" text;--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "idempotency_key";--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_idempotencyKey_unique" UNIQUE("idempotencyKey");