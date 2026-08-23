import { describe, expect, it } from "vitest";

import { parseClientEnv, parseServerEnv } from "../../src/lib/env/schema";

const validServerEnv = {
  APP_ENV: "staging",
  NEXT_PUBLIC_APP_URL: "https://staging.example.com",
  SHOPEE_ENV: "sandbox",
  SHOPEE_PARTNER_ID: "123456",
  SHOPEE_PARTNER_KEY: "sandbox-partner-key",
  SHOPEE_REDIRECT_URI: "https://staging.example.com/api/shopee/callback",
  TOKEN_ENCRYPTION_KEY: "a".repeat(64),
  FIREBASE_ADMIN_PROJECT_ID: "rabbit-bytes-staging",
  FIREBASE_ADMIN_CLIENT_EMAIL: "firebase@example.com",
  FIREBASE_ADMIN_PRIVATE_KEY: "private-key-placeholder",
  SESSION_COOKIE_NAME: "rb_session",
} as const;

describe("environment parsing", () => {
  it("accepts a complete Sandbox staging configuration", () => {
    expect(parseServerEnv(validServerEnv).SHOPEE_ENV).toBe("sandbox");
  });

  it("rejects Sandbox credentials in production", () => {
    expect(() =>
      parseServerEnv({ ...validServerEnv, APP_ENV: "production" }),
    ).toThrow("Production APP_ENV must use production Shopee credentials.");
  });

  it("rejects a redirect URI outside the configured app origin", () => {
    expect(() =>
      parseServerEnv({
        ...validServerEnv,
        SHOPEE_REDIRECT_URI: "https://attacker.example/api/shopee/callback",
      }),
    ).toThrow("SHOPEE_REDIRECT_URI must use NEXT_PUBLIC_APP_URL as its origin.");
  });

  it("rejects a deceptive redirect URI with a matching prefix", () => {
    expect(() =>
      parseServerEnv({
        ...validServerEnv,
        SHOPEE_REDIRECT_URI:
          "https://staging.example.com.attacker.example/api/shopee/callback",
      }),
    ).toThrow("SHOPEE_REDIRECT_URI must use NEXT_PUBLIC_APP_URL as its origin.");
  });

  it("requires all public Firebase client identifiers", () => {
    expect(() =>
      parseClientEnv({
        NEXT_PUBLIC_FIREBASE_API_KEY: "public-api-key",
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "example.firebaseapp.com",
      }),
    ).toThrow();
  });
});
