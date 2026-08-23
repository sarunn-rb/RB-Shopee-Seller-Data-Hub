import { IconChartBar } from "@tabler/icons-react";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export default function AdsPage() {
  return (
    <PlaceholderPage
      title="Shopee Ads"
      description="Live reporting will be enabled only after the official Shop Ads endpoint, permissions, constraints, and Sandbox response are verified."
    >
      <div className="mt-7 flex min-h-64 flex-col items-center justify-center rounded-xl border bg-[#fcfcfc] px-5 text-center">
        <IconChartBar size={32} stroke={1.5} className="text-[#5b6067]" />
        <p className="mt-4 font-semibold">No live report available</p>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          Connect a Sandbox shop first. No mock metrics or stored Ads history are shown.
        </p>
      </div>
    </PlaceholderPage>
  );
}
