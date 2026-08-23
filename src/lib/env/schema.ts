import { z } from "zod";

const nonEmptyString = z.string().trim().min(1);

export const clientEnvSchema = z.object({
  NEXT_PUBLIC_FIREBASE_API_KEY: nonEmptyString,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: nonEmptyString,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: nonEmptyString,
  NEXT_PUBLIC_FIREBASE_APP_ID: nonEmptyString,
});

export const serverEnvSchema = z.object({
  APP_ENV: z.enum(["local", "staging", "production"]),
  NEXT_PUBLIC_APP_URL: z.url(),
  SHOPEE_ENV: z.enum(["sandbox", "production"]),
  SHOPEE_PARTNER_ID: z.string().regex(/^\d+$/),
  SHOPEE_PARTNER_KEY: nonEmptyString,
  SHOPEE_REDIRECT_URI: z.url(),
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .regex(/^(?:[a-fA-F0-9]{64}|[A-Za-z0-9+/]{43}=?)$/),
  FIREBASE_ADMIN_PROJECT_ID: nonEmptyString,
  FIREBASE_ADMIN_CLIENT_EMAIL: z.email(),
  FIREBASE_ADMIN_PRIVATE_KEY: nonEmptyString,
  SESSION_COOKIE_NAME: z.string().regex(/^[A-Za-z0-9_-]+$/),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseClientEnv(input: unknown): ClientEnv {
  return clientEnvSchema.parse(input);
}

export function parseServerEnv(input: unknown): ServerEnv {
  const parsed = serverEnvSchema.parse(input);

  if (parsed.APP_ENV === "production" && parsed.SHOPEE_ENV !== "production") {
    throw new Error("Production APP_ENV must use production Shopee credentials.");
  }

  if (parsed.APP_ENV !== "production" && parsed.SHOPEE_ENV !== "sandbox") {
    throw new Error("Non-production APP_ENV must use Shopee Sandbox credentials.");
  }

  const appOrigin = new URL(parsed.NEXT_PUBLIC_APP_URL).origin;
  const redirectOrigin = new URL(parsed.SHOPEE_REDIRECT_URI).origin;

  if (redirectOrigin !== appOrigin) {
    throw new Error("SHOPEE_REDIRECT_URI must use NEXT_PUBLIC_APP_URL as its origin.");
  }

  return parsed;
}
