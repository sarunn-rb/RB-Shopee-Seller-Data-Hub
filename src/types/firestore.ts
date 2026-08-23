import { z } from "zod";

export const RoleSchema = z.enum(["admin", "member"]);
export type Role = z.infer<typeof RoleSchema>;

// User Profile (users/{userId})
export const UserSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  createdAt: z.any(), // Firestore Timestamp
});
export type User = z.infer<typeof UserSchema>;

// Organization Member
export const OrganizationMemberSchema = z.object({
  role: RoleSchema,
  addedAt: z.any(), // Firestore Timestamp
});
export type OrganizationMember = z.infer<typeof OrganizationMemberSchema>;

// Organization (organizations/{orgId})
export const OrganizationSchema = z.object({
  name: z.string(),
  members: z.record(z.string(), OrganizationMemberSchema), // uid -> Member Data
  createdAt: z.any(), // Firestore Timestamp
});
export type Organization = z.infer<typeof OrganizationSchema>;

// Default organization ID
export const DEFAULT_ORG_ID = "rabbit-bytes";

// Shopee Connection Metadata (shopee_connections/{connectionId})
export const ShopeeConnectionSchema = z.object({
  organizationId: z.string(),
  shopId: z.number(),
  shopName: z.string().optional(),
  status: z.enum(["active", "revoked", "expired"]),
  createdAt: z.any(), // Firestore Timestamp
  updatedAt: z.any(), // Firestore Timestamp
});
export type ShopeeConnection = z.infer<typeof ShopeeConnectionSchema>;

// Shopee Credential (shopee_credentials/{connectionId})
// Strictly server-only
export const ShopeeCredentialSchema = z.object({
  accessToken: z.object({
    ciphertext: z.string(),
    iv: z.string(),
    authTag: z.string(),
  }),
  refreshToken: z.object({
    ciphertext: z.string(),
    iv: z.string(),
    authTag: z.string(),
  }),
  expiresAt: z.number(), // Unix timestamp in seconds
  tokenVersion: z.number(), // Used for optimistic concurrency control during refresh
  updatedAt: z.any(), // Firestore Timestamp
});
export type ShopeeCredential = z.infer<typeof ShopeeCredentialSchema>;

// OAuth State (oauth_states/{stateId})
export const OAuthStateSchema = z.object({
  createdAt: z.any(), // Firestore Timestamp
  expiresAt: z.any(), // Firestore Timestamp
});
export type OAuthState = z.infer<typeof OAuthStateSchema>;
