"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Input,
  Textarea,
  Select,
  Field,
  Label,
  Badge,
  Spinner,
  cn,
} from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { AgentIconTile } from "@/components/brand/agentIcon";
import { Agents, Models, Secrets, Skills } from "@/lib/fleet/endpoints";
import { FleetClientError } from "@/lib/fleet/client";
import type {
  Agent,
  CreateAgentRequest,
  FleetModel,
  ToolSpec,
  SubagentSpec,
  FileEntry,
  Skill,
} from "@/lib/fleet/types";
import { DM_PREFIX, ICON_COLORS } from "./helpers";
import { usePersona } from "@/lib/personas";
import { AgentConnections } from "./AgentConnections";
import { TOOL_CATALOG, TOOL_GROUPS, TOOL_MCP_URL, TOOL_MCP_NAME } from "@/lib/toolCatalog";

/* ----------------------------- local editor state ----------------------------- */
interface ToolRow {
  name: string;
  display_name: string;
  mcp_server_name: string;
  mcp_server_url: string;
}
interface SubagentRow {
  name: string;
  description: string;
  system_prompt: string;
  model: string;
  tools: ToolRow[];
}
type Identity = "personal" | "shared";
type Visibility = "tenant" | "user";
type TenantAccess = "read" | "run" | "write";
type BackendType = "state" | "sandbox";
type SandboxScope = "thread" | "agent";

const emptyTool = (): ToolRow => ({
  name: "",
  display_name: "",
  mcp_server_name: "",
  mcp_server_url: "",
});

function toolToRow(t: ToolSpec): ToolRow {
  return {
    name: t.name ?? "",
    display_name: t.display_name ?? "",
    mcp_server_name: t.mcp_server_name ?? "",
    mcp_server_url: t.mcp_server_url ?? "",
  };
}
function rowToTool(r: ToolRow): ToolSpec | null {
  if (!r.name && !r.mcp_server_url && !r.mcp_server_name && !r.display_name) return null;
  const t: ToolSpec = {};
  if (r.name) t.name = r.name;
  if (r.display_name) t.display_name = r.display_name;
  if (r.mcp_server_name) t.mcp_server_name = r.mcp_server_name;
  if (r.mcp_server_url) t.mcp_server_url = r.mcp_server_url;
  return t;
}

