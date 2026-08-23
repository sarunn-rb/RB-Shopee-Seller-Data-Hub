import "server-only";

import { parseServerEnv } from "@/lib/env/schema";

export function getServerEnv() {
  return parseServerEnv({
    APP_ENV: process.env.APP_ENV,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    SHOPEE_ENV: process.env.SHOPEE_ENV,
    SHOPEE_PARTNER_ID: process.env.SHOPEE_PARTNER_ID,
    SHOPEE_PARTNER_KEY: process.env.SHOPEE_PARTNER_KEY,
    SHOPEE_REDIRECT_URI: process.env.SHOPEE_REDIRECT_URI,
    TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY,
    FIREBASE_ADMIN_PROJECT_ID: process.env.FIREBASE_ADMIN_PROJECT_ID,
    FIREBASE_ADMIN_CLIENT_EMAIL: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    FIREBASE_ADMIN_PRIVATE_KEY: process.env.FIREBASE_ADMIN_PRIVATE_KEY,
    SESSION_COOKIE_NAME: process.env.SESSION_COOKIE_NAME,
  });
}
