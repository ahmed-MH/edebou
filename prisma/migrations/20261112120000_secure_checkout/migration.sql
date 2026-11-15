-- Phase 3: secure checkout, idempotence and shared PostgreSQL rate limiting.
-- This migration is additive and preserves any legacy orders.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname = 'edebou_checkout_writer'
  ) THEN
    RAISE EXCEPTION
      'Role edebou_checkout_writer is missing. Run the checkout role provisioning command before Prisma Migrate.';
  END IF;
END
$$;

ALTER TABLE "orders"
  ADD COLUMN "idempotency_key_hash" CHAR(64),
  ADD COLUMN "request_hash" CHAR(64),
  ADD COLUMN "stock_restored_at" TIMESTAMPTZ(3);

-- Existing rows predate public checkout idempotence. Synthetic hashes allow the
-- new columns to become NOT NULL without changing or deleting historical data.
UPDATE "orders"
SET
  "idempotency_key_hash" =
    md5("id"::text || ':legacy-idempotency') ||
    md5("id"::text || ':legacy-idempotency:2'),
  "request_hash" =
    md5("id"::text || ':legacy-request') ||
    md5("id"::text || ':legacy-request:2')
WHERE "idempotency_key_hash" IS NULL OR "request_hash" IS NULL;

ALTER TABLE "orders"
  ALTER COLUMN "idempotency_key_hash" SET NOT NULL,
  ALTER COLUMN "request_hash" SET NOT NULL,
  ADD CONSTRAINT "orders_idempotency_key_hash_format_check"
    CHECK ("idempotency_key_hash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "orders_request_hash_format_check"
    CHECK ("request_hash" ~ '^[0-9a-f]{64}$');

CREATE UNIQUE INDEX "orders_idempotency_key_hash_key"
  ON "orders"("idempotency_key_hash");

CREATE TABLE "checkout_rate_limits" (
  "key_hash" CHAR(64) NOT NULL,
  "window_started_at" TIMESTAMPTZ(3) NOT NULL,
  "request_count" INTEGER NOT NULL,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "checkout_rate_limits_pkey" PRIMARY KEY ("key_hash"),
  CONSTRAINT "checkout_rate_limits_key_hash_format_check"
    CHECK ("key_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "checkout_rate_limits_request_count_check"
    CHECK ("request_count" BETWEEN 1 AND 1000000)
);

CREATE INDEX "checkout_rate_limits_updated_at_idx"
  ON "checkout_rate_limits"("updated_at");

-- The checkout login inherits this fixed NOLOGIN role. It can price an order,
-- decrement stock, insert orders/items and maintain only its hashed limiter.
-- It cannot change catalog prices, categories or commercial settings.
GRANT USAGE ON SCHEMA public TO edebou_checkout_writer;
GRANT SELECT ON TABLE
  "categories",
  "products",
  "product_price_tiers",
  "store_settings"
TO edebou_checkout_writer;
GRANT UPDATE ("stock_quantity", "updated_at")
  ON TABLE "products" TO edebou_checkout_writer;
GRANT INSERT ON TABLE "orders", "order_items"
  TO edebou_checkout_writer;
GRANT SELECT (
  "id",
  "order_number",
  "idempotency_key_hash",
  "request_hash",
  "subtotal",
  "delivery_fee",
  "total"
) ON TABLE "orders" TO edebou_checkout_writer;
GRANT SELECT, INSERT ON TABLE "checkout_rate_limits"
  TO edebou_checkout_writer;
GRANT UPDATE ("window_started_at", "request_count", "updated_at")
  ON TABLE "checkout_rate_limits" TO edebou_checkout_writer;