/* ----------------------------- main form ----------------------------- */
export function AgentForm({ agent, onSaved }: { agent?: Agent; onSaved?: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const { currentId: personaId } = usePersona();
  const isEdit = !!agent;

  // Core fields
  const [name, setName] = React.useState(agent?.name ?? "");
  const [description, setDescription] = React.useState(agent?.description ?? "");
  const [modelId, setModelId] = React.useState(agent?.model?.id ?? "");
  const [systemPrompt, setSystemPrompt] = React.useState(agent?.system_prompt ?? "");

  // Tools
  const [tools, setTools] = React.useState<ToolRow[]>(
    agent?.tools?.tools?.length ? agent.tools.tools.map(toolToRow) : [],
  );

  // Subagents
  const [subagents, setSubagents] = React.useState<SubagentRow[]>(
    agent?.subagents?.length
      ? agent.subagents.map((s) => ({
          name: s.name ?? "",
          description: s.description ?? "",
          system_prompt: s.system_prompt ?? s.instructions ?? "",
          model: s.model?.id ?? "",
          tools: s.tools?.tools?.length ? s.tools.tools.map(toolToRow) : [],
        }))
      : [],
  );

  // Backend
  const [backendType, setBackendType] = React.useState<BackendType>(
    (agent?.backend?.type as BackendType) ?? "state",
  );
  const [sandboxScope, setSandboxScope] = React.useState<SandboxScope>(
    (agent?.backend?.sandbox_config?.scope as SandboxScope) ?? "thread",
  );
  const [idleTtl, setIdleTtl] = React.useState(
    agent?.backend?.sandbox_config?.idle_ttl_seconds?.toString() ?? "",
  );
  const [deleteAfter, setDeleteAfter] = React.useState(
    agent?.backend?.sandbox_config?.delete_after_stop_seconds?.toString() ?? "",
  );

  // Permissions
  const [identity, setIdentity] = React.useState<Identity>(
    (agent?.permissions?.identity as Identity) ?? "personal",
  );
  const [visibility, setVisibility] = React.useState<Visibility>(
    (agent?.permissions?.visibility as Visibility) ?? "user",
  );
  const [tenantAccess, setTenantAccess] = React.useState<TenantAccess>(
    (agent?.permissions?.tenant_access_level as TenantAccess) ?? "read",
  );

  // Display
  const [icon, setIcon] = React.useState(agent?.display?.icon ?? "bot");
  const [iconColor, setIconColor] = React.useState(agent?.display?.icon_color ?? "navy");

  // Skills — workspace skills linked to this agent (files entries of type "skill").
  const initialSkillHandles = React.useMemo(() => {
    const handles: string[] = [];
    for (const [, f] of Object.entries(agent?.files ?? {})) {
      if (f && f.type === "skill" && f.repo_handle) handles.push(f.repo_handle);
    }
    return handles;
  }, [agent]);
  const [skillHandles, setSkillHandles] = React.useState<string[]>(initialSkillHandles);
  const [workspaceSkills, setWorkspaceSkills] = React.useState<Skill[]>([]);

  // Models + secrets for validation
  const [models, setModels] = React.useState<FleetModel[]>([]);
  const [modelsLoading, setModelsLoading] = React.useState(true);
  const [setSecretNames, setSetSecretNames] = React.useState<Set<string>>(new Set());

  const [submitting, setSubmitting] = React.useState(false);
  const [nameError, setNameError] = React.useState<string | null>(null);
  const [modelError, setModelError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [m, s] = await Promise.all([
          Models.list(),
          Secrets.list({ page_size: 100 }).catch(() => ({ items: [] as { name: string; set?: boolean }[] })),
        ]);
        if (!active) return;
        const modelList = m.items ?? [];
        setModels(modelList);
        // Load workspace skills for the picker (non-blocking).
        Skills.list({ page_size: 100 })
          .then((r) => active && setWorkspaceSkills(r.items ?? []))
          .catch(() => {});
        // The API requires a concrete model.id — preselect one so the form
        // can't be submitted with no model. Prefer the workspace default.
        setModelId((cur) => {
          if (cur) return cur;
          const def = modelList.find((x) => x.is_default) ?? modelList[0];
          return def?.id ?? "";
        });
        const present = new Set<string>();
        for (const item of s.items ?? []) {
          if (item.set !== false) present.add(item.name);
        }
        setSetSecretNames(present);
      } catch {
        if (active) setModels([]);
      } finally {
        if (active) setModelsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const selectedModel = models.find((m) => m.id === modelId);
  const missingSecrets = (selectedModel?.required_secrets ?? []).filter(
    (s) => !setSecretNames.has(s),
  );

  function buildBody(): CreateAgentRequest {
    const toolSpecs = tools.map(rowToTool).filter((t): t is ToolSpec => t !== null);
    const subagentSpecs: SubagentSpec[] = subagents
      .filter((s) => s.name.trim())
      .map((s) => {
        const spec: SubagentSpec = { name: s.name.trim() };
        if (s.description) spec.description = s.description;
        if (s.system_prompt) spec.system_prompt = s.system_prompt;
        if (s.model) spec.model = { id: s.model };
        const subTools = s.tools.map(rowToTool).filter((t): t is ToolSpec => t !== null);
        if (subTools.length) spec.tools = { tools: subTools };
        return spec;
      });

    const body: CreateAgentRequest = {
      name: name.trim(),
      description: description.trim() || undefined,
      model: { id: modelId },
      system_prompt: systemPrompt || undefined,
      tools: toolSpecs.length ? { tools: toolSpecs } : undefined,
      subagents: subagentSpecs.length ? subagentSpecs : undefined,
      permissions: {
        identity,
        visibility,
        tenant_access_level: tenantAccess,
      },
      display: { icon: icon.trim() || undefined, icon_color: iconColor },
      // Attribute the agent to the acting persona (demo). Preserve any existing
      // extras on edit, but keep the original dm_owner if one was already set.
      extras: {
        ...(agent?.extras ?? {}),
        dm_owner: (agent?.extras?.dm_owner as string | undefined) ?? personaId,
      },
    };

    if (backendType === "sandbox") {
      body.backend = {
        type: "sandbox",
        sandbox_config: {
          scope: sandboxScope,
          idle_ttl_seconds: idleTtl ? Number(idleTtl) : undefined,
          delete_after_stop_seconds: deleteAfter ? Number(deleteAfter) : undefined,
        },
      };
    } else {
      body.backend = { type: "state" };
    }

    // Skills: link selected workspace skills as `files` entries of type "skill".
    const selected = Array.from(new Set(skillHandles));
    const skillFiles: Record<string, FileEntry> = {};
    for (const handle of selected) {
      skillFiles[`skills/${handle}`] = { type: "skill", repo_handle: handle };
    }
    if (Object.keys(skillFiles).length) body.files = skillFiles;

    // On edit, remove skill links that were deselected.
    if (isEdit) {
      const removed = initialSkillHandles
        .filter((h) => !selected.includes(h))
        .map((h) => `skills/${h}`);
      if (removed.length) (body as CreateAgentRequest & { remove_file_paths?: string[] }).remove_file_paths = removed;
    }

    return body;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    let invalid = false;
    if (!name.trim()) {
      setNameError("Give your agent a name.");
      invalid = true;
    } else {
      setNameError(null);
    }
    if (!modelId) {
      setModelError("Pick a model — every agent needs one to run.");
      invalid = true;
    } else {
      setModelError(null);
    }
    if (invalid) return;
    setSubmitting(true);
    try {
      const body = buildBody();
      const saved = isEdit
        ? await Agents.update(agent!.id, body)
        : await Agents.create(body);
      toast.success(
        isEdit ? "Agent updated" : "Agent created",
        isEdit ? `${saved.name} is back in business.` : `${saved.name} just joined the fleet.`,
      );
      if (onSaved) {
        // Inline edit (e.g. agent detail) — refresh in place instead of navigating.
        onSaved();
        setSubmitting(false);
      } else {
        router.push(`/agents/${saved.id}`);
        router.refresh();
      }
    } catch (err) {
      const msg =
        err instanceof FleetClientError ? err.detail || err.message : "Something went sideways.";
      toast.error(isEdit ? "Couldn't save changes" : "Couldn't create agent", msg);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      {/* ---- main column ---- */}
      <div className="space-y-6">
        {/* Basics */}
        <Card>
          <CardHeader>
            <CardTitle>Basics</CardTitle>
          </CardHeader>
          <CardBody className="space-y-0">
            <Field
              label="Name"
              hint={isEdit ? undefined : `Tip: prefix demo agents with "${DM_PREFIX}" so they're easy to spot.`}
            >
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (nameError) setNameError(null);
                }}
                placeholder={`${DM_PREFIX}Reception Desk`}
                aria-invalid={!!nameError}
                required
              />
              {nameError && <p className="mt-1 text-[12px] text-bad">{nameError}</p>}
            </Field>
            <Field label="Description">
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this agent do?"
              />
            </Field>
            <Field
              label="Model"
              hint={
                selectedModel
                  ? `Provider: ${selectedModel.provider ?? "—"}${
                      selectedModel.required_secrets?.length
                        ? ` · Requires: ${selectedModel.required_secrets.join(", ")}`
                        : ""
                    }`
                  : "The base model this agent runs on."
              }
            >
              {modelsLoading ? (
                <div className="flex h-10 items-center gap-2 px-1 text-sm text-ink-faint">
                  <Spinner /> Loading models…
                </div>
              ) : (
                <Select
                  value={modelId}
                  onChange={(e) => {
                    setModelId(e.target.value);
                    if (modelError) setModelError(null);
                  }}
                  aria-invalid={!!modelError}
                >
                  <option value="" disabled>
                    Select a model…
                  </option>
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.display_name || m.id}
                      {m.provider ? ` · ${m.provider}` : ""}
                    </option>
                  ))}
                </Select>
              )}
              {modelError && <p className="mt-1 text-[12px] text-bad">{modelError}</p>}
              {missingSecrets.length > 0 && (
                <div className="mt-2 flex items-start gap-2 rounded-[10px] border border-warn/30 bg-warn-soft px-3 py-2 text-[12px] text-warn">
                  <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
                  <span>
                    Missing secret{missingSecrets.length > 1 ? "s" : ""}:{" "}
                    <span className="font-mono">{missingSecrets.join(", ")}</span>. Add{" "}
                    {missingSecrets.length > 1 ? "them" : "it"} in Workspace settings or this model
                    won&apos;t run.
                  </span>
                </div>
              )}
            </Field>
          </CardBody>
        </Card>

        {/* System prompt */}
        <Card>
          <CardHeader>
            <CardTitle>System prompt</CardTitle>
          </CardHeader>
          <CardBody>
            <Textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="You are a helpful Dunder Mifflin sales associate…"
              className="min-h-[160px]"
            />
          </CardBody>
        </Card>

        {/* Tools */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Tools</CardTitle>
            <Button type="button" variant="secondary" size="sm" onClick={() => setTools((t) => [...t, emptyTool()])}>
              <Plus className="h-3.5 w-3.5" />
              Add tool
            </Button>
          </CardHeader>
          <CardBody>
            {tools.length === 0 ? (
              <p className="text-[13px] text-ink-faint">
                No tools wired up. Add an MCP-backed tool to give this agent superpowers.
              </p>
            ) : (
              <div className="space-y-3">
                {tools.map((row, i) => (
                  <ToolRowEditor
                    key={i}
                    row={row}
                    onChange={(next) =>
                      setTools((arr) => arr.map((r, idx) => (idx === i ? next : r)))
                    }
                    onRemove={() => setTools((arr) => arr.filter((_, idx) => idx !== i))}
                  />
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Subagents */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Subagents</CardTitle>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                setSubagents((s) => [
                  ...s,
                  { name: "", description: "", system_prompt: "", model: "", tools: [] },
                ])
              }
            >
              <Plus className="h-3.5 w-3.5" />
              Add subagent
            </Button>
          </CardHeader>
          <CardBody>
            {subagents.length === 0 ? (
              <p className="text-[13px] text-ink-faint">
                No subagents. Delegate specialized work to subagents when one persona isn&apos;t enough.
              </p>
            ) : (
              <div className="space-y-3">
                {subagents.map((row, i) => (
                  <SubagentEditor
                    key={i}
                    row={row}
                    models={models}
                    onChange={(next) =>
                      setSubagents((arr) => arr.map((r, idx) => (idx === i ? next : r)))
                    }
                    onRemove={() => setSubagents((arr) => arr.filter((_, idx) => idx !== i))}
                  />
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Skills */}
        <Card>
          <CardHeader>
            <CardTitle>Skills</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="mb-3 text-[13px] text-ink-faint">
              Link reusable workspace skills to give this agent specialized knowledge.
            </p>
            {workspaceSkills.length === 0 ? (
              <p className="text-[13px] text-ink-faint">
                No workspace skills yet. Create skills under Workspace → Skills, then link them here.
              </p>
            ) : (
              <div className="space-y-2">
                {workspaceSkills.map((sk) => {
                  const handle = sk.name || sk.id;
                  const checked = skillHandles.includes(handle);
                  return (
                    <label
                      key={sk.id}
                      className="flex cursor-pointer items-start gap-3 rounded-[10px] border border-line bg-paper-2/40 px-3 py-2.5 hover:bg-paper-2"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 accent-[var(--color-navy)]"
                        checked={checked}
                        onChange={(e) =>
                          setSkillHandles((prev) =>
                            e.target.checked
                              ? [...prev, handle]
                              : prev.filter((h) => h !== handle),
                          )
                        }
                      />
                      <span className="min-w-0">
                        <span className="block text-[13px] font-medium text-ink">{sk.name || sk.id}</span>
                        {sk.description && (
                          <span className="block text-[12px] text-ink-faint">{sk.description}</span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Connections (existing agents only — needs an agent id) */}
        {isEdit && agent && (
          <Card>
            <CardHeader>
              <CardTitle>Connections</CardTitle>
            </CardHeader>
            <CardBody>
              <AgentConnections agentId={agent.id} />
            </CardBody>
          </Card>
        )}
      </div>

      {/* ---- sidebar column ---- */}
      <div className="space-y-6">
        {/* Display */}
        <Card>
          <CardHeader>
            <CardTitle>Display</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="mb-4 flex items-center gap-3">
              <AgentIconTile icon={icon} color={iconColor} size={48} />
              <div className="text-[12px] text-ink-faint">Live preview</div>
            </div>
            <Field label="Icon" hint='Free-form name, e.g. "Bell", "Rocket", "Mail".'>
              <Input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="bot" />
            </Field>
            <Field label="Color">
              <div className="flex flex-wrap gap-2">
                {ICON_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    aria-pressed={iconColor === c}
                    onClick={() => setIconColor(c)}
                    className={cn(
                      "dm-focus h-7 w-7 rounded-full border-2 transition-transform",
                      iconColor === c ? "scale-110 border-ink" : "border-line",
                    )}
                    style={{ background: swatch(c) }}
                  />
                ))}
              </div>
            </Field>
          </CardBody>
        </Card>

        {/* Backend */}
        <Card>
          <CardHeader>
            <CardTitle>Backend</CardTitle>
          </CardHeader>
          <CardBody>
            <RadioRow
              value={backendType}
              onChange={(v) => setBackendType(v as BackendType)}
              options={[
                { value: "state", label: "State", hint: "Lightweight, stateful runs." },
                { value: "sandbox", label: "Sandbox", hint: "Isolated compute per scope." },
              ]}
            />
            {backendType === "sandbox" && (
              <div className="mt-4 space-y-0 border-t border-line pt-4">
                <Field label="Scope">
                  <Select
                    value={sandboxScope}
                    onChange={(e) => setSandboxScope(e.target.value as SandboxScope)}
                  >
                    <option value="thread">Thread</option>
                    <option value="agent">Agent</option>
                  </Select>
                </Field>
                <Field label="Idle TTL (seconds)">
                  <Input
                    type="number"
                    min={0}
                    value={idleTtl}
                    onChange={(e) => setIdleTtl(e.target.value)}
                    placeholder="e.g. 300"
                  />
                </Field>
                <Field label="Delete after stop (seconds)">
                  <Input
                    type="number"
                    min={0}
                    value={deleteAfter}
                    onChange={(e) => setDeleteAfter(e.target.value)}
                    placeholder="e.g. 3600"
                  />
                </Field>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Permissions */}
        <Card>
          <CardHeader>
            <CardTitle>Permissions</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <div>
              <Label>Identity</Label>
              <RadioRow
                value={identity}
                onChange={(v) => setIdentity(v as Identity)}
                options={[
                  { value: "personal", label: "Personal" },
                  { value: "shared", label: "Shared" },
                ]}
              />
            </div>
            <div>
              <Label>Visibility</Label>
              <RadioRow
                value={visibility}
                onChange={(v) => setVisibility(v as Visibility)}
                options={[
                  { value: "user", label: "User" },
                  { value: "tenant", label: "Tenant" },
                ]}
              />
            </div>
            <Field label="Tenant access level">
              <Select
                value={tenantAccess}
                onChange={(e) => setTenantAccess(e.target.value as TenantAccess)}
              >
                <option value="read">Read</option>
                <option value="run">Run</option>
                <option value="write">Write</option>
              </Select>
            </Field>
          </CardBody>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.back()}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={submitting}>
            {isEdit ? "Save changes" : "Create agent"}
          </Button>
        </div>
      </div>
    </form>
  );
}

/* ----------------------------- sub-components ----------------------------- */

function ToolRowEditor({
  row,
  onChange,
  onRemove,
}: {
  row: ToolRow;
  onChange: (r: ToolRow) => void;
  onRemove: () => void;
}) {
  const set = (k: keyof ToolRow) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...row, [k]: e.target.value });

  // A row is "custom" if it has a name not in the catalog, or a non-standard server URL.
  const inCatalog = TOOL_CATALOG.some((t) => t.name === row.name);
  const [custom, setCustom] = React.useState(
    () => !!row.name && !inCatalog || (!!row.mcp_server_url && row.mcp_server_url !== TOOL_MCP_URL),
  );

  function pickFromCatalog(name: string) {
    if (name === "__custom__") {
      setCustom(true);
      onChange({ ...row, name: "", mcp_server_url: "", mcp_server_name: "" });
      return;
    }
    const t = TOOL_CATALOG.find((x) => x.name === name);
    setCustom(false);
    onChange({
      ...row,
      name,
      mcp_server_url: TOOL_MCP_URL,
      mcp_server_name: TOOL_MCP_NAME,
      display_name: row.display_name || t?.name.replace(/_/g, " ") || name,
    });
  }

  return (
    <div className="rounded-[10px] border border-line bg-paper-2/40 p-3">
      {!custom ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select
            value={inCatalog ? row.name : ""}
            onChange={(e) => pickFromCatalog(e.target.value)}
            aria-label="Choose a tool"
            className="flex-1"
          >
            <option value="">Choose a tool…</option>
            {TOOL_GROUPS.map((g) => (
              <optgroup key={g} label={g}>
                {TOOL_CATALOG.filter((t) => t.group === g).map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name.replace(/_/g, " ")}
                  </option>
                ))}
              </optgroup>
            ))}
            <optgroup label="Other">
              <option value="__custom__">+ Custom MCP tool…</option>
            </optgroup>
          </Select>
          <Input
            value={row.display_name}
            onChange={set("display_name")}
            placeholder="Display name (optional)"
            aria-label="Display name"
            className="sm:w-56"
          />
          <Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label="Remove tool">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12px] font-medium text-ink-soft">Custom MCP tool</span>
            <button
              type="button"
              onClick={() => {
                setCustom(false);
                onChange({ ...row, name: "", mcp_server_url: "", mcp_server_name: "" });
              }}
              className="dm-focus text-[12px] text-navy-400 hover:text-navy"
            >
              ← Pick from catalog
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input value={row.name} onChange={set("name")} placeholder="Tool name" aria-label="Tool name" />
            <Input
              value={row.display_name}
              onChange={set("display_name")}
              placeholder="Display name"
              aria-label="Display name"
            />
            <Input
              value={row.mcp_server_name}
              onChange={set("mcp_server_name")}
              placeholder="MCP server name"
              aria-label="MCP server name"
            />
            <Input
              value={row.mcp_server_url}
              onChange={set("mcp_server_url")}
              placeholder="MCP server URL"
              aria-label="MCP server URL"
            />
          </div>
          <div className="mt-2 flex justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function SubagentEditor({
  row,
  models,
  onChange,
  onRemove,
}: {
  row: SubagentRow;
  models: FleetModel[];
  onChange: (r: SubagentRow) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = React.useState(!row.name);
  return (
    <div className="rounded-[10px] border border-line bg-paper-2/40">
      <div className="flex items-center justify-between px-3 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="dm-focus flex min-w-0 items-center gap-2 rounded text-left"
        >
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-ink-faint" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" />
          )}
          <span className="truncate text-[13px] font-medium text-ink">
            {row.name || "Untitled subagent"}
          </span>
          {row.tools.length > 0 && <Badge tone="neutral">{row.tools.length} tools</Badge>}
        </button>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {open && (
        <div className="space-y-0 border-t border-line px-3 py-3">
          <Field label="Name">
            <Input
              value={row.name}
              onChange={(e) => onChange({ ...row, name: e.target.value })}
              placeholder="researcher"
            />
          </Field>
          <Field label="Description">
            <Input
              value={row.description}
              onChange={(e) => onChange({ ...row, description: e.target.value })}
              placeholder="What this subagent handles"
            />
          </Field>
          <Field label="System prompt">
            <Textarea
              value={row.system_prompt}
              onChange={(e) => onChange({ ...row, system_prompt: e.target.value })}
              className="min-h-[80px]"
            />
          </Field>
          <Field label="Model (optional)">
            <Select
              value={row.model}
              onChange={(e) => onChange({ ...row, model: e.target.value })}
            >
              <option value="">Inherit from agent</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name || m.id}
                </option>
              ))}
            </Select>
          </Field>
          <div className="mb-1 flex items-center justify-between">
            <Label className="mb-0">Tools</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange({ ...row, tools: [...row.tools, emptyTool()] })}
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
          </div>
          {row.tools.length === 0 ? (
            <p className="text-[12px] text-ink-faint">No tools for this subagent.</p>
          ) : (
            <div className="space-y-2">
              {row.tools.map((t, ti) => (
                <ToolRowEditor
                  key={ti}
                  row={t}
                  onChange={(next) =>
                    onChange({
                      ...row,
                      tools: row.tools.map((x, xi) => (xi === ti ? next : x)),
                    })
                  }
                  onRemove={() =>
                    onChange({ ...row, tools: row.tools.filter((_, xi) => xi !== ti) })
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RadioRow({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; hint?: string }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={cn(
              "dm-focus rounded-[10px] border px-3 py-2 text-left transition-colors",
              active
                ? "border-navy bg-navy/5"
                : "border-line-strong bg-card hover:bg-paper-2",
            )}
          >
            <span className={cn("block text-[13px] font-medium", active ? "text-navy" : "text-ink")}>
              {o.label}
            </span>
            {o.hint && <span className="mt-0.5 block text-[11px] text-ink-faint">{o.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

// Inline swatch hex mirroring the brand COLORS map in agentIcon.tsx.
function swatch(name: string): string {
  const map: Record<string, string> = {
    blue: "#2b4a78",
    navy: "#0b2545",
    green: "#2f7d4f",
    red: "#9b2226",
    orange: "#b4690e",
    gold: "#b8860b",
    purple: "#5b3b8c",
    pink: "#a23b6e",
    gray: "#41506b",
    teal: "#1f6f6f",
  };
  return map[name] ?? "#2b4a78";
}
