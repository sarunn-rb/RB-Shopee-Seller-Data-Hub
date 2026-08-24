import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { requireRole } from "@/lib/auth/server";
import { redirect } from "next/navigation";

export default async function MembersPage() {
  try {
    await requireRole("admin");
  } catch {
    redirect("/dashboard");
  }
  return (
    <PlaceholderPage
      title="Members"
      description="Invite-only Rabbit Bytes membership."
    />
  );
}
