// Parse the Agent Builder's generated workspace files (from thread values.files)
// into a Fleet CreateAgentRequest. The builder writes /config.json, /AGENTS.md,
// /tools.json, and optionally /subagents/<name>/{AGENTS.md,tools.json}.
import type {
  CreateAgentRequest, ToolSpec, SubagentSpec, ToolsConfig, InterruptRule,
} from "@/lib/fleet/types";

export interface WorkspaceFile {
  content?: string;
  type?: string;
}
export type WorkspaceFiles = Record<string, WorkspaceFile>;

/** Files the builder generates for the NEW agent (exclude its read-only catalogs). */
export function generatedFiles(files: WorkspaceFiles | undefined): WorkspaceFiles {
  const out: WorkspaceFiles = {};
  if (!files) return out;
  for (const [path, f] of Object.entries(files)) {
    // Skip the builder's reference catalogs.
    if (path.startsWith("/tools/")) continue;
    if (path.startsWith("/skills/")) continue; // builder's own skill docs, not the new agent's
    if (path.startsWith("/triggers/")) continue;
    out[path] = f;
  }
  return out;
}

/** True once the builder has written a config.json — the agent is ready to create. */
export function isAgentReady(files: WorkspaceFiles | undefined): boolean {
  const g = generatedFiles(files);
  return Boolean(g["/config.json"]?.content && g["/AGENTS.md"]?.content);
}

function safeParse<T>(s: string | undefined): T | undefined {
  if (!s) return undefined;
  try {
    return JSON.parse(s) as T;
  } catch {
    return undefined;
  }
}

/** Strip simple YAML frontmatter and return { description, body }. */
function splitFrontmatter(md: string): { description?: string; body: string } {
  const m = md.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { body: md };
  const fm = m[1];
  const body = m[2];
  const d = fm.match(/^description:\s*(.+)$/m);
  return { description: d ? d[1].trim().replace(/^["']|["']$/g, "") : undefined, body };
}

function toToolsConfig(json: string | undefined): ToolsConfig | undefined {
  const parsed = safeParse<{ tools?: ToolSpec[]; interrupt_config?: Record<string, InterruptRule> }>(json);
  if (!parsed) return undefined;
  const tools = Array.isArray(parsed.tools) ? parsed.tools : [];
  const cfg: ToolsConfig = {};
  if (tools.length) cfg.tools = tools;
  if (parsed.interrupt_config && typeof parsed.interrupt_config === "object") {
    cfg.interrupt_config = parsed.interrupt_config;
  }
  return cfg.tools || cfg.interrupt_config ? cfg : undefined;
}

interface BuilderConfig {
  name?: string;
  description?: string;
  triggers?: string[];
  cron_schedules?: string[];
  skills?: string[];
  backend_type?: "default" | "agent_scoped_sandbox" | "thread_scoped_sandbox";
}

export interface ParsedAgent {
  request: CreateAgentRequest;
  /** Rich summary for the preview/confirm UI. */
  summary: {
    name: string;
    description?: string;
    model: string;
    backend: "state" | "sandbox";
    sandboxScope?: "thread" | "agent";
    toolNames: string[];
    subagentNames: string[];
    cronSchedules: string[];
    triggers: string[];
    skills: string[];
  };
  /** Demo limitations to surface (Fleet create has no triggers/cron fields). */
  notes: string[];
}

/**
 * Build a CreateAgentRequest from the workspace files.
 * `dmOwner` attributes the agent to the acting persona (demo).
 */
export function parseAgentFromFiles(
  files: WorkspaceFiles | undefined,
  opts: { dmOwner?: string; defaultModelId?: string } = {},
): ParsedAgent | null {
  const g = generatedFiles(files);
  const config = safeParse<BuilderConfig>(g["/config.json"]?.content);
  const systemPrompt = g["/AGENTS.md"]?.content;
  if (!config || !systemPrompt) return null;

  const notes: string[] = [];

  // Subagents from /subagents/<name>/...
  const subNames = new Set<string>();
  for (const path of Object.keys(g)) {
    const m = path.match(/^\/subagents\/([^/]+)\//);
    if (m) subNames.add(m[1]);
  }
  const subagents: SubagentSpec[] = [];
  for (const name of subNames) {
    const md = g[`/subagents/${name}/AGENTS.md`]?.content;
    const { description, body } = md ? splitFrontmatter(md) : { description: undefined, body: "" };
    const spec: SubagentSpec = { name };
    if (description) spec.description = description;
    if (body.trim()) spec.system_prompt = body.trim();
    const tcfg = toToolsConfig(g[`/subagents/${name}/tools.json`]?.content);
    if (tcfg) spec.tools = tcfg;
    subagents.push(spec);
  }

  const tools = toToolsConfig(g["/tools.json"]?.content);

  const name = config.name?.trim() || "New Agent";
  const request: CreateAgentRequest = {
    name,
    description: config.description?.trim() || undefined,
    // The builder's config.json doesn't specify a model (the platform assigns one);
    // Fleet's create REQUIRES model.id, so default to the workspace's standard model.
    model: { id: opts.defaultModelId || "anthropic:claude-sonnet-4-6" },
    system_prompt: systemPrompt,
    tools,
    subagents: subagents.length ? subagents : undefined,
    backend:
      config.backend_type === "agent_scoped_sandbox"
        ? { type: "sandbox", sandbox_config: { scope: "agent" } }
        : config.backend_type === "thread_scoped_sandbox"
          ? { type: "sandbox", sandbox_config: { scope: "thread" } }
          : { type: "state" },
    permissions: { identity: "personal", visibility: "tenant", tenant_access_level: "read" },
    extras: {
      ...(opts.dmOwner ? { dm_owner: opts.dmOwner } : {}),
      ...(config.triggers?.length ? { dm_triggers: config.triggers } : {}),
      ...(config.cron_schedules?.length ? { dm_cron_schedules: config.cron_schedules } : {}),
      ...(config.skills?.length ? { dm_skills: config.skills } : {}),
    },
  };

  if (config.triggers?.length || config.cron_schedules?.length) {
    notes.push("Triggers / schedules were designed but aren't applied by this demo's create call.");
  }
  if (config.skills?.length) {
    notes.push(`References skills: ${config.skills.join(", ")} (linked as metadata).`);
  }

  return {
    request,
    summary: {
      name,
      description: request.description,
      model: request.model?.id || "—",
      backend: request.backend?.type === "sandbox" ? "sandbox" : "state",
      sandboxScope: request.backend?.sandbox_config?.scope,
      toolNames: (tools?.tools ?? []).map((t) => t.name || "tool").filter(Boolean) as string[],
      subagentNames: subagents.map((s) => s.name || "subagent").filter(Boolean) as string[],
      cronSchedules: config.cron_schedules ?? [],
      triggers: config.triggers ?? [],
      skills: config.skills ?? [],
    },
    notes,
  };
}
