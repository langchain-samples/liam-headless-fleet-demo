"use client";
// Reusable agent chat: thread switcher + live streaming messages + composer.
// Rendered inline on the agent detail page as the default "Chat" mode.
import * as React from "react";
import { Plus, MessagesSquare } from "lucide-react";
import { Button, Select, Spinner, EmptyState } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { ChatMessage } from "@/components/threads/ChatMessage";
import { Composer } from "@/components/threads/Composer";
import { InterruptPanel } from "@/components/threads/InterruptPanel";
import { useChatStream } from "@/components/threads/useChatStream";
import { extractMessages, parseInterrupts } from "@/components/threads/shared";
import { Threads } from "@/lib/fleet/endpoints";
import { errMessage as errMsg } from "@/lib/fleet/client";
import type { ThreadSummary } from "@/lib/fleet/types";
import { cn } from "@/lib/cn";

function threadLabel(t: ThreadSummary): string {
  return t.title || `Thread ${t.id.slice(0, 8)}`;
}

export function AgentChat({
  agentId,
  agentName,
  agentIcon,
  agentColor,
  active = true,
  className,
  emptyState,
  hideThreadBar,
  onFiles,
  alwaysNewThread,
  footer,
}: {
  agentId: string;
  agentName: string;
  agentIcon?: string;
  agentColor?: string;
  /** When false, the chat won't auto-load/create threads (e.g. hidden tab). */
  active?: boolean;
  className?: string;
  /** Custom centered empty state (e.g. a builder hero) shown before any messages. */
  emptyState?: React.ReactNode;
  /** Hide the thread switcher bar (single-conversation surfaces like the builder). */
  hideThreadBar?: boolean;
  /** Called with the thread's workspace files whenever state loads (for the builder). */
  onFiles?: (files: Record<string, { content?: string; type?: string }> | undefined) => void;
  /** Always start a fresh thread on mount instead of resuming the latest one (builder). */
  alwaysNewThread?: boolean;
  /** Extra content rendered between the messages and the composer (e.g. a create-agent card). */
  footer?: React.ReactNode;
}) {
  const toast = useToast();

  const [threads, setThreads] = React.useState<ThreadSummary[]>([]);
  const [threadId, setThreadId] = React.useState<string | null>(null);
  const [loadingThreads, setLoadingThreads] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [loadingMsgs, setLoadingMsgs] = React.useState(false);
  const initedRef = React.useRef(false);
  // Holds the latest loadMessages so the stream's onSettle can call it without a
  // declaration-order cycle (loadMessages needs the hook's setters, the hook needs onSettle).
  const loadMessagesRef = React.useRef<(id: string, opts?: { silent?: boolean }) => void>(() => {});

  // Re-sync thread state after each run, and refresh the thread list (for titles).
  const handleSettle = React.useCallback(
    (id: string) => {
      loadMessagesRef.current(id, { silent: true });
      Threads.list({ agent_id: agentId, page_size: 20 })
        .then((r) => setThreads(r.items))
        .catch(() => {});
    },
    [agentId],
  );

  const chat = useChatStream({ toast, onSettle: handleSettle, onFiles });
  const { messages, setMessages, streaming, interrupts, setInterrupts, scrollRef, onScroll, runStream, stop } = chat;

  /* ---------------------- load this agent's threads ---------------------- */
  const loadThreads = React.useCallback(async () => {
    setLoadingThreads(true);
    try {
      const res = await Threads.list({ agent_id: agentId, page_size: 20 });
      if (alwaysNewThread) {
        // Builder: always start a clean conversation rather than resuming the latest.
        const created = await Threads.create({ agent_id: agentId });
        const newId = created.id || created.thread_id!;
        setThreads([created, ...res.items]);
        setThreadId(newId);
        setMessages([]);
      } else if (res.items.length > 0) {
        setThreads(res.items);
        setThreadId((cur) => cur ?? res.items[0].id);
      } else {
        const created = await Threads.create({ agent_id: agentId });
        const newId = created.id || created.thread_id!;
        setThreads([created]);
        setThreadId(newId);
      }
    } catch (e) {
      toast.error("Couldn't open chat", errMsg(e));
    } finally {
      setLoadingThreads(false);
    }
  }, [agentId, toast, alwaysNewThread, setMessages]);

  // Initialize once when first active.
  React.useEffect(() => {
    if (active && !initedRef.current) {
      initedRef.current = true;
      loadThreads();
    }
  }, [active, loadThreads]);

  /* ---------------------- load messages for a thread --------------------- */
  const loadMessages = React.useCallback(
    async (id: string, opts: { silent?: boolean } = {}) => {
      if (!opts.silent) setLoadingMsgs(true);
      try {
        const detail = await Threads.get(id);
        setMessages(extractMessages(detail.values));
        // Surface any pending human-in-the-loop requests (clarifying questions, approvals).
        setInterrupts(parseInterrupts(detail.interrupts));
        if (onFiles) {
          const files = (detail.values as Record<string, unknown> | undefined)?.files as
            | Record<string, { content?: string; type?: string }>
            | undefined;
          // Only surface persisted files if present — the live stream is the primary
          // source for generated files (refetched thread state often omits them).
          if (files && Object.keys(files).length) onFiles(files);
        }
      } catch (e) {
        if (!opts.silent) toast.error("Couldn't load messages", errMsg(e));
      } finally {
        if (!opts.silent) setLoadingMsgs(false);
      }
    },
    [toast, onFiles, setMessages, setInterrupts],
  );
  React.useEffect(() => {
    loadMessagesRef.current = loadMessages;
  }, [loadMessages]);

  React.useEffect(() => {
    if (threadId) loadMessages(threadId);
    else setMessages([]);
  }, [threadId, loadMessages, setMessages]);

  /* --------------------------- new thread --------------------------- */
  const newThread = React.useCallback(async () => {
    setCreating(true);
    try {
      const created = await Threads.create({ agent_id: agentId });
      const newId = created.id || created.thread_id!;
      setThreads((prev) => [created, ...prev]);
      setThreadId(newId);
      setMessages([]);
    } catch (e) {
      toast.error("Couldn't start a thread", errMsg(e));
    } finally {
      setCreating(false);
    }
  }, [agentId, toast, setMessages]);

  /* --------------------------- send / respond --------------------------- */
  const send = React.useCallback(
    (text: string) => {
      if (!threadId) return;
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
    [agentId, threadId, runStream],
  );

  // Answer a human-in-the-loop interrupt by resuming the paused run.
  const respondToInterrupt = React.useCallback(
    (_interruptId: string, answer: string) => {
      if (!threadId) return;
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

  // Skip a HITL interrupt: let the run continue without an answer.
  const skipInterrupt = React.useCallback(async () => {
    if (!threadId) return;
    try {
      await Threads.resolveInterrupt(threadId);
      setInterrupts([]);
    } catch (e) {
      toast.error("Couldn't skip", errMsg(e));
    }
  }, [threadId, setInterrupts, toast]);

  return (
    <div className={cn("flex flex-col", className)}>
      {/* thread switcher */}
      {!hideThreadBar && (
      <div className="flex items-center gap-2 border-b border-line bg-paper-2/40 px-4 py-2.5">
        <Select
          value={threadId ?? ""}
          onChange={(e) => setThreadId(e.target.value)}
          disabled={loadingThreads || streaming}
          className="h-9 flex-1 text-[13px]"
          aria-label="Select thread"
        >
          {threads.length === 0 && <option value="">No threads yet</option>}
          {threads.map((t) => (
            <option key={t.id} value={t.id}>
              {threadLabel(t)}
            </option>
          ))}
        </Select>
        <Button variant="secondary" size="sm" onClick={newThread} loading={creating} disabled={streaming} title="Start a new thread">
          <Plus className="h-3.5 w-3.5" />
          New
        </Button>
      </div>
      )}

      {/* messages */}
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-4 py-6">
        {loadingThreads || (loadingMsgs && messages.length === 0) ? (
          <div className="flex h-full items-center justify-center text-ink-faint">
            <Spinner className="h-5 w-5" />
          </div>
        ) : messages.length === 0 ? (
          emptyState ?? (
            <EmptyState
              icon={<MessagesSquare className="h-7 w-7" />}
              title="Say hello"
              description={`Start chatting with ${agentName}. Even Stanley answers eventually.`}
              className="border-0 bg-transparent"
            />
          )
        ) : (
          <div className="mx-auto max-w-3xl space-y-6">
            {messages.map((m) => (
              <ChatMessage key={m.id} message={m} agentIcon={agentIcon} agentColor={agentColor} />
            ))}

            {/* HITL interrupt — inline in the flow, under the agent's turn */}
            {interrupts.length > 0 && !streaming &&
              interrupts.map((it) => (
                <InterruptPanel
                  key={it.interruptId}
                  interrupt={it}
                  onRespond={(answer) => respondToInterrupt(it.interruptId, answer)}
                  onSkip={skipInterrupt}
                />
              ))}
          </div>
        )}
      </div>

      {/* footer slot (e.g. create-agent preview) sits above the composer */}
      {footer && (
        <div className="border-t border-line bg-paper-2/30 px-4 py-3">
          <div className="mx-auto max-w-3xl">{footer}</div>
        </div>
      )}

      {/* composer */}
      <div className="border-t border-line bg-card/60 px-4 py-3">
        <div className="mx-auto max-w-3xl">
          <Composer
            onSend={send}
            onStop={stop}
            streaming={streaming}
            disabled={!threadId || loadingThreads || interrupts.length > 0}
            placeholder={
              interrupts.length > 0 ? "Answer the question above to continue…" : `Message ${agentName}…`
            }
          />
        </div>
      </div>
    </div>
  );
}
