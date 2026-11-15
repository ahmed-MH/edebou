-- Phase 4: authenticated back-office, auditable administration and
-- privacy-bounded checkout intents. This migration is additive.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname = 'edebou_checkout_writer'
  ) THEN
    RAISE EXCEPTION 'Role edebou_checkout_writer is missing.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname = 'edebou_admin_writer'
  ) THEN
    RAISE EXCEPTION
      'Role edebou_admin_writer is missing. Provision the admin role before Prisma Migrate.';
  END IF;
END
$$;

CREATE TYPE "checkout_intent_status" AS ENUM (
  'ACTIVE', 'CONTACTED', 'CONVERTED', 'DISMISSED', 'EXPIRED'
);

CREATE TYPE "admin_role" AS ENUM ('OWNER', 'MANAGER', 'VIEWER');

CREATE TABLE "checkout_intents" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "token_hash" CHAR(64) NOT NULL,
  "customer_name" VARCHAR(160),
  "phone" VARCHAR(32) NOT NULL,
  "governorate" VARCHAR(100),
  "address" VARCHAR(500),
  "locale" VARCHAR(2) NOT NULL,
  "source" VARCHAR(32) NOT NULL,
  "items" JSONB NOT NULL,
  "status" "checkout_intent_status" NOT NULL DEFAULT 'ACTIVE',
  "admin_note" VARCHAR(500),
  "order_id" UUID,
  "first_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "contacted_at" TIMESTAMPTZ(3),
  "converted_at" TIMESTAMPTZ(3),
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "checkout_intents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "checkout_intents_token_hash_format_check"
    CHECK ("token_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "checkout_intents_locale_check"
    CHECK ("locale" IN ('ar', 'fr')),
  CONSTRAINT "checkout_intents_source_check"
    CHECK ("source" IN ('PRODUCT', 'CHECKOUT')),
  CONSTRAINT "checkout_intents_phone_check"
    CHECK ("phone" ~ '^\+216[234579][0-9]{7}$'),
  CONSTRAINT "checkout_intents_expiry_check"
    CHECK ("expires_at" > "first_seen_at"),
  CONSTRAINT "checkout_intents_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "checkout_intents_token_hash_key"
  ON "checkout_intents"("token_hash");
CREATE UNIQUE INDEX "checkout_intents_order_id_key"
  ON "checkout_intents"("order_id");
CREATE INDEX "checkout_intents_status_last_seen_at_idx"
  ON "checkout_intents"("status", "last_seen_at");
CREATE INDEX "checkout_intents_phone_idx" ON "checkout_intents"("phone");
CREATE INDEX "checkout_intents_expires_at_idx"
  ON "checkout_intents"("expires_at");

CREATE TABLE "admin_users" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "email" VARCHAR(254) NOT NULL,
  "display_name" VARCHAR(120) NOT NULL,
  "password_hash" VARCHAR(255) NOT NULL,
  "role" "admin_role" NOT NULL DEFAULT 'MANAGER',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "failed_login_count" INTEGER NOT NULL DEFAULT 0,
  "locked_until" TIMESTAMPTZ(3),
  "last_login_at" TIMESTAMPTZ(3),
  "password_changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admin_users_failed_login_count_check"
    CHECK ("failed_login_count" BETWEEN 0 AND 1000000)
);

CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");
CREATE INDEX "admin_users_is_active_idx" ON "admin_users"("is_active");

