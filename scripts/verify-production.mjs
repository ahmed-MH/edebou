import assert from "node:assert/strict";

const baseUrl = new URL(process.argv[2] ?? "http://127.0.0.1:3000");

async function request(pathname, init) {
  return fetch(new URL(pathname, baseUrl), {
    redirect: "manual",
    ...init,
  });
}

function extractNonce(csp) {
  const match = csp.match(/'nonce-([^']+)'/);
  assert.ok(match, "CSP must contain a nonce");
  return match[1];
}

function assertBaselineHeaders(response) {
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(
    response.headers.get("referrer-policy"),
    "strict-origin-when-cross-origin",
  );
  assert.equal(
    response.headers.get("permissions-policy"),
    "browsing-topics=(), camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  );
  assert.equal(response.headers.get("cross-origin-opener-policy"), "same-origin");
  assert.equal(
    response.headers.get("cross-origin-resource-policy"),
    "same-origin",
  );
  assert.equal(response.headers.get("x-dns-prefetch-control"), "off");
  assert.equal(
    response.headers.get("x-permitted-cross-domain-policies"),
    "none",
  );
  assert.equal(response.headers.get("x-powered-by"), null);
}

const rootResponse = await request("/");
assert.equal(rootResponse.status, 200);
assertBaselineHeaders(rootResponse);
const rootHtml = await rootResponse.text();
assert.match(rootHtml, /<html[^>]*lang="ar"[^>]*dir="rtl"/);
assert.match(rootHtml, /كل ما تحتاجه/);

const frenchPreferenceResponse = await request("/", {
  headers: {
    "accept-language": "fr-FR,fr;q=0.9",
    cookie: "NEXT_LOCALE=fr",
  },
});
assert.equal(frenchPreferenceResponse.status, 200);
assert.match(
  await frenchPreferenceResponse.text(),
  /<html[^>]*lang="ar"[^>]*dir="rtl"/,
);

const frenchResponse = await request("/fr");
assert.equal(frenchResponse.status, 200);
assertBaselineHeaders(frenchResponse);
assert.match(
  await frenchResponse.text(),
  /<html[^>]*lang="fr"[^>]*dir="ltr"/,
);

const prefixedArabicResponse = await request("/ar");
assert.ok([301, 302, 307, 308].includes(prefixedArabicResponse.status));
assert.equal(new URL(prefixedArabicResponse.headers.get("location"), baseUrl).pathname, "/");

for (const pathname of ["/admin", "/admin/products", "/admin/orders"]) {
  const response = await request(pathname);
  assert.ok([301, 302, 303, 307, 308].includes(response.status));
  assert.equal(
    new URL(response.headers.get("location"), baseUrl).pathname,
    "/admin/login",
  );
}

const adminLoginResponse = await request("/admin/login");
assert.equal(adminLoginResponse.status, 200);
assertBaselineHeaders(adminLoginResponse);
assert.match(await adminLoginResponse.text(), /Back-office EDebou/);

for (const pathname of ["/admin/anything/nested", "/fr/admin", "/api/admin"]) {
  const response = await request(pathname, { redirect: "follow" });
  assert.equal(response.status, 404, `${pathname} must stay unavailable`);
  assertBaselineHeaders(response);
  const body = await response.text();
  assert.doesNotMatch(body, /admin-shell|admin-sidebar|data-admin/i);
}

const firstResponse = await request("/");
const secondResponse = await request("/");
const firstCsp = firstResponse.headers.get("content-security-policy") ?? "";
const secondCsp = secondResponse.headers.get("content-security-policy") ?? "";
const firstNonce = extractNonce(firstCsp);
const secondNonce = extractNonce(secondCsp);

assert.notEqual(firstNonce, secondNonce, "A nonce must not be reused");
assert.match(firstCsp, /default-src 'self'/);
assert.match(firstCsp, /script-src [^;]*'strict-dynamic'/);
assert.match(firstCsp, /script-src-attr 'none'/);
assert.match(firstCsp, /style-src 'self' 'nonce-[^']+'/);
assert.match(firstCsp, /style-src-attr 'none'/);
assert.match(firstCsp, /img-src 'self' data: blob:/);
assert.match(firstCsp, /object-src 'none'/);
assert.match(firstCsp, /base-uri 'self'/);
assert.match(firstCsp, /form-action 'self'/);
assert.match(firstCsp, /frame-src 'none'/);
assert.match(firstCsp, /frame-ancestors 'none'/);
assert.match(firstCsp, /upgrade-insecure-requests/);
assert.doesNotMatch(
  firstCsp.match(/script-src [^;]*/)?.[0] ?? "",
  /'unsafe-inline'|'unsafe-eval'/,
);
assert.doesNotMatch(
  firstCsp.match(/style-src [^;]*/)?.[0] ?? "",
  /'unsafe-inline'|'unsafe-eval'/,
);
assert.equal(firstResponse.headers.get("cache-control"), "private, no-store");

const firstHtml = await firstResponse.text();
assert.doesNotMatch(
  firstHtml,
  /\sstyle=/i,
  "Rendered markup must not rely on style attributes blocked by the CSP",
);
const scriptTags = firstHtml.match(/<script\b[^>]*>/g) ?? [];
assert.ok(scriptTags.length > 0, "The rendered page should contain framework scripts");

for (const scriptTag of scriptTags) {
  const nonceMatch = scriptTag.match(/\bnonce="([^"]+)"/);
  assert.equal(nonceMatch?.[1], firstNonce, `Unexpected script nonce: ${scriptTag}`);
}

const styleTags = firstHtml.match(/<style\b[^>]*>/g) ?? [];
for (const styleTag of styleTags) {
  const nonceMatch = styleTag.match(/\bnonce="([^"]+)"/);
  assert.equal(nonceMatch?.[1], firstNonce, `Unexpected style nonce: ${styleTag}`);
}

console.log(
  `Production smoke checks passed for ${baseUrl.origin}: locales, protected admin, headers, and fresh CSP nonces.`,
);
