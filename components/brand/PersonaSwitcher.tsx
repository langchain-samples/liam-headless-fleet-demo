"use client";
import * as React from "react";
import { ChevronsUpDown, Check, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { usePersona, PERSONAS, PersonaAvatar } from "@/lib/personas";

/** Bottom-left identity card with a popover to switch the acting demo user. */
export function PersonaSwitcher() {
  const { current, currentId, setPersona } = usePersona();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      {open && (
        <div className="dm-fade-in absolute bottom-[calc(100%+8px)] left-0 right-0 z-50 max-h-[60vh] overflow-y-auto rounded-[12px] border border-line bg-card p-1.5 shadow-2xl">
          <p className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
            Switch user (demo)
          </p>
          {PERSONAS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setPersona(p.id);
                setOpen(false);
              }}
              className={cn(
                "dm-focus flex w-full items-center gap-2.5 rounded-[9px] px-2 py-1.5 text-left transition-colors hover:bg-paper-2",
                p.id === currentId && "bg-paper-2",
              )}
            >
              <PersonaAvatar persona={p} size={30} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[13px] font-medium text-ink">{p.name}</span>
                  {p.role === "admin" && (
                    <ShieldCheck className="h-3 w-3 shrink-0 text-accent" aria-label="Admin" />
                  )}
                </span>
                <span className="block truncate text-[11px] text-ink-faint">{p.title}</span>
              </span>
              {p.id === currentId && <Check className="h-3.5 w-3.5 shrink-0 text-navy" />}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="dm-focus flex w-full items-center gap-2.5 rounded-[10px] border border-line bg-paper-2/70 p-2.5 text-left transition-colors hover:bg-paper-2"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <PersonaAvatar persona={current} size={34} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-semibold text-ink">{current.name}</span>
            {current.role === "admin" && (
              <span className="rounded bg-accent-soft px-1 py-px text-[9px] font-bold uppercase tracking-wide text-[#7a5a08]">
                Admin
              </span>
            )}
          </span>
          <span className="block truncate text-[11px] text-ink-faint">
            {current.title} · Scranton
          </span>
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-ink-faint" />
      </button>
    </div>
  );
}
