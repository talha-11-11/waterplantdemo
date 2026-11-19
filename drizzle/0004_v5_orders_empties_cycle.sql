CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer,
	"from_name" text DEFAULT '' NOT NULL,
	"from_phone" text DEFAULT '' NOT NULL,
	"date" date NOT NULL,
	"std" integer DEFAULT 0 NOT NULL,
	"disp" integer DEFAULT 0 NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"raw_text" text DEFAULT '' NOT NULL,
	"created_by" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"done_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "production_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"count" integer NOT NULL,
	"method" text DEFAULT 'manual' NOT NULL,
	"detected" integer,
	"item_id" integer,
	"note" text DEFAULT '' NOT NULL,
	"created_by" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "cycle_days" integer;--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN "empties_returned" integer;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "camera_production" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_logs" ADD CONSTRAINT "production_logs_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_date_status_idx" ON "orders" USING btree ("date","status");