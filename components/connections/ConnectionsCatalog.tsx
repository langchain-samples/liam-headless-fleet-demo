"use client";
import * as React from "react";
import {
  CheckCircle2,
  Search as SearchIcon,
  LayoutGrid,
  Plug,
  Loader2,
  ExternalLink,
  Link2Off,
} from "lucide-react";
import { Button, Badge, Input, EmptyState, Skeleton, cn } from "@/components/ui";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { AgentIcon } from "@/components/brand/agentIcon";
import { Auth } from "@/lib/fleet/endpoints";
import type { ProviderResponse, TokenSummary } from "@/lib/fleet/types";
import {
  SERVICE_CATALOG,
  type ServiceCategory,
  type ServiceDef,
  matchProviders,
  matchTokens,
  pickProvider,
  statusFor,
} from "./catalog";
import { useConnect } from "./useConnect";
import { errMessage } from "./shared";

const CATEGORY_ORDER: ServiceCategory[] = [
  "Google",
  "Microsoft",
  "Developer",
  "Communication",
  "Sales & CRM",
  "Productivity",
  "Other",
];

function ServiceCard({
  svc,
  providers,
  tokens,
  connecting,
  verificationUrl,
  popupBlocked,
  onConnect,
  onDisconnect,
}: {
  svc: ServiceDef;
  providers: ProviderResponse[];
  tokens: TokenSummary[];
  connecting: boolean;
  verificationUrl: string | null;
  popupBlocked: boolean;
  onConnect: () => void;
  onDisconnect: (token: TokenSummary) => void;
}) {
  const status = statusFor(svc, providers, tokens);
  const myTokens = matchTokens(svc, tokens);

  return (
    <div className="group relative flex items-start gap-3.5 rounded-xl border border-line bg-card px-4 py-3.5 transition-colors hover:border-line-strong hover:bg-paper-2/40">
      <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-line bg-paper-2">
        <AgentIcon icon={svc.icon} color={svc.color} size={20} />
      </span>

      <div className="min-w-0 flex-1">
        <h4 className="truncate text-[14px] font-semibold text-ink">{svc.name}</h4>
        <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-ink-faint">{svc.description}</p>
        {status === "connected" && !connecting && (
          <p className="mt-1 text-[11.5px] font-medium text-good">Your agents can use this.</p>
        )}
        {connecting && verificationUrl && (
          <a
            href={verificationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "dm-focus mt-1.5 inline-flex items-center gap-1 rounded text-[12px] font-medium text-navy hover:underline",
              popupBlocked &&
                "border border-navy/30 bg-navy/5 px-2 py-1 no-underline hover:bg-navy/10",
            )}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {popupBlocked ? "Popup blocked — open authorization" : "Open authorization"}
          </a>
        )}
      </div>

      <div className="flex shrink-0 items-center self-center">
        {status === "connected" ? (
          <div className="flex items-center gap-2">
            <Badge tone="good" className="gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Connected
            </Badge>
            <button
              onClick={() => myTokens[0] && onDisconnect(myTokens[0])}
              className="dm-focus rounded-md px-2 py-1 text-[12px] font-medium text-ink-faint opacity-0 transition hover:bg-paper-2 hover:text-bad group-hover:opacity-100"
            >
              Disconnect
            </button>
          </div>
        ) : status === "available" ? (
          <Button size="sm" variant="secondary" onClick={onConnect} disabled={connecting}>
            {connecting ? <Loader2 className="h-4 w-4 dm-spin" /> : null}
            {connecting ? "Connecting" : "Connect"}
          </Button>
        ) : (
          <span
            className="inline-flex cursor-not-allowed items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-[12px] font-medium text-ink-faint/70"
            title="No provider registered for this service yet."
          >
            <Link2Off className="h-3.5 w-3.5" /> Unavailable
          </span>
        )}
      </div>
    </div>
  );
}

