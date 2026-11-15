import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { CommercePageShell } from "@/components/cart/commerce-page-shell";
import { CheckoutPageContent } from "@/components/checkout/checkout-page-content";
import { routing } from "@/i18n/routing";
import { orderService } from "@/lib/services/order-service";

export const metadata: Metadata = {
  title: "Checkout — EDebou",
  robots: { index: false, follow: false },
};

async function getDeliveryFee(): Promise<number | null> {
  await connection();

  try {
    return (await orderService.getCheckoutSettings()).deliveryFeeMillimes;
  } catch {
    return null;
  }
}

export default async function LocalizedCheckoutPage({
  params,
}: {
  readonly params: Promise<{ readonly locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  if (locale === routing.defaultLocale) {
    redirect("/checkout");
  }

  const deliveryFeeMillimes = await getDeliveryFee();

  return (
    <CommercePageShell locale={locale}>
      <CheckoutPageContent
        locale={locale}
        deliveryFeeMillimes={deliveryFeeMillimes}
      />
    </CommercePageShell>
  );
}
