"use client";

import { ShoppingBag } from "lucide-react";
import Link from "next/link";

import type { AppLocale } from "@/i18n/routing";

import { commerceCopy } from "./commerce-copy";
import { useCart } from "./cart-provider";

export function CartLink({ locale }: { readonly locale: AppLocale }) {
  const { hydrated, totalQuantity } = useCart();
  const copy = commerceCopy[locale].header;
  const displayedQuantity = hydrated ? totalQuantity : 0;

  return (
    <Link
      href={locale === "fr" ? "/fr/cart" : "/cart"}
      aria-label={copy.cartLabel(displayedQuantity)}
      className="relative inline-flex min-h-12 min-w-[4.25rem] shrink-0 justify-self-end items-center justify-center gap-2 rounded-2xl border border-border bg-white px-3 text-sm font-bold text-ink shadow-[0_4px_14px_rgb(17_24_39/5%)] transition-[border-color,color,transform] hover:scale-[1.03] hover:border-brand/30 hover:text-brand md:min-h-11 md:min-w-0 md:rounded-xl md:shadow-none sm:px-4"
    >
      <ShoppingBag className="size-5" aria-hidden="true" />
      <span className="hidden xl:inline">{copy.cart}</span>
      <span
        aria-hidden="true"
        className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand px-1.5 py-0.5 text-[0.68rem] font-extrabold leading-4 text-white"
      >
        {displayedQuantity > 999 ? "999+" : displayedQuantity}
      </span>
    </Link>
  );
}
