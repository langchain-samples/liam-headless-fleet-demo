"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, MoreVertical, Pencil, Pin, PinOff, MailOpen, Trash2, AlertTriangle,
  CheckCircle2, Loader2, RefreshCw,
} from "lucide-react";
import {
  Badge, Button, Card, EmptyState, Field, Input, Select, Skeleton,
} from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { Dialog, ConfirmDialog } from "@/components/ui/Dialog";
import { PageHeader } from "@/components/brand/AppShell";
import { AgentIcon } from "@/components/brand/agentIcon";
import { Threads, Agents } from "@/lib/fleet/endpoints";
import { errMessage as errMsg } from "@/lib/fleet/client";
import type { ThreadDetail, ThreadStatus, Agent } from "@/lib/fleet/types";
import { cn } from "@/lib/cn";
import { ChatMessage } from "./ChatMessage";
import { Composer } from "./Composer";
import { InterruptPanel } from "./InterruptPanel";
import { useChatStream } from "./useChatStream";
import { STATUS_TONE, STATUS_LABEL, extractMessages, parseInterrupts } from "./shared";


export function ThreadConsole({ threadId }: { threadId: string }) {
  const router = useRouter();
  const toast = useToast();

  const [thread, setThread] = React.useState<ThreadDetail | null>(null);
  const [agent, setAgent] = React.useState<Agent | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  // Agent picker (only needed if the thread has no bound agent_id).
  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [pickAgentId, setPickAgentId] = React.useState("");

  // Dialog state.
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [renameOpen, setRenameOpen] = React.useState(false);
  const [renameVal, setRenameVal] = React.useState("");
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [resolving, setResolving] = React.useState(false);

  const agentId = thread?.agent_id || pickAgentId || undefined;
  const isPinned = thread?.metadata?.is_pinned === true;

  // Streaming engine (messages, streaming flag, interrupts, scroll, run lifecycle).
  const chat = useChatStream({
    toast,
    onSettle: () => loadThread({ silent: true }),
  });
  const { messages, setMessages, streaming, interrupts, setInterrupts, scrollRef, onScroll, runStream, stop } = chat;

  /* --------------------------- data loading --------------------------- */

  const loadThread = React.useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!opts.silent) setLoading(true);
      try {
        const t = await Threads.get(threadId);
        setThread(t);
        setLoadError(null);
        setInterrupts(parseInterrupts(t.interrupts));
        // Render persisted conversation from thread state.
        const persisted = extractMessages(t.values);
        // Don't clobber an in-flight stream with a stale snapshot.
        setMessages((prev) => {
          const streamingNow = prev.some((m) => m.streaming);
          return streamingNow ? prev : persisted;
        });
        if (t.agent_id) {
          try {
            setAgent(await Agents.get(t.agent_id));
          } catch {
            /* agent fetch is best-effort (may be inaccessible) */
          }
        }
      } catch (e) {
        setLoadError(errMsg(e, "Could not load this thread."));
      } finally {
        setLoading(false);
      }
    },
    [threadId, setMessages, setInterrupts],
  );

  React.useEffect(() => {
    loadThread();
  }, [loadThread]);

  // Lazy-load agents only when the thread isn't bound to one.
  React.useEffect(() => {
    if (thread && !thread.agent_id && agents.length === 0) {
      Agents.list({ include: ["owner"], page_size: 50 })
        .then((r) => setAgents(r.items))
        .catch(() => {});
    }
  }, [thread, agents.length]);

  /* --------------------------- send / respond --------------------------- */

  const send = React.useCallback(
    (text: string) => {
      if (!agentId) {
        toast.error("Pick an agent", "This thread has no agent bound yet.");
        return;
      }
      void runStream(
        threadId,
        {
          assistant_id: agentId,
          input: { messages: [{ role: "user", content: text }] },
          stream_mode: ["values", "messages-tuple"],
          stream_subgraphs: true,
        },
        text,
      );
    },
    [agentId, threadId, toast, runStream],
  );

  // Resume a paused run by answering its human-in-the-loop request.
  const respond = React.useCallback(
    (answer: string) => {
      if (!agentId) return;
      void runStream(
        threadId,
        {
          assistant_id: agentId,
          command: { resume: { decisions: [{ type: "respond", message: answer }] } },
          stream_mode: ["values", "messages-tuple"],
          stream_subgraphs: true,
        },
        answer,
      );
    },
    [agentId, threadId, runStream],
  );

  /* --------------------------- thread actions --------------------------- */

  const doRename = async () => {
    const title = renameVal.trim();
    try {
      await Threads.update(threadId, { title: title || null });
      setRenameOpen(false);
      toast.success("Thread renamed");
      loadThread({ silent: true });
    } catch (e) {
      toast.error("Rename failed", errMsg(e));
    }
  };

  const togglePin = async () => {
    setMenuOpen(false);
    try {
      await Threads.update(threadId, { metadata: { is_pinned: !isPinned } });
      toast.success(isPinned ? "Unpinned" : "Pinned to inbox");
      loadThread({ silent: true });
    } catch (e) {
      toast.error("Update failed", errMsg(e));
    }
  };

  const markRead = async () => {
    setMenuOpen(false);
    try {
      await Threads.update(threadId, { metadata: { read_status: true } });
      toast.success("Marked read");
      loadThread({ silent: true });
    } catch (e) {
      toast.error("Update failed", errMsg(e));
    }
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      await Threads.remove(threadId);
      toast.success("Thread deleted");
      router.push("/threads");
    } catch (e) {
      toast.error("Delete failed", errMsg(e));
      setDeleting(false);
    }
  };

  const resolveInterrupt = async () => {
    setResolving(true);
    try {
      await Threads.resolveInterrupt(threadId);
      toast.success("Interrupt resolved");
      await loadThread({ silent: true });
    } catch (e) {
      toast.error("Resolve failed", errMsg(e));
    } finally {
      setResolving(false);
    }
  };

  /* --------------------------- render --------------------------- */

  const status = (thread?.status || "idle") as ThreadStatus;
  const title = thread?.title || "Untitled thread";
  const icon = agent?.display?.icon;
  const iconColor = agent?.display?.icon_color;

  if (loadError && !thread) {
    return (
      <>
        <PageHeader
          title="Thread"
          actions={
            <Link href="/threads">
              <Button variant="secondary" size="sm">
                <ArrowLeft className="h-4 w-4" /> Inbox
              </Button>
            </Link>
          }
        />
        <div className="px-6 py-10 sm:px-8">
          <EmptyState
            icon={<AlertTriangle className="h-8 w-8" />}
            title="We couldn't open that thread"
            description={loadError}
            action={
              <Button variant="secondary" onClick={() => loadThread()}>
                <RefreshCw className="h-4 w-4" /> Try again
              </Button>
            }
          />
        </div>
      </>
    );
  }

  return (
    <div className="flex h-[calc(100vh-0px)] flex-col lg:h-screen">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-card/40 px-4 py-3.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/threads" className="dm-focus rounded-lg p-1.5 text-ink-soft hover:bg-paper-2" aria-label="Back to inbox">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
            style={{ background: "rgba(43,74,120,0.10)", border: "1px solid rgba(43,74,120,0.20)" }}
          >
            <AgentIcon icon={icon} color={iconColor} size={18} />
          </span>
          <div className="min-w-0">
            {loading ? (
              <Skeleton className="h-5 w-48" />
            ) : (
              <h1 className="truncate text-[16px] font-semibold tracking-tight text-ink" style={{ fontFamily: "var(--font-serif)" }}>
                {title}
              </h1>
            )}
            <div className="mt-0.5 flex items-center gap-2">
              <Badge tone={STATUS_TONE[status]}>
                {status === "busy" && <Loader2 className="h-3 w-3 dm-spin" />}
                {STATUS_LABEL[status]}
              </Badge>
              {agent?.name && <span className="truncate text-[12px] text-ink-faint">{agent.name}</span>}
              {isPinned && <Pin className="h-3 w-3 text-accent" />}
            </div>
          </div>
        </div>

        <div className="relative flex items-center gap-2">
          {streaming && (
            <span className="flex items-center gap-1.5 text-[12px] font-medium text-navy">
              <Loader2 className="h-3.5 w-3.5 dm-spin" /> streaming…
            </span>
          )}
          <Button
            variant="secondary"
            size="icon"
            aria-label="Thread actions"
            onClick={() => setMenuOpen((v) => !v)}
            disabled={loading}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden />
              <div className="absolute right-0 top-11 z-20 w-48 overflow-hidden rounded-[12px] border border-line bg-card py-1 shadow-xl dm-fade-in">
                <MenuItem
                  icon={<Pencil className="h-4 w-4" />}
                  label="Rename"
                  onClick={() => {
                    setRenameVal(thread?.title || "");
                    setRenameOpen(true);
                    setMenuOpen(false);
                  }}
                />
                <MenuItem
                  icon={isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                  label={isPinned ? "Unpin" : "Pin"}
                  onClick={togglePin}
                />
                <MenuItem icon={<MailOpen className="h-4 w-4" />} label="Mark read" onClick={markRead} />
                <div className="my-1 h-px bg-line" />
                <MenuItem
                  icon={<Trash2 className="h-4 w-4" />}
                  label="Delete"
                  danger
                  onClick={() => {
                    setDeleteOpen(true);
                    setMenuOpen(false);
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* error-status banner (non-blocking) */}
      {status === "error" && thread?.error != null && (
        <div className="border-b border-bad/30 bg-bad-soft px-4 py-2.5 text-[12px] text-bad sm:px-6">
          <span className="font-semibold">Last run errored. </span>
          <span className="break-words">
            {typeof thread.error === "string" ? thread.error : JSON.stringify(thread.error).slice(0, 300)}
          </span>
        </div>
      )}

      {/* agent picker when unbound */}
      {!loading && thread && !thread.agent_id && (
        <div className="border-b border-line bg-paper-2/50 px-4 py-3 sm:px-6">
          <div className="mx-auto flex max-w-3xl items-center gap-2">
            <span className="text-[12px] text-ink-soft">This thread isn&apos;t bound to an agent. Pick one to chat:</span>
            <Select
              value={pickAgentId}
              onChange={(e) => setPickAgentId(e.target.value)}
              className="max-w-xs"
              aria-label="Choose an agent"
            >
              <option value="">Select an agent…</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      )}

      {/* conversation */}
      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-5">
          {loading ? (
            <>
              <Skeleton className="h-16 w-2/3" />
              <Skeleton className="ml-auto h-12 w-1/2" />
              <Skeleton className="h-24 w-3/4" />
            </>
          ) : messages.length === 0 ? (
            <Card className="border-dashed">
              <div className="px-6 py-10 text-center">
                <p className="text-[15px] font-semibold text-ink">No messages yet</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-ink-faint">
                  Every great Dunder Mifflin conversation starts somewhere. Send the first message below and watch
                  the agent reply in real time.
                </p>
              </div>
            </Card>
          ) : (
            messages.map((m) => <ChatMessage key={m.id} message={m} agentIcon={icon} agentColor={iconColor} />)
          )}

          {/* HITL interrupt — inline at the end of the conversation, near the composer */}
          {status === "interrupted" && !streaming && interrupts.length > 0 &&
            interrupts.map((it) => (
              <InterruptPanel
                key={it.interruptId}
                interrupt={it}
                onRespond={respond}
                onSkip={resolveInterrupt}
              />
            ))}
          {status === "interrupted" && !streaming && interrupts.length === 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-warn/30 bg-warn-soft px-4 py-3">
              <div className="flex items-center gap-2 text-[13px] text-warn">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>This run paused for human input. Resolve it to let the agent continue.</span>
              </div>
              <Button variant="secondary" size="sm" onClick={resolveInterrupt} loading={resolving}>
                <CheckCircle2 className="h-4 w-4" /> Resolve
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* composer */}
      <div className="border-t border-line bg-card/60 px-4 py-3 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <Composer
            onSend={send}
            onStop={stop}
            streaming={streaming}
            disabled={loading || (!agentId && !!thread && !thread.agent_id ? !pickAgentId : false) || status === "busy"}
            placeholder={status === "busy" ? "Agent is busy…" : "Message the agent…"}
          />
        </div>
      </div>

      {/* rename dialog */}
      <Dialog
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        title="Rename thread"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button onClick={doRename}>Save</Button>
          </>
        }
      >
        <Field label="Title">
          <Input
            value={renameVal}
            onChange={(e) => setRenameVal(e.target.value)}
            placeholder="e.g. Q3 paper supply escalation"
            onKeyDown={(e) => e.key === "Enter" && doRename()}
            autoFocus
          />
        </Field>
      </Dialog>

      {/* delete confirm */}
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={doDelete}
        title="Delete this thread?"
        message="This permanently removes the thread and all of its runs. There's no undo — not even Toby can recover it."
        confirmLabel="Delete"
        danger
        loading={deleting}
      />
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "dm-focus flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium transition-colors hover:bg-paper-2",
        danger ? "text-bad" : "text-ink-soft hover:text-ink",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
