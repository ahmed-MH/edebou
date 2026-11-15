"use client";

import { useCallback, useEffect, useState } from "react";

import type { PublicProductDetailDto } from "@/lib/dto/catalog";

import type { CartItem } from "./cart-state";
import { fetchCartProduct } from "./catalog-client";

export type ValidatedCartLine = {
  readonly item: CartItem;
  readonly product: PublicProductDetailDto | null;
};

type CartProductsState =
  | { readonly status: "idle"; readonly lines: readonly [] }
  | { readonly status: "loading"; readonly lines: readonly [] }
  | { readonly status: "error"; readonly lines: readonly []; readonly error: Error }
  | { readonly status: "ready"; readonly lines: readonly ValidatedCartLine[] };

type SettledCartProductsState =
  | {
      readonly requestKey: string;
      readonly status: "error";
      readonly lines: readonly [];
      readonly error: Error;
    }
  | {
      readonly requestKey: string;
      readonly status: "ready";
      readonly lines: readonly ValidatedCartLine[];
    };

export function useCartProducts(
  items: readonly CartItem[],
  hydrated: boolean,
): CartProductsState & { readonly retry: () => void } {
  const [state, setState] = useState<SettledCartProductsState | null>(null);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  const requestKey = `${attempt}:${items
    .map(({ slug, quantity }) => `${slug}:${quantity}`)
    .join("|")}`;

  useEffect(() => {
    if (!hydrated || items.length === 0) {
      return;
    }

    const controller = new AbortController();

    Promise.all(
      items.map(async (item) => ({
        item,
        product: await fetchCartProduct(item.slug, controller.signal),
      })),
    )
      .then((lines) =>
        setState({ requestKey, status: "ready", lines }),
      )
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setState({
          requestKey,
          status: "error",
          lines: [],
          error: error instanceof Error ? error : new Error("Catalog failure"),
        });
      });

    return () => controller.abort();
  }, [hydrated, items, requestKey]);

  let current: CartProductsState;
  if (!hydrated) {
    current = { status: "idle", lines: [] };
  } else if (items.length === 0) {
    current = { status: "ready", lines: [] };
  } else if (!state || state.requestKey !== requestKey) {
    current = { status: "loading", lines: [] };
  } else {
    current = state;
  }

  return { ...current, retry };
}
