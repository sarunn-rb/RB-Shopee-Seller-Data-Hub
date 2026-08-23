import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { DEFAULT_ORG_ID, ShopeeConnection } from "@/types/firestore";
import { Button, buttonVariants } from "@/components/ui/button";
import { IconCheck, IconAlertCircle } from "@tabler/icons-react";
import Image from "next/image";
import { requireAuth } from "@/lib/auth/server";
import { getShopInfo } from "@/lib/shopee/shop";
import { ConnectionActions } from "./ConnectionActions";

export const dynamic = "force-dynamic";

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  await requireAuth();
  const resolvedParams = await searchParams;

  const firestore = getFirebaseAdminFirestore();
  const connectionsSnapshot = await firestore
    .collection("shopee_connections")
    .where("organizationId", "==", DEFAULT_ORG_ID)
    .get();

  const connections = connectionsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as (ShopeeConnection & { id: string })[];

  // Attempt to fetch shop info for each active connection
  const connectionsWithInfo = await Promise.all(
    connections.map(async (conn) => {
      if (conn.status === "active") {
        try {
          const shopInfo = await getShopInfo(conn.organizationId, conn.id, conn.shopId);
          return { ...conn, liveInfo: shopInfo };
        } catch (error: unknown) {
          const errMsg = error instanceof Error ? error.message : String(error);
          console.error(`Failed to get shop info for ${conn.shopId}`, error);
          return { ...conn, liveInfo: null, error: `Failed to load live info: ${errMsg}` };
        }
      }
      return { ...conn, liveInfo: null };
    })
  );

  return (
    <div className="mx-auto w-full max-w-[1360px] space-y-6 px-4 py-8 sm:px-7 lg:px-10 lg:py-9">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Shopee Connections</h1>
          <p className="text-sm text-zinc-500">Manage connected Shopee shops for your organization.</p>
        </div>
        <a href="/api/shopee/connect" className={buttonVariants({ variant: "default" })}>
          <Image src="/shopee.svg" alt="Shopee Logo" width={16} height={16} className="mr-2 opacity-90 brightness-0 invert" />
          Connect Shop
        </a>
      </div>

      {resolvedParams.success && (
        <div className="rounded-md bg-green-50 p-4 text-green-700 flex items-center dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800">
          <IconCheck className="mr-2 h-5 w-5" />
          Successfully connected Shopee shop!
        </div>
      )}

      {resolvedParams.error && (
        <div className="rounded-md bg-red-50 p-4 text-red-700 flex items-center dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800">
          <IconAlertCircle className="mr-2 h-5 w-5" />
          Failed to connect: {resolvedParams.error}
        </div>
      )}

      <div className="rounded-xl border bg-white shadow-sm dark:bg-zinc-950 dark:border-zinc-800">
        <div className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-zinc-50 dark:bg-zinc-900/50 dark:border-zinc-800">
                <th className="h-12 px-4 text-left font-medium text-zinc-500">Shop ID / Name</th>
                <th className="h-12 px-4 text-left font-medium text-zinc-500">Status</th>
                <th className="h-12 px-4 text-right font-medium text-zinc-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {connectionsWithInfo.length === 0 ? (
                <tr>
                  <td colSpan={3} className="h-24 text-center text-zinc-500">
                    No shops connected yet.
                  </td>
                </tr>
              ) : (
                connectionsWithInfo.map((conn) => (
                  <tr key={conn.id} className="border-b last:border-0 dark:border-zinc-800">
                    <td className="p-4">
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">
                        {conn.liveInfo?.shop_name || conn.shopName || `Shop ${conn.shopId}`}
                      </div>
                      <div className="text-zinc-500 text-xs">{conn.shopId}</div>
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          conn.status === "active"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                        }`}
                      >
                        {conn.status}
                      </span>
                      {conn.error && (
                        <div className="text-xs text-red-500 mt-1">{conn.error}</div>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <ConnectionActions connectionId={conn.id} status={conn.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
