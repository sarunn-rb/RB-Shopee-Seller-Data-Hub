import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { getServerEnv } from "./env/server";
import { getFirebaseAdminFirestore } from "./firebase/admin";

const LOG_RETENTION_DAYS = 30;
const BLOCKED_KEYS = [
  "token",
  "secret",
  "key",
  "authorization",
  "password",
  "credential",
  "cookie",
];
const SENSITIVE_VALUE_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
  /\bshpk[a-z0-9]{16,}\b/gi,
  /\b(?:access_token|refresh_token|authorization)=([^\s&]+)/gi,
];

export interface ApiLogEntry {
  event: string;
  organizationId: string;
  connectionId?: string;
  shopId?: string | number;
  endpointName?: string;
  httpStatus?: number;
  providerRequestId?: string;
  providerErrorCode?: string;
  durationMs?: number;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLogEntry {
  action: string;
  actorId: string;
  organizationId: string;
  connectionId?: string;
  shopId?: number;
  metadata?: Record<string, unknown>;
}

function sanitizeString(value: string): string {
  return SENSITIVE_VALUE_PATTERNS.reduce(
    (result, pattern) => result.replace(pattern, "[REDACTED]"),
    value,
  ).slice(0, 1_000);
}

export function sanitizeLogValue(value: unknown, key = "", seen = new WeakSet<object>()): unknown {
  const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (
    BLOCKED_KEYS.some((blocked) => normalizedKey.includes(blocked)) ||
    normalizedKey === "code" ||
    normalizedKey.endsWith("authorizationcode")
  ) {
    return "[REDACTED]";
  }
  if (typeof value === "string") {
    return sanitizeString(value);
  }
  if (value === null || value === undefined || typeof value !== "object") {
    return value;
  }
  if (seen.has(value)) {
    return "[CIRCULAR]";
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => sanitizeLogValue(item, key, seen));
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .map(([childKey, item]) => [childKey, sanitizeLogValue(item, childKey, seen)]),
  );
}

function expiresAt() {
  return Timestamp.fromMillis(Date.now() + LOG_RETENTION_DAYS * 24 * 60 * 60 * 1_000);
}

export async function logApiInteraction(entry: ApiLogEntry): Promise<void> {
  try {
    const sanitized = sanitizeLogValue(entry) as ApiLogEntry;
    await getFirebaseAdminFirestore().collection("shopee_api_logs").add({
      ...sanitized,
      environment: getServerEnv().SHOPEE_ENV,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: expiresAt(),
    });
  } catch {
    console.error("Failed to persist sanitized Shopee API diagnostic.");
  }
}

export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    const sanitized = sanitizeLogValue(entry) as AuditLogEntry;
    await getFirebaseAdminFirestore().collection("audit_logs").add({
      ...sanitized,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: expiresAt(),
    });
  } catch {
    console.error("Failed to persist sanitized audit event.");
  }
}
