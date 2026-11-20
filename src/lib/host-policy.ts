const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export interface AppOrigins {
  readonly publicOrigin: string;
  readonly adminOrigin: string;
}

export interface AppHosts {
  readonly publicHost: string;
  readonly adminHost: string;
  readonly wwwHost: string;
}

export type RequestSurface =
  | "combined-development"
  | "public"
  | "public-www"
  | "admin"
  | "internal-health"
  | "unknown";

function parseConfiguredOrigin(
  name: "PUBLIC_APP_ORIGIN" | "ADMIN_APP_ORIGIN",
  value: string | undefined,
  fallback: string,
): string {
  const candidate = value?.trim() || fallback;
  let url: URL;

  try {
    url = new URL(candidate);
  } catch {
    throw new Error(`${name}_INVALID`);
  }

  const isLocalDevelopmentOrigin =
    process.env.NODE_ENV !== "production" &&
    url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    (url.protocol !== "https:" && !isLocalDevelopmentOrigin)
  ) {
    throw new Error(`${name}_INVALID`);
  }

  return url.origin;
}

export function getAppOrigins(): AppOrigins {
  return {
    publicOrigin: parseConfiguredOrigin(
      "PUBLIC_APP_ORIGIN",
      process.env.PUBLIC_APP_ORIGIN,
      "http://localhost:3000",
    ),
    adminOrigin: parseConfiguredOrigin(
      "ADMIN_APP_ORIGIN",
      process.env.ADMIN_APP_ORIGIN,
      "http://localhost:3000",
    ),
  };
}

export function getAppHosts(origins = getAppOrigins()): AppHosts {
  const publicHost = new URL(origins.publicOrigin).host.toLowerCase();
  return {
    publicHost,
    adminHost: new URL(origins.adminOrigin).host.toLowerCase(),
    wwwHost: `www.${publicHost}`,
  };
}

export function normalizeForwardedHost(value: string | null): string | null {
  if (!value || value.includes(",") || /[\s/@\\]/u.test(value)) return null;

  const normalized = value.toLowerCase().replace(/\.$/u, "");
  try {
    const parsed = new URL(`http://${normalized}`);
    if (parsed.host !== normalized || !parsed.hostname) return null;
  } catch {
    return null;
  }
  return normalized;
}

export function isInternalHealthPath(pathname: string): boolean {
  return pathname === "/api/health/live" || pathname === "/api/health/ready";
}

export function isAdminPath(pathname: string): boolean {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/api/admin" ||
    pathname.startsWith("/api/admin/")
  );
}

export function isAllowedAdminSurfacePath(pathname: string): boolean {
  return (
    isAdminPath(pathname) ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/brand/") ||
    pathname.startsWith("/api/product-images/") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.png" ||
    pathname === "/robots.txt"
  );
}

export function classifyRequestSurface(
  rawHost: string | null,
  pathname: string,
  hosts: AppHosts,
): RequestSurface {
  const host = normalizeForwardedHost(rawHost);
  if (!host) return "unknown";
  if (hosts.publicHost === hosts.adminHost && host === hosts.publicHost) {
    return "combined-development";
  }
  if (host === hosts.publicHost) return "public";
  if (host === hosts.wwwHost) return "public-www";
  if (host === hosts.adminHost) return "admin";

  const hostname = host.startsWith("[")
    ? host.slice(0, host.indexOf("]") + 1)
    : host.split(":", 1)[0];
  if (
    isInternalHealthPath(pathname) &&
    (LOCAL_HOSTS.has(hostname) || hostname === "app")
  ) {
    return "internal-health";
  }
  return "unknown";
}
