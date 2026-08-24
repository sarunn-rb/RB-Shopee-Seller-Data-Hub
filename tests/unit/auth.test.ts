import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { parseActiveMembership } from "@/lib/auth/server";
import { hasRecentSignIn } from "@/lib/auth/session";

describe("authentication and role parsing", () => {
  it("accepts only active admin/member memberships", () => {
    expect(parseActiveMembership({ role: "admin", status: "active" })).toEqual({ role: "admin" });
    expect(parseActiveMembership({ role: "member", status: "active" })).toEqual({ role: "member" });
    expect(parseActiveMembership({ role: "admin", status: "disabled" })).toBeNull();
    expect(parseActiveMembership({ role: "owner", status: "active" })).toBeNull();
  });

  it("requires sign-in within five minutes before minting a session", () => {
    expect(hasRecentSignIn(1_000, 1_299)).toBe(true);
    expect(hasRecentSignIn(1_000, 1_301)).toBe(false);
    expect(hasRecentSignIn(1_301, 1_300)).toBe(false);
  });
});