CREATE TABLE "admin_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "token_hash" CHAR(64) NOT NULL,
  "user_agent_hash" CHAR(64),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admin_sessions_token_hash_format_check"
    CHECK ("token_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "admin_sessions_user_agent_hash_format_check"
    CHECK ("user_agent_hash" IS NULL OR "user_agent_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "admin_sessions_expiry_check"
    CHECK ("expires_at" > "created_at"),
  CONSTRAINT "admin_sessions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "admin_users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "admin_sessions_token_hash_key"
  ON "admin_sessions"("token_hash");
CREATE INDEX "admin_sessions_user_id_expires_at_idx"
  ON "admin_sessions"("user_id", "expires_at");
CREATE INDEX "admin_sessions_expires_at_idx"
  ON "admin_sessions"("expires_at");

CREATE TABLE "admin_login_rate_limits" (
  "key_hash" CHAR(64) NOT NULL,
  "window_started_at" TIMESTAMPTZ(3) NOT NULL,
  "request_count" INTEGER NOT NULL,
  "blocked_until" TIMESTAMPTZ(3),
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "admin_login_rate_limits_pkey" PRIMARY KEY ("key_hash"),
  CONSTRAINT "admin_login_rate_limits_key_hash_format_check"
    CHECK ("key_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "admin_login_rate_limits_request_count_check"
    CHECK ("request_count" BETWEEN 1 AND 1000000)
);

CREATE INDEX "admin_login_rate_limits_updated_at_idx"
  ON "admin_login_rate_limits"("updated_at");

CREATE TABLE "admin_audit_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "actor_user_id" UUID,
  "action" VARCHAR(80) NOT NULL,
  "entity_type" VARCHAR(80) NOT NULL,
  "entity_id" VARCHAR(160),
  "summary" JSONB,
  "ip_hash" CHAR(64),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admin_audit_logs_ip_hash_format_check"
    CHECK ("ip_hash" IS NULL OR "ip_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "admin_audit_logs_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "admin_users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "admin_audit_logs_created_at_idx"
  ON "admin_audit_logs"("created_at");
CREATE INDEX "admin_audit_logs_actor_user_id_created_at_idx"
  ON "admin_audit_logs"("actor_user_id", "created_at");
CREATE INDEX "admin_audit_logs_entity_idx"
  ON "admin_audit_logs"("entity_type", "entity_id");

-- Public checkout can only upsert its opaque draft and mark it converted.
-- It receives no SELECT privilege on customer drafts.
GRANT INSERT (
  "token_hash", "customer_name", "phone", "governorate", "address",
  "locale", "source", "items", "expires_at"
) ON TABLE "checkout_intents" TO edebou_checkout_writer;
GRANT UPDATE (
  "customer_name", "phone", "governorate", "address", "locale", "source",
  "items", "status", "order_id", "last_seen_at", "converted_at",
  "expires_at", "updated_at"
) ON TABLE "checkout_intents" TO edebou_checkout_writer;

-- The back-office role is separate from both the public catalog reader and
-- checkout writer. Every sensitive query still verifies a database session.
GRANT USAGE ON SCHEMA public TO edebou_admin_writer;
GRANT SELECT ON TABLE
  "categories", "products", "product_images", "product_price_tiers",
  "orders", "order_items", "store_settings", "checkout_intents",
  "admin_users", "admin_sessions", "admin_login_rate_limits",
  "admin_audit_logs"
TO edebou_admin_writer;

GRANT INSERT, UPDATE, DELETE ON TABLE
  "admin_sessions", "admin_login_rate_limits"
TO edebou_admin_writer;
GRANT UPDATE (
  "failed_login_count", "locked_until", "last_login_at", "updated_at"
) ON TABLE "admin_users" TO edebou_admin_writer;
GRANT INSERT ON TABLE "admin_audit_logs" TO edebou_admin_writer;
GRANT UPDATE ("status", "stock_restored_at", "updated_at")
  ON TABLE "orders" TO edebou_admin_writer;
GRANT UPDATE ("stock_quantity", "price", "is_active", "updated_at")
  ON TABLE "products" TO edebou_admin_writer;
GRANT UPDATE ("is_active", "updated_at")
  ON TABLE "categories" TO edebou_admin_writer;
GRANT UPDATE ("delivery_fee", "updated_at")
  ON TABLE "store_settings" TO edebou_admin_writer;
GRANT UPDATE (
  "status", "admin_note", "contacted_at", "updated_at"
) ON TABLE "checkout_intents" TO edebou_admin_writer;
GRANT DELETE ON TABLE "checkout_intents" TO edebou_admin_writer;
