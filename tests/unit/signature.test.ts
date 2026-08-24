import crypto from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { generateShopeeSignatureWithKey } from "@/lib/shopee/signature";

describe("Shopee request signing", () => {
  it("uses the documented partner/path/timestamp/access-token/shop-id base string", () => {
    const base = "1240435/api/v2/shop/get_shop_info1700000000access-token12345";
    const expected = crypto.createHmac("sha256", "partner-secret").update(base).digest("hex");
    expect(generateShopeeSignatureWithKey(
      "1240435",
      "partner-secret",
      "/api/v2/shop/get_shop_info",
      1_700_000_000,
      "access-token12345",
    )).toBe(expected);
  });
});
