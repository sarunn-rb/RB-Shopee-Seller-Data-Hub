import { IconPlugConnected } from "@tabler/icons-react";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export default function ConnectionsPage() {
  return (
    <PlaceholderPage
      title="Connections"
      description="Shopee Sandbox connection setup is scheduled after Firebase session and server-side RBAC foundations are complete."
    >
      <div
        id="setup"
        className="mt-7 flex min-h-64 flex-col items-center justify-center rounded-xl border bg-[#fcfcfc] px-5 text-center"
      >
        <IconPlugConnected size={32} stroke={1.5} className="text-[#5b6067]" />
        <p className="mt-4 font-semibold">No Shopee shops connected</p>
        <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
          Configure Firebase and a stable Sandbox redirect domain before starting authorization.
        </p>
      </div>
    </PlaceholderPage>
  );
}
