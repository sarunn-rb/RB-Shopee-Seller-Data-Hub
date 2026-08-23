import {
  IconAlertTriangle,
  IconBuildingStore,
  IconPlus,
  IconShieldCheck,
  IconShieldLock,
} from "@tabler/icons-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const summaries = [
  { label: "Connected shops", value: 0, icon: IconBuildingStore },
  { label: "Healthy connections", value: 0, icon: IconShieldCheck },
  { label: "Needs attention", value: 0, icon: IconAlertTriangle },
] as const;

export function Overview() {
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
