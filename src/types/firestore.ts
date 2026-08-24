import { z } from "zod";

const FirestoreTimestampSchema = z.unknown();

export const RoleSchema = z.enum(["admin", "member"]);
export type Role = z.infer<typeof RoleSchema>;

export const MemberStatusSchema = z.enum(["active", "invited", "disabled"]);
export type MemberStatus = z.infer<typeof MemberStatusSchema>;

export const UserSchema = z.object({
  email: z.email(),
  name: z.string().optional(),
  createdAt: FirestoreTimestampSchema,
});
export type User = z.infer<typeof UserSchema>;

export const OrganizationMemberSchema = z.object({
  uid: z.string().optional(),
  email: z.email().optional(),
  displayName: z.string().optional(),
  role: RoleSchema,
  status: MemberStatusSchema.default("active"),
  addedAt: FirestoreTimestampSchema.optional(),
  createdAt: FirestoreTimestampSchema.optional(),
  updatedAt: FirestoreTimestampSchema.optional(),
});
export type OrganizationMember = z.infer<typeof OrganizationMemberSchema>;

export const OrganizationSchema = z.object({
  name: z.string(),
  members: z.record(z.string(), OrganizationMemberSchema).optional(),
  createdAt: FirestoreTimestampSchema,
  updatedAt: FirestoreTimestampSchema.optional(),
});
export type Organization = z.infer<typeof OrganizationSchema>;

export const DEFAULT_ORG_ID = "rabbit-bytes";

export const ShopeeEnvironmentSchema = z.enum(["sandbox", "production"]);
export type ShopeeEnvironment = z.infer<typeof ShopeeEnvironmentSchema>;

export const ShopeeConnectionStatusSchema = z.enum([
  "pending",
  "active",
  "reauthorization_required",
  "disconnected",
  "error",
]);
export type ShopeeConnectionStatus = z.infer<typeof ShopeeConnectionStatusSchema>;

export const ShopeeConnectionSchema = z.object({
  organizationId: z.string().min(1),
  environment: ShopeeEnvironmentSchema,
  shopId: z.number().int().positive(),
  merchantId: z.number().int().positive().optional(),
  mainAccountId: z.number().int().positive().optional(),
  shopName: z.string().optional(),
  region: z.string().optional(),
  currency: z.string().optional(),
  status: ShopeeConnectionStatusSchema,
  connectedAt: FirestoreTimestampSchema.optional(),
  reauthorizedAt: FirestoreTimestampSchema.optional(),
  authorizationExpiresAt: FirestoreTimestampSchema.optional(),
  accessTokenExpiresAt: FirestoreTimestampSchema.optional(),
  refreshTokenExpiresAt: FirestoreTimestampSchema.optional(),
  lastSuccessfulApiCallAt: FirestoreTimestampSchema.optional(),
  lastErrorAt: FirestoreTimestampSchema.optional(),
  lastErrorCode: z.string().optional(),
  disconnectedAt: FirestoreTimestampSchema.optional(),
  providerRevocationStatus: z.enum(["not_required", "manual_required", "completed"]).optional(),
  createdBy: z.string().optional(),
  createdAt: FirestoreTimestampSchema,
  updatedAt: FirestoreTimestampSchema,
});
export type ShopeeConnection = z.infer<typeof ShopeeConnectionSchema>;

export const EncryptedDataSchema = z.object({
  ciphertext: z.string().min(1),
  iv: z.string().min(1),
  authTag: z.string().min(1),
});
export type EncryptedData = z.infer<typeof EncryptedDataSchema>;

export const RefreshLeaseSchema = z.object({
  ownerId: z.string().min(1),
  expectedTokenVersion: z.number().int().nonnegative(),
  expiresAt: z.number().int().positive(),
});
export type RefreshLease = z.infer<typeof RefreshLeaseSchema>;

export const ShopeeCredentialSchema = z.object({
  accessToken: EncryptedDataSchema,
  refreshToken: EncryptedDataSchema,
  accessTokenExpiresAt: z.number().int().positive().optional(),
  expiresAt: z.number().int().positive().optional(),
  refreshTokenExpiresAt: z.number().int().positive().optional(),
  tokenVersion: z.number().int().nonnegative(),
  refreshLease: RefreshLeaseSchema.optional(),
  updatedAt: FirestoreTimestampSchema,
}).refine((value) => value.accessTokenExpiresAt !== undefined || value.expiresAt !== undefined, {
  message: "Credential requires accessTokenExpiresAt.",
});
export type ShopeeCredential = z.infer<typeof ShopeeCredentialSchema>;

export const OAuthStateSchema = z.object({
  state: z.string().min(32),
  userId: z.string().min(1),
  organizationId: z.string().min(1),
  environment: ShopeeEnvironmentSchema,
  returnTo: z.string().startsWith("/"),
  createdAt: FirestoreTimestampSchema,
  expiresAt: FirestoreTimestampSchema,
});
export type OAuthState = z.infer<typeof OAuthStateSchema>;
