import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { extractSandboxShopInfoResponse, ShopInfoSchema } from "@/lib/shopee/shop";

describe("Sandbox shop validation", () => {
  it("accepts the flat get_shop_info response shape returned by Sandbox", () => {
    const payload = {
      shop_name: "Sandbox Shop",
      region: "SG",
      status: "NORMAL",
      request_id: "safe-request-id",
      auth_time: 1_787_553_400,
      expire_time: 1_790_145_400,
    };

    expect(ShopInfoSchema.parse(extractSandboxShopInfoResponse(payload))).toMatchObject({
      shop_name: "Sandbox Shop",
      region: "SG",
    });
  });
});
