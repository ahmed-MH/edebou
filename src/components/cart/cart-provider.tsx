"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";

import {
  CART_STORAGE_KEY,
  cartReducer,
  initialCartState,
  parseStoredCart,
  serializeCartItems,
  type CartItem,
} from "./cart-state";

type CartContextValue = {
  readonly items: readonly CartItem[];
  readonly totalQuantity: number;
  readonly hydrated: boolean;
  readonly addItem: (item: CartItem) => void;
  readonly updateQuantity: (slug: string, quantity: number) => void;
  readonly removeItem: (slug: string) => void;
  readonly clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { readonly children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialCartState);

  useEffect(() => {
    dispatch({
      type: "hydrate",
      items: parseStoredCart(window.localStorage.getItem(CART_STORAGE_KEY)),
    });
  }, []);

  useEffect(() => {
    if (!state.hydrated) {
      return;
    }

    try {
      window.localStorage.setItem(
        CART_STORAGE_KEY,
        serializeCartItems(state.items),
      );
    } catch {
      // The in-memory cart remains usable when storage is unavailable.
    }
  }, [state.hydrated, state.items]);

  useEffect(() => {
    const synchronizeTabs = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage || event.key !== CART_STORAGE_KEY) {
        return;
      }

      dispatch({ type: "replace", items: parseStoredCart(event.newValue) });
    };

    window.addEventListener("storage", synchronizeTabs);
    return () => window.removeEventListener("storage", synchronizeTabs);
  }, []);

  const addItem = useCallback((item: CartItem) => {
    dispatch({ type: "add", item });
  }, []);
  const updateQuantity = useCallback((slug: string, quantity: number) => {
    dispatch({ type: "update", slug, quantity });
  }, []);
  const removeItem = useCallback((slug: string) => {
    dispatch({ type: "remove", slug });
  }, []);
  const clearCart = useCallback(() => {
    dispatch({ type: "clear" });
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      items: state.items,
      totalQuantity: state.items.reduce(
        (total, item) => total + item.quantity,
        0,
      ),
      hydrated: state.hydrated,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
    }),
    [
      addItem,
      clearCart,
      removeItem,
      state.hydrated,
      state.items,
      updateQuantity,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used within CartProvider.");
  }

  return context;
}
