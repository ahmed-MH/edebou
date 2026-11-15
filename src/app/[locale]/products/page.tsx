import { hasLocale } from "next-intl";
import { notFound, redirect } from "next/navigation";

import {
  CatalogPage,
  type CatalogSearchParams,
} from "@/components/catalog/catalog-page";
import { routing } from "@/i18n/routing";

type LocalizedCatalogPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<CatalogSearchParams>;
};

export default async function LocalizedCatalogPage({
  params,
  searchParams,
}: LocalizedCatalogPageProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  if (locale === routing.defaultLocale) {
    redirect("/products");
  }

  return <CatalogPage locale={locale} searchParams={searchParams} />;
}
