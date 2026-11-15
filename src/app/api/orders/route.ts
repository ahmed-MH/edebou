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
import { orderService } from "@/lib/services/order-service";
import { parseOrderRequest } from "@/lib/validators/order";

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
    await orderService.enforceRateLimit(clientToken);

    const body = await readBoundedCheckoutJson(request);
    const orderRequest = parseOrderRequest(body);
    const result = await orderService.createOrder(orderRequest);

    return checkoutSuccessResponse(result.confirmation, result.replayed);
  } catch (error) {
    return checkoutErrorResponse(error);
  }
}
