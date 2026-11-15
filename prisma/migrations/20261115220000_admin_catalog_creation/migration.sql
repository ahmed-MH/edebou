-- Managers and owners can create catalogue records through authenticated,
-- validated and audited back-office Server Actions. Deletion remains denied.
GRANT INSERT ON TABLE "categories" TO edebou_admin_writer;
GRANT INSERT ON TABLE "products" TO edebou_admin_writer;
GRANT INSERT ON TABLE "product_images" TO edebou_admin_writer;
