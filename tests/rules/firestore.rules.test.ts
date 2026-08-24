import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

describe("Firestore browser access", () => {
  let environment: RulesTestEnvironment;

  beforeAll(async () => {
    environment = await initializeTestEnvironment({
      projectId: "demo-rb-data-hub",
      firestore: { rules: readFileSync(resolve("firebase/firestore.rules"), "utf8") },
    });
  });

  afterAll(async () => environment.cleanup());

  it("denies authenticated browser reads for every server-owned collection", async () => {
    const database = environment.authenticatedContext("alice").firestore();
    const paths = [
      "users/alice",
      "organizations/rabbit-bytes",
      "organizations/rabbit-bytes/members/alice",
      "shopee_connections/sandbox_shop_1",
      "shopee_credentials/sandbox_shop_1",
      "oauth_states/state",
      "shopee_api_logs/log",
      "audit_logs/log",
    ];
    for (const path of paths) await assertFails(getDoc(doc(database, path)));
    expect(paths).toHaveLength(8);
  });

  it("denies authenticated and unauthenticated browser writes", async () => {
    const authenticated = environment.authenticatedContext("admin").firestore();
    const anonymous = environment.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(authenticated, "organizations/rabbit-bytes"), { members: {} }));
    await assertFails(setDoc(doc(authenticated, "shopee_connections/one"), { status: "active" }));
    await assertFails(setDoc(doc(anonymous, "users/anonymous"), { role: "admin" }));
  });
});
