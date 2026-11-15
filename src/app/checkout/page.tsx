import type { Metadata } from "next";
import { connection } from "next/server";

import { CommercePageShell } from "@/components/cart/commerce-page-shell";
import { CheckoutPageContent } from "@/components/checkout/checkout-page-content";
import { orderService } from "@/lib/services/order-service";

export const metadata: Metadata = {
  title: "إتمام الطلب — EDebou",
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

export default async function ArabicCheckoutPage() {
  const deliveryFeeMillimes = await getDeliveryFee();

  return (
    <CommercePageShell locale="ar">
      <CheckoutPageContent
        locale="ar"
        deliveryFeeMillimes={deliveryFeeMillimes}
      />
    </CommercePageShell>
  );
}
