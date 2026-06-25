"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Inbox, AlertTriangle, ChevronLeft, ChevronRight, Pin, FlaskConical,
  RefreshCw, Loader2, MessagesSquare,
} from "lucide-react";
import {
  Badge, Button, Card, EmptyState, Field, Input, Select, Skeleton,
} from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { Dialog } from "@/components/ui/Dialog";
import { Table, THead, TR, TH, TD } from "@/components/ui/Table";
import { PageHeader, PageBody } from "@/components/brand/AppShell";
import { AgentIcon } from "@/components/brand/agentIcon";
import { AgentPicker } from "@/components/threads/AgentPicker";
import { STATUS_TONE, STATUS_LABEL, formatRelative } from "@/components/threads/shared";
import { Agents, Threads } from "@/lib/fleet/endpoints";
import { errMessage as errMsg } from "@/lib/fleet/client";
import type { Agent, ThreadStatus, ThreadSummary } from "@/lib/fleet/types";
import { cn } from "@/lib/cn";

const PAGE_SIZE = 20;
const STATUSES: ThreadStatus[] = ["idle", "busy", "interrupted", "error"];


export default function ThreadsInboxPage() {
  const router = useRouter();
  const toast = useToast();

  // Agents.
  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [agentsLoading, setAgentsLoading] = React.useState(true);
  const [agentId, setAgentId] = React.useState("");

  // Filters.
  const [status, setStatus] = React.useState<string>("");
  const [attention, setAttention] = React.useState(false);
  const [testRun, setTestRun] = React.useState(false);

  // Threads + pagination.
  const [threads, setThreads] = React.useState<ThreadSummary[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [listError, setListError] = React.useState<string | null>(null);
  const [cursor, setCursor] = React.useState<string | undefined>(undefined);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [prevStack, setPrevStack] = React.useState<(string | undefined)[]>([]);
  const [attentionCount, setAttentionCount] = React.useState<number | null>(null);

  // Selection (bulk).
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = React.useState(false);

  // New thread dialog.
  const [newOpen, setNewOpen] = React.useState(false);

  const selectedAgent = agents.find((a) => a.id === agentId);

  /* --------------------------- load agents --------------------------- */
  React.useEffect(() => {
    setAgentsLoading(true);
    Agents.list({ include: ["owner"], page_size: 100, sort_by: "name", sort_order: "asc" })
      .then((r) => setAgents(r.items))
      .catch((e) => toast.error("Couldn't load agents", errMsg(e)))
      .finally(() => setAgentsLoading(false));
  }, [toast]);

  /* --------------------------- load threads --------------------------- */
  const loadThreads = React.useCallback(
    async (cur: string | undefined, opts: { silent?: boolean } = {}) => {
      if (!agentId) return;
      if (!opts.silent) setLoading(true);
      setSelected(new Set());
      try {
        const r = await Threads.list({
          agent_id: agentId,
          page_size: PAGE_SIZE,
          cursor: cur,
          // requires_attention cannot combine with status (API constraint).
          ...(attention ? { requires_attention: true } : status ? { status } : {}),
          test_run: testRun,
        });
        setThreads(r.items);
        setNextCursor(r.next_cursor ?? null);
        setListError(null);
      } catch (e) {
        setListError(errMsg(e, "Could not load threads."));
        setThreads([]);
      } finally {
        setLoading(false);
      }
    },
    [agentId, status, attention, testRun],
  );

  const loadCount = React.useCallback(async () => {
    if (!agentId) return;
    try {
      const c = await Threads.count(agentId);
      setAttentionCount(c.attention_count);
    } catch {
      setAttentionCount(null);
    }
  }, [agentId]);

  // Reset pagination & reload whenever agent or filters change.
  React.useEffect(() => {
    setCursor(undefined);
    setPrevStack([]);
    if (agentId) {
      loadThreads(undefined);
      loadCount();
    } else {
      setThreads([]);
      setAttentionCount(null);
    }
  }, [agentId, status, attention, testRun, loadThreads, loadCount]);

  const goNext = () => {
    if (!nextCursor) return;
    setPrevStack((s) => [...s, cursor]);
    setCursor(nextCursor);
    loadThreads(nextCursor);
  };
  const goPrev = () => {
    if (prevStack.length === 0) return;
    const prev = prevStack[prevStack.length - 1];
    setPrevStack((s) => s.slice(0, -1));
    setCursor(prev);
    loadThreads(prev);
  };

  /* --------------------------- selection --------------------------- */
  const toggleOne = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allSelected = threads.length > 0 && threads.every((t) => selected.has(t.id));
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(threads.map((t) => t.id)));

  const bulk = async (data: { metadata: { is_pinned?: boolean; read_status?: boolean } }, label: string) => {
    if (selected.size === 0) return;
    setBulkBusy(true);
    try {
      await Threads.bulkModify({ thread_ids: [...selected], data });
      toast.success(label, `${selected.size} thread${selected.size === 1 ? "" : "s"} updated.`);
      await loadThreads(cursor, { silent: true });
      loadCount();
    } catch (e) {
      toast.error("Bulk update failed", errMsg(e));
    } finally {
      setBulkBusy(false);
    }
  };

  /* --------------------------- render --------------------------- */
  return (
    <>
      <PageHeader
        title="Threads"
        subtitle="Per-agent conversations and live runs across the fleet."
        actions={
          <Button onClick={() => setNewOpen(true)} disabled={agentsLoading}>
            <Plus className="h-4 w-4" /> New thread
          </Button>
        }
      />
      <PageBody className="space-y-5">
        {/* agent picker + attention badge */}
        <Card>
          <div className="flex flex-wrap items-center gap-4 px-5 py-4">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Agent</label>
              <AgentPicker
                agents={agents}
                value={agentId}
                onChange={setAgentId}
                loading={agentsLoading}
                placeholder="Choose an agent to view its inbox…"
              />
            </div>
            {agentId && (
              <div className="flex items-center gap-2">
                {attentionCount !== null && (
                  <Badge tone={attentionCount > 0 ? "warn" : "neutral"}>
                    <AlertTriangle className="h-3 w-3" />
                    {attentionCount} need{attentionCount === 1 ? "s" : ""} attention
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Refresh"
                  onClick={() => {
                    loadThreads(cursor);
                    loadCount();
                  }}
                >
                  <RefreshCw className={cn("h-4 w-4", loading && "dm-spin")} />
                </Button>
              </div>
            )}
          </div>
        </Card>

        {!agentId ? (
          <EmptyState
            icon={<MessagesSquare className="h-8 w-8" />}
            title="Pick an agent to open its inbox"
            description="Threads live under the agent that owns them. Choose one above — Michael recommends starting with whichever has the most unread messages."
          />
        ) : (
          <>
            {/* filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-medium text-ink-soft">Status</span>
                <Select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  disabled={attention}
                  className="h-9 w-40"
                  aria-label="Filter by status"
                >
                  <option value="">All statuses</option>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </Select>
              </div>

              <Toggle
                active={attention}
                onClick={() => setAttention((v) => !v)}
                icon={<AlertTriangle className="h-3.5 w-3.5" />}
                label="Requires attention"
                title="Interrupted, errored, or unread. Cannot combine with a status filter."
              />
              <Toggle
                active={testRun}
                onClick={() => setTestRun((v) => !v)}
                icon={<FlaskConical className="h-3.5 w-3.5" />}
                label="Test runs"
              />
              {attention && (
                <span className="text-[11px] text-ink-faint">Status filter disabled while attention is on.</span>
              )}
            </div>

            {/* bulk action bar */}
            {selected.size > 0 && (
              <div className="dm-fade-in flex flex-wrap items-center gap-2 rounded-[12px] border border-navy/20 bg-navy/5 px-4 py-2.5">
                <span className="text-[13px] font-medium text-navy">{selected.size} selected</span>
                <div className="flex-1" />
                <Button
                  variant="secondary"
                  size="sm"
                  loading={bulkBusy}
                  onClick={() => bulk({ metadata: { read_status: true } }, "Marked read")}
                >
                  Mark read
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={bulkBusy}
                  onClick={() => bulk({ metadata: { is_pinned: true } }, "Pinned")}
                >
                  <Pin className="h-3.5 w-3.5" /> Pin
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                  Clear
                </Button>
              </div>
            )}

            {/* list */}
            {loading ? (
              <Card>
                <div className="space-y-3 p-5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              </Card>
            ) : listError ? (
              <EmptyState
                icon={<AlertTriangle className="h-8 w-8" />}
                title="Couldn't load threads"
                description={listError}
                action={
                  <Button variant="secondary" onClick={() => loadThreads(cursor)}>
                    <RefreshCw className="h-4 w-4" /> Retry
                  </Button>
                }
              />
            ) : threads.length === 0 ? (
              <EmptyState
                icon={<Inbox className="h-8 w-8" />}
                title="Inbox zero"
                description={
                  attention || status || testRun
                    ? "No threads match these filters. Try loosening them."
                    : "No threads for this agent yet. Start one and the conversation will show up here — bears, beets, Battlestar Galactica."
                }
                action={
                  <Button onClick={() => setNewOpen(true)}>
                    <Plus className="h-4 w-4" /> New thread
                  </Button>
                }
              />
            ) : (
              <>
                <Table>
                  <THead>
                    <TR>
                      <TH className="w-10">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleAll}
                          aria-label="Select all"
                          className="dm-focus h-4 w-4 cursor-pointer accent-navy"
                        />
                      </TH>
                      <TH>Thread</TH>
                      <TH className="w-32">Status</TH>
                      <TH className="w-32">Updated</TH>
                    </TR>
                  </THead>
                  <tbody>
                    {threads.map((t) => {
                      const st = (t.status || "idle") as ThreadStatus;
                      const pinned = t.metadata?.is_pinned === true;
                      const unread = t.metadata?.read_status === false;
                      return (
                        <TR
                          key={t.id}
                          className="cursor-pointer transition-colors hover:bg-paper-2/60"
                          onClick={() => router.push(`/threads/${t.id}`)}
                        >
                          <TD onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selected.has(t.id)}
                              onChange={() => toggleOne(t.id)}
                              aria-label={`Select ${t.title || "thread"}`}
                              className="dm-focus h-4 w-4 cursor-pointer accent-navy"
                            />
                          </TD>
                          <TD>
                            <div className="flex items-center gap-2.5">
                              <AgentIcon
                                icon={selectedAgent?.display?.icon}
                                color={selectedAgent?.display?.icon_color}
                                size={16}
                              />
                              <span className="flex min-w-0 items-center gap-1.5">
                                {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-navy" aria-label="Unread" />}
                                <span
                                  className={cn(
                                    "truncate text-[13px] text-ink",
                                    unread ? "font-semibold" : "font-medium",
                                  )}
                                >
                                  {t.title || "Untitled thread"}
                                </span>
                                {pinned && <Pin className="h-3 w-3 shrink-0 text-accent" />}
                              </span>
                            </div>
                          </TD>
                          <TD>
                            <Badge tone={STATUS_TONE[st]}>
                              {st === "busy" && <Loader2 className="h-3 w-3 dm-spin" />}
                              {STATUS_LABEL[st]}
                            </Badge>
                          </TD>
                          <TD className="text-[12px] text-ink-faint">{formatRelative(t.updated_at)}</TD>
                        </TR>
                      );
                    })}
                  </tbody>
                </Table>

                {/* pagination */}
                <div className="flex items-center justify-between">
                  <p className="text-[12px] text-ink-faint">
                    Showing {threads.length} thread{threads.length === 1 ? "" : "s"}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={goPrev} disabled={prevStack.length === 0 || loading}>
                      <ChevronLeft className="h-4 w-4" /> Prev
                    </Button>
                    <Button variant="secondary" size="sm" onClick={goNext} disabled={!nextCursor || loading}>
                      Next <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </PageBody>

      <NewThreadDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        agents={agents}
        defaultAgentId={agentId}
        onCreated={(id) => router.push(`/threads/${id}`)}
      />
    </>
  );
}

function Toggle({
  active,
  onClick,
  icon,
  label,
  title,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cn(
        "dm-focus inline-flex h-9 items-center gap-1.5 rounded-[10px] border px-3 text-[13px] font-medium transition-colors",
        active
          ? "border-navy/30 bg-navy/10 text-navy"
          : "border-line-strong bg-card text-ink-soft hover:bg-paper-2",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/* --------------------------- New thread dialog --------------------------- */
function NewThreadDialog({
  open,
  onClose,
  agents,
  defaultAgentId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  agents: Agent[];
  defaultAgentId?: string;
  onCreated: (threadId: string) => void;
}) {
  const toast = useToast();
  const [agentId, setAgentId] = React.useState(defaultAgentId || "");
  const [title, setTitle] = React.useState("");
  const [source, setSource] = React.useState("");
  const [testRun, setTestRun] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setAgentId(defaultAgentId || "");
      setTitle("");
      setSource("");
      setTestRun(false);
    }
  }, [open, defaultAgentId]);

  const metadata = () => {
    const m: Record<string, unknown> = {};
    if (title.trim()) m.title = title.trim();
    if (source.trim()) m.source = source.trim();
    return Object.keys(m).length ? m : undefined;
  };

  const create = async () => {
    if (!agentId) return;
    setBusy(true);
    try {
      const t = await Threads.create({
        agent_id: agentId,
        metadata: metadata(),
        options: testRun ? { test_run: true } : undefined,
      });
      // Apply a friendly title up-front if provided (metadata.title isn't the display title).
      if (title.trim()) {
        try {
          await Threads.update(t.id, { title: title.trim() });
        } catch {
          /* non-fatal */
        }
      }
      toast.success("Thread created", "Opening the chat console…");
      onCreated(t.id);
    } catch (e) {
      toast.error("Couldn't create thread", errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New thread"
      description="Start a fresh conversation with one of your agents."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={create} loading={busy} disabled={!agentId}>
            Create & open
          </Button>
        </>
      }
    >
      <Field label="Agent">
        {agents.length === 0 ? (
          <p className="text-[13px] text-ink-faint">No agents available.</p>
        ) : (
          <AgentPicker agents={agents} value={agentId} onChange={setAgentId} className="max-w-none" />
        )}
      </Field>
      <Field label="Title" hint="Optional — a human-friendly name for the thread.">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. DM Demo — Scranton order check" />
      </Field>
      <Field label="Metadata: source" hint="Optional tag stored on the thread's metadata.">
        <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. demo" />
      </Field>
      <label className="flex items-center gap-2 text-[13px] text-ink-soft">
        <input
          type="checkbox"
          checked={testRun}
          onChange={(e) => setTestRun(e.target.checked)}
          className="dm-focus h-4 w-4 cursor-pointer accent-navy"
        />
        <FlaskConical className="h-3.5 w-3.5" /> Mark as test run
      </label>
    </Dialog>
  );
}
