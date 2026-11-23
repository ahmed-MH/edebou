"use client";

import {
  CheckCircle2,
  LoaderCircle,
  Map as MapIcon,
  MapPin,
  Phone,
  ShoppingBag,
  Truck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import { commerceCopy } from "@/components/cart/commerce-copy";
import { createIdempotencyKey } from "@/components/cart/cart-state";
import {
  checkoutFormSchema,
  type CheckoutCustomer,
} from "@/components/checkout/checkout-form-schema";
import {
  buildOrderItems,
  createOrder,
  CreateOrderError,
  type CreateOrderPayload,
  type OrderConfirmation,
} from "@/components/checkout/order-client";
import { getGovernorates } from "@/components/checkout/tunisia-governorates";
import { useCheckoutIntentTracking } from "@/components/checkout/use-checkout-intent";
import type { AppLocale } from "@/i18n/routing";
import { formatTunisianDinars } from "@/lib/format-currency";

type FormField = "fullName" | "phone" | "governorate" | "address";
type FormState = Record<FormField, string>;
type FormErrors = Partial<Record<FormField, string>>;

const emptyForm: FormState = {
  fullName: "",
  phone: "",
  governorate: "",
  address: "",
};

function RequiredFieldLabel({ label }: { readonly label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm font-bold text-ink">
      <span>{label}</span>
      <span className="text-brand" aria-hidden="true">
        *
      </span>
    </span>
  );
}

function DirectOrderField({
  field,
  label,
  value,
  placeholder,
  error,
  icon: Icon,
  autoComplete,
  inputMode,
  maxLength,
  onChange,
}: {
  readonly field: "fullName" | "phone";
  readonly label: string;
  readonly value: string;
  readonly placeholder: string;
  readonly error?: string;
  readonly icon: LucideIcon;
  readonly autoComplete: string;
  readonly inputMode?: "text" | "tel";
  readonly maxLength: number;
  readonly onChange: (field: FormField, value: string) => void;
}) {
  const id = `direct-order-${field}`;
  const descriptionId = `${id}-description`;

  return (
    <label className="grid gap-1.5 text-sm font-bold text-ink" htmlFor={id}>
      <RequiredFieldLabel label={label} />
      <span className="flex min-h-14 overflow-hidden rounded-xl border border-border bg-white shadow-sm transition-colors focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/10">
        <span className="inline-flex w-14 shrink-0 items-center justify-center border-e border-border bg-soft text-ink">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <input
          id={id}
          name={field}
          required
          type={field === "phone" ? "tel" : "text"}
          inputMode={inputMode}
          autoComplete={autoComplete}
          maxLength={maxLength}
          value={value}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? descriptionId : undefined}
          onChange={(event) => onChange(field, event.currentTarget.value)}
          className="min-w-0 flex-1 bg-transparent px-4 text-start font-normal text-ink outline-none placeholder:text-muted/70"
        />
      </span>
      {error ? (
        <span
          id={descriptionId}
          className="text-xs font-semibold text-brand"
        >
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function ProductDirectOrderForm({
  availability,
  callUsLabel,
  contactPhone,
  deliveryFeeMillimes,
  locale,
  orderNowLabel,
  productName,
  quantity,
  selectionControls,
  slug,
  subtotalMillimes,
}: {
  readonly availability: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  readonly callUsLabel: string;
  readonly contactPhone: string | null;
  readonly deliveryFeeMillimes: number | null;
  readonly locale: AppLocale;
  readonly orderNowLabel: string;
  readonly productName: string;
  readonly quantity: number;
  readonly selectionControls: ReactNode;
  readonly slug: string;
  readonly subtotalMillimes: number;
}) {
  const copy = commerceCopy[locale];
  const governorates = getGovernorates(locale);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<OrderConfirmation | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const confirmationRef = useRef<HTMLElement>(null);
  const submitErrorRef = useRef<HTMLDivElement>(null);
  const attemptRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const pendingRef = useRef(false);
  const totalMillimes =
    deliveryFeeMillimes === null
      ? null
      : subtotalMillimes + deliveryFeeMillimes;
  const isOutOfStock = availability === "OUT_OF_STOCK";
  const isFormComplete = Object.values(form).every(
    (value) => value.trim().length > 0,
  );
  const intentTracking = useCheckoutIntentTracking({
    customer: form,
    items: [{ productSlug: slug, quantity }],
    locale,
    source: "PRODUCT",
  });

  useEffect(() => {
    if (confirmation) {
      confirmationRef.current?.focus({ preventScroll: true });
      confirmationRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [confirmation]);

  useEffect(() => {
    if (submitError) {
      submitErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [submitError]);

  const updateField = (field: FormField, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (pendingRef.current || isOutOfStock || deliveryFeeMillimes === null) {
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
            copy.checkout.validation[
              field as keyof typeof copy.checkout.validation
            ];
        }
      }
      setErrors(nextErrors);
      const firstInvalidField = validated.error.issues[0]?.path[0];
      if (typeof firstInvalidField === "string" && firstInvalidField in emptyForm) {
        const control = formRef.current?.elements.namedItem(firstInvalidField);
        if (control instanceof HTMLElement) {
          control.focus();
        }
      }
      return;
    }

    const customer: CheckoutCustomer = validated.data;
    const requestWithoutKey = {
      locale,
      customer,
      items: buildOrderItems([{ slug, quantity }]),
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
    } catch (error) {
      const code = error instanceof CreateOrderError ? error.code : "UNKNOWN";
      setSubmitError(copy.checkout.errors[code]);
    } finally {
      pendingRef.current = false;
      setSubmitting(false);
    }
  };

  if (confirmation) {
    return (
      <section
        id="direct-order"
        ref={confirmationRef}
        tabIndex={-1}
        aria-live="polite"
        className="scroll-mt-24 border-t border-ink/70 pt-7"
      >
        <CheckCircle2 className="size-9 text-emerald-600" aria-hidden="true" />
        <p className="mt-4 text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-700">
          {copy.checkout.successEyebrow}
        </p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-ink">
          {copy.checkout.successTitle}
        </h2>
        <dl className="mt-5 grid gap-3 border-y border-border py-4 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="font-semibold text-muted">{copy.checkout.orderNumber}</dt>
            <dd className="font-mono font-extrabold text-ink" dir="ltr">
              {confirmation.orderNumber}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="font-semibold text-muted">{copy.checkout.successTotal}</dt>
            <dd>
              <bdi className="price-value text-lg font-extrabold text-brand">
                {formatTunisianDinars(confirmation.totalMillimes, locale)}
              </bdi>
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-sm font-bold text-ink">
          {copy.checkout.successPayment}
        </p>
        <p className="mt-2 text-xs leading-6 text-muted">
          {copy.checkout.successPrivacy}
        </p>
      </section>
    );
  }

  return (
    <>
    <section id="direct-order" className="scroll-mt-24 rounded-xl border border-border bg-white p-4 shadow-sm sm:p-6">
      <p className="text-sm font-bold text-brand">
        {copy.checkout.directOrderEyebrow}
      </p>
      <h2 className="mt-1 text-2xl font-black tracking-tight text-ink">
        {copy.checkout.directOrderTitle}
      </h2>
      <p className="mt-2 text-base leading-7 text-muted">
        {copy.checkout.directOrderDescription}
      </p>

      <form id="product-direct-order-form" ref={formRef} noValidate onSubmit={handleSubmit} className="mt-6 grid gap-5">
        <DirectOrderField
          field="fullName"
          label={copy.checkout.fields.fullName}
          placeholder={copy.checkout.fields.fullNamePlaceholder}
          value={form.fullName}
          error={errors.fullName}
          icon={UserRound}
          autoComplete="name"
          maxLength={120}
          onChange={updateField}
        />
        <DirectOrderField
          field="phone"
          label={copy.checkout.fields.phone}
          placeholder={copy.checkout.fields.phonePlaceholder}
          value={form.phone}
          error={errors.phone}
          icon={Phone}
          autoComplete="tel"
          inputMode="tel"
          maxLength={32}
          onChange={updateField}
        />

        <label
          htmlFor="direct-order-governorate"
          className="grid gap-1.5 text-sm font-bold text-ink"
        >
          <RequiredFieldLabel label={copy.checkout.fields.governorate} />
          <span className="flex min-h-14 overflow-hidden rounded-xl border border-border bg-white shadow-sm transition-colors focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/10">
            <span className="inline-flex w-14 shrink-0 items-center justify-center border-e border-border bg-soft text-ink">
              <MapIcon className="size-5" aria-hidden="true" />
            </span>
            <select
              id="direct-order-governorate"
              name="governorate"
              required
              autoComplete="address-level1"
              value={form.governorate}
              aria-invalid={Boolean(errors.governorate)}
              aria-describedby={
                errors.governorate
                  ? "direct-order-governorate-error"
                  : undefined
              }
              onChange={(event) =>
                updateField("governorate", event.currentTarget.value)
              }
              className="min-w-0 flex-1 bg-transparent px-4 text-start font-normal text-ink outline-none"
            >
              <option value="">{copy.checkout.fields.governoratePlaceholder}</option>
              {governorates.map(({ code, label }) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </span>
          {errors.governorate ? (
            <span
              id="direct-order-governorate-error"
              className="text-xs font-semibold text-brand"
            >
              {errors.governorate}
            </span>
          ) : null}
        </label>

        <label
          htmlFor="direct-order-address"
          className="grid gap-1.5 text-sm font-bold text-ink"
        >
          <RequiredFieldLabel label={copy.checkout.fields.address} />
          <span className="flex min-h-14 overflow-hidden rounded-xl border border-border bg-white shadow-sm transition-colors focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/10">
            <span className="inline-flex w-14 shrink-0 items-center justify-center border-e border-border bg-soft text-ink">
              <MapPin className="size-5" aria-hidden="true" />
            </span>
            <input
              id="direct-order-address"
              name="address"
              required
              type="text"
              autoComplete="street-address"
              maxLength={300}
              value={form.address}
              placeholder={copy.checkout.fields.addressPlaceholder}
              aria-invalid={Boolean(errors.address)}
              aria-describedby={
                errors.address ? "direct-order-address-error" : undefined
              }
              onChange={(event) =>
                updateField("address", event.currentTarget.value)
              }
              className="min-w-0 flex-1 bg-transparent px-4 text-start font-normal text-ink outline-none placeholder:text-muted/70"
            />
          </span>
          {errors.address ? (
            <span
              id="direct-order-address-error"
              className="text-xs font-semibold text-brand"
            >
              {errors.address}
            </span>
          ) : null}
        </label>

        {selectionControls}

        <fieldset className="border border-emerald-200 bg-emerald-50 p-4">
          <legend className="px-1 text-sm font-extrabold text-ink">
            {copy.checkout.paymentTitle}
          </legend>
          <label className="flex items-start gap-3">
            <input
              type="radio"
              name="directPaymentMethod"
              value="cash-on-delivery"
              checked
              readOnly
              className="mt-1 accent-[var(--brand)]"
            />
            <span>
              <strong className="block text-sm text-ink">
                {copy.checkout.cashOnDelivery}
              </strong>
              <span className="mt-1 block text-xs leading-5 text-muted">
                {copy.checkout.cashOnDeliveryHelp}
              </span>
            </span>
          </label>
        </fieldset>

        <p className="text-xs leading-5 text-muted">
          {copy.checkout.draftPrivacyNotice}
        </p>

        <div className="border-y border-border py-4">
          <p className="font-bold text-ink">{productName}</p>
          <p className="mt-1 text-sm text-muted">
            {copy.common.quantity} × {quantity}
          </p>
          <dl className="mt-4 grid gap-2 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="font-semibold text-muted">{copy.common.subtotal}</dt>
              <dd>
                <bdi className="price-value font-bold text-ink">
                  {formatTunisianDinars(subtotalMillimes, locale)}
                </bdi>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="flex items-center gap-2 font-semibold text-muted">
                <Truck className="size-4" aria-hidden="true" />
                {copy.checkout.deliveryFee}
              </dt>
              <dd>
                {deliveryFeeMillimes === null ? (
                  "—"
                ) : (
                  <bdi className="price-value font-bold text-ink">
                    {formatTunisianDinars(deliveryFeeMillimes, locale)}
                  </bdi>
                )}
              </dd>
            </div>
            <div className="mt-1 flex items-center justify-between gap-4 border-t border-border pt-3">
              <dt className="font-extrabold text-ink">{copy.checkout.total}</dt>
              <dd>
                {totalMillimes === null ? (
                  "—"
                ) : (
                  <bdi className="price-value text-lg font-black text-brand">
                    {formatTunisianDinars(totalMillimes, locale)}
                  </bdi>
                )}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs leading-5 text-muted">
            {copy.common.indicativeNotice}
          </p>
        </div>

        {isOutOfStock ? (
          <div role="alert" className="bg-brand-soft p-3 text-sm font-bold text-brand">
            {copy.common.outOfStock}
          </div>
        ) : null}

        {deliveryFeeMillimes === null ? (
          <div role="alert" className="bg-amber-50 p-3 text-sm font-bold text-amber-900">
            {copy.checkout.errors.SERVICE_UNAVAILABLE}
          </div>
        ) : null}

        {submitError ? (
          <div
            ref={submitErrorRef}
            role="alert"
            aria-live="assertive"
            className="bg-brand-soft p-3 text-sm font-bold text-brand"
          >
            {submitError}
          </div>
        ) : null}
      </form>
    </section>
    {!isOutOfStock ? (
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_30px_rgb(17_24_39/10%)] backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center">
          {isFormComplete ? (
            <button
              type="submit"
              form="product-direct-order-form"
              disabled={submitting || deliveryFeeMillimes === null}
              className="order-cta-attract inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-sm bg-brand px-5 text-sm font-extrabold uppercase tracking-[0.12em] text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-muted"
            >
              {submitting ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : null}
              <span aria-live="polite">{submitting ? copy.checkout.submitting : copy.checkout.submit}</span>
            </button>
          ) : (
            <a
              href="#direct-order"
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-center text-base font-bold text-white hover:bg-brand-dark"
            >
              <ShoppingBag className="size-5" aria-hidden="true" />
              {orderNowLabel}
            </a>
          )}
          {contactPhone ? (
            <a
              href={`tel:${contactPhone}`}
              aria-label={callUsLabel}
              className="ms-3 inline-flex size-12 shrink-0 items-center justify-center rounded-xl border border-brand text-brand hover:bg-brand-soft"
            >
              <Phone className="size-6" aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </div>
    ) : null}
    </>
  );
}
