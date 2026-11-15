import { z } from "zod";

import type { PublicProductPriceTierDto } from "@/lib/dto/catalog";

export const CART_STORAGE_KEY = "edebou.cart.v1";
export const MAX_CART_LINES = 20;
export const MAX_CART_ITEM_QUANTITY = 100;

const productSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const cartItemSchema = z
  .object({
    slug: productSlugSchema,
    quantity: z.number().int().min(1).max(MAX_CART_ITEM_QUANTITY),
  })
  .strict();

export type CartItem = z.infer<typeof cartItemSchema>;

export type CartState = {
  readonly items: readonly CartItem[];
  readonly hydrated: boolean;
};

export type CartAction =
  | { readonly type: "hydrate"; readonly items: readonly CartItem[] }
  | { readonly type: "replace"; readonly items: readonly CartItem[] }
  | { readonly type: "add"; readonly item: CartItem }
  | { readonly type: "update"; readonly slug: string; readonly quantity: number }
  | { readonly type: "remove"; readonly slug: string }
  | { readonly type: "clear" };

export const initialCartState: CartState = {
  items: [],
  hydrated: false,
};

function normalizeCartItems(items: readonly unknown[]): CartItem[] {
  const normalized = new Map<string, CartItem>();

  for (const candidate of items) {
    const result = cartItemSchema.safeParse(candidate);

    if (!result.success || normalized.has(result.data.slug)) {
      continue;
    }

    normalized.set(result.data.slug, result.data);

    if (normalized.size === MAX_CART_LINES) {
      break;
    }
  }

  return [...normalized.values()];
}

export function parseStoredCart(rawValue: string | null): CartItem[] {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(rawValue);
    return Array.isArray(parsed) ? normalizeCartItems(parsed) : [];
  } catch {
    return [];
  }
}

export function serializeCartItems(items: readonly CartItem[]): string {
  return JSON.stringify(
    normalizeCartItems(items).map(({ slug, quantity }) => ({ slug, quantity })),
  );
}

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "hydrate":
      return {
        hydrated: true,
        items: normalizeCartItems(action.items),
      };
    case "replace":
      return state.hydrated
        ? { ...state, items: normalizeCartItems(action.items) }
        : state;
    case "add": {
      const parsedItem = cartItemSchema.safeParse(action.item);

      if (!parsedItem.success) {
        return state;
      }

      const existingIndex = state.items.findIndex(
        (item) => item.slug === parsedItem.data.slug,
      );

      if (existingIndex >= 0) {
        const current = state.items[existingIndex];
        const nextQuantity = Math.min(
          MAX_CART_ITEM_QUANTITY,
          current.quantity + parsedItem.data.quantity,
        );

        if (nextQuantity === current.quantity) {
          return state;
        }

        return {
          ...state,
          items: state.items.map((item, index) =>
            index === existingIndex ? { ...item, quantity: nextQuantity } : item,
          ),
        };
      }

      if (state.items.length >= MAX_CART_LINES) {
        return state;
      }

      return { ...state, items: [...state.items, parsedItem.data] };
    }
    case "update": {
      if (
        !Number.isInteger(action.quantity) ||
        action.quantity < 1 ||
        action.quantity > MAX_CART_ITEM_QUANTITY
      ) {
        return state;
      }

      return {
        ...state,
        items: state.items.map((item) =>
          item.slug === action.slug
            ? { ...item, quantity: action.quantity }
            : item,
        ),
      };
    }
    case "remove":
      return {
        ...state,
        items: state.items.filter((item) => item.slug !== action.slug),
      };
    case "clear":
      return state.items.length === 0 ? state : { ...state, items: [] };
  }
}

export function getIndicativeUnitPrice(
  basePriceMillimes: number,
  priceTiers: readonly PublicProductPriceTierDto[],
  quantity: number,
): number {
  let unitPrice = basePriceMillimes;
  let selectedMinimum = 1;

  for (const tier of priceTiers) {
    if (tier.minQuantity <= quantity && tier.minQuantity > selectedMinimum) {
      unitPrice = tier.unitPriceMillimes;
      selectedMinimum = tier.minQuantity;
    }
  }

  return unitPrice;
}

export function createIdempotencyKey(): string {
  if (typeof globalThis.crypto?.randomUUID !== "function") {
    throw new Error("Secure random UUID generation is unavailable.");
  }

  return globalThis.crypto.randomUUID();
}
