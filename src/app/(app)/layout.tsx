import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { requireAuth } from "@/lib/auth/server";

export default async function ProtectedAppLayout({ children }: { children: ReactNode }) {
  let auth;
  try {
    auth = await requireAuth();
  } catch {
    redirect("/login");
  }

  return <AppShell role={auth.role} email={auth.email}>{children}</AppShell>;
}
