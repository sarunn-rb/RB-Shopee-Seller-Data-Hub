import { IconAlertCircle, IconCheck } from "@tabler/icons-react";
import Image from "next/image";

import { ConnectionActions } from "./ConnectionActions";
import { buttonVariants } from "@/components/ui/button";
import { requireAuth, parseConnectionDocument } from "@/lib/auth/server";
import { getServerEnv } from "@/lib/env/server";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  authorization_rejected: "Shopee authorization was cancelled or rejected.",
  invalid_state: "The authorization session expired or was already used. Start again from Connect Shop.",
  token_exchange_failed: "Shopee did not accept the one-time authorization code. Start authorization again.",
  connection_validation_failed: "Tokens were received, but the shop validation call failed. Check API Logs before retrying.",
  callback_failed: "The Shopee callback could not be completed. Please retry authorization.",
};

const SUCCESS_MESSAGES: Record<string, string> = {
  connected: "Shopee shop connected and validated successfully.",
  reauthorized: "Shopee shop reauthorized and validated successfully.",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending validation",
  active: "Active",
  reauthorization_required: "Reauthorization required",
  disconnected: "Disconnected locally",
  error: "Provider error",
};

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const auth = await requireAuth();
  const resolvedParams = await searchParams;
  const snapshot = await getFirebaseAdminFirestore()
    .collection("shopee_connections")
    .where("organizationId", "==", auth.organizationId)
    .where("environment", "==", getServerEnv().SHOPEE_ENV)
    .get();
  const connections = snapshot.docs.flatMap((doc) => {
    try {
      const connection = parseConnectionDocument(doc.data());
      return connection.environment === getServerEnv().SHOPEE_ENV
        ? [{ id: doc.id, ...connection }]
        : [];
    } catch {
      return [];
    }
  });

  return (
    <div className="mx-auto w-full max-w-[1360px] space-y-6 px-4 py-8 sm:px-7 lg:px-10 lg:py-9">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Shopee Connections</h1>
          <p className="text-sm text-zinc-500">Manage connected Shopee shops for your organization.</p>
        </div>
        {auth.role === "admin" ? (
          <a href="/api/shopee/connect" className={buttonVariants({ variant: "default" })}>
            <Image src="/shopee.svg" alt="" width={16} height={16} className="mr-2 opacity-90 brightness-0 invert" />
            Connect Shop
          </a>
        ) : null}
      </div>

      {resolvedParams.success ? (
        <div className="flex items-center rounded-md border border-green-200 bg-green-50 p-4 text-green-700">
          <IconCheck className="mr-2 h-5 w-5" />
          {SUCCESS_MESSAGES[resolvedParams.success] ?? "Shopee connection updated successfully."}
        </div>
      ) : null}

      {resolvedParams.error ? (
        <div className="flex items-center rounded-md border border-red-200 bg-red-50 p-4 text-red-700">
          <IconAlertCircle className="mr-2 h-5 w-5" />
          {ERROR_MESSAGES[resolvedParams.error] ?? "Shopee connection could not be updated."}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-zinc-50">
                <th className="h-12 px-4 text-left font-medium text-zinc-500">Shop ID / Name</th>
                <th className="h-12 px-4 text-left font-medium text-zinc-500">Environment</th>
                <th className="h-12 px-4 text-left font-medium text-zinc-500">Status</th>
                <th className="h-12 px-4 text-right font-medium text-zinc-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {connections.length === 0 ? (
                <tr><td colSpan={4} className="h-24 text-center text-zinc-500">No shops connected yet.</td></tr>
              ) : connections.map((connection) => (
                <tr key={connection.id} className="border-b last:border-0">
                  <td className="p-4">
                    <div className="font-medium text-zinc-900">{connection.shopName || `Shop ${connection.shopId}`}</div>
                    <div className="text-xs text-zinc-500">{connection.shopId}</div>
                  </td>
                  <td className="p-4 uppercase text-zinc-600">{connection.environment}</td>
                  <td className="p-4">
                    <span className={connection.status === "active"
                      ? "inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800"
                      : "inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800"}>
                      {STATUS_LABELS[connection.status]}
                    </span>
                    {connection.lastErrorCode ? <div className="mt-1 text-xs text-zinc-500">{connection.lastErrorCode}</div> : null}
                  </td>
                  <td className="p-4 text-right">
                    {auth.role === "admin" ? <ConnectionActions connectionId={connection.id} status={connection.status} /> : <span className="text-xs text-zinc-400">View only</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
