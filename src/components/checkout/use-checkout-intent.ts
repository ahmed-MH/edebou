"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

import type { AppLocale } from "@/i18n/routing";

import { checkoutPhoneSchema } from "./checkout-form-schema";

const STORAGE_KEY = "edebou:checkout-intent-token";
const SAVE_DELAY_MS = 900;

type IntentItem = {
  readonly productSlug: string;
  readonly quantity: number;
};

type IntentCustomer = {
  readonly fullName: string;
  readonly phone: string;
  readonly governorate: string;
  readonly address: string;
};

function getOrCreateIntentToken(): string {
  const current = window.sessionStorage.getItem(STORAGE_KEY);
  if (current) return current;

  const token = window.crypto.randomUUID();
  window.sessionStorage.setItem(STORAGE_KEY, token);
  return token;
}

export function useCheckoutIntentTracking({
  customer,
  items,
  locale,
  source,
}: {
  readonly customer: IntentCustomer;
  readonly items: readonly IntentItem[];
  readonly locale: AppLocale;
  readonly source: "PRODUCT" | "CHECKOUT";
}) {
  const tokenRef = useRef<string | null>(null);
  const lastSavedFingerprintRef = useRef<string | null>(null);
  const phoneResult = checkoutPhoneSchema.safeParse(customer.phone);
  const normalizedPhone = phoneResult.success ? phoneResult.data : null;
  const itemsFingerprint = useMemo(() => JSON.stringify(items), [items]);

  useEffect(() => {
    if (!normalizedPhone || items.length === 0) return;

    const token = tokenRef.current ?? getOrCreateIntentToken();
    tokenRef.current = token;
    const payload = {
      token,
      locale,
      source,
      customer: {
        fullName: customer.fullName || undefined,
        phone: normalizedPhone,
        governorate: customer.governorate || undefined,
        address: customer.address || undefined,
      },
      items: JSON.parse(itemsFingerprint) as IntentItem[],
    };
    const fingerprint = JSON.stringify(payload);
    if (lastSavedFingerprintRef.current === fingerprint) return;

    const timeout = window.setTimeout(() => {
      void fetch("/api/checkout-intents", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-EDebou-CSRF": "1",
        },
        credentials: "same-origin",
        cache: "no-store",
        body: fingerprint,
      })
        .then((response) => {
          if (response.ok) lastSavedFingerprintRef.current = fingerprint;
        })
        .catch(() => {
          // This assistance feature must never block the customer's order.
        });
    }, SAVE_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [
    customer.address,
    customer.fullName,
    customer.governorate,
    items.length,
    itemsFingerprint,
    locale,
    normalizedPhone,
    source,
  ]);

  const getToken = useCallback(() => tokenRef.current ?? undefined, []);
  const complete = useCallback(() => {
    tokenRef.current = null;
    lastSavedFingerprintRef.current = null;
    window.sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  return { complete, getToken } as const;
}
