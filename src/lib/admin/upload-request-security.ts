import "server-only";

import { isSecureAdminMutationHeaders } from "@/lib/admin/request-security";
import { getAppOrigins } from "@/lib/host-policy";

export const ADMIN_UPLOAD_CSRF_HEADER = "x-edebou-admin-csrf";
export const ADMIN_UPLOAD_CSRF_VALUE = "1";

export function isSecureAdminUploadRequest(request: Request): boolean {
  return (
    isSecureAdminMutationHeaders(
      request.headers,
      getAppOrigins().adminOrigin,
    ) &&
    request.headers.get(ADMIN_UPLOAD_CSRF_HEADER) === ADMIN_UPLOAD_CSRF_VALUE
  );
}
