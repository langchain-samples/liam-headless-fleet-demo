"use client";
import * as React from "react";
import { Wrench, Cog, Loader2, Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { AgentIcon } from "@/components/brand/agentIcon";
import { Markdown } from "./Markdown";
import type { ChatMessage as ChatMessageT } from "./shared";

/**
 * A single conversation turn. User turns are a compact navy bubble on the right;
 * assistant turns are clean left-aligned prose with the agent avatar (no heavy
 * bubble chrome), tool turns are a subtle monospace card.
 */
export function ChatMessage({
  message,
  agentIcon,
  agentColor,
}: {
  message: ChatMessageT;
  agentIcon?: string;
  agentColor?: string;
}) {
  const isUser = message.role === "user";
  const isTool = message.role === "tool";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center px-2 py-1">
        <div className="flex items-center gap-1.5 rounded-full border border-line bg-paper-2/60 px-3 py-1 text-[11px] text-ink-faint">
          <Cog className="h-3 w-3" />
          <span className="max-w-[60ch] truncate">{message.content || "system"}</span>
        </div>
      </div>
    );
  }

  // User: right-aligned navy bubble, no label.
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] whitespace-pre-wrap break-words rounded-[16px] rounded-tr-sm bg-navy px-4 py-2.5 text-[14px] leading-relaxed text-white shadow-sm">
          {message.content}
        </div>
      </div>
    );
  }

  // Tool: subtle monospace card.
  if (isTool) {
    return (
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line bg-paper-2 text-ink-soft">
          <Wrench className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-[11px] font-medium text-ink-faint">{message.name || "Tool"}</p>
          <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded-[12px] border border-line bg-paper-2/60 px-3 py-2 font-mono text-[12px] text-ink-soft">
            {message.content || "—"}
          </pre>
        </div>
      </div>
    );
  }

  // Assistant: avatar + flowing prose, no bubble border.
  return (
    <div className="flex items-start gap-3">
      <span
        className={cn(
          "mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          message.streaming && "ring-2 ring-navy-400/30",
        )}
        style={{ background: "rgba(43,74,120,0.10)", border: "1px solid rgba(43,74,120,0.18)" }}
      >
        <AgentIcon icon={agentIcon} color={agentColor} size={15} />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        {/* Live agent activity (tool steps) — streams in while working,
            collapses to a summary once a text answer arrives. */}
        {(message.streaming || (message.steps && message.steps.length > 0)) && (
          <StepList
            steps={message.steps ?? []}
            streaming={!!message.streaming}
            hasContent={!!message.content}
          />
        )}
        <div className="break-words text-[14px] leading-[1.65] text-ink">
          {message.content ? (
            <Markdown>{message.content}</Markdown>
          ) : message.streaming ? (
            ""
          ) : message.steps?.length ? (
            ""
          ) : (
            <span className="text-ink-faint">(no content)</span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Live agent activity. While the agent is working (streaming, no answer text yet)
 * it streams the actual tool events in — the current action with a spinner, plus
 * the few most-recent completed steps — so the user sees what the agent is doing.
 * Once a text answer starts (or the run ends) it collapses to a compact, expandable
 * "N steps" summary.
 */
function StepList({
  steps,
  streaming,
  hasContent,
}: {
  steps: string[];
  streaming: boolean;
  hasContent: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const active = streaming && !hasContent;

  // ---- Live activity feed while the agent works ----
  if (active) {
    if (steps.length === 0) {
      // Before the first event arrives — a quiet working pulse, no "Thinking"
      // label. Match the avatar's height (h-7) and center so it lines up with it
      // instead of floating above the avatar's middle.
      return (
        <div className="mb-2 flex h-7 items-center gap-2 text-ink-faint">
          <Loader2 className="h-4 w-4 dm-spin text-navy-400" />
        </div>
      );
    }
    // Emphasize the CURRENT action as one clean line; fold prior steps into a quiet count.
    const current = steps[steps.length - 1];
    const doneCount = steps.length - 1;
    return (
      <div className="mb-2 flex flex-col gap-0.5">
        <span className="dm-fade-in inline-flex items-center gap-1.5 text-[13px] font-medium text-ink">
          <Loader2 className="h-3.5 w-3.5 shrink-0 dm-spin text-navy-400" />
          {current}
          <span className="dm-dots" aria-hidden />
        </span>
        {doneCount > 0 && (
          <span className="inline-flex items-center gap-1.5 pl-[20px] text-[11px] text-ink-faint">
            <Check className="h-3 w-3 shrink-0 text-good" />
            {doneCount} step{doneCount === 1 ? "" : "s"} done
          </span>
        )}
      </div>
    );
  }

  // ---- Collapsed summary once the answer arrives / run ends ----
  if (steps.length === 0) return null;
  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="dm-focus inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-paper-2/60 px-2.5 py-0.5 text-[11px] text-ink-soft transition-colors hover:border-navy-400"
      >
        <Check className="h-3 w-3 shrink-0 text-good" />
        <span className="truncate">{`${steps.length} step${steps.length === 1 ? "" : "s"}`}</span>
        <ChevronRight className={cn("h-3 w-3 shrink-0 transition-transform", open && "rotate-90")} />
      </button>

      {open && (
        <div className="mt-1 flex flex-col gap-1 border-l border-line pl-3">
          {steps.map((s, i) => (
            <span key={`${s}-${i}`} className="inline-flex items-center gap-1.5 text-[11px] text-ink-faint">
              <Check className="h-3 w-3 shrink-0 text-good" />
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
