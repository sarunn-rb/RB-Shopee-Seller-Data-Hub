import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { DEFAULT_ORG_ID } from "@/types/firestore";
import { requireAuth } from "@/lib/auth/server";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

interface ApiLog {
  id: string;
  timestamp: string | null;
  event: string;
  endpointName?: string;
  httpStatus?: number;
  durationMs?: number;
  shopId?: string;
  message?: string;
  providerErrorCode?: string;
}

export default async function LogsPage() {
  await requireAuth();

  const firestore = getFirebaseAdminFirestore();
  let logs: ApiLog[] = [];
  let errorMsg = "";

  try {
    const logsSnapshot = await firestore
      .collection("shopee_api_logs")
      .where("organizationId", "==", DEFAULT_ORG_ID)
      .orderBy("timestamp", "desc")
      .limit(50)
      .get();

    logs = logsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        timestamp: data.timestamp ? data.timestamp.toDate().toISOString() : null,
      } as ApiLog;
    });
  } catch (err: unknown) {
    const error = err as { message?: string };
    if (error.message?.includes("index")) {
      errorMsg = error.message; // Contains the URL to create the index
    } else {
      errorMsg = "Failed to load logs.";
      console.error(error);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1360px] space-y-6 px-4 py-8 sm:px-7 lg:px-10 lg:py-9">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">API Logs</h1>
          <p className="text-sm text-zinc-500">Recent Shopee Open API diagnostic logs. Secrets are redacted.</p>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-md bg-amber-50 p-4 text-amber-700 flex items-center dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800 text-sm">
          <p className="break-all">{errorMsg}</p>
        </div>
      )}

      <div className="rounded-xl border bg-white shadow-sm dark:bg-zinc-950 dark:border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-zinc-50 dark:bg-zinc-900/50 dark:border-zinc-800 whitespace-nowrap">
                <th className="h-12 px-4 text-left font-medium text-zinc-500">Timestamp</th>
                <th className="h-12 px-4 text-left font-medium text-zinc-500">Event</th>
                <th className="h-12 px-4 text-left font-medium text-zinc-500">Endpoint</th>
                <th className="h-12 px-4 text-left font-medium text-zinc-500">Status</th>
                <th className="h-12 px-4 text-left font-medium text-zinc-500">Duration</th>
                <th className="h-12 px-4 text-left font-medium text-zinc-500">Shop ID</th>
                <th className="h-12 px-4 text-left font-medium text-zinc-500">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="h-24 text-center text-zinc-500">
                    No logs found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b last:border-0 dark:border-zinc-800">
                    <td className="p-4 whitespace-nowrap text-zinc-500">
                      {log.timestamp ? format(new Date(log.timestamp), "MMM d, HH:mm:ss") : "-"}
                    </td>
                    <td className="p-4 font-medium">
                      <span className={log.event.includes("error") ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}>
                        {log.event}
                      </span>
                    </td>
                    <td className="p-4 truncate max-w-[200px]" title={log.endpointName}>
                      {log.endpointName || "-"}
                    </td>
                    <td className="p-4">
                      {log.httpStatus || "-"}
                    </td>
                    <td className="p-4">
                      {log.durationMs ? `${log.durationMs}ms` : "-"}
                    </td>
                    <td className="p-4">
                      {log.shopId || "-"}
                    </td>
                    <td className="p-4 text-xs text-zinc-500 max-w-[250px] truncate" title={log.message || log.providerErrorCode}>
                      {log.message || log.providerErrorCode || "-"}
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
