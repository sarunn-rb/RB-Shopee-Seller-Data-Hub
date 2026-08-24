import type { EncryptedData, RefreshLease } from "@/types/firestore";

export type TokenCredentialRecord = {
  accessToken: EncryptedData;
  refreshToken: EncryptedData;
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt?: number;
  tokenVersion: number;
  refreshLease?: RefreshLease;
};

export type AcquireLeaseResult =
  | { kind: "token"; credential: TokenCredentialRecord }
  | { kind: "wait"; expectedTokenVersion: number; leaseExpiresAt: number }
  | {
      kind: "lease";
      credential: TokenCredentialRecord;
      ownerId: string;
      expectedTokenVersion: number;
    };

export type RotationResult =
  | { kind: "committed"; credential: TokenCredentialRecord }
  | { kind: "newer"; credential: TokenCredentialRecord };

export interface TokenRefreshStore {
  acquireLease(input: {
    connectionId: string;
    ownerId: string;
    now: number;
    leaseExpiresAt: number;
    expiryBufferSeconds: number;
    forceRefresh: boolean;
  }): Promise<AcquireLeaseResult>;
  commitRotation(input: {
    connectionId: string;
    ownerId: string;
    expectedTokenVersion: number;
    accessToken: EncryptedData;
    refreshToken: EncryptedData;
    accessTokenExpiresAt: number;
    refreshTokenExpiresAt: number;
  }): Promise<RotationResult>;
  releaseLease(input: {
    connectionId: string;
    ownerId: string;
    expectedTokenVersion: number;
    errorCode: string;
    reauthorizationRequired: boolean;
  }): Promise<void>;
}

export type RefreshProviderResult = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

export type TokenRefreshCoordinatorDependencies = {
  store: TokenRefreshStore;
  refreshProvider: (input: { shopId: number; refreshToken: string }) => Promise<RefreshProviderResult>;
  encrypt: (value: string) => EncryptedData;
  decrypt: (value: EncryptedData) => string;
  isPermanentRefreshFailure: (error: unknown) => boolean;
  errorCode: (error: unknown) => string;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  makeLeaseId?: () => string;
  expiryBufferSeconds?: number;
  leaseSeconds?: number;
  waitIntervalMilliseconds?: number;
  maxWaitMilliseconds?: number;
};

export function createTokenRefreshCoordinator(dependencies: TokenRefreshCoordinatorDependencies) {
  const now = dependencies.now ?? (() => Math.floor(Date.now() / 1_000));
  const sleep = dependencies.sleep ?? ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const makeLeaseId = dependencies.makeLeaseId ?? (() => crypto.randomUUID());
  const expiryBufferSeconds = dependencies.expiryBufferSeconds ?? 30 * 60;
  const leaseSeconds = dependencies.leaseSeconds ?? 30;
  const waitIntervalMilliseconds = dependencies.waitIntervalMilliseconds ?? 250;
  const maxWaitMilliseconds = dependencies.maxWaitMilliseconds ?? 20_000;

  return async function getAccessToken(input: {
    connectionId: string;
    shopId: number;
    forceRefresh?: boolean;
  }): Promise<string> {
    const ownerId = makeLeaseId();
    let waitedMilliseconds = 0;
    let forceRefresh = input.forceRefresh ?? false;

    while (waitedMilliseconds <= maxWaitMilliseconds) {
      const nowSeconds = now();
      const decision = await dependencies.store.acquireLease({
        connectionId: input.connectionId,
        ownerId,
        now: nowSeconds,
        leaseExpiresAt: nowSeconds + leaseSeconds,
        expiryBufferSeconds,
        forceRefresh,
      });

      if (decision.kind === "token") {
        return dependencies.decrypt(decision.credential.accessToken);
      }
      if (decision.kind === "wait") {
        await sleep(waitIntervalMilliseconds);
        waitedMilliseconds += waitIntervalMilliseconds;
        // A concurrent request owns the refresh. Accept its newer valid token
        // on the next read; if it failed, normal expiry logic acquires the lease.
        forceRefresh = false;
        continue;
      }

      try {
        const refreshed = await dependencies.refreshProvider({
          shopId: input.shopId,
          refreshToken: dependencies.decrypt(decision.credential.refreshToken),
        });
        const refreshedAt = now();
        const rotation = await dependencies.store.commitRotation({
          connectionId: input.connectionId,
          ownerId: decision.ownerId,
          expectedTokenVersion: decision.expectedTokenVersion,
          accessToken: dependencies.encrypt(refreshed.accessToken),
          refreshToken: dependencies.encrypt(refreshed.refreshToken),
          accessTokenExpiresAt: refreshedAt + refreshed.expiresIn,
          refreshTokenExpiresAt: refreshedAt + 30 * 24 * 60 * 60,
        });

        return dependencies.decrypt(rotation.credential.accessToken);
      } catch (error) {
        await dependencies.store.releaseLease({
          connectionId: input.connectionId,
          ownerId: decision.ownerId,
          expectedTokenVersion: decision.expectedTokenVersion,
          errorCode: dependencies.errorCode(error),
          reauthorizationRequired: dependencies.isPermanentRefreshFailure(error),
        });
        throw error;
      }
    }

    throw new Error("token_refresh_wait_timeout");
  };
}
