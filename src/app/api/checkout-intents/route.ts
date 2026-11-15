import { getCheckoutSecurityConfig } from "@/lib/checkout/config";
import { InvalidCheckoutRequestError } from "@/lib/checkout/errors";
import {
  assertCheckoutRequestSecurity,
  readBoundedCheckoutJson,
  resolveCheckoutClientToken,
} from "@/lib/checkout/request-security";
import {
  checkoutErrorResponse,
  checkoutSuccessResponse,
} from "@/lib/http/checkout-api";
import { checkoutIntentService } from "@/lib/services/checkout-intent-service";
import { parseCheckoutIntent } from "@/lib/validators/checkout-intent";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    if (new URL(request.url).search) {
      throw new InvalidCheckoutRequestError();
    }
    const config = getCheckoutSecurityConfig();
    assertCheckoutRequestSecurity(request, config);
    const clientToken = resolveCheckoutClientToken(
      request,
      config.trustedProxyHops,
    );
    await checkoutIntentService.enforceRateLimit(clientToken);
    const body = await readBoundedCheckoutJson(request);
    const intent = parseCheckoutIntent(body);
    await checkoutIntentService.saveIntent(intent);
    return checkoutSuccessResponse({ saved: true }, false);
  } catch (error) {
    return checkoutErrorResponse(error);
  }
}
