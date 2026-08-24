import {
  IconAlertTriangle,
  IconBuildingStore,
  IconPlus,
  IconShieldCheck,
  IconShieldLock,
} from "@tabler/icons-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import type { ShopeeConnection } from "@/types/firestore";
import { getConnectionSummary } from "@/lib/dashboard/connection-summary";
import { cn } from "@/lib/utils";

type OverviewConnection = ShopeeConnection & { id: string };

const STATUS_LABELS: Record<OverviewConnection["status"], string> = {
  pending: "Pending validation",
  active: "Active",
  reauthorization_required: "Reauthorization required",
  disconnected: "Disconnected locally",
  error: "Provider error",
};

function formatLastSuccessfulCall(value: unknown) {
  const date = value instanceof Date
    ? value
    : typeof value === "object"
      && value !== null
      && "toDate" in value
      && typeof value.toDate === "function"
        ? value.toDate()
        : null;

  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "Not yet";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function Overview({ connections }: { connections: OverviewConnection[] }) {
  const { connectedShops, healthyConnections, needsAttention } = getConnectionSummary(connections);
  const summaries = [
    { label: "Connected shops", value: connectedShops, icon: IconBuildingStore },
    { label: "Healthy connections", value: healthyConnections, icon: IconShieldCheck },
    { label: "Needs attention", value: needsAttention, icon: IconAlertTriangle },
  ];

  return (
    <div className="mx-auto w-full max-w-[1360px] px-4 py-8 sm:px-7 lg:px-10 lg:py-9">
      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.035em] text-[#111316]">
          Overview
        </h1>
        <p className="mt-1 text-[15px] text-muted-foreground">
          Monitor shop connections and open live reports.
        </p>
      </div>

      <section
        aria-label="Connection summary"
        className="mt-7 grid gap-4 md:grid-cols-3"
      >
        {summaries.map((summary) => {
          const IconComponent = summary.icon;

          return (
            <div
              key={summary.label}
              className="flex min-h-[116px] items-center gap-4 rounded-xl border bg-white px-5"
            >
              <span className="grid size-14 shrink-0 place-items-center rounded-lg border bg-[#fbfbfb] text-[#444950]">
                <IconComponent size={28} stroke={1.55} aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm text-muted-foreground">{summary.label}</p>
                <p className="mt-1 text-[30px] font-semibold leading-none tracking-tight">
                  {summary.value}
                </p>
              </div>
            </div>
          );
        })}
      </section>

      <section className="mt-7 overflow-hidden rounded-xl border bg-white">
        <div className="flex min-h-20 flex-col justify-between gap-3 border-b px-5 py-3 sm:flex-row sm:items-center">
          <h2 className="text-lg font-semibold tracking-[-0.02em]">
            Shop connections
          </h2>
          <Link
            href="/connections"
            className={cn(
              buttonVariants({ size: "lg" }),
              "h-10 gap-2 px-4 shadow-none",
            )}
          >
            <IconPlus size={17} stroke={1.8} aria-hidden="true" />
            Connect Shopee
          </Link>
        </div>

        <div className="hidden grid-cols-[1.15fr_.72fr_.9fr_.78fr_1.35fr_.55fr] border-b bg-[#fcfcfc] px-5 py-4 text-xs font-medium text-[#454a50] md:grid">
          <span>Shop</span>
          <span>Region</span>
          <span>Environment</span>
          <span>Status</span>
          <span>Last successful API call</span>
          <span className="text-right">Actions</span>
        </div>

        {connections.length === 0 ? (
          <div className="flex min-h-[350px] flex-col items-center justify-center px-5 py-12 text-center">
            <span className="grid size-16 place-items-center rounded-full border bg-[#fcfcfc] text-[#5b6067]">
              <IconBuildingStore size={30} stroke={1.45} aria-hidden="true" />
            </span>
            <h3 className="mt-5 text-xl font-semibold tracking-[-0.025em]">
              No Shopee shops connected
            </h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Connect a Sandbox shop to start querying live Ads data.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row">
              <Link
                href="/connections"
                className={cn(buttonVariants({ size: "lg" }), "h-10 px-5")}
              >
                Connect Shopee
              </Link>
              <Link
                href="/connections#setup"
                className={cn(
                  buttonVariants({ variant: "link", size: "lg" }),
                  "text-[#d94216]",
                )}
              >
                View setup guide
              </Link>
            </div>
          </div>
        ) : (
          <div>
            {connections.map((connection) => (
              <div
                key={connection.id}
                className="grid gap-3 border-b px-5 py-4 last:border-b-0 md:grid-cols-[1.15fr_.72fr_.9fr_.78fr_1.35fr_.55fr] md:items-center"
              >
                <div>
                  <p className="font-medium text-[#1e2226]">
                    {connection.shopName || `Shop ${connection.shopId}`}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">ID: {connection.shopId}</p>
                </div>
                <p className="text-sm text-[#4d535a]">{connection.region || "—"}</p>
                <p className="text-sm uppercase text-[#4d535a]">{connection.environment}</p>
                <p className="text-sm text-[#4d535a]">{STATUS_LABELS[connection.status]}</p>
                <p className="text-sm text-[#4d535a]">
                  {formatLastSuccessfulCall(connection.lastSuccessfulApiCallAt)}
                </p>
                <div className="text-left md:text-right">
                  <Link
                    href="/connections"
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8")}
                  >
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="mt-5 flex items-start gap-3 rounded-xl border bg-[#fcfcfc] px-5 py-4 text-sm text-[#545a61]">
        <IconShieldLock
          size={20}
          stroke={1.65}
          className="mt-0.5 shrink-0"
          aria-hidden="true"
        />
        <p>Ads performance is queried live from Shopee and is not stored.</p>
      </div>
    </div>
  );
}
