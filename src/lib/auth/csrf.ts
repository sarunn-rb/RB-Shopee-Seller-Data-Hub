import "server-only";

import { getServerEnv } from "@/lib/env/server";

export class CsrfError extends Error {
  constructor() {
    super("invalid_origin");
    this.name = "CsrfError";
  }
}

export function requireSameOrigin(request: Request): void {
  const expectedOrigin = new URL(getServerEnv().NEXT_PUBLIC_APP_URL).origin;
  const origin = request.headers.get("origin");

  if (!origin || origin !== expectedOrigin) {
    throw new CsrfError();
  }
}
