import { beforeEach, describe, expect, it, vi } from "vitest";

const stateStore = vi.hoisted(() => ({ value: undefined as Record<string, unknown> | undefined }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env/server", () => ({
  getServerEnv: () => ({
    SHOPEE_ENV: "sandbox",
    SHOPEE_PARTNER_ID: "1",
    SHOPEE_PARTNER_KEY: "key",
    SHOPEE_REDIRECT_URI: "https://app.example.com/api/shopee/callback",
  }),
}));
vi.mock("@/lib/firebase/admin", () => ({
  getFirebaseAdminFirestore: () => ({
    collection: () => ({ doc: () => ({}) }),
    runTransaction: async (callback: (transaction: unknown) => Promise<unknown>) => callback({
      get: async () => ({ exists: Boolean(stateStore.value), data: () => stateStore.value }),
      delete: () => { stateStore.value = undefined; },
    }),
  }),
}));

import { consumeOAuthState, isSafeInternalReturnTo } from "@/lib/shopee/oauth";

describe("Shopee OAuth state", () => {
  const auth = { uid: "user-1", email: "admin@example.com", role: "admin" as const, organizationId: "rabbit-bytes" };

  beforeEach(() => {
    stateStore.value = {
      state: "a".repeat(64),
      userId: auth.uid,
      organizationId: auth.organizationId,
      environment: "sandbox",
      returnTo: "/connections",
      createdAt: new Date("2026-08-24T00:00:00Z"),
      expiresAt: new Date(Date.now() + 60_000),
    };
  });

  it("consumes a valid state once and rejects replay", async () => {
    await expect(consumeOAuthState("a".repeat(64), auth)).resolves.toMatchObject({ userId: auth.uid });
    await expect(consumeOAuthState("a".repeat(64), auth)).rejects.toThrow("invalid_oauth_state");
  });

  it("rejects protocol-relative and backslash return paths", () => {
    expect(isSafeInternalReturnTo("/connections")).toBe(true);
    expect(isSafeInternalReturnTo("//evil.example")).toBe(false);
    expect(isSafeInternalReturnTo("/\\evil.example")).toBe(false);
  });
});
