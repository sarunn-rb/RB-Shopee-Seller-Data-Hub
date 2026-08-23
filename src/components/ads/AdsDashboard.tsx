"use client";

import { useState } from "react";
import { ShopeeConnection } from "@/types/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { IconLoader2, IconCalendar } from "@tabler/icons-react";

interface AdsDashboardProps {
  connections: (ShopeeConnection & { id: string })[];
}

export function AdsDashboard({ connections }: AdsDashboardProps) {
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>(
    connections.length > 0 ? connections[0].id : ""
  );
  // Default to 1 July 2026 for sandbox testing
  const [startDate, setStartDate] = useState<Date | undefined>(new Date(2026, 6, 1));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date(2026, 6, 15));
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [data, setData] = useState<{
    balance?: Record<string, unknown>;
    daily?: Record<string, unknown>[];
    hourly?: unknown;
    campaigns?: unknown;
    gms?: unknown;
  }>({});

  const fetchData = async () => {
    if (!selectedConnectionId) return;
    
    setLoading(true);
    setError(null);
    setData({});
    
    try {
      const formattedStartDate = startDate ? format(startDate, "dd-MM-yyyy") : "";
      const formattedEndDate = endDate ? format(endDate, "dd-MM-yyyy") : "";

      // Run multiple API queries in parallel or sequence depending on requirements
      const endpoints = [
        { action: "get_total_balance" },
        { action: "get_daily_performance", params: { start_date: formattedStartDate, end_date: formattedEndDate } },
        { action: "get_hourly_performance", params: { date: formattedEndDate } }, // fetch hourly for end date
        { action: "get_product_campaign_id_list" },
        { action: "get_gms_campaign_performance", params: { start_date: formattedStartDate, end_date: formattedEndDate } }
      ];

      const results = await Promise.allSettled(
        endpoints.map(async (ep) => {
          const res = await fetch("/api/shopee/ads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ connectionId: selectedConnectionId, action: ep.action, params: ep.params })
          });
          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            throw new Error(errBody.error || `Error ${res.status}`);
          }
          const json = await res.json();
          if (json.error) throw new Error(json.error);
          return { action: ep.action, data: json.data };
        })
      );

      const newData: Record<string, unknown> = {};
      const errors: string[] = [];

      results.forEach((result, index) => {
        const action = endpoints[index].action;
        if (result.status === "fulfilled") {
          newData[action] = result.value.data;
        } else {
          errors.push(`${action}: ${result.reason.message}`);
        }
      });

      const dailyData = newData["get_daily_performance"] as Record<string, unknown> | undefined;

      setData({
        balance: newData["get_total_balance"] as Record<string, unknown>,
        daily: (dailyData?.response || dailyData) as Record<string, unknown>[],
        hourly: newData["get_hourly_performance"],
        campaigns: newData["get_product_campaign_id_list"],
        gms: newData["get_gms_campaign_performance"],
      });

      if (errors.length > 0) {
        // Some requests might fail (like 404 for gms in sandbox), we just show them in console or warn
        console.warn("Some endpoints failed:", errors);
      }

    } catch (err: unknown) {
      const error = err as { message?: string };
      setError(error.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  if (connections.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border bg-white dark:bg-zinc-950">
        <p className="text-zinc-500">No active Shopee connections found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex flex-col space-y-1.5 flex-1 min-w-[240px]">
          <label className="text-sm font-medium">Shop Connection</label>
          <Select value={selectedConnectionId} onValueChange={(val: string | null) => val && setSelectedConnectionId(val)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a shop" />
            </SelectTrigger>
            <SelectContent>
              {connections.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.shopName || `Shop ID: ${c.shopId}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex flex-col space-y-1.5">
          <label className="text-sm font-medium">Start Date</label>
          <Popover>
            <PopoverTrigger className={cn(
              "inline-flex items-center justify-start whitespace-nowrap rounded-md text-sm font-normal transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 w-[200px] text-left",
              !startDate && "text-muted-foreground"
            )}>
              <IconCalendar className="mr-2 h-4 w-4" />
              {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={(date: Date | undefined) => date && setStartDate(date)}
              />
            </PopoverContent>
          </Popover>
        </div>
        
        <div className="flex flex-col space-y-1.5">
          <label className="text-sm font-medium">End Date</label>
          <Popover>
            <PopoverTrigger className={cn(
              "inline-flex items-center justify-start whitespace-nowrap rounded-md text-sm font-normal transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 w-[200px] text-left",
              !endDate && "text-muted-foreground"
            )}>
              <IconCalendar className="mr-2 h-4 w-4" />
              {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={(date: Date | undefined) => date && setEndDate(date)}
              />
            </PopoverContent>
          </Popover>
        </div>

        <Button onClick={fetchData} disabled={loading} className="w-full sm:w-auto mb-0.5">
          {loading ? <IconLoader2 className="mr-2 h-4 w-4 animate-spin" /> : "Query Data"}
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-red-700 dark:bg-red-900/30 dark:text-red-400">
          Error: {error}
        </div>
      )}

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="daily">Daily Performance</TabsTrigger>
          <TabsTrigger value="hourly">Hourly (End Date)</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns & GMS</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.balance ? `฿${((data.balance.total_balance as number) / 100000).toFixed(2)}` : "-"}
                </div>
                <p className="text-xs text-muted-foreground">Ads Credits</p>
              </CardContent>
            </Card>
            {/* Can add more overview cards here */}
          </div>
        </TabsContent>

        <TabsContent value="daily" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Daily CPC Ads Performance</CardTitle>
              <CardDescription>Performance metrics grouped by day.</CardDescription>
            </CardHeader>
            <CardContent>
              {data.daily && Array.isArray(data.daily) ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-2 pr-4">Date</th>
                        <th className="py-2 px-4 text-right">Impressions</th>
                        <th className="py-2 px-4 text-right">Clicks</th>
                        <th className="py-2 px-4 text-right">CTR</th>
                        <th className="py-2 px-4 text-right">Expense</th>
                        <th className="py-2 pl-4 text-right">GMV</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.daily.map((row: Record<string, unknown>, i: number) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-2 pr-4">{row.date as string}</td>
                          <td className="py-2 px-4 text-right">{row.impression as number}</td>
                          <td className="py-2 px-4 text-right">{row.clicks as number}</td>
                          <td className="py-2 px-4 text-right">{typeof row.ctr === 'number' ? row.ctr.toFixed(2) : '-'}%</td>
                          <td className="py-2 px-4 text-right">฿{typeof row.expense === 'number' ? (row.expense / 100000).toFixed(2) : '-'}</td>
                          <td className="py-2 pl-4 text-right">฿{typeof row.direct_gmv === 'number' ? (row.direct_gmv / 100000).toFixed(2) : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-zinc-500">No data loaded.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hourly" className="mt-4">
           <Card>
            <CardHeader>
              <CardTitle>Hourly Performance</CardTitle>
              <CardDescription>Check console or raw data if available</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-zinc-100 p-4 rounded-md overflow-x-auto dark:bg-zinc-900">
                {JSON.stringify(data.hourly || {}, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Product Campaigns</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-zinc-100 p-4 rounded-md overflow-x-auto dark:bg-zinc-900">
                  {JSON.stringify(data.campaigns || {}, null, 2)}
                </pre>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>GMV Max Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-zinc-100 p-4 rounded-md overflow-x-auto dark:bg-zinc-900">
                  {JSON.stringify(data.gms || {}, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
