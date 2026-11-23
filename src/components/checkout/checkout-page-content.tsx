"use client";

import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  ShoppingBag,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";

import type { AppLocale } from "@/i18n/routing";
import { formatTunisianDinars } from "@/lib/format-currency";

import { commerceCopy } from "../cart/commerce-copy";
import { useCart } from "../cart/cart-provider";
import { createIdempotencyKey, getIndicativeLineTotal } from "../cart/cart-state";
import { useCartProducts } from "../cart/use-cart-products";
import {
  checkoutFormSchema,
  type CheckoutCustomer,
} from "./checkout-form-schema";
import {
  buildOrderItems,
  createOrder,
  CreateOrderError,
  type CreateOrderPayload,
  type OrderConfirmation,
} from "./order-client";
import { getGovernorates } from "./tunisia-governorates";
import { useCheckoutIntentTracking } from "./use-checkout-intent";

type FormField = "fullName" | "phone" | "governorate" | "address";
type FormState = Record<FormField, string>;
type FormErrors = Partial<Record<FormField, string>>;

const emptyForm: FormState = {
  fullName: "",
  phone: "",
  governorate: "",
  address: "",
};

function TextField({
  id,
  label,
  value,
  placeholder,
  error,
  help,
  autoComplete,
  inputMode,
  maxLength,
  onChange,
}: {
  readonly id: FormField;
  readonly label: string;
  readonly value: string;
  readonly placeholder: string;
  readonly error?: string;
  readonly help?: string;
  readonly autoComplete: string;
  readonly inputMode?: "text" | "tel";
  readonly maxLength: number;
  readonly onChange: (field: FormField, value: string) => void;
}) {
  const descriptionId = `${id}-description`;

  return (
    <label className="grid gap-1.5 font-bold text-ink" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        name={id}
        type={id === "phone" ? "tel" : "text"}
        inputMode={inputMode}
        autoComplete={autoComplete}
        maxLength={maxLength}
        value={value}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={help || error ? descriptionId : undefined}
        onChange={(event) => onChange(id, event.currentTarget.value)}
        className="min-h-12 rounded-xl border border-border bg-white px-4 font-normal text-ink outline-none placeholder:text-muted/70 focus:border-brand"
      />
      {error || help ? (
        <span
          id={descriptionId}
          className={`text-xs font-semibold ${error ? "text-brand" : "text-muted"}`}
        >
          {error ?? help}
        </span>
      ) : null}
    </label>
  );
}

