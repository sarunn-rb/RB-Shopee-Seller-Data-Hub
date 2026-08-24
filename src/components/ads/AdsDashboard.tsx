"use client";

import { IconCalendar, IconLoader2 } from "@tabler/icons-react";
import { format, subDays, subMonths } from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type AdsConnection = { id: string; shopId: number; shopName?: string };
type AdsData = {
  balance?: Record<string, unknown>;
  daily?: Record<string, unknown>[];
  hourly?: unknown;
  campaigns?: unknown;
  settings?: unknown;
  gmsCampaign?: unknown;
  gmsItems?: unknown;
};

const ERROR_MESSAGES: Record<string, string> = {
  authorization_expired: "Shopee authorization expired. Ask an admin to reauthorize this shop.",
  permission_denied: "This Shopee app does not have permission for the requested Ads API.",
  rate_limited: "Shopee rate-limited the request. Wait briefly and try again.",
  provider_unavailable: "Shopee is temporarily unavailable. Try again later.",
  invalid_provider_response: "Shopee returned a response that did not match the verified contract.",
  connection_not_active: "This shop connection is not active.",
  invalid_request: "Check the selected dates and filters.",
};

export function AdsDashboard({ connections }: { connections: AdsConnection[] }) {
  const today = new Date();
  const [selectedConnectionId, setSelectedConnectionId] = useState(connections[0]?.id ?? "");
  const [startDate, setStartDate] = useState<Date | undefined>(() => subDays(new Date(), 29));
  const [endDate, setEndDate] = useState<Date | undefined>(() => new Date());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AdsData>({});
  const activeController = useRef<AbortController | null>(null);

  useEffect(() => () => activeController.current?.abort(), []);

  const cancelActiveRequest = () => {
    activeController.current?.abort();
    activeController.current = null;
    setLoading(false);
  };

  const fetchAction = async (
    signal: AbortSignal,
    action: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> => {
    const response = await fetch("/api/shopee/ads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId: selectedConnectionId, action, params }),
      credentials: "same-origin",
      signal,
    });
    const body = await response.json().catch(() => ({ error: "provider_unavailable" })) as { error?: string; data?: unknown };
    if (!response.ok || body.error) throw new Error(body.error ?? "provider_unavailable");
    return body.data;
  };

  const queryData = async () => {
    if (!selectedConnectionId || !startDate || !endDate) return;
    activeController.current?.abort();
    const controller = new AbortController();
    activeController.current = controller;
    setLoading(true);
    setError(null);
    setData({});

    const dates = { start_date: format(startDate, "dd-MM-yyyy"), end_date: format(endDate, "dd-MM-yyyy") };
    const requests = [
      ["get_total_balance", undefined],
      ["get_all_cpc_ads_daily_performance", dates],
      ["get_all_cpc_ads_hourly_performance", { performance_date: dates.end_date }],
      ["get_product_level_campaign_id_list", { ad_type: "all" }],
      ["get_gms_campaign_performance", dates],
      ["get_gms_item_performance", { ...dates, page_size: 100 }],
    ] as const;

    try {
      const values = new Map<string, unknown>();
      const failures: string[] = [];
      // Sequential on purpose: these are live provider calls and Shopee exposes
      // shop/partner throttling without a published numeric quota.
      for (const [action, params] of requests) {
        try {
          values.set(action, await fetchAction(controller.signal, action, params));
        } catch (requestError) {
          if (controller.signal.aborted) return;
          failures.push(requestError instanceof Error ? requestError.message : "provider_unavailable");
        }
      }

      const campaignResult = values.get("get_product_level_campaign_id_list") as { campaign_list?: Array<{ campaign_id?: number }> } | undefined;
      const campaignIds = campaignResult?.campaign_list
        ?.map((campaign) => campaign.campaign_id)
        .filter((id): id is number => typeof id === "number") ?? [];
      if (campaignIds.length > 0) {
        try {
          values.set("get_product_level_campaign_setting_info", await fetchAction(controller.signal, "get_product_level_campaign_setting_info", {
            campaign_id_list: campaignIds,
            info_type_list: [1, 2, 3, 4],
          }));
        } catch (settingsError) {
          failures.push(settingsError instanceof Error ? settingsError.message : "provider_unavailable");
        }
      }

      setData({
        balance: values.get("get_total_balance") as Record<string, unknown> | undefined,
        daily: values.get("get_all_cpc_ads_daily_performance") as Record<string, unknown>[] | undefined,
        hourly: values.get("get_all_cpc_ads_hourly_performance"),
        campaigns: campaignResult,
        settings: values.get("get_product_level_campaign_setting_info"),
        gmsCampaign: values.get("get_gms_campaign_performance"),
        gmsItems: values.get("get_gms_item_performance"),
      });
      if (failures.length > 0) {
        const unique = [...new Set(failures)];
        setError(unique.map((code) => ERROR_MESSAGES[code] ?? "One or more Shopee queries failed.").join(" "));
      }
    } catch (requestError) {
      if (!controller.signal.aborted) {
        const code = requestError instanceof Error ? requestError.message : "provider_unavailable";
        setError(ERROR_MESSAGES[code] ?? "Shopee Ads query failed.");
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  if (connections.length === 0) {
    return <div className="flex h-64 items-center justify-center rounded-xl border bg-white"><p className="text-zinc-500">No active Shopee connections found.</p></div>;
  }

  const money = (value: unknown) => typeof value === "number"
    ? `฿${value.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "-";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="min-w-[240px] flex-1 space-y-1.5">
          <label className="text-sm font-medium">Shop Connection</label>
          <Select value={selectedConnectionId} onValueChange={(value: string | null) => {
            if (!value) return;
            cancelActiveRequest();
            setSelectedConnectionId(value);
          }}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select a shop" /></SelectTrigger>
            <SelectContent>{connections.map((connection) => <SelectItem key={connection.id} value={connection.id}>{connection.shopName || `Shop ID: ${connection.shopId}`}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {([["Start Date", startDate, setStartDate], ["End Date", endDate, setEndDate]] as const).map(([label, value, setter]) => (
          <div key={label} className="space-y-1.5">
            <label className="text-sm font-medium">{label}</label>
            <Popover>
              <PopoverTrigger className={cn("inline-flex h-9 w-[200px] items-center rounded-md border px-4 py-2 text-left text-sm", !value && "text-muted-foreground")}>
                <IconCalendar className="mr-2 h-4 w-4" />{value ? format(value, "PPP") : "Pick a date"}
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={value} onSelect={(date: Date | undefined) => {
                if (!date) return;
                cancelActiveRequest();
                setter(date);
              }} disabled={{ before: subMonths(today, 6), after: today }} /></PopoverContent>
            </Popover>
          </div>
        ))}
        <Button onClick={queryData} disabled={loading} className="w-full sm:w-auto">
          {loading ? <><IconLoader2 className="mr-2 h-4 w-4 animate-spin" />Querying</> : "Query Data"}
        </Button>
      </div>

      {error ? <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-800">{error}</div> : null}

      <Tabs defaultValue="overview" className="w-full">
        <TabsList><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="daily">Daily</TabsTrigger><TabsTrigger value="hourly">Hourly</TabsTrigger><TabsTrigger value="campaigns">Campaigns</TabsTrigger><TabsTrigger value="gms">GMV Max</TabsTrigger></TabsList>
        <TabsContent value="overview" className="mt-4">
          <Card><CardHeader><CardTitle className="text-sm">Total Balance</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{money(data.balance?.total_balance)}</div><p className="text-xs text-muted-foreground">Shopee Ads credits (live)</p></CardContent></Card>
        </TabsContent>
        <TabsContent value="daily" className="mt-4">
          <Card><CardHeader><CardTitle>Daily CPC Ads Performance</CardTitle><CardDescription>Live performance; no rows are stored in Firestore.</CardDescription></CardHeader><CardContent>
            {data.daily?.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="py-2">Date</th><th className="px-4 text-right">Impressions</th><th className="px-4 text-right">Clicks</th><th className="px-4 text-right">CTR</th><th className="px-4 text-right">Expense</th><th className="pl-4 text-right">Direct GMV</th></tr></thead><tbody>{data.daily.map((row, index) => <tr key={`${String(row.date)}-${index}`} className="border-b last:border-0"><td className="py-2">{String(row.date)}</td><td className="px-4 text-right">{String(row.impression)}</td><td className="px-4 text-right">{String(row.clicks)}</td><td className="px-4 text-right">{typeof row.ctr === "number" ? `${row.ctr.toFixed(2)}%` : "-"}</td><td className="px-4 text-right">{money(row.expense)}</td><td className="pl-4 text-right">{money(row.direct_gmv)}</td></tr>)}</tbody></table></div> : <p className="text-sm text-zinc-500">No daily rows loaded.</p>}
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="hourly" className="mt-4"><RawResult title="Hourly Performance" value={data.hourly} /></TabsContent>
        <TabsContent value="campaigns" className="mt-4 grid gap-4 lg:grid-cols-2"><RawResult title="Product Campaign IDs" value={data.campaigns} /><RawResult title="Campaign Settings" value={data.settings} /></TabsContent>
        <TabsContent value="gms" className="mt-4 grid gap-4 lg:grid-cols-2"><RawResult title="GMV Max Campaign" value={data.gmsCampaign} /><RawResult title="GMV Max Items" value={data.gmsItems} /></TabsContent>
      </Tabs>
    </div>
  );
}

function RawResult({ title, value }: { title: string; value: unknown }) {
  const serialized = useMemo(() => JSON.stringify(value ?? {}, null, 2), [value]);
  return <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent><pre className="max-h-[480px] overflow-auto rounded-md bg-zinc-100 p-4 text-xs">{serialized}</pre></CardContent></Card>;
}
