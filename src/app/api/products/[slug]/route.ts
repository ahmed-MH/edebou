import { publicApiErrorResponse, publicJsonResponse } from "@/lib/http/public-api";
import { catalogService } from "@/lib/services";
import {
  parseEmptyQuery,
  parseProductSlug,
} from "@/lib/validators/catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ProductRouteContext {
  readonly params: Promise<{ readonly slug: string }>;
}

export async function GET(
  request: Request,
  context: ProductRouteContext,
): Promise<Response> {
  try {
    parseEmptyQuery(new URL(request.url).searchParams);
    const { slug: rawSlug } = await context.params;
    const slug = parseProductSlug(rawSlug);
    const product = await catalogService.getProductBySlug(slug);
    return publicJsonResponse(product);
  } catch (error) {
    return publicApiErrorResponse(error, "get-product");
  }
}
