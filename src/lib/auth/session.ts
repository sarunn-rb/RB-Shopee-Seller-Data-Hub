import "server-only";

import { cookies } from "next/headers";
import { getServerEnv } from "@/lib/env/server";

const SESSION_COOKIE_NAME = getServerEnv().SESSION_COOKIE_NAME;

// Expires in 14 days
const SESSION_EXPIRES_IN_MS = 14 * 24 * 60 * 60 * 1000;

export async function getSessionCookie() {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value;
}

export async function setSessionCookie(sessionValue: string) {
  const cookieStore = await cookies();
  const env = getServerEnv();

  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: sessionValue,
    httpOnly: true,
    secure: env.APP_ENV === "production" || env.APP_ENV === "staging",
    sameSite: "lax",
    maxAge: SESSION_EXPIRES_IN_MS / 1000,
    path: "/",
  });
}

export async function removeSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
