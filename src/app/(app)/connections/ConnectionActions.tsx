"use client";

import { Button } from "@/components/ui/button";
import { IconPlugConnected, IconTrash } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function ConnectionActions({ connectionId, status }: { connectionId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleDisconnect = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/shopee/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
        credentials: "same-origin",
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to disconnect");
      }
      
      setDisconnectOpen(false);
      router.refresh();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setErrorMsg(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/shopee/connection", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
        credentials: "same-origin",
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }
      
      setDeleteOpen(false);
      router.refresh();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setErrorMsg(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleReconnect = () => {
    // Reusing the connect endpoint which initiates OAuth. 
    router.push("/api/shopee/connect");
  };

  if (status === "active") {
    return (
      <AlertDialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <AlertDialogTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 disabled:pointer-events-none disabled:opacity-50 dark:focus-visible:ring-zinc-300 bg-red-500 text-zinc-50 shadow-sm hover:bg-red-500/90 dark:bg-red-900 dark:text-zinc-50 dark:hover:bg-red-900/90 h-8 px-3" disabled={loading}>
          <IconTrash className="mr-2 h-4 w-4" />
          Disconnect
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Shop</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disconnect this shop? All Shopee credentials will be deleted from the system. You will need to reauthorize the connection if you change your mind.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {errorMsg && (
            <div className="text-sm font-medium text-red-500 rounded bg-red-50 dark:bg-red-950/50 p-3">
              {errorMsg}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDisconnect} disabled={loading}>
              {loading ? "Disconnecting..." : "Disconnect"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // If status is disconnected or error, show Reconnect + Delete
  return (
    <div className="flex items-center justify-end space-x-2">
      <Button variant="outline" size="sm" onClick={handleReconnect} disabled={loading}>
        <IconPlugConnected className="mr-2 h-4 w-4 text-green-600 dark:text-green-400" />
        Reconnect
      </Button>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 disabled:pointer-events-none disabled:opacity-50 dark:focus-visible:ring-zinc-300 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50 h-8 px-3 text-zinc-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" disabled={loading}>
          <IconTrash className="h-4 w-4" />
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete Shop</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to completely remove this shop from the database? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {errorMsg && (
            <div className="text-sm font-medium text-red-500 rounded bg-red-50 dark:bg-red-950/50 p-3">
              {errorMsg}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              {loading ? "Deleting..." : "Delete Permanently"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
