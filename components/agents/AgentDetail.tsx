"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Pencil,
  Copy,
  Trash2,
  ArrowLeft,
  Hash,
  MessagesSquare,
} from "lucide-react";
import { PageBody } from "@/components/brand/AppShell";
import {
  Button,
  Card,
  CardBody,
  Badge,
  Input,
  Skeleton,
  EmptyState,
  Field,
  cn,
} from "@/components/ui";
import { Dialog, ConfirmDialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { AgentIconTile } from "@/components/brand/agentIcon";
import { AgentChat } from "./AgentChat";
import { AgentForm } from "./AgentForm";
import { Agents } from "@/lib/fleet/endpoints";
import { FleetClientError } from "@/lib/fleet/client";
import type { Agent } from "@/lib/fleet/types";
import {
  accessLevelLabel,
  accessLevelTone,
  fmtDate,
  ownerName,
  shortRevision,
  DM_PREFIX,
} from "./helpers";

type Mode = "chat" | "edit";

export function AgentDetail({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();

  const [agent, setAgent] = React.useState<Agent | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<Mode>("chat");

  // dialogs / actions
  const [cloneOpen, setCloneOpen] = React.useState(false);
  const [cloneName, setCloneName] = React.useState("");
  const [cloning, setCloning] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const a = await Agents.get(id, ["owner", "files"]);
      setAgent(a);
    } catch (e) {
      setError(e instanceof FleetClientError ? e.detail || e.message : "Couldn't load this agent.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    load();
  }, [load]);

  function openClone() {
    setCloneName(`${DM_PREFIX}${agent?.name ?? "Agent"} (Copy)`);
    setCloneOpen(true);
  }

  async function confirmClone() {
    setCloning(true);
    try {
      const cloned = await Agents.clone(id, { name: cloneName.trim() || undefined });
      toast.success("Agent cloned", `${cloned.name} is ready.`);
      setCloneOpen(false);
      router.push(`/agents/${cloned.id}`);
    } catch (e) {
      toast.error(
        "Clone failed",
        e instanceof FleetClientError ? e.detail || e.message : "Couldn't clone the agent.",
      );
    } finally {
      setCloning(false);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      await Agents.remove(id);
      toast.success("Agent deleted", `${agent?.name ?? "The agent"} has left the building.`);
      router.push("/agents");
      router.refresh();
    } catch (e) {
      toast.error(
        "Delete failed",
        e instanceof FleetClientError ? e.detail || e.message : "Couldn't delete the agent.",
      );
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  if (loading) return <DetailSkeleton />;

  if (error || !agent) {
    return (
      <PageBody>
        <Link href="/agents" className="dm-focus mb-4 inline-flex items-center gap-1.5 rounded text-[13px] text-ink-soft hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Back to roster
        </Link>
        <EmptyState
          title="Agent not found"
          description={error || "This agent may have been deleted or you don't have access."}
          action={
            <Link href="/agents">
              <Button variant="secondary">Back to roster</Button>
            </Link>
          }
        />
      </PageBody>
    );
  }

  return (
    <div className="flex h-[calc(100vh-0px)] flex-col lg:h-screen">
      {/* Header */}
      <div className="shrink-0 border-b border-line bg-card/40 px-6 py-5 sm:px-8">
        <Link
          href="/agents"
          className="dm-focus mb-4 inline-flex items-center gap-1.5 rounded text-[13px] text-ink-soft hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> Back to roster
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <AgentIconTile icon={agent.display?.icon} color={agent.display?.icon_color} size={56} />
            <div className="min-w-0">
              <h1
                className="truncate text-[22px] font-bold tracking-tight text-ink"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {agent.name}
              </h1>
              {agent.description && (
                <p className="mt-0.5 max-w-2xl text-sm text-ink-soft">{agent.description}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge tone="neutral">{ownerName(agent)}</Badge>
                {agent.model?.id && (
                  <Badge tone="navy" className="font-mono">
                    {agent.model.id}
                  </Badge>
                )}
                {agent.permissions?.visibility && (
                  <Badge tone="neutral">
                    {agent.permissions.visibility === "tenant" ? "Tenant" : "Personal"}
                  </Badge>
                )}
                {agent.access_level && (
                  <Badge tone={accessLevelTone(agent.access_level)}>
                    {accessLevelLabel(agent.access_level)}
                  </Badge>
                )}
                {agent.backend?.type && (
                  <Badge tone="accent">{agent.backend.type === "sandbox" ? "Sandbox" : "State"}</Badge>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={openClone}>
              <Copy className="h-4 w-4" />
              Clone
            </Button>
            <Button variant="danger" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>

        {/* meta line */}
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-ink-faint">
          <span>Created {fmtDate(agent.created_at)}</span>
          <span>Updated {fmtDate(agent.updated_at)}</span>
          <span className="inline-flex items-center gap-1">
            <Hash className="h-3 w-3" />
            <span className="font-mono">{shortRevision(agent.revision)}</span>
          </span>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="shrink-0 px-6 pt-5 sm:px-8">
        <div className="inline-flex overflow-hidden rounded-[10px] border border-line-strong">
          <button
            onClick={() => setMode("chat")}
            className={cn(
              "dm-focus inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium transition-colors",
              mode === "chat" ? "bg-navy text-white" : "bg-card text-ink-soft hover:bg-paper-2",
            )}
          >
            <MessagesSquare className="h-3.5 w-3.5" />
            Chat
          </button>
          <button
            onClick={() => setMode("edit")}
            className={cn(
              "dm-focus inline-flex items-center gap-1.5 border-l border-line-strong px-4 py-2 text-[13px] font-medium transition-colors",
              mode === "edit" ? "bg-navy text-white" : "bg-card text-ink-soft hover:bg-paper-2",
            )}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
        </div>
      </div>

      {mode === "chat" ? (
        // Chat fills the rest of the viewport down to the bottom.
        <div className="mt-4 min-h-0 flex-1 overflow-hidden border-t border-line bg-card">
          <AgentChat
            agentId={id}
            agentName={agent.name}
            agentIcon={agent.display?.icon}
            agentColor={agent.display?.icon_color}
            className="h-full"
          />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8">
          <AgentForm agent={agent} onSaved={load} />
        </div>
      )}

      {/* Clone dialog */}
      <Dialog
        open={cloneOpen}
        onClose={() => !cloning && setCloneOpen(false)}
        title="Clone agent"
        description="Make a copy with a fresh name. The original stays put."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCloneOpen(false)} disabled={cloning}>
              Cancel
            </Button>
            <Button variant="primary" onClick={confirmClone} loading={cloning}>
              Clone agent
            </Button>
          </>
        }
      >
        <Field label="New name">
          <Input
            value={cloneName}
            onChange={(e) => setCloneName(e.target.value)}
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && !cloning && confirmClone()}
          />
        </Field>
      </Dialog>

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => !deleting && setDeleteOpen(false)}
        onConfirm={confirmDelete}
        title="Delete this agent?"
        message={`"${agent.name}" will be permanently removed. This can't be undone.`}
        confirmLabel="Delete agent"
        danger
        loading={deleting}
      />
    </div>
  );
}

/* ----------------------------- skeleton ----------------------------- */
function DetailSkeleton() {
  return (
    <>
      <div className="border-b border-line bg-card/40 px-6 py-5 sm:px-8">
        <Skeleton className="mb-4 h-4 w-28" />
        <div className="flex items-start gap-4">
          <Skeleton className="h-14 w-14 rounded-[10px]" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          </div>
        </div>
      </div>
      <PageBody>
        <Skeleton className="mb-5 h-8 w-full max-w-xl" />
        <Card>
          <CardBody className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </CardBody>
        </Card>
      </PageBody>
    </>
  );
}
