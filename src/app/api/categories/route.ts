import { publicApiErrorResponse, publicJsonResponse } from "@/lib/http/public-api";
import { catalogService } from "@/lib/services";
import { parseEmptyQuery } from "@/lib/validators/catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  try {
    parseEmptyQuery(new URL(request.url).searchParams);
    const categories = await catalogService.listCategories();
    return publicJsonResponse(categories);
  } catch (error) {
    return publicApiErrorResponse(error, "list-categories");
  }
}
