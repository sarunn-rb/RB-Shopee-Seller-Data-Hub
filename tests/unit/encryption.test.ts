import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { decryptStringWithKey, encryptStringWithKey } from "@/lib/shopee/encryption";

describe("Shopee credential encryption", () => {
  const key = Buffer.alloc(32, 7);

  it("round-trips with AES-256-GCM", () => {
    const encrypted = encryptStringWithKey("refresh-token", key);
    expect(encrypted.ciphertext).not.toContain("refresh-token");
    expect(decryptStringWithKey(encrypted, key)).toBe("refresh-token");
  });

  it("rejects tampered ciphertext", () => {
    const encrypted = encryptStringWithKey("access-token", key);
    const tampered = { ...encrypted, ciphertext: `${encrypted.ciphertext.slice(0, -2)}AA` };
    expect(() => decryptStringWithKey(tampered, key)).toThrow();
  });
});
