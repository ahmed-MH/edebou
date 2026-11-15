-- Prisma uses the tier primary key internally while materializing the selected
-- nested price-tier relation. It is not returned by the checkout DTO.
GRANT SELECT ("id")
  ON TABLE "product_price_tiers" TO edebou_checkout_writer;
