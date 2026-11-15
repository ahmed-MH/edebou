import { publicApiErrorResponse, publicJsonResponse } from "@/lib/http/public-api";
import { catalogService } from "@/lib/services";
import { parseProductListQuery } from "@/lib/validators/catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  try {
    const query = parseProductListQuery(new URL(request.url).searchParams);
    const products = await catalogService.listProducts(query);
    return publicJsonResponse(products);
  } catch (error) {
    return publicApiErrorResponse(error, "list-products");
  }
}
