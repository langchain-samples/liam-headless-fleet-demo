"use client";
import * as React from "react";
import Link from "next/link";
import { Plus, Search, Users, Building2, ArrowUpDown, Bot } from "lucide-react";
import { PageHeader, PageBody } from "@/components/brand/AppShell";
import {
  Button,
  Card,
  Badge,
  Input,
  Select,
  Skeleton,
  EmptyState,
  cn,
} from "@/components/ui";
import { AgentIconTile } from "@/components/brand/agentIcon";
import { Agents } from "@/lib/fleet/endpoints";
import { FleetClientError } from "@/lib/fleet/client";
import type { Agent } from "@/lib/fleet/types";
import {
  accessLevelLabel,
  accessLevelTone,
  visibilityLabel,
  ownerName,
  truncate,
} from "@/components/agents/helpers";
import { usePersona, personaFor } from "@/lib/personas";

const PAGE_SIZE = 24;

type Audience = "user" | "tenant";
type SortKey = "updated_at" | "created_at" | "name";

export default function AgentsPage() {
  const { current, currentId } = usePersona();
  const [name, setName] = React.useState("");
  const [debouncedName, setDebouncedName] = React.useState("");
  const [audience, setAudience] = React.useState<Audience>("user");
  const [sortBy, setSortBy] = React.useState<SortKey>("updated_at");
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc");

  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Debounce the name filter.
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedName(name.trim()), 300);
    return () => clearTimeout(t);
  }, [name]);

  // Reset pagination whenever server-side filters/sort change.
  React.useEffect(() => {
    setCursor(null);
  }, [debouncedName, sortBy, sortOrder]);

  const fetchPage = React.useCallback(
    async (activeCursor: string | null, signal: AbortSignal) => {
      const isFirst = !activeCursor;
      if (isFirst) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const res = await Agents.list({
          name: debouncedName || undefined,
          // Always fetch the full tenant roster; "Mine" filters by persona client-side
          // (the API's audience=user is scoped to the key, not the demo persona).
          audience: "tenant",
          sort_by: sortBy,
          sort_order: sortOrder,
          include: ["owner"],
          page_size: PAGE_SIZE,
          cursor: activeCursor || undefined,
        });
        if (signal.aborted) return;
        setAgents((prev) => (isFirst ? res.items : [...prev, ...res.items]));
        setNextCursor(res.next_cursor ?? null);
      } catch (e) {
        if (signal.aborted) return;
        const msg =
          e instanceof FleetClientError ? e.detail || e.message : "Could not reach the fleet.";
        setError(msg);
      } finally {
        if (!signal.aborted) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [debouncedName, sortBy, sortOrder],
  );

  React.useEffect(() => {
    const ctrl = new AbortController();
    fetchPage(cursor, ctrl.signal);
    return () => ctrl.abort();
  }, [cursor, fetchPage]);

  // "Mine" = agents attributed to the acting persona (client-side).
  const visible = React.useMemo(
    () => (audience === "user" ? agents.filter((a) => personaFor(a).id === currentId) : agents),
    [agents, audience, currentId],
  );

  return (
    <>
      <PageHeader
        title="Agents"
        subtitle="The Dunder Mifflin agent roster — every salesperson, every shift."
        actions={
          <Link href="/agents/new">
            <Button variant="primary">
              <Plus className="h-4 w-4" />
              New agent
            </Button>
          </Link>
        }
      />
      <PageBody>
        {/* Controls */}
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Filter by name…"
              className="pl-9"
              aria-label="Filter agents by name"
            />
          </div>

          {/* Audience toggle */}
          <div
            className="inline-flex overflow-hidden rounded-[10px] border border-line-strong"
            role="group"
            aria-label="Audience"
          >
            <button
              onClick={() => setAudience("user")}
              className={cn(
                "dm-focus inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium transition-colors",
                audience === "user"
                  ? "bg-navy text-white"
                  : "bg-card text-ink-soft hover:bg-paper-2",
              )}
            >
              <Users className="h-3.5 w-3.5" />
              Mine
            </button>
            <button
              onClick={() => setAudience("tenant")}
              className={cn(
                "dm-focus inline-flex items-center gap-1.5 border-l border-line-strong px-3 py-2 text-[13px] font-medium transition-colors",
                audience === "tenant"
                  ? "bg-navy text-white"
                  : "bg-card text-ink-soft hover:bg-paper-2",
              )}
            >
              <Building2 className="h-3.5 w-3.5" />
              Tenant
            </button>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              aria-label="Sort by"
              className="w-[150px]"
            >
              <option value="updated_at">Last updated</option>
              <option value="created_at">Date created</option>
              <option value="name">Name</option>
            </Select>
            <Button
              variant="secondary"
              size="icon"
              aria-label={`Sort ${sortOrder === "asc" ? "ascending" : "descending"}`}
              title={sortOrder === "asc" ? "Ascending" : "Descending"}
              onClick={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
            >
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <RosterSkeleton />
        ) : error ? (
          <EmptyState
            icon={<Bot className="h-8 w-8" />}
            title="The phone lines are down"
            description={error}
            action={
              <Button variant="secondary" onClick={() => fetchPage(null, new AbortController().signal)}>
                Try again
              </Button>
            }
          />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<Bot className="h-8 w-8" />}
            title={
              debouncedName
                ? "No agents match that name"
                : audience === "user"
                  ? `${current.name.split(" ")[0]} hasn't built any agents yet`
                  : "No agents on the roster yet"
            }
            description={
              debouncedName
                ? "Bears. Beets. No matching agents. Try a different search."
                : audience === "user"
                  ? "Switch to Tenant to see everyone's agents, or hire a new one."
                  : "Every great branch starts with one hire. Spin up your first agent to get the fleet rolling."
            }
            action={
              !debouncedName && (
                <Link href="/agents/new">
                  <Button variant="primary">
                    <Plus className="h-4 w-4" />
                    New agent
                  </Button>
                </Link>
              )
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((a) => (
                <AgentCard key={a.id} agent={a} />
              ))}
            </div>
            {/* When filtering "Mine" client-side, still allow loading more tenant pages. */}
            {nextCursor && (
              <div className="mt-6 flex justify-center">
                <Button
                  variant="secondary"
                  loading={loadingMore}
                  onClick={() => setCursor(nextCursor)}
                >
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </PageBody>
    </>
  );
}

function AgentCard({ agent }: { agent: Agent }) {
  return (
    <Link
      href={`/agents/${agent.id}`}
      className="dm-focus group block rounded-[var(--radius-card)]"
    >
      <Card className="h-full p-5 transition-all hover:-translate-y-0.5 hover:border-line-strong hover:shadow-md">
        <div className="flex items-start gap-3.5">
          <AgentIconTile icon={agent.display?.icon} color={agent.display?.icon_color} size={44} />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[15px] font-semibold tracking-tight text-ink group-hover:text-navy">
              {agent.name}
            </h3>
            <p className="mt-0.5 truncate text-[12px] text-ink-faint">
              {ownerName(agent)}
            </p>
          </div>
        </div>

        <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-[13px] leading-relaxed text-ink-soft">
          {truncate(agent.description, 160) || "No description provided."}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {agent.model?.id && (
            <Badge tone="neutral" className="font-mono">
              {agent.model.id}
            </Badge>
          )}
          <Badge tone="navy">{visibilityLabel(agent.permissions)}</Badge>
          {agent.access_level && (
            <Badge tone={accessLevelTone(agent.access_level)}>
              {accessLevelLabel(agent.access_level)}
            </Badge>
          )}
        </div>
      </Card>
    </Link>
  );
}

function RosterSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="p-5">
          <div className="flex items-start gap-3.5">
            <Skeleton className="h-11 w-11 rounded-[10px]" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
          <div className="mt-3 space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
          <div className="mt-4 flex gap-1.5">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </Card>
      ))}
    </div>
  );
}
