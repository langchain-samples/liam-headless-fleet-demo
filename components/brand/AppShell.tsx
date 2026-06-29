"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Bot, MessagesSquare, Plug, Settings2, Menu, X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { DunderMifflinLogo } from "./DunderMifflinLogo";
import { PersonaSwitcher } from "./PersonaSwitcher";
import { LogoutButton } from "./LogoutButton";
import { usePersona } from "@/lib/personas";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (p: string) => boolean;
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { href: "/", label: "Admin Dashboard", icon: LayoutDashboard, match: (p) => p === "/", adminOnly: true },
  { href: "/agents", label: "Agents", icon: Bot, match: (p) => p.startsWith("/agents") },
  { href: "/threads", label: "Threads", icon: MessagesSquare, match: (p) => p.startsWith("/threads") },
  { href: "/connections", label: "Connections", icon: Plug, match: (p) => p.startsWith("/connections") },
  { href: "/admin", label: "Workspace", icon: Settings2, match: (p) => p.startsWith("/admin") },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const { isAdmin } = usePersona();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const nav = NAV.filter((item) => !item.adminOnly || isAdmin);

  // The login screen renders standalone — no sidebar / persona chrome.
  if (pathname === "/login") return <>{children}</>;

  const SidebarInner = (
    <>
      <div className="flex h-20 items-center border-b border-line px-5">
        <Link
          href={isAdmin ? "/" : "/agents"}
          className="dm-focus block w-full rounded"
          onClick={() => setMobileOpen(false)}
        >
          <DunderMifflinLogo />
        </Link>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {nav.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "dm-focus group flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-navy text-white shadow-sm" : "text-ink-soft hover:bg-paper-2 hover:text-ink",
              )}
            >
              <Icon className={cn("h-[18px] w-[18px]", active ? "text-white" : "text-ink-faint group-hover:text-ink-soft")} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="shrink-0 space-y-2 border-t border-line p-3">
        <PersonaSwitcher />
        <LogoutButton />
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen">
      {/* desktop sidebar — sticky full-height so the footer (persona + logout)
          is always visible without scrolling; only the nav list scrolls. */}
      <aside className="sticky top-0 hidden h-screen w-[244px] shrink-0 flex-col border-r border-line bg-card/70 backdrop-blur lg:flex">
        {SidebarInner}
      </aside>

      {/* mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-navy/30 backdrop-blur-[2px]" onClick={() => setMobileOpen(false)} />
          <aside className="dm-fade-in absolute left-0 top-0 flex h-full w-[260px] flex-col border-r border-line bg-card">
            {SidebarInner}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* mobile topbar */}
        <header className="flex h-16 items-center justify-between border-b border-line bg-card/70 px-4 backdrop-blur lg:hidden">
          <button
            className="dm-focus rounded-lg p-2 text-ink-soft hover:bg-paper-2"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <DunderMifflinLogo compact />
          <span className="w-9" />
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

/** Standard page header used inside routes. */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line bg-card/40 px-6 py-5 sm:px-8">
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold tracking-tight text-ink" style={{ fontFamily: "var(--font-serif)" }}>
          {title}
        </h1>
        {subtitle && <p className="mt-0.5 text-sm text-ink-faint">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Content container with standard padding. */
export function PageBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("px-6 py-6 sm:px-8", className)}>{children}</div>;
}
