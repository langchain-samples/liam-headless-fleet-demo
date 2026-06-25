"use client";
import * as React from "react";
import { Wrench, Cog, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { AgentIcon } from "@/components/brand/agentIcon";
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
  const thinking = !!message.streaming && !message.content && !(message.steps && message.steps.length);
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
        {/* deep-agent tool steps */}
        {message.steps && message.steps.length > 0 && (
          <div className="mb-2 flex flex-col gap-1">
            {message.steps.map((s, i) => {
              const isLast = i === message.steps!.length - 1;
              const active = isLast && message.streaming && !message.content;
              return (
                <span
                  key={`${s}-${i}`}
                  className="inline-flex w-fit items-center gap-1.5 rounded-full border border-line bg-paper-2/60 px-2.5 py-0.5 text-[11px] text-ink-soft"
                >
                  {active ? (
                    <Loader2 className="h-3 w-3 dm-spin text-navy-400" />
                  ) : (
                    <Check className="h-3 w-3 text-good" />
                  )}
                  {s}
                </span>
              );
            })}
          </div>
        )}
        {thinking ? (
          <span className="inline-flex items-center gap-2 text-[13px] text-ink-faint">
            <Loader2 className="h-3.5 w-3.5 dm-spin text-navy-400" />
            <span>Thinking</span>
            <span className="dm-dots" aria-hidden />
          </span>
        ) : (
          <div className="whitespace-pre-wrap break-words text-[14px] leading-[1.65] text-ink">
            {message.content || (message.streaming ? "" : message.steps?.length ? "" : <span className="text-ink-faint">(no content)</span>)}
            {message.streaming && message.content && (
              <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-navy-400 align-middle" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
