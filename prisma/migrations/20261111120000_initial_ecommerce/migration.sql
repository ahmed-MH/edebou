-- EDebou initial e-commerce schema.
-- Monetary values are integer millimes (1 TND = 1,000 millimes), never floats.

CREATE TYPE "order_status" AS ENUM (
  'PENDING',
  'CONFIRMED',
  'SHIPPING',
  'DELIVERED',
  'CANCELLED'
);

CREATE TABLE "categories" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "slug" VARCHAR(120) NOT NULL,
  "name_ar" VARCHAR(160) NOT NULL,
  "name_fr" VARCHAR(160) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "categories_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "categories_slug_format_check"
    CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT "categories_name_ar_length_check"
    CHECK (char_length(btrim("name_ar")) BETWEEN 1 AND 160),
  CONSTRAINT "categories_name_fr_length_check"
    CHECK (char_length(btrim("name_fr")) BETWEEN 1 AND 160)
);

CREATE TABLE "products" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "category_id" UUID NOT NULL,
  "sku" VARCHAR(64) NOT NULL,
  "slug" VARCHAR(120) NOT NULL,
  "name_ar" VARCHAR(200) NOT NULL,
  "name_fr" VARCHAR(200) NOT NULL,
  "description_ar" TEXT NOT NULL,
  "description_fr" TEXT NOT NULL,
  "price" BIGINT NOT NULL,
  "stock_quantity" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "products_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "products_sku_format_check"
    CHECK ("sku" ~ '^[A-Za-z0-9][A-Za-z0-9._-]*$'),
  CONSTRAINT "products_slug_format_check"
    CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT "products_name_ar_length_check"
    CHECK (char_length(btrim("name_ar")) BETWEEN 1 AND 200),
  CONSTRAINT "products_name_fr_length_check"
    CHECK (char_length(btrim("name_fr")) BETWEEN 1 AND 200),
  CONSTRAINT "products_description_ar_length_check"
    CHECK (char_length(btrim("description_ar")) BETWEEN 1 AND 5000),
  CONSTRAINT "products_description_fr_length_check"
    CHECK (char_length(btrim("description_fr")) BETWEEN 1 AND 5000),
  CONSTRAINT "products_price_range_check"
    CHECK ("price" BETWEEN 0 AND 9999999999),
  CONSTRAINT "products_stock_quantity_range_check"
    CHECK ("stock_quantity" BETWEEN 0 AND 1000000)
);

CREATE TABLE "product_images" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "product_id" UUID NOT NULL,
  "path" VARCHAR(512) NOT NULL,
  "alt_ar" VARCHAR(240) NOT NULL,
  "alt_fr" VARCHAR(240) NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "product_images_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_images_path_check"
    CHECK (
      "path" ~ '^/[A-Za-z0-9][A-Za-z0-9/_.-]*$'
      AND "path" !~ '(^|/)\.\.?(/|$)'
    ),
  CONSTRAINT "product_images_alt_ar_length_check"
    CHECK (char_length(btrim("alt_ar")) BETWEEN 1 AND 240),
  CONSTRAINT "product_images_alt_fr_length_check"
    CHECK (char_length(btrim("alt_fr")) BETWEEN 1 AND 240),
  CONSTRAINT "product_images_position_range_check"
    CHECK ("position" BETWEEN 0 AND 100)
);

CREATE TABLE "product_price_tiers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "product_id" UUID NOT NULL,
  "min_quantity" INTEGER NOT NULL,
  "unit_price" BIGINT NOT NULL,

  CONSTRAINT "product_price_tiers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_price_tiers_min_quantity_range_check"
    CHECK ("min_quantity" BETWEEN 2 AND 1000000),
  CONSTRAINT "product_price_tiers_unit_price_range_check"
    CHECK ("unit_price" BETWEEN 0 AND 9999999999)
);

CREATE TABLE "orders" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "order_number" VARCHAR(64) NOT NULL,
  "customer_name" VARCHAR(160) NOT NULL,
  "phone" VARCHAR(32) NOT NULL,
  "governorate" VARCHAR(100) NOT NULL,
  "address" VARCHAR(500) NOT NULL,
  "notes" TEXT,
  "subtotal" BIGINT NOT NULL,
  "delivery_fee" BIGINT NOT NULL,
  "total" BIGINT NOT NULL,
  "status" "order_status" NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "orders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "orders_order_number_format_check"
    CHECK ("order_number" ~ '^[A-Za-z0-9][A-Za-z0-9-]*$'),
  CONSTRAINT "orders_customer_name_length_check"
    CHECK (char_length(btrim("customer_name")) BETWEEN 1 AND 160),
  CONSTRAINT "orders_phone_format_check"
    CHECK (
      char_length(btrim("phone")) BETWEEN 6 AND 32
      AND "phone" ~ '^[0-9+() .-]+$'
    ),
  CONSTRAINT "orders_governorate_length_check"
    CHECK (char_length(btrim("governorate")) BETWEEN 1 AND 100),
  CONSTRAINT "orders_address_length_check"
    CHECK (char_length(btrim("address")) BETWEEN 1 AND 500),
  CONSTRAINT "orders_notes_length_check"
    CHECK ("notes" IS NULL OR char_length("notes") <= 2000),
  CONSTRAINT "orders_subtotal_range_check"
    CHECK ("subtotal" BETWEEN 0 AND 9999999999),
  CONSTRAINT "orders_delivery_fee_range_check"
    CHECK ("delivery_fee" BETWEEN 0 AND 9999999999),
  CONSTRAINT "orders_total_range_check"
    CHECK ("total" BETWEEN 0 AND 9999999999),
  CONSTRAINT "orders_total_integrity_check"
    CHECK ("total" = "subtotal" + "delivery_fee")
);

