-- Tighten the checkout group to the exact columns used by the server DAL.

REVOKE SELECT ON TABLE
  "categories",
  "products",
  "product_price_tiers",
  "store_settings"
FROM edebou_checkout_writer;

GRANT SELECT ("id", "is_active")
  ON TABLE "categories" TO edebou_checkout_writer;
GRANT SELECT (
  "id",
  "category_id",
  "sku",
  "slug",
  "name_ar",
  "name_fr",
  "price",
  "stock_quantity",
  "is_active"
) ON TABLE "products" TO edebou_checkout_writer;
GRANT SELECT ("product_id", "min_quantity", "unit_price")
  ON TABLE "product_price_tiers" TO edebou_checkout_writer;
GRANT SELECT ("id", "delivery_fee")
  ON TABLE "store_settings" TO edebou_checkout_writer;

REVOKE INSERT ON TABLE "orders", "order_items"
  FROM edebou_checkout_writer;

GRANT INSERT (
  "order_number",
  "idempotency_key_hash",
  "request_hash",
  "customer_name",
  "phone",
  "governorate",
  "address",
  "notes",
  "subtotal",
  "delivery_fee",
  "total",
  "updated_at"
) ON TABLE "orders" TO edebou_checkout_writer;
GRANT INSERT (
  "order_id",
  "product_id",
  "product_name_snapshot",
  "sku_snapshot",
  "quantity",
  "unit_price",
  "line_total"
) ON TABLE "order_items" TO edebou_checkout_writer;
