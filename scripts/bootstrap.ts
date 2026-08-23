import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

// Load environment variables from .env.local manually to avoid 'dotenv' dependency
const envPath = join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  const envFile = readFileSync(envPath, "utf-8");
  envFile.split("\n").forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || "";
      // Remove surrounding quotes if present
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[key] = value;
    }
  });
}

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing Firebase Admin credentials in .env.local");
  process.exit(1);
}

initializeApp({
  credential: cert({
    projectId,
    clientEmail,
    privateKey,
  }),
});

const firestore = getFirestore();
const auth = getAuth();

async function bootstrap() {
  const email = process.argv[2];
  
  if (!email) {
    console.error("Please provide an email address as the first argument.");
    console.error("Usage: npx tsx scripts/bootstrap.ts admin@example.com");
    process.exit(1);
  }

  try {
    // 1. Get or Create user in Firebase Auth
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
      console.log(`User ${email} already exists in Auth (uid: ${userRecord.uid})`);
    } catch (error: unknown) {
      const e = error as { code?: string };
      if (e.code === 'auth/user-not-found') {
        userRecord = await auth.createUser({
          email,
          password: "Password123!", // Change this!
        });
        console.log(`Created user ${email} in Auth with temporary password 'Password123!' (uid: ${userRecord.uid})`);
      } else {
        throw e;
      }
    }

    const uid = userRecord.uid;

    // 2. Create Organization and add user as admin
    const orgRef = firestore.collection("organizations").doc("rabbit-bytes");
    
    await orgRef.set({
      name: "Rabbit Bytes",
      createdAt: new Date(),
      members: {
        [uid]: {
          role: "admin",
          addedAt: new Date(),
        }
      }
    }, { merge: true }); // Merge in case it already exists

    console.log(`User ${email} (${uid}) is now an admin of 'rabbit-bytes' organization.`);
    console.log("Bootstrap complete!");
    
  } catch (err) {
    console.error("Error during bootstrap:", err);
  }
}

bootstrap();
