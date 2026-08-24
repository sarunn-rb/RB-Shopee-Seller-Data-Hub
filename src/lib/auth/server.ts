import "server-only";

import { AuthError } from "./errors";
import { getSessionCookie } from "./session";
import { getServerEnv } from "@/lib/env/server";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import {
  DEFAULT_ORG_ID,
  OrganizationMemberSchema,
  Role,
  ShopeeConnection,
  ShopeeConnectionSchema,
} from "@/types/firestore";

export type AuthContext = {
  uid: string;
  email: string;
  role: Role;
  organizationId: string;
};

export type SessionResult =
  | { isAuthenticated: false; reason: "no_cookie" | "invalid_cookie" | "not_invited" }
  | ({ isAuthenticated: true } & AuthContext);

export function parseActiveMembership(value: unknown): { role: Role } | null {
  const parsed = OrganizationMemberSchema.safeParse(value);
  if (!parsed.success || parsed.data.status !== "active") {
    return null;
  }
  return { role: parsed.data.role };
}

export async function getCurrentMembership(uid: string) {
  const firestore = getFirebaseAdminFirestore();
  const organizationRef = firestore.collection("organizations").doc(DEFAULT_ORG_ID);
  const memberDoc = await organizationRef.collection("members").doc(uid).get();

  if (memberDoc.exists) {
    return parseActiveMembership(memberDoc.data());
  }

  // Compatibility path for organizations created by the first bootstrap script.
  const organizationDoc = await organizationRef.get();
  const legacyMember = organizationDoc.data()?.members?.[uid];
  return parseActiveMembership(legacyMember);
}

export async function verifySession(): Promise<SessionResult> {
  const sessionCookie = await getSessionCookie();
  if (!sessionCookie) {
    return { isAuthenticated: false, reason: "no_cookie" };
  }

  try {
    const decodedClaims = await getFirebaseAdminAuth().verifySessionCookie(sessionCookie, true);
    const membership = await getCurrentMembership(decodedClaims.uid);
    if (!membership) {
      return { isAuthenticated: false, reason: "not_invited" };
    }

    return {
      isAuthenticated: true,
      uid: decodedClaims.uid,
      email: decodedClaims.email ?? "",
      role: membership.role,
      organizationId: DEFAULT_ORG_ID,
    };
  } catch {
    return { isAuthenticated: false, reason: "invalid_cookie" };
  }
}

export async function requireAuth(): Promise<AuthContext> {
  const result = await verifySession();
  if (!result.isAuthenticated) {
    throw new AuthError(
      result.reason === "not_invited" ? "membership_required" : "unauthenticated",
      result.reason === "not_invited" ? 403 : 401,
    );
  }
  return result;
}

export async function requireRole(requiredRole: Role, context?: AuthContext): Promise<AuthContext> {
  const auth = context ?? await requireAuth();
  if (auth.role !== requiredRole) {
    throw new AuthError("forbidden", 403);
  }
  return auth;
}

export function requireOrganizationAccess(organizationId: string, context: AuthContext): AuthContext {
  if (organizationId !== context.organizationId) {
    throw new AuthError("forbidden", 403);
  }
  return context;
}

export function parseConnectionDocument(value: unknown): ShopeeConnection {
  const raw = typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : {};
  const legacyStatus = raw.status;
  const status = legacyStatus === "revoked"
    ? "disconnected"
    : legacyStatus === "expired"
      ? "reauthorization_required"
      : legacyStatus;

  return ShopeeConnectionSchema.parse({
    ...raw,
    status,
    connectedAt: raw.connectedAt ?? raw.createdAt,
  });
}

export async function requireConnectionAccess(
  connectionId: string,
  context?: AuthContext,
): Promise<{ auth: AuthContext; connection: ShopeeConnection }> {
  const auth = context ?? await requireAuth();
  const snapshot = await getFirebaseAdminFirestore()
    .collection("shopee_connections")
    .doc(connectionId)
    .get();

  if (!snapshot.exists) {
    throw new AuthError("forbidden", 403);
  }

  const connection = parseConnectionDocument(snapshot.data());
  requireOrganizationAccess(connection.organizationId, auth);
  if (connection.environment !== getServerEnv().SHOPEE_ENV) {
    throw new AuthError("forbidden", 403);
  }

  return { auth, connection };
}
