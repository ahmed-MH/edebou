"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  loaded: boolean;
  version: string;
  push: unknown;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

/**
 * Sends a standard Meta event. Never pass customer data (name, phone, address):
 * only product ids, quantities and amounts.
 */
export function trackMetaEvent(
  name: "ViewContent" | "InitiateCheckout" | "Purchase",
  params: Record<string, unknown>,
  eventId?: string,
): void {
  window.fbq?.("track", name, params, eventId ? { eventID: eventId } : undefined);
}

/** Millimes → TND for Meta's `value` field. */
export const toMetaValue = (millimes: number): number => millimes / 1000;

/**
 * Meta Pixel for the storefront (never on /admin). Same behaviour as Meta's
 * copy-paste snippet, written as a bundled script because the CSP forbids inline
 * scripts; 'strict-dynamic' then allows the fbevents.js it loads.
 */
export function MetaPixel({ pixelId }: { readonly pixelId: string }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");

  useEffect(() => {
    if (isAdmin || window.fbq) return;
    const queue: unknown[][] = [];
    const fbq = ((...args: unknown[]) => {
      if (fbq.callMethod) fbq.callMethod(...args);
      else queue.push(args);
    }) as Fbq;
    fbq.queue = queue;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    window.fbq = fbq;
    window._fbq ??= fbq;

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);
    fbq("init", pixelId);
  }, [isAdmin, pixelId]);

  // One PageView per page, including client-side navigations.
  useEffect(() => {
    if (!isAdmin) window.fbq?.("track", "PageView");
  }, [isAdmin, pathname]);

  return null;
}
