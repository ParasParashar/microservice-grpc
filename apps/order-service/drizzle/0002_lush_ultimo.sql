ALTER TABLE "idempotencyKeys" RENAME COLUMN "order_id" TO "orderId";--> statement-breakpoint
ALTER TABLE "order_events" RENAME COLUMN "order_id" TO "orderId";--> statement-breakpoint
ALTER TABLE "order_items" RENAME COLUMN "order_id" TO "orderId";--> statement-breakpoint
ALTER TABLE "order_items" RENAME COLUMN "product_id" TO "productId";--> statement-breakpoint
ALTER TABLE "orders" RENAME COLUMN "shipping_address" TO "shippingAddress";--> statement-breakpoint
ALTER TABLE "payments" RENAME COLUMN "order_id" TO "orderId";--> statement-breakpoint
ALTER TABLE "order_events" DROP CONSTRAINT "order_events_order_id_orders_id_fk";
--> statement-breakpoint
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_order_id_orders_id_fk";
--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_order_id_orders_id_fk";
--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_orderId_orders_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_orders_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_orders_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;