import { readProductImage } from "@/lib/admin/product-images";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { readonly params: Promise<{ readonly filename: string }> },
): Promise<Response> {
  const { filename } = await context.params;
  const image = await readProductImage(filename);
  if (!image) {
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "public, max-age=60" },
    });
  }

  return new Response(new Uint8Array(image), {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": "image/webp",
      "Content-Length": String(image.byteLength),
      "X-Content-Type-Options": "nosniff",
    },
  });
}
