export type AuthErrorCode = "unauthenticated" | "forbidden" | "membership_required";

export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    public readonly status: 401 | 403,
  ) {
    super(code);
    this.name = "AuthError";
  }
}

export function isAuthError(value: unknown): value is AuthError {
  return value instanceof AuthError;
}
