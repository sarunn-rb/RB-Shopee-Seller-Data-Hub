import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { DEFAULT_ORG_ID, ShopeeConnection } from "@/types/firestore";
import { requireAuth } from "@/lib/auth/server";
import { AdsDashboard } from "@/components/ads/AdsDashboard";

export const dynamic = "force-dynamic";

export default async function AdsPage() {
  await requireAuth();

  const firestore = getFirebaseAdminFirestore();
  const connectionsSnapshot = await firestore
    .collection("shopee_connections")
    .where("organizationId", "==", DEFAULT_ORG_ID)
    .where("status", "==", "active")
    .get();

  const connections = connectionsSnapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      shopId: data.shopId,
      shopName: data.shopName,
      status: data.status,
      organizationId: data.organizationId,
      // Strip complex timestamp objects as they cannot be passed to Client Components
    };
  }) as (ShopeeConnection & { id: string })[];

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