export function ConnectionsCatalog({
  providers,
  tokens,
  loading,
  error,
  reloadTokens,
}: {
  providers: ProviderResponse[];
  tokens: TokenSummary[];
  loading: boolean;
  error: string | null;
  reloadTokens: () => void;
}) {
  const toast = useToast();
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<"all" | "connected">("all");
  const [revoking, setRevoking] = React.useState<TokenSummary | null>(null);
  const [revokeBusy, setRevokeBusy] = React.useState(false);

  const connection = useConnect(reloadTokens);

  const connectedCount = React.useMemo(
    () => SERVICE_CATALOG.filter((s) => statusFor(s, providers, tokens) === "connected").length,
    [providers, tokens],
  );

  // in-memory filter + search over the curated catalog
  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return SERVICE_CATALOG.filter((s) => {
      if (filter === "connected" && statusFor(s, providers, tokens) !== "connected") return false;
      if (!q) return true;
      return s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
    });
  }, [query, filter, providers, tokens]);

  const groups = React.useMemo(() => {
    const map = new Map<ServiceCategory, ServiceDef[]>();
    for (const s of visible) (map.get(s.category) ?? map.set(s.category, []).get(s.category)!).push(s);
    return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => [c, map.get(c)!] as const);
  }, [visible]);

  const doConnect = (svc: ServiceDef) => {
    const provider = pickProvider(matchProviders(svc, providers), tokens);
    if (!provider) {
      toast.error("Cannot connect", "No provider registered for this service.");
      return;
    }
    void connection.connect(provider.provider_slug, svc.scopes);
  };

  const doRevoke = async () => {
    if (!revoking) return;
    setRevokeBusy(true);
    try {
      await Auth.tokens.remove(revoking.id);
      toast.success("Disconnected", revoking.provider_slug ?? "Connection removed.");
      setRevoking(null);
      reloadTokens();
    } catch (e) {
      toast.error("Could not disconnect", errMessage(e));
    } finally {
      setRevokeBusy(false);
    }
  };

  const RAIL = [
    { id: "all" as const, label: "All", count: SERVICE_CATALOG.length },
    { id: "connected" as const, label: "Connected", count: connectedCount },
  ];

  return (
    <div className="rounded-2xl border border-line bg-card/60">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="flex items-center gap-2">
          <Plug className="h-[18px] w-[18px] text-navy-400" />
          <h3 className="text-[15px] font-semibold text-ink">Services</h3>
          <span className="text-[13px] text-ink-faint">· connected services are available to every agent you build</span>
        </div>
      </div>

      <div className="flex flex-col gap-0 md:flex-row">
        {/* left rail */}
        <aside className="shrink-0 border-b border-line p-3 md:w-48 md:border-b-0 md:border-r">
          <div className="relative mb-3">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="pl-8"
              aria-label="Search services"
            />
          </div>
          <nav className="flex gap-1 md:flex-col">
            {RAIL.map((r) => {
              const active = filter === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => setFilter(r.id)}
                  className={cn(
                    "dm-focus flex flex-1 items-center justify-between rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors md:flex-none",
                    active ? "bg-navy text-white" : "text-ink-soft hover:bg-paper-2 hover:text-ink",
                  )}
                >
                  <span className="flex items-center gap-2">
                    {r.id === "all" ? <LayoutGrid className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                    {r.label}
                  </span>
                  <span className={cn("text-[12px] tabular-nums", active ? "text-white/70" : "text-ink-faint")}>
                    {r.count}
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* catalog grid */}
        <div className="min-w-0 flex-1 p-5">
          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-[72px] w-full rounded-xl" />
              ))}
            </div>
          ) : error ? (
            <EmptyState
              icon={<Plug className="h-7 w-7" />}
              title="Couldn't load connections"
              description={error}
            />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<SearchIcon className="h-7 w-7" />}
              title="No matches"
              description={filter === "connected" ? "No connected services match your search." : "Nothing matches your search."}
            />
          ) : (
            <div className="space-y-7">
              {groups.map(([category, list]) => (
                <section key={category}>
                  <h4 className="mb-2.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
                    {category}
                    <span className="text-ink-faint/60">({list.length})</span>
                  </h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {list.map((svc) => {
                      const connecting =
                        connection.activeSlug != null &&
                        connection.phase === "pending" &&
                        matchProviders(svc, providers).some(
                          (p) => p.provider_slug === connection.activeSlug,
                        );
                      return (
                        <ServiceCard
                          key={svc.key}
                          svc={svc}
                          providers={providers}
                          tokens={tokens}
                          connecting={connecting}
                          verificationUrl={connecting ? connection.verificationUrl : null}
                          popupBlocked={connecting && connection.popupBlocked}
                          onConnect={() => doConnect(svc)}
                          onDisconnect={(t) => setRevoking(t)}
                        />
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!revoking}
        onClose={() => setRevoking(null)}
        onConfirm={doRevoke}
        title="Disconnect this service?"
        message={
          <>
            Revoke the connection for{" "}
            <span className="font-medium text-ink">{revoking?.provider_slug}</span>? Agents using it will lose
            access until you reconnect.
          </>
        }
        confirmLabel="Disconnect"
        danger
        loading={revokeBusy}
      />
    </div>
  );
}
