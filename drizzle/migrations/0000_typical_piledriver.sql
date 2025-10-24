CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" text NOT NULL,
	"user_id" text NOT NULL,
	"experiment_id" uuid,
	"variant_id" uuid,
	"event_data" jsonb DEFAULT '{}'::jsonb,
	"url" text,
	"referrer" text,
	"user_agent" text,
	"ip_address" "inet",
	"country" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experiment_stats" (
	"experiment_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"date" date NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"unique_users" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"conversions" integer DEFAULT 0 NOT NULL,
	"revenue" numeric(12, 2) DEFAULT '0' NOT NULL,
	"avg_order_value" numeric(12, 2) DEFAULT '0' NOT NULL,
	"bounce_rate" numeric(5, 2),
	"avg_session_duration" integer,
	"conversion_rate" numeric(5, 4),
	"confidence_level" numeric(5, 4),
	"p_value" numeric(10, 8),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "experiment_stats_experiment_id_variant_id_date_pk" PRIMARY KEY("experiment_id","variant_id","date")
);
--> statement-breakpoint
CREATE TABLE "experiments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"hypothesis" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"traffic_allocation" jsonb DEFAULT '{"control": 50, "variant_a": 50}'::jsonb NOT NULL,
	"targeting_rules" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "user_assignments" (
	"user_id" text NOT NULL,
	"experiment_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"assignment_method" text DEFAULT 'hash' NOT NULL,
	"user_agent" text,
	"country" text,
	"device_type" text,
	CONSTRAINT "user_assignments_user_id_experiment_id_pk" PRIMARY KEY("user_id","experiment_id")
);
--> statement-breakpoint
CREATE TABLE "variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experiment_id" uuid NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"is_control" boolean DEFAULT false NOT NULL,
	"weight" integer DEFAULT 50 NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_experiment_name" UNIQUE("experiment_id","name"),
	CONSTRAINT "weight_check" CHECK ("variants"."weight" >= 0 AND "variants"."weight" <= 100)
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_stats" ADD CONSTRAINT "experiment_stats_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_stats" ADD CONSTRAINT "experiment_stats_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_assignments" ADD CONSTRAINT "user_assignments_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_assignments" ADD CONSTRAINT "user_assignments_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_events_experiment" ON "events" USING btree ("experiment_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_events_variant" ON "events" USING btree ("variant_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_events_type" ON "events" USING btree ("event_type","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_events_user" ON "events" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_stats_date" ON "experiment_stats" USING btree ("date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_stats_experiment" ON "experiment_stats" USING btree ("experiment_id","date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_experiments_status" ON "experiments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_experiments_created_at" ON "experiments" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_assignments_experiment" ON "user_assignments" USING btree ("experiment_id");--> statement-breakpoint
CREATE INDEX "idx_assignments_variant" ON "user_assignments" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "idx_assignments_assigned_at" ON "user_assignments" USING btree ("assigned_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_variants_experiment" ON "variants" USING btree ("experiment_id");--> statement-breakpoint
-- =====================================================
-- Database Functions
-- =====================================================
-- Function: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
-- Apply trigger to experiments
CREATE TRIGGER experiments_updated_at
  BEFORE UPDATE ON experiments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();--> statement-breakpoint
-- Apply trigger to variants
CREATE TRIGGER variants_updated_at
  BEFORE UPDATE ON variants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();--> statement-breakpoint
-- Function: Atomically increment conversion stats
CREATE OR REPLACE FUNCTION increment_conversion_stats(
  p_experiment_id uuid,
  p_variant_id uuid,
  p_date date,
  p_order_value numeric
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO experiment_stats (
    experiment_id,
    variant_id,
    date,
    conversions,
    revenue,
    avg_order_value,
    impressions,
    unique_users,
    clicks,
    conversion_rate,
    updated_at
  )
  VALUES (
    p_experiment_id,
    p_variant_id,
    p_date,
    1,
    p_order_value,
    p_order_value,
    0,
    0,
    0,
    0,
    NOW()
  )
  ON CONFLICT (experiment_id, variant_id, date)
  DO UPDATE SET
    conversions = experiment_stats.conversions + 1,
    revenue = experiment_stats.revenue + p_order_value,
    avg_order_value = (experiment_stats.revenue + p_order_value) / (experiment_stats.conversions + 1),
    conversion_rate = CASE
      WHEN experiment_stats.impressions > 0
      THEN ((experiment_stats.conversions + 1)::numeric / experiment_stats.impressions) * 100
      ELSE 0
    END,
    updated_at = NOW();
END;
$$;