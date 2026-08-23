import { getFirebaseAdminFirestore } from "./firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { getServerEnv } from "./env/server";

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
  metadata?: Record<string, unknown>; // Will be sanitized
}

// Ensure secrets are never logged
function sanitizeMetadata(data?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!data) return undefined;
  
  const sanitized: Record<string, unknown> = {};
  const blockedKeys = ["token", "secret", "key", "authorization", "code", "password", "credential"];
  
  for (const [k, v] of Object.entries(data)) {
    const keyLower = k.toLowerCase();
    const isBlocked = blockedKeys.some(blocked => keyLower.includes(blocked));
    
    if (v === undefined) {
      continue;
    }

    if (isBlocked) {
      sanitized[k] = "[REDACTED]";
    } else if (typeof v === 'object' && v !== null) {
      sanitized[k] = sanitizeMetadata(v as Record<string, unknown>);
    } else {
      sanitized[k] = v;
    }
  }
  return sanitized;
}

export async function logApiInteraction(entry: ApiLogEntry) {
  try {
    const firestore = getFirebaseAdminFirestore();
    const env = getServerEnv();
    
    const sanitizedMetadata = sanitizeMetadata(entry.metadata);

    const logDoc = {
      event: entry.event,
      environment: env.NEXT_PUBLIC_SHOPEE_ENV || "sandbox",
      organizationId: entry.organizationId,
      connectionId: entry.connectionId || null,
      shopId: entry.shopId || null,
      endpointName: entry.endpointName || null,
      httpStatus: entry.httpStatus || null,
      providerRequestId: entry.providerRequestId || null,
      providerErrorCode: entry.providerErrorCode || null,
      durationMs: entry.durationMs || null,
      message: entry.message || null,
      metadata: sanitizedMetadata || null,
      timestamp: FieldValue.serverTimestamp(),
    };

    // Use a 'shopee_api_logs' collection
    // Note: We don't await this strictly to avoid blocking the main API response path
    firestore.collection("shopee_api_logs").add(logDoc).catch(err => {
      console.error("Failed to write API log to Firestore:", err);
    });

  } catch (error) {
    console.error("Error in logApiInteraction:", error);
  }
}
