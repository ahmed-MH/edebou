import assert from "node:assert/strict";
import test from "node:test";

import { isSecureAdminMutationHeaders } from "../src/lib/admin/request-security";
import {
  classifyRequestSurface,
  getAppHosts,
  isAdminPath,
  isAllowedAdminSurfacePath,
  normalizeForwardedHost,
} from "../src/lib/host-policy";

const origins = {
  publicOrigin: "https://edebou.live",
  adminOrigin: "https://admin.edebou.live",
};
const hosts = getAppHosts(origins);

test("host policy separates storefront, canonical www and administration", () => {
  assert.equal(classifyRequestSurface("edebou.live", "/", hosts), "public");
  assert.equal(
    classifyRequestSurface("www.edebou.live", "/fr/products", hosts),
    "public-www",
  );
  assert.equal(
    classifyRequestSurface("admin.edebou.live", "/admin", hosts),
    "admin",
  );
  assert.equal(
    classifyRequestSurface("attacker.example", "/admin", hosts),
    "unknown",
  );
  assert.equal(
    classifyRequestSurface("app:3000", "/api/health/ready", hosts),
    "internal-health",
  );
  assert.equal(classifyRequestSurface("app:3000", "/admin", hosts), "unknown");
});

test("only admin pages, APIs and required assets exist on the admin surface", () => {
  assert.equal(isAdminPath("/admin/login"), true);
  assert.equal(isAdminPath("/api/admin/product-images"), true);
  assert.equal(isAdminPath("/api/orders"), false);
  assert.equal(isAllowedAdminSurfacePath("/admin/products"), true);
  assert.equal(isAllowedAdminSurfacePath("/_next/static/app.js"), true);
  assert.equal(isAllowedAdminSurfacePath("/api/product-images/image.webp"), true);
  assert.equal(isAllowedAdminSurfacePath("/products/example"), false);
  assert.equal(isAllowedAdminSurfacePath("/api/orders"), false);
});

test("admin mutations require exact same-origin and proxy host", () => {
  const safeHeaders = new Headers({
    Origin: origins.adminOrigin,
    Host: "app:3000",
    "X-Forwarded-Host": "admin.edebou.live",
    "Sec-Fetch-Site": "same-origin",
  });
  assert.equal(
    isSecureAdminMutationHeaders(safeHeaders, origins.adminOrigin),
    true,
  );

  for (const unsafeHeaders of [
    new Headers({
      Origin: origins.publicOrigin,
      "X-Forwarded-Host": "admin.edebou.live",
    }),
    new Headers({
      Origin: origins.adminOrigin,
      "X-Forwarded-Host": "edebou.live",
    }),
    new Headers({
      Origin: origins.adminOrigin,
      "X-Forwarded-Host": "admin.edebou.live, attacker.example",
    }),
    new Headers({
      Origin: origins.adminOrigin,
      "X-Forwarded-Host": "admin.edebou.live",
      "Sec-Fetch-Site": "cross-site",
    }),
  ]) {
    assert.equal(
      isSecureAdminMutationHeaders(unsafeHeaders, origins.adminOrigin),
      false,
    );
  }
});

test("forwarded host parser rejects ambiguous and malformed values", () => {
  assert.equal(normalizeForwardedHost("ADMIN.EDEBOU.LIVE"), "admin.edebou.live");
  assert.equal(normalizeForwardedHost("admin.edebou.live, attacker.test"), null);
  assert.equal(normalizeForwardedHost("admin.edebou.live/path"), null);
  assert.equal(normalizeForwardedHost(null), null);
});