CREATE TABLE "order_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "order_id" UUID NOT NULL,
  "product_id" UUID,
  "product_name_snapshot" VARCHAR(200) NOT NULL,
  "sku_snapshot" VARCHAR(64) NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unit_price" BIGINT NOT NULL,
  "line_total" BIGINT NOT NULL,

  CONSTRAINT "order_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "order_items_product_name_snapshot_length_check"
    CHECK (char_length(btrim("product_name_snapshot")) BETWEEN 1 AND 200),
  CONSTRAINT "order_items_sku_snapshot_format_check"
    CHECK ("sku_snapshot" ~ '^[A-Za-z0-9][A-Za-z0-9._-]*$'),
  CONSTRAINT "order_items_quantity_range_check"
    CHECK ("quantity" BETWEEN 1 AND 1000000),
  CONSTRAINT "order_items_unit_price_range_check"
    CHECK ("unit_price" BETWEEN 0 AND 9999999999),
  CONSTRAINT "order_items_line_total_range_check"
    CHECK ("line_total" BETWEEN 0 AND 9999999999),
  CONSTRAINT "order_items_line_total_integrity_check"
    CHECK ("line_total" = "unit_price" * "quantity")
);

CREATE TABLE "store_settings" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "delivery_fee" BIGINT NOT NULL,
  "store_name" VARCHAR(160) NOT NULL,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "store_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "store_settings_singleton_check" CHECK ("id" = 1),
  CONSTRAINT "store_settings_delivery_fee_range_check"
    CHECK ("delivery_fee" BETWEEN 0 AND 9999999999),
  CONSTRAINT "store_settings_store_name_length_check"
    CHECK (char_length(btrim("store_name")) BETWEEN 1 AND 160)
);

CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");
CREATE INDEX "categories_is_active_idx" ON "categories"("is_active");

CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");
CREATE INDEX "products_category_id_is_active_idx"
  ON "products"("category_id", "is_active");
CREATE INDEX "products_is_active_created_at_idx"
  ON "products"("is_active", "created_at");

CREATE UNIQUE INDEX "product_images_product_id_position_key"
  ON "product_images"("product_id", "position");
CREATE INDEX "product_images_product_id_idx"
  ON "product_images"("product_id");

CREATE UNIQUE INDEX "product_price_tiers_product_id_min_quantity_key"
  ON "product_price_tiers"("product_id", "min_quantity");
CREATE INDEX "product_price_tiers_product_id_idx"
  ON "product_price_tiers"("product_id");

CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");
CREATE INDEX "orders_status_created_at_idx"
  ON "orders"("status", "created_at");
CREATE INDEX "orders_created_at_idx" ON "orders"("created_at");

CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");
CREATE INDEX "order_items_product_id_idx" ON "order_items"("product_id");

ALTER TABLE "products"
  ADD CONSTRAINT "products_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "categories"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_images"
  ADD CONSTRAINT "product_images_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_price_tiers"
  ADD CONSTRAINT "product_price_tiers_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE FUNCTION "set_updated_at"()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "categories_set_updated_at"
BEFORE UPDATE ON "categories"
FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();

CREATE TRIGGER "products_set_updated_at"
BEFORE UPDATE ON "products"
FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();

CREATE TRIGGER "orders_set_updated_at"
BEFORE UPDATE ON "orders"
FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();

CREATE TRIGGER "store_settings_set_updated_at"
BEFORE UPDATE ON "store_settings"
FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();

REVOKE ALL ON FUNCTION "set_updated_at"() FROM PUBLIC;

-- The runtime login inherits this NOLOGIN role. It can read the public catalog
-- only: orders and Prisma's migration history deliberately remain inaccessible.
GRANT USAGE ON SCHEMA public TO edebou_catalog_reader;
GRANT SELECT ON TABLE
  "categories",
  "products",
  "product_images",
  "product_price_tiers",
  "store_settings"
TO edebou_catalog_reader;
