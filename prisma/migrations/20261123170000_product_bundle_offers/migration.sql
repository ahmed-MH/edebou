ALTER TABLE "product_price_tiers"
  ADD COLUMN "bundle_total" BIGINT;

ALTER TABLE "order_items"
  DROP CONSTRAINT "order_items_line_total_integrity_check";
ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_line_total_integrity_check"
  CHECK (
    "line_total" >= "unit_price" * "quantity"
    AND "line_total" < ("unit_price" + 1) * "quantity"
  );

ALTER TABLE "products"
  ADD COLUMN "compare_at_price" BIGINT;

ALTER TABLE "store_settings"
  ADD COLUMN "contact_phone" VARCHAR(16);
ALTER TABLE "store_settings"
  ADD CONSTRAINT "store_settings_contact_phone_format_check"
  CHECK ("contact_phone" IS NULL OR "contact_phone" ~ '^\+216[234579][0-9]{7}$');

ALTER TABLE "products"
  ADD CONSTRAINT "products_compare_at_price_range_check"
  CHECK ("compare_at_price" IS NULL OR "compare_at_price" BETWEEN 0 AND 9999999999);

ALTER TABLE "product_price_tiers"
  ADD CONSTRAINT "product_price_tiers_bundle_total_range_check"
  CHECK ("bundle_total" IS NULL OR "bundle_total" BETWEEN 0 AND 9999999999);

GRANT SELECT ("bundle_total")
  ON TABLE "product_price_tiers" TO edebou_checkout_writer;

GRANT INSERT, DELETE ON TABLE "product_price_tiers" TO edebou_admin_writer;
GRANT UPDATE ("compare_at_price") ON TABLE "products" TO edebou_admin_writer;
GRANT UPDATE (
  "category_id", "name_ar", "name_fr", "description_ar", "description_fr", "updated_at"
) ON TABLE "products" TO edebou_admin_writer;
GRANT INSERT, DELETE ON TABLE "product_images" TO edebou_admin_writer;
GRANT UPDATE ("contact_phone") ON TABLE "store_settings" TO edebou_admin_writer;
GRANT SELECT ("contact_phone") ON TABLE "store_settings" TO edebou_checkout_writer;
