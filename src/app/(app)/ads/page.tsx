import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { parseConnectionDocument, requireAuth } from "@/lib/auth/server";
import { AdsDashboard } from "@/components/ads/AdsDashboard";
import { getServerEnv } from "@/lib/env/server";

export const dynamic = "force-dynamic";

export default async function AdsPage() {
  const auth = await requireAuth();

  const firestore = getFirebaseAdminFirestore();
  const connectionsSnapshot = await firestore
    .collection("shopee_connections")
    .where("organizationId", "==", auth.organizationId)
    .where("environment", "==", getServerEnv().SHOPEE_ENV)
    .where("status", "==", "active")
    .get();

  const connections = connectionsSnapshot.docs.flatMap((doc) => {
    try {
      const connection = parseConnectionDocument(doc.data());
      return connection.environment === getServerEnv().SHOPEE_ENV
        ? [{ id: doc.id, shopId: connection.shopId, shopName: connection.shopName }]
        : [];
    } catch {
      return [];
    }
  });

  return (
    <div className="mx-auto w-full max-w-[1360px] space-y-6 px-4 py-8 sm:px-7 lg:px-10 lg:py-9">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ads Performance</h1>
        <p className="text-sm text-zinc-500">Live query of Shopee Ads APIs. Data is not stored in our database.</p>
      </div>
      
      <AdsDashboard connections={connections} />
    </div>
  );
}
