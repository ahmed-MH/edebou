-- The checkout repository uses a tagged, parameterized INSERT so PostgreSQL,
-- rather than the client, applies status/timestamp defaults. The updated_at
-- INSERT privilege from the first hardening pass is therefore unnecessary.
REVOKE INSERT ("updated_at")
  ON TABLE "orders" FROM edebou_checkout_writer;
