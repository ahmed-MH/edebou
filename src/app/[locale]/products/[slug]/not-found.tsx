import { getLocale } from "next-intl/server";

import { ProductNotFound } from "@/components/product/product-not-found";

export default async function NotFound() {
  const locale = await getLocale();
  return <ProductNotFound locale={locale === "fr" ? "fr" : "ar"} />;
}
