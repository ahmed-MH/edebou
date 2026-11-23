"use client";

import { Check, Minus, Plus, ShoppingBag } from "lucide-react";
import { useState } from "react";

import { useCart } from "@/components/cart/cart-provider";
import { getIndicativeLineTotal, MAX_CART_ITEM_QUANTITY } from "@/components/cart/cart-state";
import type { AppLocale } from "@/i18n/routing";
import type { PublicProductPriceTierDto } from "@/lib/dto/catalog";
import { formatTunisianDinars } from "@/lib/format-currency";

import { ProductDirectOrderForm } from "./product-direct-order-form";

type PurchasePanelLabels = {
  addToCart: string;
  addedToCart: string;
  callUs: string;
  decreaseQuantity: string;
  fromQuantityLabels: readonly string[];
  increaseQuantity: string;
  outOfStock: string;
  orderNow: string;
  pricingDescription: string;
  pricingTitle: string;
  quantity: string;
};

type ProductPurchasePanelProps = {
  availability: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  basePriceMillimes: number;
  contactPhone: string | null;
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
  contactPhone,
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
  const selectedTotal = getIndicativeLineTotal(basePriceMillimes, priceTiers, quantity);
  const offerQuantities = [1, ...priceTiers.map((tier) => tier.minQuantity)];

  function updateQuantity(nextQuantity: number) {
    if (!Number.isInteger(nextQuantity) || nextQuantity < 1 || nextQuantity > MAX_CART_ITEM_QUANTITY) return;
    setQuantity(nextQuantity);
    setWasAdded(false);
  }

  function handleAddToCart() {
    if (!hydrated || isOutOfStock) return;
    addItem({ slug, quantity });
    setWasAdded(true);
  }

  const selectionControls = (
    <div className="grid gap-5 border-t border-border pt-5">
      <fieldset className="grid gap-3">
        <legend className="mb-2 text-lg font-extrabold text-ink">{labels.pricingTitle}</legend>
        <p className="text-sm leading-6 text-muted">{labels.pricingDescription}</p>
        {offerQuantities.map((offerQuantity, index) => {
          const offerTotal = getIndicativeLineTotal(basePriceMillimes, priceTiers, offerQuantity);
          const isSelected = quantity === offerQuantity;
          return (
            <button
              key={offerQuantity}
              type="button"
              disabled={isOutOfStock}
              aria-pressed={isSelected}
              onClick={() => updateQuantity(offerQuantity)}
              className={isSelected
                ? "flex min-h-16 w-full items-center justify-between gap-4 rounded-xl border border-brand bg-brand-soft px-4 py-3 text-start text-ink disabled:opacity-60"
                : "flex min-h-16 w-full items-center justify-between gap-4 rounded-xl border border-border bg-white px-4 py-3 text-start text-ink hover:border-brand/50 disabled:opacity-60"}
            >
              <span className="inline-flex items-center gap-2 text-base font-bold">
                {isSelected ? <Check className="size-5 text-brand" aria-hidden="true" /> : null}
                {labels.fromQuantityLabels[index]}
              </span>
              <bdi className="price-value shrink-0 text-lg font-extrabold">
                {formatTunisianDinars(offerTotal, locale)}
              </bdi>
            </button>
          );
        })}
      </fieldset>

      <div className="flex items-center justify-between gap-4">
        <label htmlFor="product-order-quantity" className="text-base font-bold text-ink">
          {labels.quantity}
        </label>
        <div className="inline-flex items-center rounded-xl border border-border bg-white p-1">
          <button
            type="button"
            aria-label={labels.decreaseQuantity}
            disabled={quantity === 1 || isOutOfStock}
            onClick={() => updateQuantity(quantity - 1)}
            className="inline-flex size-11 items-center justify-center rounded-lg text-ink hover:bg-soft disabled:opacity-40"
          >
            <Minus className="size-5" aria-hidden="true" />
          </button>
          <input
            id="product-order-quantity"
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_CART_ITEM_QUANTITY}
            value={quantity}
            disabled={isOutOfStock}
            onChange={(event) => updateQuantity(event.currentTarget.valueAsNumber)}
            className="price-value h-11 w-14 border-0 bg-transparent text-center font-bold text-ink outline-none"
          />
          <button
            type="button"
            aria-label={labels.increaseQuantity}
            disabled={quantity === MAX_CART_ITEM_QUANTITY || isOutOfStock}
            onClick={() => updateQuantity(quantity + 1)}
            className="inline-flex size-11 items-center justify-center rounded-lg text-ink hover:bg-soft disabled:opacity-40"
          >
            <Plus className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="grid gap-4">
      <ProductDirectOrderForm
        availability={availability}
        callUsLabel={labels.callUs}
        contactPhone={contactPhone}
        deliveryFeeMillimes={deliveryFeeMillimes}
        locale={locale}
        orderNowLabel={labels.orderNow}
        productName={productName}
        quantity={quantity}
        selectionControls={selectionControls}
        slug={slug}
        subtotalMillimes={selectedTotal}
      />
      <button
        type="button"
        disabled={!hydrated || isOutOfStock}
        onClick={handleAddToCart}
        className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-ink bg-white px-5 text-base font-bold text-ink transition-colors hover:bg-soft disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-500"
      >
        {wasAdded ? <Check className="size-5" aria-hidden="true" /> : <ShoppingBag className="size-5" aria-hidden="true" />}
        {isOutOfStock ? labels.outOfStock : wasAdded ? labels.addedToCart : labels.addToCart}
      </button>
      <p className="sr-only" aria-live="polite">{wasAdded ? labels.addedToCart : ""}</p>
    </div>
  );
}
