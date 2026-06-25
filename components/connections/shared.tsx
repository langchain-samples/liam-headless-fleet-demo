"use client";
import * as React from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/cn";

// Canonical error-message extractor lives in the Fleet client; re-export for
// connections components that import it from here.
export { errMessage } from "@/lib/fleet/client";

/** Format an ISO timestamp into a compact, readable string. */
export function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Small monospace cell for ids/urls with truncation + title tooltip. */
export function Mono({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn("font-mono text-[12px] text-ink-soft", className)}
      title={typeof children === "string" ? children : undefined}
    >
      {children}
    </span>
  );
}

/** A tiny copy-to-clipboard button. */
export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable — no-op */
        }
      }}
      className="dm-focus inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-ink-faint transition-colors hover:bg-paper-2 hover:text-ink-soft"
      aria-label={label}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-good" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </button>
  );
}

/** A simple row of skeleton lines for table/card loading states. */
export function LoadingRows({ rows = 4, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }).map((_, c) => (
            <div
              key={c}
              className="dm-skeleton h-5 flex-1 rounded-md"
              style={{ opacity: 1 - r * 0.12 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Render a comma string into a string[] (trimmed, empties dropped). */
export function parseCsv(input: string): string[] {
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
