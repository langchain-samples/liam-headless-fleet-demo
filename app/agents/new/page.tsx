"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Sparkles, PenLine, Plus } from "lucide-react";
import { PageHeader } from "@/components/brand/AppShell";
import { useToast } from "@/components/ui";
import { AgentChat } from "@/components/agents/AgentChat";
import { CreateAgentCard } from "@/components/agents/CreateAgentCard";
import {
  AGENT_BUILDER_ID, AGENT_BUILDER_NAME, AGENT_BUILDER_ICON, AGENT_BUILDER_COLOR,
} from "@/lib/builder";
import {
  isAgentReady, parseAgentFromFiles, type WorkspaceFiles,
} from "@/lib/agentBuilder/createFromFiles";
import { Agents } from "@/lib/fleet/endpoints";
import { FleetClientError } from "@/lib/fleet/client";
import { usePersona } from "@/lib/personas";

export default function NewAgentPage() {
  const router = useRouter();
  const toast = useToast();
  const { currentId } = usePersona();
  const [files, setFiles] = React.useState<WorkspaceFiles | undefined>();
  const [creating, setCreating] = React.useState(false);
  // Bumping this key remounts AgentChat → starts a brand-new builder thread.
  const [chatKey, setChatKey] = React.useState(0);

  const startNewBuild = React.useCallback(() => {
    setFiles(undefined);
    setChatKey((k) => k + 1);
  }, []);

  // Merge incoming file snapshots per-path so config.json + AGENTS.md + tools.json
  // from different stream events accumulate; never let an empty entry clobber a good one.
  const mergeFiles = React.useCallback((incoming: WorkspaceFiles | undefined) => {
    if (!incoming || !Object.keys(incoming).length) return;
    setFiles((prev) => {
      const next = { ...(prev ?? {}) };
      for (const [path, f] of Object.entries(incoming)) {
        if (f && (f.content ?? "").length > 0) next[path] = f;
      }
      return next;
    });
  }, []);

  const ready = isAgentReady(files);
  const parsed = React.useMemo(
    () => (ready ? parseAgentFromFiles(files, { dmOwner: currentId }) : null),
    [ready, files, currentId],
  );

  async function createAgent() {
    if (!parsed) return;
    setCreating(true);
    try {
      const saved = await Agents.create(parsed.request);
      toast.success("Agent created", `${saved.name} just joined the fleet.`);
      router.push(`/agents/${saved.id}`);
      router.refresh();
    } catch (e) {
      const msg = e instanceof FleetClientError ? e.detail || e.message : "Something went wrong.";
      toast.error("Couldn't create agent", msg);
      setCreating(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-0px)] flex-col lg:h-screen">
      <PageHeader
        title="Build an agent"
        subtitle="Describe what you want — the Agent Builder sets it up for you."
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={startNewBuild}
              className="dm-focus inline-flex items-center gap-1.5 rounded text-[13px] font-medium text-ink-soft hover:text-ink"
            >
              <Plus className="h-3.5 w-3.5" /> New build
            </button>
            <Link
              href="/agents/new/manual"
              className="dm-focus inline-flex items-center gap-1.5 rounded text-[13px] font-medium text-ink-soft hover:text-ink"
            >
              <PenLine className="h-3.5 w-3.5" /> Fill it out manually
            </Link>
            <Link
              href="/agents"
              className="dm-focus inline-flex items-center gap-1.5 rounded text-[13px] text-ink-soft hover:text-ink"
            >
              <ArrowLeft className="h-4 w-4" /> Roster
            </Link>
          </div>
        }
      />

      {/* Builder chat — the Create-agent preview sits at the bottom, above the composer. */}
      <div className="min-h-0 flex-1">
        <AgentChat
          key={chatKey}
          agentId={AGENT_BUILDER_ID}
          agentName={AGENT_BUILDER_NAME}
          agentIcon={AGENT_BUILDER_ICON}
          agentColor={AGENT_BUILDER_COLOR}
          hideThreadBar
          alwaysNewThread
          className="h-full"
          onFiles={mergeFiles}
          emptyState={<BuilderHero />}
          footer={parsed ? <CreateAgentCard parsed={parsed} creating={creating} onCreate={createAgent} /> : null}
        />
      </div>
    </div>
  );
}

function BuilderHero() {
  const examples = [
    "An agent that drafts polite sales follow-up emails for paper clients",
    "A reception assistant that answers front-desk questions",
    "An agent that summarizes my meeting notes into action items",
  ];
  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center px-4 text-center">
      <span
        className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-[16px]"
        style={{ background: "rgba(184,134,11,0.12)", border: "1px solid rgba(184,134,11,0.3)" }}
      >
        <Sparkles className="h-7 w-7 text-accent" />
      </span>
      <h2 className="text-[22px] font-bold tracking-tight text-ink" style={{ fontFamily: "var(--font-serif)" }}>
        What should your agent do?
      </h2>
      <p className="mt-2 max-w-md text-sm text-ink-faint">
        Tell the Agent Builder in plain English. It&apos;ll ask a few questions, then set up the
        agent for you — no forms required.
      </p>
      <div className="mt-6 flex flex-col gap-2 text-left">
        {examples.map((e) => (
          <div
            key={e}
            className="rounded-[10px] border border-line bg-paper-2/50 px-3.5 py-2 text-[13px] text-ink-soft"
          >
            &ldquo;{e}&rdquo;
          </div>
        ))}
      </div>
      <p className="mt-5 text-[12px] text-ink-faint">Type your idea below to get started.</p>
    </div>
  );
}
