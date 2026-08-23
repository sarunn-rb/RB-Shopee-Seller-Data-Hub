import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { requireAuth } from "@/lib/auth/server";

export default async function ProtectedAppLayout({ children }: { children: ReactNode }) {
  try {
    await requireAuth();
  } catch (error) {
    redirect("/login");
  }

  return <AppShell>{children}</AppShell>;
}
