export type ShopeeErrorKind =
  | "authorization_expired"
  | "permission_denied"
  | "rate_limited"
  | "provider_unavailable"
  | "invalid_provider_response"
  | "provider_error"
  | "token_refresh_conflict";

export type ShopeeApiErrorOptions = {
  kind: ShopeeErrorKind;
  endpointName: string;
  errorCode?: string;
  requestId?: string;
  httpStatus?: number;
  retryable?: boolean;
  reauthorizationRequired?: boolean;
};

export class ShopeeApiError extends Error {
  readonly kind: ShopeeErrorKind;
  readonly endpointName: string;
  readonly errorCode?: string;
  readonly requestId?: string;
  readonly httpStatus?: number;
  readonly retryable: boolean;
  readonly reauthorizationRequired: boolean;

  constructor(options: ShopeeApiErrorOptions) {
    super(options.kind);
    this.name = "ShopeeApiError";
    this.kind = options.kind;
    this.endpointName = options.endpointName;
    this.errorCode = options.errorCode;
    this.requestId = options.requestId;
    this.httpStatus = options.httpStatus;
    this.retryable = options.retryable ?? false;
    this.reauthorizationRequired = options.reauthorizationRequired ?? false;
  }
}

export function isShopeeApiError(value: unknown): value is ShopeeApiError {
  return value instanceof ShopeeApiError;
}

export function toSafeShopeeErrorCode(error: unknown): ShopeeErrorKind {
  return isShopeeApiError(error) ? error.kind : "provider_unavailable";
}
