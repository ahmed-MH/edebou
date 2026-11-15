-- The owner can update the store identity from the protected settings screen.
GRANT UPDATE ("store_name")
  ON TABLE "store_settings" TO edebou_admin_writer;
