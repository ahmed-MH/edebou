import { type NextRequest, NextResponse } from "next/server";

function createContentSecurityPolicy(nonce: string): string {
  const isDevelopment = process.env.NODE_ENV === "development";

  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${
      isDevelopment ? " 'unsafe-eval'" : ""
    }`,
    "script-src-attr 'none'",
    isDevelopment
      ? "style-src 'self' 'unsafe-inline'"
      : `style-src 'self' 'nonce-${nonce}'`,
    ...(isDevelopment ? [] : ["style-src-attr 'none'"]),
    "img-src 'self' data: blob:",
    "font-src 'self'",
    isDevelopment
      ? "connect-src 'self' ws: wss:"
      : "connect-src 'self'",
    "media-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
  ];

  return directives.join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const contentSecurityPolicy = createContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  const { pathname } = request.nextUrl;
  const isPrefixedArabic = pathname === "/ar" || pathname.startsWith("/ar/");

  if (isPrefixedArabic) {
    const canonicalUrl = request.nextUrl.clone();
    canonicalUrl.pathname = pathname.slice(3) || "/";

    const redirectResponse = NextResponse.redirect(canonicalUrl);
    redirectResponse.headers.set(
      "Content-Security-Policy",
      contentSecurityPolicy,
    );
    redirectResponse.headers.set("Cache-Control", "private, no-store");
    return redirectResponse;
  }

  const locale =
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/fr" ||
    pathname.startsWith("/fr/")
      ? "fr"
      : "ar";

  // Never trust nonce or policy material supplied by the client.
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);
  requestHeaders.set("x-edebou-locale", locale);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  response.headers.set("Cache-Control", "private, no-store");

  return response;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
