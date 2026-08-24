import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { sanitizeLogValue } from "@/lib/logger";

describe("structured log redaction", () => {
  it("redacts nested secrets, arrays, strings, and circular objects", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const sanitized = sanitizeLogValue({
      accessToken: "plain",
      nested: { partner_key: "secret", safe: "ok" },
      rows: [{ authorization: "Bearer x" }],
      message: "refresh_token=abc123",
      providerErrorCode: "ads.rate_limit.exceed_shop_api",
      circular,
    }) as Record<string, unknown>;
    expect(sanitized.accessToken).toBe("[REDACTED]");
    expect(sanitized.nested).toEqual({ partner_key: "[REDACTED]", safe: "ok" });
    expect(sanitized.rows).toEqual([{ authorization: "[REDACTED]" }]);
    expect(sanitized.message).toContain("[REDACTED]");
    expect(sanitized.providerErrorCode).toBe("ads.rate_limit.exceed_shop_api");
    expect(sanitized.circular).toEqual({ self: "[CIRCULAR]" });
  });
});
