ALTER TABLE "order_items" RENAME COLUMN "unit_price" TO "unitPrice";--> statement-breakpoint
ALTER TABLE "orders" RENAME COLUMN "total_amount" TO "totalAmount";--> statement-breakpoint
ALTER TABLE "payments" RENAME COLUMN "payment_method" TO "paymentMethod";