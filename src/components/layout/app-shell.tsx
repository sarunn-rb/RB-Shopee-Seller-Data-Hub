"use client";

import {
  IconChartBar,
  IconChevronsLeft,
  IconChevronsRight,
  IconHistory,
  IconLayoutDashboard,
  IconLogout,
  IconMenu2,
  IconPlugConnected,
  IconSettings,
  IconUserCircle,
  IconUsers,
  IconX,
  type Icon,
} from "@tabler/icons-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { getFirebaseClientAuth } from "@/lib/firebase/client";
import { cn } from "@/lib/utils";
import { signOut } from "firebase/auth";
import type { Role } from "@/types/firestore";

type NavigationItem = {
  href: string;
  label: string;
  icon: Icon;
  adminOnly?: boolean;
};

const navigation: NavigationItem[] = [
  { href: "/dashboard", label: "Overview", icon: IconLayoutDashboard },
  { href: "/ads", label: "Shopee Ads", icon: IconChartBar },
  { href: "/connections", label: "Connections", icon: IconPlugConnected },
  { href: "/logs", label: "API Logs", icon: IconHistory },
  { href: "/settings/members", label: "Members", icon: IconUsers, adminOnly: true },
  { href: "/settings", label: "Settings", icon: IconSettings },
];

function SidebarContent({
  collapsed = false,
  onNavigate,
  onToggle,
  role,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
  onToggle?: () => void;
  role: Role;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-sidebar px-4 py-5 text-sidebar-foreground">
      <Link
        href="/dashboard"
        className={cn(
          "flex items-center",
          collapsed ? "min-h-10 justify-center" : "min-h-20",
        )}
        onClick={onNavigate}
      >
        <Image
          src={
            collapsed
              ? "/brand/rabbit-bytes-mark.png"
              : "/brand/rabbit-bytes-wordmark-white.png"
          }
          alt="Rabbit Bytes"
          width={collapsed ? 40 : 204}
          height={collapsed ? 40 : 59}
          priority
          className={cn(
            "h-auto object-contain",
            collapsed ? "w-10" : "w-[204px]",
          )}
        />
      </Link>



      <nav
        className={cn("space-y-1", collapsed ? "mt-8" : "mt-10")}
        aria-label="Main navigation"
      >
        {navigation.filter((item) => !item.adminOnly || role === "admin").map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const IconComponent = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group relative flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-[#d7d9dc] transition-colors hover:bg-sidebar-accent hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6b35]",
                isActive && "bg-sidebar-accent text-white",
                collapsed && "justify-center px-0",
              )}
            >
              {isActive ? (
                <span
                  className="absolute inset-y-2 -left-4 w-[3px] rounded-r bg-[#f4511e]"
                  aria-hidden="true"
                />
              ) : null}
              <IconComponent size={20} stroke={1.7} aria-hidden="true" />
              <span className={cn(collapsed && "sr-only")}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {onToggle ? (
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "mt-auto flex h-11 items-center gap-3 border-t border-sidebar-border pt-4 text-sm text-[#d7d9dc] hover:text-white focus-visible:outline-2 focus-visible:outline-[#ff6b35]",
            collapsed && "justify-center",
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <IconChevronsRight size={20} stroke={1.7} />
          ) : (
            <IconChevronsLeft size={20} stroke={1.7} />
          )}
          <span className={cn(collapsed && "sr-only")}>Collapse</span>
        </button>
      ) : null}
    </div>
  );
}

export function AppShell({ children, role, email }: { children: ReactNode; role: Role; email: string }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const router = useRouter();

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => undefined);
    await signOut(getFirebaseClientAuth()).catch(() => undefined);
    router.push("/login");
    router.refresh();
  };

  return (
    <div
      className={cn(
        "min-h-dvh bg-white lg:grid",
        desktopCollapsed
          ? "lg:grid-cols-[88px_minmax(0,1fr)]"
          : "lg:grid-cols-[288px_minmax(0,1fr)]",
      )}
    >
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden transition-[width] duration-200 lg:block",
          desktopCollapsed ? "w-[88px]" : "w-72",
        )}
      >
        <SidebarContent
          collapsed={desktopCollapsed}
          onToggle={() => setDesktopCollapsed((value) => !value)}
          role={role}
        />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative h-full w-[min(288px,86vw)] shadow-2xl">
            <button
              type="button"
              className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-md text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#ff6b35]"
              aria-label="Close navigation"
              onClick={() => setMobileOpen(false)}
            >
              <IconX size={20} />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} role={role} />
          </aside>
        </div>
      ) : null}

      <div className="min-w-0 lg:col-start-2">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-white/95 px-4 backdrop-blur-sm sm:px-7 lg:px-10">
          <button
            type="button"
            className="grid size-9 place-items-center rounded-md border text-[#35393e] hover:bg-muted focus-visible:outline-2 focus-visible:outline-[#f4511e] lg:hidden"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
          >
            <IconMenu2 size={20} stroke={1.8} />
          </button>

          <div className="ml-auto flex items-center gap-2 text-sm font-medium text-[#26292d]">
            <IconUserCircle size={32} stroke={1.4} className="text-[#555b62]" />
            <span className="hidden max-w-52 truncate sm:inline">{email || role}</span>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs capitalize text-zinc-600">{role}</span>
            <button
              type="button"
              onClick={logout}
              className="grid size-9 place-items-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
              aria-label="Sign out"
            >
              <IconLogout size={18} stroke={1.7} />
            </button>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
