import { describe, expect, it } from "vitest";

import { getConnectionSummary } from "@/lib/dashboard/connection-summary";

describe("dashboard connection summary", () => {
  it("counts active and attention-required shops without counting disconnected shops", () => {
    expect(getConnectionSummary([
      { status: "active" },
      { status: "pending" },
      { status: "reauthorization_required" },
      { status: "error" },
      { status: "disconnected" },
    ])).toEqual({
      connectedShops: 4,
      healthyConnections: 1,
      needsAttention: 3,
    });
  });
});
