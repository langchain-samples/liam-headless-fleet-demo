"use client";
import * as React from "react";
import Link from "next/link";
import {
  Bot, MessagesSquare, KeyRound, Boxes, Plus, ArrowRight, Plug, Sparkles,
  Users, ShieldCheck, ChevronRight,
} from "lucide-react";
import { Card, Badge, Skeleton, cn } from "@/components/ui";
import { AgentIconTile } from "@/components/brand/agentIcon";
import { Agents, Models, Secrets, Threads } from "@/lib/fleet/endpoints";
import type { Agent, FleetModel } from "@/lib/fleet/types";
import {
  usePersona, PERSONAS, PersonaAvatar, personaFor, type Persona,
} from "@/lib/personas";

interface Stats {
  agents: Agent[];
  models: FleetModel[];
  secretNames: Set<string>;
  attention: number | null;
}

function uniqueRequiredSecrets(models: FleetModel[]): string[] {
  const s = new Set<string>();
  for (const m of models) for (const r of m.required_secrets ?? []) s.add(r);
  return [...s];
}

export function Dashboard() {
  const { current, isAdmin } = usePersona();
  const [data, setData] = React.useState<Stats | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      // Tenant view = everyone's agents (fall back to user view if forbidden/empty).
      let agents: Agent[] = [];
      try {
        const tenant = await Agents.list({
          audience: "tenant", include: ["owner"], sort_by: "updated_at", sort_order: "desc", page_size: 100,
        });
        agents = tenant.items;
      } catch {
        /* fall through */
      }
      if (agents.length === 0) {
        const mine = await Agents.list({
          audience: "user", include: ["owner"], sort_by: "updated_at", sort_order: "desc", page_size: 100,
        });
        agents = mine.items;
      }
      const [modelsRes, secretsRes] = await Promise.all([
        Models.list({ include_oss_models: true }),
        Secrets.list({ page_size: 100 }),
      ]);
      let attention: number | null = null;
      if (agents[0]) {
        try {
          attention = (await Threads.count(agents[0].id)).attention_count;
        } catch {
          attention = null;
        }
      }
      setData({
        agents,
        models: modelsRes.items,
        secretNames: new Set(secretsRes.items.map((s) => s.name)),
        attention,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not reach the fleet.";
      setError(msg);
    }
  }, []);

  React.useEffect(() => {
    let alive = true;
    load().catch(() => {});
    return () => {
      alive = false;
      void alive;
    };
  }, [load]);

  const required = data ? uniqueRequiredSecrets(data.models) : [];
  const missing = data ? required.filter((r) => !data.secretNames.has(r)) : [];

  // Group agents by persona.
  const byPersona = React.useMemo(() => {
    const m = new Map<string, Agent[]>();
    for (const a of data?.agents ?? []) {
      const p = personaFor(a);
      if (!m.has(p.id)) m.set(p.id, []);
      m.get(p.id)!.push(a);
    }
    return m;
  }, [data?.agents]);

  const activeUsers = PERSONAS.filter((p) => (byPersona.get(p.id)?.length ?? 0) > 0).length;

  return (
    <div className="space-y-7">
      {/* Acting-as banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-line bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <PersonaAvatar persona={current} size={38} />
          <div>
            <p className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
              {current.name}
              {isAdmin && <ShieldCheck className="h-3.5 w-3.5 text-accent" />}
            </p>
            <p className="text-[12px] text-ink-faint">
              {isAdmin
                ? "Admin view — you can see every employee's agents."
                : `${current.title} · viewing your own agents.`}
            </p>
          </div>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={<Bot className="h-5 w-5" />} label={isAdmin ? "Agents (all)" : "Your agents"}
          value={data ? (isAdmin ? data.agents.length : (byPersona.get(current.id)?.length ?? 0)) : undefined}
          href="/agents" hint="on the roster" />
        <StatTile icon={<Users className="h-5 w-5" />} label="Active employees"
          value={data ? activeUsers : undefined} href="#people" hint="have created agents"
          tone="navy" />
        <StatTile icon={<Boxes className="h-5 w-5" />} label="Models"
          value={data ? data.models.length : undefined} href="/admin" hint="available" />
        <StatTile icon={<KeyRound className="h-5 w-5" />} label="Model keys"
          value={data ? `${required.length - missing.length}` : undefined}
          href="/admin" hint={missing.length ? `${missing.length} missing` : "all set"}
          tone={missing.length ? "bad" : "good"} />
      </div>

      {error && !data && (
        <Card><div className="p-6 text-center text-sm text-bad">{error}</div></Card>
      )}

      {isAdmin ? (
        <AdminPeople data={data} byPersona={byPersona} />
      ) : (
        <MemberView persona={current} agents={byPersona.get(current.id) ?? []} loading={!data} />
      )}
    </div>
  );
}

/* ---------------------------- admin: people ---------------------------- */
function AdminPeople({
  data, byPersona,
}: {
  data: Stats | null;
  byPersona: Map<string, Agent[]>;
}) {
  const ordered = [...PERSONAS].sort(
    (a, b) => (byPersona.get(b.id)?.length ?? 0) - (byPersona.get(a.id)?.length ?? 0),
  );
  return (
    <div id="people">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink">The Scranton branch</h2>
        <Link href="/agents" className="text-[13px] font-medium text-navy-400 hover:text-navy">
          All agents →
        </Link>
      </div>
      {!data ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[120px]" />)}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {ordered.map((p) => (
            <PersonCard key={p.id} persona={p} agents={byPersona.get(p.id) ?? []} />
          ))}
        </div>
      )}
    </div>
  );
}

