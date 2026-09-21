CREATE TABLE "idempotency_keys" (
	"key" text PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"response_payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "idempotencyKeys" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "idempotencyKeys" CASCADE;--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_idempotencyKey_unique";--> statement-breakpoint
ALTER TABLE "order_events" DROP CONSTRAINT "order_events_orderId_orders_id_fk";
--> statement-breakpoint
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_orderId_orders_id_fk";
--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_orderId_orders_id_fk";
--> statement-breakpoint
ALTER TABLE "order_events" ADD COLUMN "order_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "order_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "product_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "unit_price" double precision NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "customer_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "total_amount" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "total_items" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_address" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "billing_address" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "order_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "payment_method" text NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "transaction_token" text NOT NULL;--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_events" DROP COLUMN "orderId";--> statement-breakpoint
ALTER TABLE "order_items" DROP COLUMN "orderId";--> statement-breakpoint
ALTER TABLE "order_items" DROP COLUMN "productId";--> statement-breakpoint
ALTER TABLE "order_items" DROP COLUMN "unitPrice";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "idempotencyKey";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "customerId";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "totalAmount";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "totalItems";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "shippingAddress";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "billingAddress";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN "orderId";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN "paymentMethod";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN "transactionToken";--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_idempotency_key_unique" UNIQUE("idempotency_key");