import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { notFound, redirect } from "next/navigation";

import { CartPageContent } from "@/components/cart/cart-page-content";
import { CommercePageShell } from "@/components/cart/commerce-page-shell";
import { routing } from "@/i18n/routing";

export const metadata: Metadata = {
  title: "Panier — EDebou",
  robots: { index: false, follow: true },
};

export default async function LocalizedCartPage({
  params,
}: {
  readonly params: Promise<{ readonly locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  if (locale === routing.defaultLocale) {
    redirect("/cart");
  }

  return (
    <CommercePageShell locale={locale}>
      <CartPageContent locale={locale} />
    </CommercePageShell>
  );
}
