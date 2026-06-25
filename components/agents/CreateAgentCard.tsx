"use client";
import * as React from "react";
import {
  Wand2, Wrench, Boxes, Clock, Zap, Cpu, Server, ChevronDown, ChevronUp, Info,
} from "lucide-react";
import { Badge, Button } from "@/components/ui";
import type { ParsedAgent } from "@/lib/agentBuilder/createFromFiles";

/** Bottom-of-chat preview of the agent the builder produced, with a Create button. */
export function CreateAgentCard({
  parsed,
  creating,
  onCreate,
}: {
  parsed: ParsedAgent;
  creating: boolean;
  onCreate: () => void;
}) {
  const [open, setOpen] = React.useState(true);
  const s = parsed.summary;

  return (
    <div className="dm-fade-in rounded-[14px] border border-good/40 bg-card shadow-sm">
      {/* header row */}
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-good-soft text-good">
            <Wand2 className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-ink">{s.name}</p>
            <p className="text-[11px] text-ink-faint">Ready to create</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setOpen((v) => !v)}
            className="dm-focus inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-ink-soft hover:bg-paper-2"
          >
            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
            {open ? "Hide" : "Preview"}
          </button>
          <Button variant="primary" size="sm" onClick={onCreate} loading={creating}>
            <Wand2 className="h-3.5 w-3.5" />
            Create agent
          </Button>
        </div>
      </div>

      {open && (
        <div className="space-y-3 border-t border-line px-4 py-3">
          {s.description && (
            <p className="text-[13px] leading-relaxed text-ink-soft">{s.description}</p>
          )}

          {/* meta chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Meta icon={<Cpu className="h-3 w-3" />} label={s.model} />
            <Meta
              icon={s.backend === "sandbox" ? <Server className="h-3 w-3" /> : <Boxes className="h-3 w-3" />}
              label={s.backend === "sandbox" ? `Sandbox (${s.sandboxScope ?? "thread"})` : "State backend"}
            />
          </div>

          {/* tools */}
          <Section icon={<Wrench className="h-3.5 w-3.5" />} title={`Tools (${s.toolNames.length})`}>
            {s.toolNames.length ? (
              <div className="flex flex-wrap gap-1.5">
                {s.toolNames.map((t) => (
                  <Badge key={t} tone="neutral" className="font-mono">{t}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-ink-faint">No tools — pure conversational agent.</p>
            )}
          </Section>

          {/* subagents */}
          {s.subagentNames.length > 0 && (
            <Section icon={<Boxes className="h-3.5 w-3.5" />} title={`Subagents (${s.subagentNames.length})`}>
              <div className="flex flex-wrap gap-1.5">
                {s.subagentNames.map((n) => (
                  <Badge key={n} tone="navy">{n}</Badge>
                ))}
              </div>
            </Section>
          )}

          {/* schedules */}
          {s.cronSchedules.length > 0 && (
            <Section icon={<Clock className="h-3.5 w-3.5" />} title="Schedule">
              <div className="flex flex-wrap gap-1.5">
                {s.cronSchedules.map((c) => (
                  <Badge key={c} tone="accent" className="font-mono">{c}</Badge>
                ))}
              </div>
            </Section>
          )}

          {/* triggers */}
          {s.triggers.length > 0 && (
            <Section icon={<Zap className="h-3.5 w-3.5" />} title={`Triggers (${s.triggers.length})`}>
              <div className="flex flex-wrap gap-1.5">
                {s.triggers.map((t) => (
                  <Badge key={t} tone="warn" className="font-mono">{t.slice(0, 8)}…</Badge>
                ))}
              </div>
            </Section>
          )}

          {/* notes / demo limitations */}
          {parsed.notes.length > 0 && (
            <div className="flex items-start gap-1.5 rounded-[10px] bg-paper-2/60 px-3 py-2 text-[11px] text-ink-faint">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{parsed.notes.join(" ")}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Meta({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper-2/50 px-2.5 py-0.5 text-[11px] font-medium text-ink-soft">
      {icon}
      {label}
    </span>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
        {icon}
        {title}
      </p>
      {children}
    </div>
  );
}
