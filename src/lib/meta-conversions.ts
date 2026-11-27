import "server-only";

import { isIP } from "node:net";

import { siteConfig } from "@/config/site";

// Graph API versions stay supported about two years; bump when Meta deprecates it.
const GRAPH_API_VERSION = "v23.0";

export interface PurchaseEventInput {
  readonly orderNumber: string;
  readonly totalMillimes: number;
  readonly items: readonly { readonly productSlug: string; readonly quantity: number }[];
  readonly clientIp: string;
  readonly userAgent: string | null;
  readonly sourceUrl: string | null;
  readonly cookieHeader: string | null;
}

function readCookie(header: string | null, name: string): string | undefined {
  return header
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

/**
 * Server-side twin of the browser Pixel "Purchase". Same event_id (the order
 * number) so Meta counts the sale once. No name, phone or address is sent:
 * only what Meta needs to match a browser (IP, user agent, _fbp/_fbc cookies).
 */
export function buildPurchaseEvent(input: PurchaseEventInput, nowMs = Date.now()) {
  const fbp = readCookie(input.cookieHeader, "_fbp");
  const fbc = readCookie(input.cookieHeader, "_fbc");
  return {
    event_name: "Purchase",
    event_time: Math.floor(nowMs / 1000),
    event_id: input.orderNumber,
    action_source: "website",
    ...(input.sourceUrl ? { event_source_url: input.sourceUrl } : {}),
    user_data: {
      ...(isIP(input.clientIp) ? { client_ip_address: input.clientIp } : {}),
      ...(input.userAgent ? { client_user_agent: input.userAgent } : {}),
      ...(fbp ? { fbp } : {}),
      ...(fbc ? { fbc } : {}),
    },
    custom_data: {
      currency: "TND",
      value: input.totalMillimes / 1000,
      content_type: "product",
      content_ids: input.items.map((item) => item.productSlug),
      num_items: input.items.reduce((sum, item) => sum + item.quantity, 0),
    },
  };
}

/** Sends the Purchase to Meta. Never throws: a Meta outage must not affect orders. */
export async function sendMetaPurchase(input: PurchaseEventInput): Promise<void> {
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN?.trim();
  if (!accessToken || !siteConfig.metaPixelId) return;
  const testEventCode = process.env.META_CAPI_TEST_EVENT_CODE?.trim();

  try {
    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${siteConfig.metaPixelId}/events`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Token in the body, not the URL, so it never lands in proxy or access logs.
        body: JSON.stringify({
          data: [buildPurchaseEvent(input)],
          access_token: accessToken,
          ...(testEventCode ? { test_event_code: testEventCode } : {}),
        }),
        signal: AbortSignal.timeout(5_000),
      },
    );
    if (!response.ok) {
      console.error(
        "Meta Conversions API rejected Purchase.",
        response.status,
        (await response.text()).slice(0, 500),
      );
    }
  } catch (error) {
    console.error(
      "Meta Conversions API Purchase failed.",
      error instanceof Error ? error.message : "unknown error",
    );
  }
}
