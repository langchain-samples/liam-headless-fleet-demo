"use client";
import * as React from "react";
import { ChevronDown, Search, Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { Input, Spinner } from "@/components/ui";
import { AgentIcon } from "@/components/brand/agentIcon";
import type { Agent } from "@/lib/fleet/types";

/** Searchable dropdown for selecting an agent. */
export function AgentPicker({
  agents,
  value,
  onChange,
  loading,
  placeholder = "Select an agent…",
  className,
}: {
  agents: Agent[];
  value?: string;
  onChange: (id: string) => void;
  loading?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const rootRef = React.useRef<HTMLDivElement>(null);

  const selected = agents.find((a) => a.id === value);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const filtered = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return agents;
    return agents.filter((a) => a.name.toLowerCase().includes(s) || a.description?.toLowerCase().includes(s));
  }, [agents, q]);

  return (
    <div ref={rootRef} className={cn("relative w-full max-w-sm", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={loading}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "dm-focus flex h-10 w-full items-center gap-2 rounded-[10px] border border-line-strong bg-card px-3 text-sm text-ink",
          "transition-colors hover:bg-paper-2 disabled:opacity-60",
        )}
      >
        {loading ? (
          <Spinner />
        ) : selected ? (
          <AgentIcon icon={selected.display?.icon} color={selected.display?.icon_color} size={16} />
        ) : null}
        <span className={cn("flex-1 truncate text-left", !selected && "text-ink-faint")}>
          {selected ? selected.name : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-ink-faint" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-[12px] border border-line bg-card shadow-xl dm-fade-in">
          <div className="border-b border-line p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search agents…"
                className="h-9 pl-8"
                autoFocus
              />
            </div>
          </div>
          <ul role="listbox" className="max-h-72 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-center text-[13px] text-ink-faint">No agents match “{q}”.</li>
            ) : (
              filtered.map((a) => {
                const active = a.id === value;
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        onChange(a.id);
                        setOpen(false);
                        setQ("");
                      }}
                      className={cn(
                        "dm-focus flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-paper-2",
                        active && "bg-paper-2",
                      )}
                    >
                      <AgentIcon icon={a.display?.icon} color={a.display?.icon_color} size={16} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-ink">{a.name}</span>
                        {a.description && (
                          <span className="block truncate text-[11px] text-ink-faint">{a.description}</span>
                        )}
                      </span>
                      {active && <Check className="h-4 w-4 shrink-0 text-navy" />}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
