"use client";

import { AlertCircle, LoaderCircle, ShoppingBag, Trash2 } from "lucide-react";
import Link from "next/link";

import type { AppLocale } from "@/i18n/routing";
import { formatTunisianDinars } from "@/lib/format-currency";

import { commerceCopy } from "./commerce-copy";
import { useCart } from "./cart-provider";
import {
  findBundleOffer,
  getIndicativeLineTotal,
  getIndicativeUnitPrice,
  MAX_CART_ITEM_QUANTITY,
} from "./cart-state";
import { useCartProducts, type ValidatedCartLine } from "./use-cart-products";

function CartLine({
  line,
  locale,
}: {
  readonly line: ValidatedCartLine;
  readonly locale: AppLocale;
}) {
  const { updateQuantity, removeItem } = useCart();
  const copy = commerceCopy[locale];
  const { item, product } = line;

  if (!product) {
    return (
      <li className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <div className="flex items-start gap-3">
          <AlertCircle
            className="mt-0.5 size-5 shrink-0 text-amber-700"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-ink">{copy.common.unavailable}</p>
            <p className="mt-1 break-all text-sm text-muted">{item.slug}</p>
          </div>
          <button
            type="button"
            onClick={() => removeItem(item.slug)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber-300 bg-white px-3 text-sm font-bold text-ink hover:text-brand"
          >
            <Trash2 className="size-4" aria-hidden="true" />
            {copy.common.remove}
          </button>
        </div>
      </li>
    );
  }

  const name = product.name[locale];
  const isBundleOffer = findBundleOffer(product.priceTiers, item.quantity) !== null;
  const unitPrice = getIndicativeUnitPrice(
    product.priceMillimes,
    product.priceTiers,
    item.quantity,
  );
  const lineTotal = getIndicativeLineTotal(product.priceMillimes, product.priceTiers, item.quantity);
  const isOutOfStock = product.availability === "OUT_OF_STOCK";

  return (
    <li className="rounded-2xl border border-border bg-white p-4 shadow-card sm:p-5">
      <article className="grid gap-4 sm:grid-cols-[7rem_minmax(0,1fr)]">
        <div className="product-media-stage aspect-square overflow-hidden rounded-2xl border border-border">
          {product.image ? (
            // Product paths are curated server-side; no HTML is injected.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.image.path}
              alt={product.image.alt[locale]}
              width="320"
              height="320"
              className="h-full w-full object-contain p-3"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted">
              <ShoppingBag className="size-8" aria-hidden="true" />
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-ink">{name}</h2>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">
                {product.sku}
              </p>
              <p
                className={`mt-2 text-sm font-bold ${
                  isOutOfStock ? "text-brand" : "text-emerald-700"
                }`}
              >
                {copy.common.availability[product.availability]}
              </p>
            </div>
            <button
              type="button"
              onClick={() => removeItem(item.slug)}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-muted hover:bg-brand-soft hover:text-brand"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              {copy.common.remove}
            </button>
          </div>

          {isOutOfStock ? (
            <p className="mt-3 rounded-xl bg-brand-soft p-3 text-sm font-semibold text-brand">
              {copy.common.outOfStock}
            </p>
          ) : null}

          <div className="mt-5 grid gap-4 border-t border-border pt-4 sm:grid-cols-[minmax(8rem,0.75fr)_1fr_1fr] sm:items-end">
            <label className="grid gap-1.5 text-sm font-bold text-ink">
              <span>{copy.common.quantity}</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_CART_ITEM_QUANTITY}
                step={1}
                value={item.quantity}
                onChange={(event) =>
                  updateQuantity(item.slug, Number(event.currentTarget.value))
                }
                className="min-h-11 w-full rounded-xl border border-border bg-white px-3 text-ink outline-none focus:border-brand"
              />
            </label>
            <div>
              <p className="text-xs font-semibold text-muted">
                {isBundleOffer ? copy.common.averageUnitPrice : copy.common.unitPrice}
              </p>
              <bdi className="price-value mt-1 block font-bold text-ink">
                {formatTunisianDinars(unitPrice, locale)}
              </bdi>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted">
                {copy.common.lineTotal}
              </p>
              <bdi className="price-value mt-1 block text-lg font-extrabold text-brand">
                {formatTunisianDinars(lineTotal, locale)}
              </bdi>
            </div>
          </div>
        </div>
      </article>
    </li>
  );
}

export function CartPageContent({ locale }: { readonly locale: AppLocale }) {
  const cart = useCart();
  const products = useCartProducts(cart.items, cart.hydrated);
  const copy = commerceCopy[locale];
  const productsHref = locale === "fr" ? "/fr/products" : "/products";
  const checkoutHref = locale === "fr" ? "/fr/checkout" : "/checkout";

  if (!cart.hydrated || products.status === "idle" || products.status === "loading") {
    return (
      <section className="mx-auto min-h-[32rem] max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div
          role="status"
          className="flex min-h-64 items-center justify-center gap-3 rounded-2xl border border-border bg-white text-sm font-bold text-muted"
        >
          <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
          {copy.common.loading}
        </div>
      </section>
    );
  }

  if (products.status === "error") {
    return (
      <section className="mx-auto min-h-[32rem] max-w-3xl px-4 py-12 sm:px-6 lg:py-16">
        <div role="alert" className="rounded-2xl border border-amber-200 bg-white p-7 text-center shadow-card">
          <AlertCircle className="mx-auto size-9 text-amber-700" aria-hidden="true" />
          <h1 className="mt-4 text-2xl font-extrabold">{copy.common.loadErrorTitle}</h1>
          <p className="mt-2 text-sm leading-7 text-muted">{copy.common.loadErrorBody}</p>
          <button
            type="button"
            onClick={products.retry}
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-5 font-bold text-white hover:bg-brand-dark"
          >
            {copy.common.retry}
          </button>
        </div>
      </section>
    );
  }

  if (products.lines.length === 0) {
    return (
      <section className="mx-auto min-h-[32rem] max-w-3xl px-4 py-12 sm:px-6 lg:py-16">
        <div className="rounded-2xl border border-border bg-white p-8 text-center shadow-card sm:p-12">
          <ShoppingBag className="mx-auto size-11 text-brand" aria-hidden="true" />
          <h1 className="mt-5 text-2xl font-extrabold sm:text-3xl">{copy.cart.emptyTitle}</h1>
          <p className="mx-auto mt-3 max-w-lg leading-7 text-muted">{copy.cart.emptyBody}</p>
          <Link
            href={productsHref}
            className="mt-7 inline-flex min-h-12 items-center justify-center rounded-xl bg-brand px-6 font-bold text-white hover:bg-brand-dark"
          >
            {copy.common.browseProducts}
          </Link>
        </div>
      </section>
    );
  }

  const hasUnavailable = products.lines.some(
    ({ product }) => !product || product.availability === "OUT_OF_STOCK",
  );
  const subtotal = products.lines.reduce((total, { item, product }) => {
    if (!product || product.availability === "OUT_OF_STOCK") {
      return total;
    }

    return (
      total +
      getIndicativeLineTotal(
        product.priceMillimes,
        product.priceTiers,
        item.quantity,
      )
    );
  }, 0);

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <div className="max-w-3xl">
        <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-brand">{copy.cart.eyebrow}</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{copy.cart.title}</h1>
        <p className="mt-3 leading-7 text-muted">{copy.cart.description}</p>
      </div>

      <div className="mt-8 grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold text-muted">{copy.cart.itemCount(cart.totalQuantity)}</p>
            <button
              type="button"
              onClick={cart.clearCart}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-muted hover:bg-white hover:text-brand"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              {copy.cart.clear}
            </button>
          </div>
          <ul className="grid gap-4">
            {products.lines.map((line) => (
              <CartLine key={line.item.slug} line={line} locale={locale} />
            ))}
          </ul>
        </div>

        <aside className="rounded-2xl border border-border bg-white p-6 shadow-card lg:sticky lg:top-32">
          <h2 className="text-xl font-extrabold">{copy.cart.summary}</h2>
          <div className="mt-5 flex items-center justify-between gap-4 border-y border-border py-4">
            <span className="font-semibold text-muted">{copy.common.subtotal}</span>
            <bdi className="price-value text-xl font-extrabold text-ink">
              {formatTunisianDinars(subtotal, locale)}
            </bdi>
          </div>
          <p className="mt-4 text-xs leading-6 text-muted">{copy.common.indicativeNotice}</p>

          {hasUnavailable ? (
            <>
              <span
                aria-disabled="true"
                className="mt-5 flex min-h-12 cursor-not-allowed items-center justify-center rounded-xl bg-soft px-4 text-center font-bold text-muted"
              >
                {copy.cart.checkout}
              </span>
              <p className="mt-3 text-sm font-semibold text-brand">{copy.cart.checkoutBlocked}</p>
            </>
          ) : (
            <Link
              href={checkoutHref}
              className="mt-5 flex min-h-12 items-center justify-center rounded-xl bg-brand px-4 text-center font-bold text-white hover:bg-brand-dark"
            >
              {copy.cart.checkout}
            </Link>
          )}
        </aside>
      </div>
    </section>
  );
}
