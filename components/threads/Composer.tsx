"use client";
import * as React from "react";
import { ArrowUp, Square, Plus } from "lucide-react";
import { cn } from "@/lib/cn";

/** Message composer. Enter sends, Shift+Enter newlines. Auto-grows up to a cap. */
export function Composer({
  onSend,
  onStop,
  streaming,
  disabled,
  placeholder = "Message the agent…",
}: {
  onSend: (text: string) => void;
  onStop: () => void;
  streaming: boolean;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = React.useState("");
  const [focused, setFocused] = React.useState(false);
  const ref = React.useRef<HTMLTextAreaElement>(null);

  const grow = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, []);

  React.useEffect(grow, [text, grow]);

  const submit = () => {
    const t = text.trim();
    if (!t || streaming || disabled) return;
    onSend(t);
    setText("");
  };

  const canSend = !!text.trim() && !disabled;

  return (
    <div>
      <div
        className={cn(
          "flex items-end gap-2 rounded-[18px] border bg-card px-2.5 py-2 transition-colors",
          focused ? "border-navy-400 shadow-sm" : "border-line-strong",
          disabled && "opacity-60",
        )}
      >
        {/* attach affordance (decorative for the demo) */}
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          className="mb-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-paper-2 hover:text-ink-soft"
          title="Attach (coming soon)"
        >
          <Plus className="h-4 w-4" />
        </button>

        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          disabled={disabled}
          placeholder={placeholder}
          aria-label="Message composer"
          className="flex-1 resize-none border-0 bg-transparent py-1.5 text-[14px] text-ink outline-none placeholder:text-ink-faint"
        />

        {streaming ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop streaming"
            title="Stop"
            className="dm-focus mb-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper-2 text-ink-soft transition-colors hover:bg-line"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            aria-label="Send message"
            className={cn(
              "dm-focus mb-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all",
              canSend
                ? "bg-navy text-white hover:bg-navy-600"
                : "bg-paper-2 text-ink-faint",
            )}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        )}
      </div>
      <p className="mt-1.5 px-2 text-[11px] text-ink-faint">
        Enter to send · Shift+Enter for a new line
      </p>
    </div>
  );
}