function Confirmation({
  locale,
  confirmation,
}: {
  readonly locale: AppLocale;
  readonly confirmation: OrderConfirmation;
}) {
  const copy = commerceCopy[locale].checkout;
  const productsHref = locale === "fr" ? "/fr/products" : "/products";

  return (
    <section className="mx-auto min-h-[35rem] max-w-3xl px-4 py-12 sm:px-6 lg:py-16">
      <div className="rounded-3xl border border-emerald-200 bg-white p-7 text-center shadow-card sm:p-11">
        <CheckCircle2 className="mx-auto size-12 text-emerald-600" aria-hidden="true" />
        <p className="mt-5 text-sm font-extrabold uppercase tracking-[0.16em] text-emerald-700">
          {copy.successEyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">{copy.successTitle}</h1>
        <dl className="mx-auto mt-8 grid max-w-md gap-4 rounded-2xl bg-soft p-5 text-start">
          <div className="flex items-center justify-between gap-4">
            <dt className="font-semibold text-muted">{copy.orderNumber}</dt>
            <dd className="font-mono text-base font-extrabold text-ink" dir="ltr">
              {confirmation.orderNumber}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
            <dt className="font-semibold text-muted">{copy.successTotal}</dt>
            <dd>
              <bdi className="price-value text-xl font-extrabold text-brand">
                {formatTunisianDinars(confirmation.totalMillimes, locale)}
              </bdi>
            </dd>
          </div>
        </dl>
        <p className="mt-6 font-bold text-ink">{copy.successPayment}</p>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-muted">{copy.successPrivacy}</p>
        <Link
          href={productsHref}
          className="mt-7 inline-flex min-h-12 items-center justify-center rounded-xl bg-brand px-6 font-bold text-white hover:bg-brand-dark"
        >
          {copy.continueShopping}
        </Link>
      </div>
    </section>
  );
}

export function CheckoutPageContent({
  locale,
  deliveryFeeMillimes,
}: {
  readonly locale: AppLocale;
  readonly deliveryFeeMillimes: number | null;
}) {
  const cart = useCart();
  const products = useCartProducts(cart.items, cart.hydrated);
  const copy = commerceCopy[locale];
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<OrderConfirmation | null>(null);
  const attemptRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const pendingRef = useRef(false);
  const cartHref = locale === "fr" ? "/fr/cart" : "/cart";
  const productsHref = locale === "fr" ? "/fr/products" : "/products";
  const governorates = getGovernorates(locale);
  const orderItems = buildOrderItems(cart.items);
  const intentTracking = useCheckoutIntentTracking({
    customer: form,
    items: orderItems,
    locale,
    source: "CHECKOUT",
  });

  const updateField = (field: FormField, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError(null);
  };

  if (confirmation) {
    return <Confirmation locale={locale} confirmation={confirmation} />;
  }

  if (!cart.hydrated || products.status === "idle" || products.status === "loading") {
    return (
      <section className="mx-auto min-h-[32rem] max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div role="status" className="flex min-h-64 items-center justify-center gap-3 rounded-2xl border border-border bg-white font-bold text-muted">
          <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
          {copy.common.loading}
        </div>
      </section>
    );
  }

  if (products.status === "error") {
    return (
      <section className="mx-auto min-h-[32rem] max-w-3xl px-4 py-12 sm:px-6">
        <div role="alert" className="rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-card">
          <AlertCircle className="mx-auto size-9 text-amber-700" aria-hidden="true" />
          <h1 className="mt-4 text-2xl font-extrabold">{copy.common.loadErrorTitle}</h1>
          <p className="mt-2 text-sm leading-7 text-muted">{copy.common.loadErrorBody}</p>
          <button type="button" onClick={products.retry} className="mt-6 min-h-11 rounded-xl bg-brand px-5 font-bold text-white hover:bg-brand-dark">
            {copy.common.retry}
          </button>
        </div>
      </section>
    );
  }

  if (products.lines.length === 0) {
    return (
      <section className="mx-auto min-h-[32rem] max-w-3xl px-4 py-12 sm:px-6">
        <div className="rounded-2xl border border-border bg-white p-9 text-center shadow-card">
          <ShoppingBag className="mx-auto size-11 text-brand" aria-hidden="true" />
          <h1 className="mt-5 text-2xl font-extrabold">{copy.checkout.emptyTitle}</h1>
          <p className="mt-3 leading-7 text-muted">{copy.checkout.emptyBody}</p>
          <Link href={productsHref} className="mt-7 inline-flex min-h-12 items-center rounded-xl bg-brand px-6 font-bold text-white hover:bg-brand-dark">
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
  const total =
    deliveryFeeMillimes === null ? null : subtotal + deliveryFeeMillimes;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (pendingRef.current || hasUnavailable || deliveryFeeMillimes === null) {
      return;
    }

    const validated = checkoutFormSchema.safeParse(form);
    if (!validated.success) {
      const nextErrors: FormErrors = {};
      for (const issue of validated.error.issues) {
        const field = issue.path[0];
        if (
          typeof field === "string" &&
          field in copy.checkout.validation &&
          !(field in nextErrors)
        ) {
          nextErrors[field as FormField] =
            copy.checkout.validation[field as keyof typeof copy.checkout.validation];
        }
      }
      setErrors(nextErrors);
      return;
    }

    const customer: CheckoutCustomer = validated.data;
    const requestWithoutKey = {
      locale,
      customer,
      items: buildOrderItems(cart.items),
    } as const;
    const fingerprint = JSON.stringify(requestWithoutKey);
    const existingAttempt = attemptRef.current;
    const idempotencyKey =
      existingAttempt?.fingerprint === fingerprint
        ? existingAttempt.key
        : createIdempotencyKey();
    attemptRef.current = { fingerprint, key: idempotencyKey };

    const payload: CreateOrderPayload = {
      idempotencyKey,
      checkoutIntentToken: intentTracking.getToken(),
      ...requestWithoutKey,
    };

    pendingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const result = await createOrder(payload);
      setConfirmation(result);
      setForm(emptyForm);
      setErrors({});
      attemptRef.current = null;
      intentTracking.complete();
      cart.clearCart();
    } catch (error) {
      const code = error instanceof CreateOrderError ? error.code : "UNKNOWN";
      setSubmitError(copy.checkout.errors[code]);
    } finally {
      pendingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <div className="max-w-3xl">
        <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-brand">{copy.checkout.eyebrow}</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{copy.checkout.title}</h1>
        <p className="mt-3 leading-7 text-muted">{copy.checkout.description}</p>
      </div>

      <div className="mt-8 grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <form noValidate onSubmit={handleSubmit} className="rounded-2xl border border-border bg-white p-5 shadow-card sm:p-7">
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              id="fullName"
              label={copy.checkout.fields.fullName}
              placeholder={copy.checkout.fields.fullNamePlaceholder}
              value={form.fullName}
              error={errors.fullName}
              autoComplete="name"
              maxLength={120}
              onChange={updateField}
            />
            <TextField
              id="phone"
              label={copy.checkout.fields.phone}
              placeholder={copy.checkout.fields.phonePlaceholder}
              value={form.phone}
              error={errors.phone}
              help={copy.checkout.fields.phoneHelp}
              autoComplete="tel"
              inputMode="tel"
              maxLength={32}
              onChange={updateField}
            />
          </div>

          <label htmlFor="governorate" className="mt-5 grid gap-1.5 font-bold text-ink">
            <span>{copy.checkout.fields.governorate}</span>
            <select
              id="governorate"
              name="governorate"
              autoComplete="address-level1"
              value={form.governorate}
              aria-invalid={Boolean(errors.governorate)}
              aria-describedby={errors.governorate ? "governorate-error" : undefined}
              onChange={(event) => updateField("governorate", event.currentTarget.value)}
              className="min-h-12 rounded-xl border border-border bg-white px-4 font-normal text-ink outline-none focus:border-brand"
            >
              <option value="">{copy.checkout.fields.governoratePlaceholder}</option>
              {governorates.map(({ code, label }) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
            {errors.governorate ? (
              <span id="governorate-error" className="text-xs font-semibold text-brand">{errors.governorate}</span>
            ) : null}
          </label>

          <label htmlFor="address" className="mt-5 grid gap-1.5 font-bold text-ink">
            <span>{copy.checkout.fields.address}</span>
            <textarea
              id="address"
              name="address"
              rows={4}
              autoComplete="street-address"
              maxLength={300}
              value={form.address}
              placeholder={copy.checkout.fields.addressPlaceholder}
              aria-invalid={Boolean(errors.address)}
              aria-describedby={errors.address ? "address-error" : undefined}
              onChange={(event) => updateField("address", event.currentTarget.value)}
              className="rounded-xl border border-border bg-white px-4 py-3 font-normal text-ink outline-none placeholder:text-muted/70 focus:border-brand"
            />
            {errors.address ? <span id="address-error" className="text-xs font-semibold text-brand">{errors.address}</span> : null}
          </label>

          <fieldset className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <legend className="px-1 font-extrabold text-ink">{copy.checkout.paymentTitle}</legend>
            <label className="mt-1 flex items-start gap-3">
              <input type="radio" name="paymentMethod" value="cash-on-delivery" checked readOnly className="mt-1 accent-[var(--brand)]" />
              <span>
                <strong className="block text-ink">{copy.checkout.cashOnDelivery}</strong>
                <span className="mt-1 block text-sm leading-6 text-muted">{copy.checkout.cashOnDeliveryHelp}</span>
              </span>
            </label>
          </fieldset>

          <p className="mt-3 text-xs leading-5 text-muted">
            {copy.checkout.draftPrivacyNotice}
          </p>

          {hasUnavailable ? (
            <div role="alert" className="mt-5 rounded-xl bg-brand-soft p-4 text-sm font-bold text-brand">
              {copy.checkout.unavailableCart} <Link href={cartHref} className="underline">{copy.checkout.backToCart}</Link>
            </div>
          ) : null}

          {deliveryFeeMillimes === null ? (
            <div role="alert" className="mt-5 rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-900">
              {copy.checkout.errors.SERVICE_UNAVAILABLE}
            </div>
          ) : null}

          {submitError ? (
            <div role="alert" aria-live="assertive" className="mt-5 rounded-xl bg-brand-soft p-4 text-sm font-bold text-brand">
              {submitError}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting || hasUnavailable || deliveryFeeMillimes === null}
            className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 font-extrabold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-muted"
          >
            {submitting ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : null}
            {submitting ? copy.checkout.submitting : copy.checkout.submit}
          </button>
        </form>

        <aside className="rounded-2xl border border-border bg-white p-6 shadow-card lg:sticky lg:top-32">
          <h2 className="text-xl font-extrabold">{copy.checkout.summary}</h2>
          <ul className="mt-5 grid gap-3 border-b border-border pb-5">
            {products.lines.map(({ item, product }) => (
              <li key={item.slug} className="flex items-start justify-between gap-4 text-sm">
                <span className="min-w-0 text-muted">
                  <span className="font-semibold text-ink">{product?.name[locale] ?? item.slug}</span>
                  <span className="block">× {item.quantity}</span>
                </span>
                {product ? (
                  <bdi className="price-value shrink-0 font-bold text-ink">
                    {formatTunisianDinars(
                      getIndicativeLineTotal(product.priceMillimes, product.priceTiers, item.quantity),
                      locale,
                    )}
                  </bdi>
                ) : null}
              </li>
            ))}
          </ul>
          <dl className="mt-5 grid gap-3">
            <div className="flex items-center justify-between gap-4">
              <dt className="font-semibold text-muted">{copy.common.subtotal}</dt>
              <dd><bdi className="price-value font-bold">{formatTunisianDinars(subtotal, locale)}</bdi></dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="flex items-center gap-2 font-semibold text-muted"><Truck className="size-4" aria-hidden="true" />{copy.checkout.deliveryFee}</dt>
              <dd>
                {deliveryFeeMillimes === null ? "—" : (
                  <bdi className="price-value font-bold">{formatTunisianDinars(deliveryFeeMillimes, locale)}</bdi>
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
              <dt className="text-lg font-extrabold">{copy.checkout.total}</dt>
              <dd>
                {total === null ? "—" : (
                  <bdi className="price-value text-xl font-black text-brand">{formatTunisianDinars(total, locale)}</bdi>
                )}
              </dd>
            </div>
          </dl>
          <p className="mt-5 text-xs leading-6 text-muted">{copy.common.indicativeNotice}</p>
          <Link href={cartHref} className="mt-4 inline-flex min-h-11 items-center font-bold text-brand hover:underline">
            {copy.checkout.backToCart}
          </Link>
        </aside>
      </div>
    </section>
  );
}
