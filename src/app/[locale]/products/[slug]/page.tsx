import { hasLocale } from "next-intl";
import { notFound, redirect } from "next/navigation";

import { ProductDetailPage } from "@/components/product/product-detail-page";
import { routing } from "@/i18n/routing";

type LocalizedProductPageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export default async function LocalizedProductPage({
  params,
}: LocalizedProductPageProps) {
  const { locale, slug } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  if (locale === routing.defaultLocale) {
    redirect(`/products/${encodeURIComponent(slug)}`);
  }

  return <ProductDetailPage locale={locale} rawSlug={slug} />;
}