function PersonCard({ persona, agents }: { persona: Persona; agents: Agent[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line bg-paper-2/40 px-4 py-3">
        <PersonaAvatar persona={persona} size={40} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-[14px] font-semibold text-ink">
            {persona.name}
            {persona.role === "admin" && <ShieldCheck className="h-3 w-3 text-accent" />}
          </p>
          <p className="truncate text-[12px] text-ink-faint">{persona.title}</p>
        </div>
        <Badge tone={agents.length ? "navy" : "neutral"}>
          {agents.length} agent{agents.length === 1 ? "" : "s"}
        </Badge>
      </div>
      <div className="p-3">
        {agents.length === 0 ? (
          <p className="px-1 py-2 text-[12px] text-ink-faint">No agents yet.</p>
        ) : (
          <div className="space-y-1">
            {agents.slice(0, 4).map((a) => (
              <Link
                key={a.id}
                href={`/agents/${a.id}`}
                className="dm-focus group flex items-center gap-2.5 rounded-[8px] px-2 py-1.5 hover:bg-paper-2"
              >
                <AgentIconTile icon={a.display?.icon} color={a.display?.icon_color} size={26} />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink group-hover:text-navy">
                  {a.name}
                </span>
                {a.model?.id && <span className="hidden truncate text-[11px] text-ink-faint sm:block">{a.model.id}</span>}
                <ChevronRight className="h-3.5 w-3.5 text-line-strong group-hover:text-navy-400" />
              </Link>
            ))}
            {agents.length > 4 && (
              <p className="px-2 pt-1 text-[11px] text-ink-faint">+{agents.length - 4} more</p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

/* ---------------------------- member view ---------------------------- */
function MemberView({ persona, agents, loading }: { persona: Persona; agents: Agent[]; loading: boolean }) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-ink">Your agents</h2>
          <Link href="/agents" className="text-[13px] font-medium text-navy-400 hover:text-navy">View all →</Link>
        </div>
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[88px]" />)}
          </div>
        ) : agents.length === 0 ? (
          <Card><div className="p-6 text-center text-sm text-ink-faint">
            No agents yet, {persona.name.split(" ")[0]}. Hire your first one to get started.
          </div></Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {agents.slice(0, 6).map((a) => (
              <Link key={a.id} href={`/agents/${a.id}`}>
                <Card className="group h-full transition-shadow hover:shadow-md">
                  <div className="flex items-start gap-3 p-4">
                    <AgentIconTile icon={a.display?.icon} color={a.display?.icon_color} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-ink group-hover:text-navy">{a.name}</p>
                      <p className="mt-0.5 line-clamp-2 text-[12px] text-ink-faint">{a.description || "No description."}</p>
                      {a.model?.id && <Badge tone="navy" className="mt-2">{a.model.id}</Badge>}
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
      <div>
        <h2 className="mb-3 text-[15px] font-semibold text-ink">Quick actions</h2>
        <div className="space-y-2.5">
          <QuickAction href="/agents/new" icon={<Plus className="h-4 w-4" />} title="Hire a new agent" desc="Configure a model, prompt, and tools." primary />
          <QuickAction href="/threads" icon={<MessagesSquare className="h-4 w-4" />} title="Open the inbox" desc="Chat with an agent and stream a run." />
          <QuickAction href="/connections" icon={<Plug className="h-4 w-4" />} title="Connect a service" desc="OAuth providers, sessions, and tokens." />
          <QuickAction href="/admin" icon={<Sparkles className="h-4 w-4" />} title="Workspace settings" desc="Secrets, integrations, skills, models." />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- shared tiles ---------------------------- */
function StatTile({
  icon, label, value, hint, href, tone = "neutral",
}: {
  icon: React.ReactNode; label: string; value?: number | string; hint?: string; href: string;
  tone?: "neutral" | "navy" | "good" | "warn" | "bad";
}) {
  const toneColor = { neutral: "text-navy-400", navy: "text-navy", good: "text-good", warn: "text-warn", bad: "text-bad" }[tone];
  return (
    <Link href={href}>
      <Card className="group h-full transition-shadow hover:shadow-md">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-[9px] bg-paper-2", toneColor)}>{icon}</span>
            <ArrowRight className="h-4 w-4 text-line-strong transition-colors group-hover:text-navy-400" />
          </div>
          <div className="mt-3">
            {value === undefined ? <Skeleton className="h-7 w-16" /> : (
              <p className="text-[26px] font-bold leading-none tracking-tight text-ink">{value}</p>
            )}
            <p className="mt-1.5 text-[13px] font-medium text-ink-soft">{label}</p>
            {hint && <p className="text-[11px] text-ink-faint">{hint}</p>}
          </div>
        </div>
      </Card>
    </Link>
  );
}

function QuickAction({ href, icon, title, desc, primary }: {
  href: string; icon: React.ReactNode; title: string; desc: string; primary?: boolean;
}) {
  return (
    <Link href={href}>
      <Card className={cn("group transition-all hover:shadow-md", primary && "border-navy/30 bg-navy/[0.03]")}>
        <div className="flex items-center gap-3 p-3.5">
          <span className={cn("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px]", primary ? "bg-navy text-white" : "bg-paper-2 text-ink-soft")}>{icon}</span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-semibold text-ink">{title}</p>
            <p className="text-[12px] text-ink-faint">{desc}</p>
          </div>
          <ArrowRight className="h-4 w-4 text-line-strong transition-colors group-hover:text-navy-400" />
        </div>
      </Card>
    </Link>
  );
}
