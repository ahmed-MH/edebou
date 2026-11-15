-- Authenticated managers and owners may delete catalogue records through
-- audited Server Actions. Foreign keys preserve order snapshots and prevent
-- deletion of non-empty categories.
GRANT DELETE ON TABLE "products" TO edebou_admin_writer;
GRANT DELETE ON TABLE "categories" TO edebou_admin_writer;
