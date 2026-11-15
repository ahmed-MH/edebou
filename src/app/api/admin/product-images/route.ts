import { getAdminPrismaClient } from "@/lib/db/admin-prisma";
import { getOptionalAdminSession } from "@/lib/admin/session";
import {
  deleteUnreferencedProductImage,
  isManagedProductImagePath,
  MAX_PRODUCT_UPLOAD_BODY_BYTES,
  saveProductImages,
} from "@/lib/admin/product-images";
import { isSecureAdminUploadRequest } from "@/lib/admin/upload-request-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function authorize(request: Request) {
  if (!isSecureAdminUploadRequest(request)) return null;
  const identity = await getOptionalAdminSession();
  return identity && identity.role !== "VIEWER" ? identity : null;
}

function privateJson(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  const identity = await authorize(request);
  if (!identity) return privateJson({ error: "UNAUTHORIZED" }, 401);

  const contentType = request.headers.get("content-type") ?? "";
  const contentLength = request.headers.get("content-length");
  if (
    !contentType.toLowerCase().startsWith("multipart/form-data;") ||
    (contentLength !== null &&
      (!/^\d+$/u.test(contentLength) ||
        Number(contentLength) > MAX_PRODUCT_UPLOAD_BODY_BYTES))
  ) {
    return privateJson({ error: "INVALID_UPLOAD" }, 400);
  }

  try {
    const formData = await request.formData();
    const files = formData
      .getAll("images")
      .filter((value): value is File => value instanceof File);
    const images = await saveProductImages(files);
    return privateJson({ images }, 201);
  } catch (error) {
    console.error("Admin product image upload failed.", error);
    return privateJson({ error: "INVALID_UPLOAD" }, 400);
  }
}
export async function DELETE(request: Request): Promise<Response> {
  const identity = await authorize(request);
  if (!identity) return privateJson({ error: "UNAUTHORIZED" }, 401);

  const contentLength = request.headers.get("content-length");
  if (
    contentLength !== null &&
    (!/^\d+$/u.test(contentLength) || Number(contentLength) > 2_048)
  ) {
    return privateJson({ error: "INVALID_REQUEST" }, 400);
  }

  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 2_048) {
      return privateJson({ error: "INVALID_REQUEST" }, 400);
    }
    const value: unknown = JSON.parse(raw);
    const publicPath =
      value &&
      typeof value === "object" &&
      "path" in value &&
      typeof value.path === "string"
        ? value.path
        : "";
    if (!isManagedProductImagePath(publicPath)) {
      return privateJson({ error: "INVALID_REQUEST" }, 400);
    }
    const references = await getAdminPrismaClient().productImage.count({
      where: { path: publicPath },
    });
    if (references > 0) {
      return privateJson({ error: "IMAGE_IN_USE" }, 409);
    }
    await deleteUnreferencedProductImage(publicPath);
    return new Response(null, {
      status: 204,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Admin staged product image deletion failed.", error);
    return privateJson({ error: "INVALID_REQUEST" }, 400);
  }
}
