import { hasLocale } from "next-intl";
import { notFound, redirect } from "next/navigation";

import { StorefrontHome } from "@/components/storefront/storefront-home";
import { routing } from "@/i18n/routing";

export const dynamic = "force-dynamic";

type HomePageProps = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  if (locale === routing.defaultLocale) {
    redirect("/");
  }

  return <StorefrontHome locale={locale} />;
}
