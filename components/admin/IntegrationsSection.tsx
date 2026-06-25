"use client";
import * as React from "react";
import {
  Plug,
  Plus,
  Trash2,
  Pencil,
  CheckCircle2,
  Search as SearchIcon,
  LayoutGrid,
  Link2,
} from "lucide-react";
import {
  Button,
  Badge,
  Input,
  Field,
  Skeleton,
  EmptyState,
  cn,
} from "@/components/ui";
import { Dialog, ConfirmDialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { AgentIcon } from "@/components/brand/agentIcon";
import { Integrations } from "@/lib/fleet/endpoints";
import { errMessage as errMsg } from "@/lib/fleet/client";
import type {
  Integration,
  HeaderInput,
  CreateIntegrationRequest,
} from "@/lib/fleet/types";


type HeaderRow = { key: string; value: string };

/** Human-friendly category label for an integration, derived from its `source`. */
function categoryOf(it: Integration): string {
  const s = (it.source ?? "").trim();
  if (!s) return "Other";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function IntegrationDialog({
  open,
  onClose,
  onSaved,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing?: Integration | null;
}) {
  const toast = useToast();
  const [name, setName] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [source, setSource] = React.useState("");
  const [headers, setHeaders] = React.useState<HeaderRow[]>([]);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setUrl(editing?.url ?? "");
    setSource(editing?.source ?? "");
    setHeaders((editing?.headers ?? []).map((h) => ({ key: h.key, value: h.value ?? "" })));
  }, [open, editing]);

  const addHeader = () => setHeaders((h) => [...h, { key: "", value: "" }]);
  const updHeader = (i: number, patch: Partial<HeaderRow>) =>
    setHeaders((h) => h.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const dropHeader = (i: number) => setHeaders((h) => h.filter((_, idx) => idx !== i));

  const submit = async () => {
    if (!name.trim() || !url.trim()) return;
    const cleanHeaders: HeaderInput[] = headers
      .filter((h) => h.key.trim())
      .map((h) => ({ key: h.key.trim(), value: h.value }));
    setSaving(true);
    try {
      if (editing) {
        await Integrations.update(editing.id, {
          name: name.trim(),
          url: url.trim(),
          headers: cleanHeaders,
        });
        toast.success("MCP server updated", name.trim());
      } else {
        const body: CreateIntegrationRequest = {
          name: name.trim(),
          url: url.trim(),
          ...(source.trim() ? { source: source.trim() } : {}),
          ...(cleanHeaders.length ? { headers: cleanHeaders } : {}),
        };
        await Integrations.create(body);
        toast.success("MCP server added", name.trim());
      }
      onSaved();
      onClose();
    } catch (e) {
      toast.error(editing ? "Could not update server" : "Could not add server", errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? "Edit MCP server" : "Add MCP server"}
      description="Connect an external MCP server so agents can call its tools."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving} disabled={!name.trim() || !url.trim()}>
            {editing ? "Save changes" : "Add server"}
          </Button>
        </>
      }
    >
      <Field label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="DM Demo — Inventory MCP" autoFocus />
      </Field>
      <Field label="URL" hint="The MCP server endpoint.">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://mcp.example.com/sse" />
      </Field>
      {!editing && (
        <Field label="Category" hint="Optional label used to group this server (e.g. Productivity, Developer).">
          <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="custom" />
        </Field>
      )}
      <Field label="Headers" hint="Optional request headers sent to the server (e.g. an Authorization header).">
        <div className="space-y-2">
          {headers.map((h, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                className="flex-1"
                placeholder="Header"
                value={h.key}
                onChange={(e) => updHeader(i, { key: e.target.value })}
              />
              <Input
                className="flex-1"
                placeholder="Value"
                value={h.value}
                onChange={(e) => updHeader(i, { value: e.target.value })}
              />
              <Button variant="ghost" size="icon" aria-label="Remove header" onClick={() => dropHeader(i)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={addHeader}>
            <Plus className="h-4 w-4" /> Add header
          </Button>
        </div>
      </Field>
    </Dialog>
  );
}

/** A single integration card in the catalog grid. */
function IntegrationCard({
  it,
  onEdit,
  onDelete,
}: {
  it: Integration;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const connected = !!it.enabled && it.can_invoke !== false;
  return (
    <div className="group relative flex items-start gap-3.5 rounded-xl border border-line bg-card px-4 py-3.5 transition-colors hover:border-line-strong hover:bg-paper-2/50">
      <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-line bg-paper-2">
        <AgentIcon icon={it.name} color="navy" size={20} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h4 className="truncate text-[14px] font-semibold text-ink">{it.name ?? "Untitled server"}</h4>
          {it.transport && (
            <Badge tone="neutral" className="hidden shrink-0 sm:inline-flex">
              {it.transport}
            </Badge>
          )}
        </div>
        <p className="mt-0.5 flex items-center gap-1 truncate text-[12.5px] text-ink-faint">
          <Link2 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate font-mono">{it.url ?? "—"}</span>
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2 self-center">
        {/* hover actions */}
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <Button variant="ghost" size="icon" aria-label={`Edit ${it.name}`} onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label={`Delete ${it.name}`} onClick={onDelete}>
            <Trash2 className="h-4 w-4 text-bad" />
          </Button>
        </div>
        {connected ? (
          <Badge tone="good" className="shrink-0 gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> Connected
          </Badge>
        ) : it.enabled ? (
          <Badge tone="warn" className="shrink-0">
            Not invokable
          </Badge>
        ) : (
          <Badge tone="neutral" className="shrink-0">
            Disabled
          </Badge>
        )}
      </div>
    </div>
  );
}

export function IntegrationsSection() {
  const toast = useToast();
  const [items, setItems] = React.useState<Integration[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [dialog, setDialog] = React.useState<{ open: boolean; editing?: Integration | null }>({ open: false });
  const [confirmDel, setConfirmDel] = React.useState<Integration | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<"all" | "connected">("all");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await Integrations.list({ page_size: 200 });
      setItems(res.items);
    } catch (e) {
      toast.error("Could not load integrations", errMsg(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const onDelete = async () => {
    if (!confirmDel) return;
    setDeleting(true);
    try {
      await Integrations.remove(confirmDel.id);
      toast.success("MCP server removed", confirmDel.name ?? confirmDel.id);
      setConfirmDel(null);
      void load();
    } catch (e) {
      toast.error("Could not remove server", errMsg(e));
    } finally {
      setDeleting(false);
    }
  };

  const all = React.useMemo(() => items ?? [], [items]);
  const connectedCount = all.filter((i) => i.enabled && i.can_invoke !== false).length;

  // in-memory filter + search over already-fetched data (no new network calls)
  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((it) => {
      if (filter === "connected" && !(it.enabled && it.can_invoke !== false)) return false;
      if (!q) return true;
      return (
        (it.name ?? "").toLowerCase().includes(q) ||
        (it.url ?? "").toLowerCase().includes(q) ||
        (it.source ?? "").toLowerCase().includes(q)
      );
    });
  }, [all, filter, query]);

  // group visible items by category, sorted with "Other" last
  const groups = React.useMemo(() => {
    const map = new Map<string, Integration[]>();
    for (const it of visible) {
      const c = categoryOf(it);
      (map.get(c) ?? map.set(c, []).get(c)!).push(it);
    }
    return [...map.entries()].sort(([a], [b]) => {
      if (a === "Other") return 1;
      if (b === "Other") return -1;
      return a.localeCompare(b);
    });
  }, [visible]);

  const RAIL = [
    { id: "all" as const, label: "All", count: all.length },
    { id: "connected" as const, label: "Connected", count: connectedCount },
  ];

  return (
    <div className="rounded-2xl border border-line bg-card/60">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="flex items-center gap-2">
          <Plug className="h-[18px] w-[18px] text-navy-400" />
          <h3 className="text-[15px] font-semibold text-ink">Integrations</h3>
          <span className="text-[13px] text-ink-faint">· MCP servers your agents can call</span>
        </div>
        <Button size="sm" onClick={() => setDialog({ open: true, editing: null })}>
          <Plus className="h-4 w-4" /> Add MCP server
        </Button>
      </div>

      <div className="flex flex-col gap-0 md:flex-row">
        {/* left filter rail */}
        <aside className="shrink-0 border-b border-line p-3 md:w-48 md:border-b-0 md:border-r">
          <div className="relative mb-3">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="pl-8"
              aria-label="Search integrations"
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
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[68px] w-full rounded-xl" />
              ))}
            </div>
          ) : all.length === 0 ? (
            <EmptyState
              icon={<Plug className="h-7 w-7" />}
              title="No integrations connected"
              description="No MCP servers wired up yet. Connect one and your agents get a whole new set of tools — identity theft is not a joke, Jim."
              action={
                <Button size="sm" onClick={() => setDialog({ open: true, editing: null })}>
                  <Plus className="h-4 w-4" /> Add MCP server
                </Button>
              }
            />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<SearchIcon className="h-7 w-7" />}
              title="No matches"
              description={filter === "connected" ? "No connected servers match your search." : "Nothing matches your search."}
            />
          ) : (
            <div className="space-y-7">
              {groups.map(([category, list]) => (
                <section key={category}>
                  <h4 className="mb-2.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-paper-2 text-navy-400">
                      <Plug className="h-3 w-3" />
                    </span>
                    {category}
                    <span className="text-ink-faint/60">({list.length})</span>
                  </h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {list.map((it) => (
                      <IntegrationCard
                        key={it.id}
                        it={it}
                        onEdit={() => setDialog({ open: true, editing: it })}
                        onDelete={() => setConfirmDel(it)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>

      <IntegrationDialog
        open={dialog.open}
        editing={dialog.editing}
        onClose={() => setDialog({ open: false })}
        onSaved={load}
      />
      <ConfirmDialog
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        onConfirm={onDelete}
        title="Remove MCP server?"
        message={
          <>
            Disconnect <span className="font-medium text-ink">{confirmDel?.name}</span>? Agents will lose access to
            its tools.
          </>
        }
        confirmLabel="Remove"
        danger
        loading={deleting}
      />
    </div>
  );
}
