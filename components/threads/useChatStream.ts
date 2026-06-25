"use client";
// Shared chat-streaming engine for AgentChat and ThreadConsole.
//
// Owns the conversation message list, streaming state, pending HITL interrupts,
// scroll-pinning, and the run lifecycle (start → stream tokens/tool-steps/files
// with a typewriter smoother → settle). Both chat surfaces consume this so the
// streaming logic lives in exactly one place.
import * as React from "react";
import { streamRun, parseSSE, FleetClientError, errMessage } from "@/lib/fleet/client";
import {
  interpretSSE,
  resetStreamState,
  humanizeTool,
  createSmoothStreamer,
  type ChatMessage as ChatMessageT,
  type ParsedInterrupt,
} from "./shared";

type Toast = { error: (title: string, detail?: string) => void };
type Files = Record<string, { content?: string; type?: string }>;

export interface ChatStream {
  messages: ChatMessageT[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessageT[]>>;
  streaming: boolean;
  interrupts: ParsedInterrupt[];
  setInterrupts: React.Dispatch<React.SetStateAction<ParsedInterrupt[]>>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  /** Attach to the scroll container's onScroll to track stick-to-bottom intent. */
  onScroll: () => void;
  /** Start a run on `threadId` with `body`; optionally show a user bubble first. */
  runStream: (threadId: string, body: unknown, userBubble?: string) => Promise<void>;
  /** Abort the in-flight stream. */
  stop: () => void;
}

export function useChatStream(opts: {
  toast: Toast;
  /** Re-sync authoritative thread state after a run settles (also refreshes interrupts). */
  onSettle: (threadId: string) => void;
  /** Receive workspace files surfaced in `values` snapshots (builder create flow). */
  onFiles?: (files: Files) => void;
}): ChatStream {
  const { toast, onSettle, onFiles } = opts;

  const [messages, setMessages] = React.useState<ChatMessageT[]>([]);
  const [streaming, setStreaming] = React.useState(false);
  const [interrupts, setInterrupts] = React.useState<ParsedInterrupt[]>([]);

  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const stickToBottom = React.useRef(true);
  const abortRef = React.useRef<AbortController | null>(null);
  const smootherRef = React.useRef<ReturnType<typeof createSmoothStreamer> | null>(null);

  // Keep latest callbacks in a ref so runStream stays stable across renders.
  const cbRef = React.useRef({ toast, onSettle, onFiles });
  React.useEffect(() => {
    cbRef.current = { toast, onSettle, onFiles };
  });

  // Cancel any in-flight work on unmount (abort fetch + stop the smoother interval).
  React.useEffect(
    () => () => {
      abortRef.current?.abort();
      smootherRef.current?.cancel();
    },
    [],
  );

  const onScroll = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  // Autoscroll to newest while pinned.
  React.useEffect(() => {
    if (stickToBottom.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const stop = React.useCallback(() => abortRef.current?.abort(), []);

  const runStream = React.useCallback(
    async (threadId: string, body: unknown, userBubble?: string) => {
      if (streaming || !threadId) return;
      stickToBottom.current = true;
      resetStreamState();
      setInterrupts([]); // acting on the request clears it

      const aiId = `a-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        ...(userBubble ? [{ id: `u-${Date.now()}`, role: "user" as const, content: userBubble }] : []),
        { id: aiId, role: "assistant" as const, content: "", streaming: true },
      ]);
      setStreaming(true);

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const patchAi = (patch: Partial<ChatMessageT>) =>
        setMessages((prev) => prev.map((m) => (m.id === aiId ? { ...m, ...patch } : m)));
      const setAiContent = (full: string) => patchAi({ content: full });

      // Smooth chunky deltas into a fluid typewriter reveal; keep the view pinned.
      const smoother = createSmoothStreamer((full) => {
        if (stickToBottom.current && scrollRef.current) {
          requestAnimationFrame(() => {
            if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          });
        }
        setAiContent(full);
      });
      smootherRef.current = smoother;

      const addStep = (label: string) =>
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== aiId) return m;
            const steps = m.steps ?? [];
            if (steps[steps.length - 1] === label) return m; // dedupe consecutive
            return { ...m, steps: [...steps, label] };
          }),
        );

      try {
        const res = await streamRun(threadId, body, ctrl.signal);
        if (!res.ok) {
          let detail = `Run failed (${res.status})`;
          try {
            const j = await res.json();
            detail = (j && (j.detail || j.message)) || detail;
          } catch {
            /* ignore */
          }
          throw new FleetClientError(res.status, detail);
        }

        let sawError: string | null = null;
        for await (const { event, data } of parseSSE(res, ctrl.signal)) {
          if (ctrl.signal.aborted) break;
          const piece = interpretSSE(event, data);
          if (!piece) continue;
          if (piece.error) {
            sawError = piece.error;
            continue;
          }
          if (piece.done) break;
          if (piece.files) cbRef.current.onFiles?.(piece.files);
          // Interrupts can stream in mid-run (a `values` snapshot's `__interrupt__`);
          // surface the pause immediately rather than waiting for the run to settle.
          if (piece.interrupts?.length) setInterrupts(piece.interrupts);
          // Live tool activity from the token stream (call start) — shows progress during
          // the tool-heavy phase. `addStep` de-dupes consecutive labels, so the richer
          // filename label from the next `values` snapshot still supersedes/augments it.
          if (piece.tool) addStep(humanizeTool(piece.tool.name));
          // Tool steps from `values` snapshots carry COMPLETE args (e.g. filenames).
          if (piece.tools) for (const t of piece.tools) addStep(humanizeTool(t.name, t.arg));
          if (typeof piece.text === "string" && piece.text) {
            if (piece.snapshot) smoother.set(piece.text);
            else smoother.push(piece.text);
          }
        }

        if (sawError && !ctrl.signal.aborted) {
          smoother.finish();
          cbRef.current.toast.error("Run error", sawError);
          setAiContent(`${smoother.value}\n\n⚠️ ${sawError}`);
        } else if (!ctrl.signal.aborted) {
          // Stream ended cleanly — let the typewriter reveal the rest at its pace.
          await smoother.drain();
        }
      } catch (e) {
        smoother.cancel();
        if (ctrl.signal.aborted) {
          setAiContent(`${smoother.value}\n\n— stopped —`);
        } else {
          const msg = errMessage(e, "The run failed to stream.");
          cbRef.current.toast.error("Streaming failed", msg);
          setAiContent(`${smoother.value}\n\n⚠️ ${msg}`);
        }
      } finally {
        smoother.finish(); // safety: ensure full text is shown
        if (smootherRef.current === smoother) smootherRef.current = null;
        abortRef.current = null;
        setStreaming(false);
        // Mark done and drop an empty assistant bubble (e.g. paused before any text).
        setMessages((prev) =>
          prev
            .map((m) => (m.id === aiId ? { ...m, streaming: false } : m))
            .filter((m) => !(m.id === aiId && !m.content && !m.steps?.length)),
        );
        cbRef.current.onSettle(threadId);
      }
    },
    [streaming],
  );

  return {
    messages,
    setMessages,
    streaming,
    interrupts,
    setInterrupts,
    scrollRef,
    onScroll,
    runStream,
    stop,
  };
}
