import { CsrfError } from "@/lib/auth/csrf";
import { isAuthError } from "@/lib/auth/errors";
import { isShopeeApiError, type ShopeeErrorKind } from "@/lib/shopee/errors";

export type SafeApiError = {
  status: number;
  code: string;
  requestId?: string;
};

const SHOPEE_STATUS: Record<ShopeeErrorKind, number> = {
  authorization_expired: 401,
  permission_denied: 403,
  rate_limited: 429,
  provider_unavailable: 503,
  invalid_provider_response: 502,
  provider_error: 502,
  token_refresh_conflict: 409,
};

export function toSafeApiError(error: unknown): SafeApiError {
  if (isAuthError(error)) return { status: error.status, code: error.code };
  if (error instanceof CsrfError) return { status: 403, code: "invalid_origin" };
  if (isShopeeApiError(error)) {
    return {
      status: SHOPEE_STATUS[error.kind],
      code: error.kind,
      requestId: error.requestId,
    };
  }
  return { status: 500, code: "internal_error" };
}
