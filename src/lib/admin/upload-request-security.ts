import "server-only";

export const ADMIN_UPLOAD_CSRF_HEADER = "x-edebou-admin-csrf";
export const ADMIN_UPLOAD_CSRF_VALUE = "1";

export function isSecureAdminUploadRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin || origin.includes(",")) return false;

  let targetOrigin: string;
  try {
    targetOrigin = new URL(request.url).origin;
    if (new URL(origin).origin !== origin) return false;
  } catch {
    return false;
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  return (
    origin === targetOrigin &&
    (fetchSite === null || fetchSite === "same-origin") &&
    request.headers.get(ADMIN_UPLOAD_CSRF_HEADER) === ADMIN_UPLOAD_CSRF_VALUE
  );
}
