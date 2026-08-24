import type { Metadata } from "next";

import { Overview } from "@/components/dashboard/overview";
import { parseConnectionDocument, requireAuth } from "@/lib/auth/server";
import { getServerEnv } from "@/lib/env/server";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";

export const metadata: Metadata = {
  title: "Overview",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const auth = await requireAuth();
  const environment = getServerEnv().SHOPEE_ENV;
  const snapshot = await getFirebaseAdminFirestore()
    .collection("shopee_connections")
    .where("organizationId", "==", auth.organizationId)
    .where("environment", "==", environment)
    .get();

  const connections = snapshot.docs.flatMap((doc) => {
    try {
      const connection = parseConnectionDocument(doc.data());
      return connection.environment === environment
        ? [{ id: doc.id, ...connection }]
        : [];
    } catch {
      return [];
    }
  });

  return <Overview connections={connections} />;
}
