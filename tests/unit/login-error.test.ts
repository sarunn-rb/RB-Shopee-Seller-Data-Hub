import { describe, expect, it } from "vitest";

import { getLoginErrorMessage } from "@/lib/auth/login-error";

describe("login error messages", () => {
  it("explains invalid Firebase credentials without revealing account existence", () => {
    expect(getLoginErrorMessage("auth/invalid-credential")).toBe("Email or password is incorrect.");
  });

  it("explains an unauthorized Firebase Auth domain", () => {
    expect(getLoginErrorMessage("auth/unauthorized-domain")).toBe(
      "This app domain is not authorized in Firebase Authentication.",
    );
  });

  it("explains missing organization membership after verified Firebase sign-in", () => {
    expect(getLoginErrorMessage("membership_required")).toBe(
      "This account is not an active Rabbit Bytes member. Contact an administrator for access.",
    );
  });
});
