import "client-only";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

import { getClientEnv } from "@/lib/env/client";

export function getFirebaseClientApp() {
  if (getApps().length > 0) {
    return getApp();
  }

  const env = getClientEnv();

  return initializeApp({
    apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
}

export function getFirebaseClientAuth() {
  return getAuth(getFirebaseClientApp());
}
