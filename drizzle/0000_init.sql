CREATE TABLE "bills" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"month" text NOT NULL,
	"std" integer NOT NULL,
	"disp" integer NOT NULL,
	"charges" integer NOT NULL,
	"previous_balance" integer NOT NULL,
	"payments_in_month" integer NOT NULL,
	"total_due" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"society" text NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"default_std" integer DEFAULT 0 NOT NULL,
	"default_disp" integer DEFAULT 0 NOT NULL,
	"price_std" integer,
	"price_disp" integer,
	"opening_balance" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deliveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"date" date NOT NULL,
	"std" integer DEFAULT 0 NOT NULL,
	"disp" integer DEFAULT 0 NOT NULL,
	"price_std" integer NOT NULL,
	"price_disp" integer NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer,
	"kind" text NOT NULL,
	"period" text NOT NULL,
	"status" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"date" date NOT NULL,
	"amount" integer NOT NULL,
	"method" text DEFAULT 'cash' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"business_name" text DEFAULT 'Pak Pure Pani' NOT NULL,
	"price_std" integer DEFAULT 60 NOT NULL,
	"price_disp" integer DEFAULT 150 NOT NULL,
	"payment_info" text DEFAULT 'JazzCash / Easypaisa: 03XX-XXXXXXX' NOT NULL,
	"owner_phone" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_log" ADD CONSTRAINT "message_log_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bills_customer_month_uq" ON "bills" USING btree ("customer_id","month");--> statement-breakpoint
CREATE INDEX "customers_society_idx" ON "customers" USING btree ("society");--> statement-breakpoint
CREATE UNIQUE INDEX "deliveries_customer_date_uq" ON "deliveries" USING btree ("customer_id","date");--> statement-breakpoint
CREATE INDEX "deliveries_date_idx" ON "deliveries" USING btree ("date");--> statement-breakpoint
CREATE INDEX "message_log_lookup_idx" ON "message_log" USING btree ("customer_id","kind","period");--> statement-breakpoint
CREATE INDEX "payments_date_idx" ON "payments" USING btree ("date");