"use client";

import { Check, Minus, Plus, ShoppingBag } from "lucide-react";
import { useState } from "react";

import { useCart } from "@/components/cart/cart-provider";
import {
  getIndicativeUnitPrice,
  MAX_CART_ITEM_QUANTITY,
} from "@/components/cart/cart-state";
import type { AppLocale } from "@/i18n/routing";
import type { PublicProductPriceTierDto } from "@/lib/dto/catalog";
import { formatTunisianDinars } from "@/lib/format-currency";

import { ProductDirectOrderForm } from "./product-direct-order-form";

type PurchasePanelLabels = {
  addToCart: string;
  addedToCart: string;
  decreaseQuantity: string;
  each: string;
  fromQuantityLabels: readonly string[];
  increaseQuantity: string;
  outOfStock: string;
  pricingDescription: string;
  pricingTitle: string;
  quantity: string;
  selectedUnitPrice: string;
};

type ProductPurchasePanelProps = {
  availability: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  basePriceMillimes: number;
  deliveryFeeMillimes: number | null;
  labels: PurchasePanelLabels;
  locale: AppLocale;
  priceTiers: readonly PublicProductPriceTierDto[];
  productName: string;
  slug: string;
};

export function ProductPurchasePanel({
  availability,
  basePriceMillimes,
  deliveryFeeMillimes,
  labels,
  locale,
  priceTiers,
  productName,
  slug,
}: ProductPurchasePanelProps) {
  const { addItem, hydrated } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [wasAdded, setWasAdded] = useState(false);
  const isOutOfStock = availability === "OUT_OF_STOCK";
  const selectedUnitPrice = getIndicativeUnitPrice(
    basePriceMillimes,
    priceTiers,
    quantity,
  );
  const activeMinimum = priceTiers.reduce(
    (minimum, tier) =>
      tier.minQuantity <= quantity && tier.minQuantity > minimum
        ? tier.minQuantity
        : minimum,
    1,
  );
  const priceRows = [
    { minQuantity: 1, unitPriceMillimes: basePriceMillimes },
    ...priceTiers,
  ];

  function updateQuantity(nextQuantity: number) {
    if (
      !Number.isInteger(nextQuantity) ||
      nextQuantity < 1 ||
      nextQuantity > MAX_CART_ITEM_QUANTITY
    ) {
      return;
    }

    setQuantity(nextQuantity);
    setWasAdded(false);
  }

  function handleAddToCart() {
    if (!hydrated || isOutOfStock) {
      return;
    }

    addItem({ slug, quantity });
    setWasAdded(true);
  }

  return (
    <div className="grid gap-7 pt-7">
      {priceRows.length > 1 ? (
        <section
          aria-labelledby="product-pricing-heading"
          className="border-b border-border pb-7"
        >
          <h2
            id="product-pricing-heading"
            className="text-xs font-bold uppercase tracking-[0.16em] text-ink"
          >
            {labels.pricingTitle}
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            {labels.pricingDescription}
          </p>
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {priceRows.map((tier, index) => {
              const isSelected = tier.minQuantity === activeMinimum;

              return (
                <li
                  key={tier.minQuantity}
                  className={`flex items-center justify-between gap-4 px-2 py-3 text-sm ${
                    isSelected
                      ? "bg-brand-soft text-ink"
                      : "text-muted"
                  }`}
                >
                  <span className="inline-flex items-center gap-2 font-semibold">
                    {isSelected ? (
                      <Check className="size-4 text-brand" aria-hidden="true" />
                    ) : null}
                    {labels.fromQuantityLabels[index]}
                  </span>
                  <bdi className="price-value font-bold">
                    {formatTunisianDinars(tier.unitPriceMillimes, locale)} /{" "}
                    {labels.each}
                  </bdi>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:items-end">
        <label className="grid gap-2 text-sm font-bold text-ink">
          <span className="text-xs uppercase tracking-[0.14em]">
            {labels.quantity}
          </span>
          <span className="inline-flex w-full items-center justify-between border border-ink/70 bg-white p-1">
            <button
              type="button"
              aria-label={labels.decreaseQuantity}
              disabled={quantity === 1 || isOutOfStock}
              onClick={() => updateQuantity(quantity - 1)}
              className="inline-flex size-10 items-center justify-center text-ink transition-colors hover:bg-soft disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Minus className="size-4" aria-hidden="true" />
            </button>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_CART_ITEM_QUANTITY}
              step={1}
              value={quantity}
              disabled={isOutOfStock}
              onChange={(event) => updateQuantity(event.currentTarget.valueAsNumber)}
              className="price-value h-10 w-16 border-0 bg-transparent text-center font-bold text-ink outline-none disabled:opacity-50"
            />
            <button
              type="button"
              aria-label={labels.increaseQuantity}
              disabled={
                quantity === MAX_CART_ITEM_QUANTITY || isOutOfStock
              }
              onClick={() => updateQuantity(quantity + 1)}
              className="inline-flex size-10 items-center justify-center text-ink transition-colors hover:bg-soft disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="size-4" aria-hidden="true" />
            </button>
          </span>
        </label>

        <div className="border border-border bg-soft px-4 py-3 sm:text-end">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-brand-dark">
            {labels.selectedUnitPrice}
          </p>
          <bdi className="price-value mt-1 block text-2xl font-extrabold text-brand">
            {formatTunisianDinars(selectedUnitPrice, locale)} / {labels.each}
          </bdi>
        </div>
      </div>

      <ProductDirectOrderForm
        availability={availability}
        deliveryFeeMillimes={deliveryFeeMillimes}
        locale={locale}
        productName={productName}
        quantity={quantity}
        slug={slug}
        unitPriceMillimes={selectedUnitPrice}
      />

      <button
        type="button"
        disabled={!hydrated || isOutOfStock}
        onClick={handleAddToCart}
        className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-sm border-2 border-ink bg-ink px-5 text-sm font-extrabold uppercase tracking-[0.12em] text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300 disabled:text-white"
      >
        {wasAdded ? (
          <Check className="size-5" aria-hidden="true" />
        ) : (
          <ShoppingBag className="size-5" aria-hidden="true" />
        )}
        {isOutOfStock
          ? labels.outOfStock
          : wasAdded
            ? labels.addedToCart
            : labels.addToCart}
      </button>
      <p className="sr-only" aria-live="polite">
        {wasAdded ? labels.addedToCart : ""}
      </p>
    </div>
  );
}
