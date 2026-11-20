-- Production databases are not demo-seeded. Ensure the singleton commercial
-- configuration exists without overwriting values already chosen by an owner.
INSERT INTO "store_settings" (
  "id",
  "delivery_fee",
  "store_name"
)
VALUES (1, 8000, 'EDebou')
ON CONFLICT ("id") DO NOTHING;
