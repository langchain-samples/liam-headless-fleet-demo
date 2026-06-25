"use client";
// Renders a human-in-the-loop request (e.g. the Agent Builder's clarifying
// questions) inline in the conversation. Suggested answers are checkbox rows
// (multi-select per question) plus an optional free-text box. Submitting composes
// the answers and resumes the paused run with a `respond`; Skip continues without
// answering. Dunder Mifflin light theme.
import * as React from "react";
import { HelpCircle, CornerDownLeft, Check, SkipForward } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { ParsedInterrupt } from "./shared";

export function InterruptPanel({
  interrupt,
  onRespond,
  onSkip,
}: {
  interrupt: ParsedInterrupt;
  onRespond: (answer: string) => void;
  /** Continue the run without providing an answer. */
  onSkip?: () => void;
}) {
  const isQuestions = interrupt.questions.length > 0;

  // Per-question state: which suggested checkboxes are selected + free-text.
  const [selected, setSelected] = React.useState<Record<number, Set<string>>>({});
  const [custom, setCustom] = React.useState<Record<number, string>>({});
  // Single free-text answer for the no-questions (approval/respond) case.
  const [reply, setReply] = React.useState("");

  const toggle = (qi: number, value: string) =>
    setSelected((prev) => {
      const next = { ...prev };
      const set = new Set(next[qi] ?? []);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      next[qi] = set;
      return next;
    });

  // Build the answer string the agent receives.
  const composed = React.useMemo(() => {
    if (!isQuestions) return reply.trim();
    const parts: string[] = [];
    interrupt.questions.forEach((q, i) => {
      const picks = [...(selected[i] ?? [])];
      const free = (custom[i] ?? "").trim();
      const all = [...picks, ...(free ? [free] : [])];
      if (all.length) parts.push(`${i + 1}. ${q}\n→ ${all.join(", ")}`);
    });
    return parts.join("\n\n");
  }, [isQuestions, interrupt.questions, selected, custom, reply]);

  const canSend = composed.length > 0;

  const submit = () => {
    if (!canSend) return;
    onRespond(composed);
    setSelected({});
    setCustom({});
    setReply("");
  };

  return (
    <div className="dm-fade-in rounded-[14px] border border-navy-400/40 bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <HelpCircle className="h-4 w-4 text-navy-400" />
        <p className="text-[13px] font-semibold text-ink">
          {isQuestions ? "The agent needs a few details" : "The agent is waiting on you"}
        </p>
      </div>

      <div className="space-y-4 px-4 py-3.5">
        {isQuestions ? (
          interrupt.questions.map((q, i) => {
            const picks = selected[i] ?? new Set<string>();
            const suggestions = interrupt.suggestedAnswers[i] ?? [];
            return (
              <div key={i} className="space-y-2">
                <p className="text-[13px] text-ink">
                  <span className="mr-1.5 font-semibold text-navy-400">{i + 1}.</span>
                  {q}
                </p>
                {suggestions.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {suggestions.map((s) => {
                      const on = picks.has(s);
                      return (
                        <label
                          key={s}
                          className={cn(
                            "flex cursor-pointer items-center gap-2.5 rounded-[8px] px-2 py-1.5 text-[13px] transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-navy-400/50",
                            on ? "bg-navy/5 text-ink" : "text-ink-soft hover:bg-paper-2",
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors",
                              on ? "border-navy bg-navy text-white" : "border-line-strong bg-card",
                            )}
                          >
                            {on && <Check className="h-3 w-3" />}
                          </span>
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => toggle(i, s)}
                            className="sr-only"
                          />
                          {s}
                        </label>
                      );
                    })}
                  </div>
                )}
                <input
                  value={custom[i] ?? ""}
                  onChange={(e) => setCustom((prev) => ({ ...prev, [i]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                  placeholder={suggestions.length ? "Or type your own…" : "Type your answer…"}
                  className="dm-focus w-full rounded-[10px] border border-line-strong bg-card px-3 py-1.5 text-[13px] text-ink outline-none placeholder:text-ink-faint focus:border-navy-400"
                />
              </div>
            );
          })
        ) : (
          <>
            <p className="whitespace-pre-wrap text-[13px] text-ink-soft">
              {interrupt.description || `Approval needed for ${interrupt.actionName}.`}
            </p>
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={3}
              placeholder="Add a reply…"
              className="dm-focus w-full resize-none rounded-[12px] border border-line-strong bg-card px-3 py-2.5 text-[14px] text-ink outline-none placeholder:text-ink-faint focus:border-navy-400"
            />
          </>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
          <span className="hidden text-[11px] text-ink-faint sm:inline">
            {isQuestions ? "Pick options or type answers" : "⌘/Ctrl + Enter to send"}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {onSkip && (
              <Button onClick={onSkip} variant="secondary" size="sm">
                <SkipForward className="h-3.5 w-3.5" />
                Skip
              </Button>
            )}
            <Button onClick={submit} disabled={!canSend} size="sm">
              <CornerDownLeft className="h-3.5 w-3.5" />
              Submit
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
