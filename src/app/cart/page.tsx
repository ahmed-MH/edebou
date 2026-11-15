import type { Metadata } from "next";

import { CartPageContent } from "@/components/cart/cart-page-content";
import { CommercePageShell } from "@/components/cart/commerce-page-shell";

export const metadata: Metadata = {
  title: "سلة التسوق — EDebou",
  robots: { index: false, follow: true },
};

export default function ArabicCartPage() {
  return (
    <CommercePageShell locale="ar">
      <CartPageContent locale="ar" />
    </CommercePageShell>
  );
}
