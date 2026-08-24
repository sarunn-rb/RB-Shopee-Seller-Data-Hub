import "server-only";

import crypto from "crypto";
import { getServerEnv } from "@/lib/env/server";

// We use AES-256-GCM. GCM provides both encryption and integrity via an auth tag.
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // Standard for GCM

export interface EncryptedData {
  ciphertext: string;
  iv: string;
  authTag: string;
}

function getEncryptionKey(): Buffer {
  const key = getServerEnv().TOKEN_ENCRYPTION_KEY;
  // If it's a 64-char hex string
  if (key.length === 64) {
    return Buffer.from(key, "hex");
  }
  // Otherwise assume base64
  return Buffer.from(key, "base64");
}

export function encryptString(text: string): EncryptedData {
  return encryptStringWithKey(text, getEncryptionKey());
}

export function encryptStringWithKey(text: string, key: Buffer): EncryptedData {
  if (key.length !== 32) {
    throw new Error("Invalid encryption key length. Expected 32 bytes.");
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, "utf8", "base64");
  encrypted += cipher.final("base64");
  
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: encrypted,
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

export function decryptString(encryptedData: EncryptedData): string {
  return decryptStringWithKey(encryptedData, getEncryptionKey());
}

export function decryptStringWithKey(encryptedData: EncryptedData, key: Buffer): string {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(encryptedData.iv, "base64")
  );
  
  decipher.setAuthTag(Buffer.from(encryptedData.authTag, "base64"));
  
  let decrypted = decipher.update(encryptedData.ciphertext, "base64", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}
