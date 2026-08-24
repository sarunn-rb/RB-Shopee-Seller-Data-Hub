import { describe, expect, it, vi } from "vitest";

import {
  createTokenRefreshCoordinator,
  type TokenCredentialRecord,
  type TokenRefreshStore,
} from "@/lib/shopee/token-refresh";

const encrypted = (value: string) => ({ ciphertext: value, iv: "iv", authTag: "tag" });

function fakeStore(initial: TokenCredentialRecord) {
  let record = structuredClone(initial);
  let reauthorizationRequired = false;
  const store: TokenRefreshStore = {
    async acquireLease(input) {
      if (!input.forceRefresh && record.accessTokenExpiresAt > input.now + input.expiryBufferSeconds) {
        return { kind: "token", credential: structuredClone(record) };
      }
      if (record.refreshLease && record.refreshLease.ownerId !== input.ownerId && record.refreshLease.expiresAt > input.now) {
        return { kind: "wait", expectedTokenVersion: record.refreshLease.expectedTokenVersion, leaseExpiresAt: record.refreshLease.expiresAt };
      }
      record.refreshLease = { ownerId: input.ownerId, expectedTokenVersion: record.tokenVersion, expiresAt: input.leaseExpiresAt };
      return { kind: "lease", credential: structuredClone(record), ownerId: input.ownerId, expectedTokenVersion: record.tokenVersion };
    },
    async commitRotation(input) {
      if (record.tokenVersion > input.expectedTokenVersion) return { kind: "newer", credential: structuredClone(record) };
      record = {
        accessToken: input.accessToken,
        refreshToken: input.refreshToken,
        accessTokenExpiresAt: input.accessTokenExpiresAt,
        refreshTokenExpiresAt: input.refreshTokenExpiresAt,
        tokenVersion: record.tokenVersion + 1,
      };
      return { kind: "committed", credential: structuredClone(record) };
    },
    async releaseLease(input) {
      if (record.refreshLease?.ownerId === input.ownerId) delete record.refreshLease;
      reauthorizationRequired = input.reauthorizationRequired;
    },
  };
  return { store, getRecord: () => record, reauthorizationRequired: () => reauthorizationRequired };
}

function coordinator(store: TokenRefreshStore, refreshProvider: () => Promise<{ accessToken: string; refreshToken: string; expiresIn: number }>, ids = ["owner-a"]) {
  return createTokenRefreshCoordinator({
    store,
    refreshProvider,
    encrypt: encrypted,
    decrypt: (value) => value.ciphertext,
    isPermanentRefreshFailure: (error) => error instanceof Error && error.message === "refresh_token_expired",
    errorCode: (error) => error instanceof Error ? error.message : "unknown",
    now: () => 1_000,
    sleep: async () => { await Promise.resolve(); },
    makeLeaseId: () => ids.shift() ?? "owner-extra",
    waitIntervalMilliseconds: 1,
    maxWaitMilliseconds: 50,
  });
}

describe("rotating Shopee tokens", () => {
  const initial = (): TokenCredentialRecord => ({
    accessToken: encrypted("old-access"),
    refreshToken: encrypted("old-refresh"),
    accessTokenExpiresAt: 900,
    refreshTokenExpiresAt: 2_000,
    tokenVersion: 3,
  });

  it("returns a sufficiently valid token without refreshing", async () => {
    const state = fakeStore({ ...initial(), accessTokenExpiresAt: 5_000 });
    const refresh = vi.fn();
    await expect(coordinator(state.store, refresh)({ connectionId: "c1", shopId: 1 })).resolves.toBe("old-access");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("rotates both tokens and increments the version", async () => {
    const state = fakeStore(initial());
    const refresh = vi.fn(async () => ({ accessToken: "new-access", refreshToken: "new-refresh", expiresIn: 3_600 }));
    await expect(coordinator(state.store, refresh)({ connectionId: "c1", shopId: 1 })).resolves.toBe("new-access");
    expect(state.getRecord()).toMatchObject({ tokenVersion: 4, accessToken: encrypted("new-access"), refreshToken: encrypted("new-refresh") });
  });

  it("recovers an expired refresh lease", async () => {
    const state = fakeStore({
      ...initial(),
      refreshLease: { ownerId: "dead-owner", expectedTokenVersion: 3, expiresAt: 999 },
    });
    const refresh = vi.fn(async () => ({ accessToken: "recovered", refreshToken: "rotated", expiresIn: 3_600 }));
    await expect(coordinator(state.store, refresh)({ connectionId: "c1", shopId: 1 })).resolves.toBe("recovered");
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(state.getRecord().refreshLease).toBeUndefined();
  });

  it("uses a newer token when transaction B observes a higher tokenVersion", async () => {
    const newer = { ...initial(), accessToken: encrypted("winner-access"), tokenVersion: 4, accessTokenExpiresAt: 4_000 };
    const store: TokenRefreshStore = {
      acquireLease: async () => ({ kind: "lease", credential: initial(), ownerId: "owner-a", expectedTokenVersion: 3 }),
      commitRotation: async () => ({ kind: "newer", credential: newer }),
      releaseLease: vi.fn(),
    };
    const refresh = vi.fn(async () => ({ accessToken: "loser-access", refreshToken: "loser-refresh", expiresIn: 3_600 }));
    await expect(coordinator(store, refresh)({ connectionId: "c1", shopId: 1 })).resolves.toBe("winner-access");
  });

  it("allows only one provider refresh during a concurrent forced-refresh race", async () => {
    const state = fakeStore(initial());
    const refresh = vi.fn(async () => {
      await Promise.resolve();
      return { accessToken: "race-access", refreshToken: "race-refresh", expiresIn: 3_600 };
    });
    const getToken = coordinator(state.store, refresh, ["owner-a", "owner-b"]);
    const tokens = await Promise.all([
      getToken({ connectionId: "c1", shopId: 1, forceRefresh: true }),
      getToken({ connectionId: "c1", shopId: 1, forceRefresh: true }),
    ]);
    expect(tokens).toEqual(["race-access", "race-access"]);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(state.getRecord().tokenVersion).toBe(4);
  });

  it("marks reauthorization only for a permanent refresh failure", async () => {
    const state = fakeStore(initial());
    const getToken = coordinator(state.store, async () => { throw new Error("refresh_token_expired"); });
    await expect(getToken({ connectionId: "c1", shopId: 1 })).rejects.toThrow("refresh_token_expired");
    expect(state.reauthorizationRequired()).toBe(true);
  });

  it("does not mark a transient refresh failure as reauthorization required", async () => {
    const state = fakeStore(initial());
    const getToken = coordinator(state.store, async () => { throw new Error("network_error"); });
    await expect(getToken({ connectionId: "c1", shopId: 1 })).rejects.toThrow("network_error");
    expect(state.reauthorizationRequired()).toBe(false);
  });
});
