# Dunder Mifflin · Agent Fleet

A demo UI for **LangChain Headless Fleet**, themed as an internal tool for Dunder Mifflin Paper Co.
that lets "employees" build, run, and manage Fleet agents. It exercises the full Fleet API surface
(agents, threads/runs with live SSE streaming, OAuth connections, secrets, integrations, skills,
models, tenants) through a polished Next.js front end.

## Architecture

```
Browser (React)  ──fetch──►  /api/fleet/*  (Next route handlers)  ──+secret headers──►  Fleet API
                                  ▲ inject X-Api-Key + X-Tenant-Id from env, server-side only
```

- **The LangSmith API key never reaches the browser.** All Fleet calls go through the server-side
  proxy at `app/api/fleet/[...path]/route.ts` (and `app/api/fleet/stream/route.ts` for SSE), which
  injects credentials from environment variables and allowlists the upstream host.
- Typed client + endpoints live in `lib/fleet/` (`server.ts` is server-only; `client.ts`/`endpoints.ts`
  are used by the browser and only ever call our own `/api/fleet/*`).
- Design system in `components/ui`, brand shell in `components/brand`, feature areas under `app/*`.
- **Cost analytics** use a second server-only route (`app/api/fleet/cost/route.ts`) that reads the
  workspace's LangSmith **tracing** data — see [Cost / usage tracking](#cost--usage-tracking). It reuses
  the same server-only credentials, so no key reaches the browser there either.

## Setup

Create `.env.local` (gitignored) with:

```bash
FLEET_API_BASE=https://api.smith.langchain.com/v1/fleet
FLEET_API_KEY=lsv2_...           # a Fleet-enabled LangSmith API key
FLEET_TENANT_ID=<workspace-uuid> # required by workspace-scoped endpoints
FLEET_ORG_ID=<org-uuid>          # optional
```

## Run

```bash
npm install
npm run dev          # http://localhost:3000 (use PORT=3030 if 3000 is taken)
npm run build        # production build
npx tsc --noEmit     # typecheck
```

## Areas

- **Dashboard** (`/`) — overview with stat tiles (agent count, active employees, models, model-key
  coverage), the employees and the agents each built (with agent **created dates**), and an
  **admin-only Spend section** (cost per user and per agent — see below). Agent counts merge the
  `tenant` and `user` audiences (deduped) so an admin sees every agent visible to them.
- **Agents** (`/agents`) — roster, and a per-agent page with a live **Chat** mode and an **Edit**
  mode (name, model, system prompt, tools, subagents, skills, connections, backend, permissions).
  Building a new agent is chat-first via the workspace Agent Builder (`/agents/new`), with a manual
  form fallback. Clone and delete supported.
- **Threads** (`/threads`) — per-agent inbox with attention count + filters, and a live chat console
  that streams runs over Server-Sent Events; resolve-interrupt, bulk pin/mark-read. Interrupt prompts
  (HITL clarifying questions / approvals) render inline in the conversation near the composer.
- **Connections** (`/connections`) — a curated **service catalog** (Gmail, Slack, GitHub, Salesforce,
  …) showing your real **Connect / Connected** status, derived from your OAuth tokens + the org's
  providers. Connecting runs the OAuth authorization flow; "Connected" services are usable by your
  agents. Raw provider management (register / discover from MCP / edit / delete) lives under
  **Workspace → OAuth Providers**.
- **Workspace** (`/admin`) — secrets (write-only, with a model-required-secrets cross-check),
  integrations (MCP servers), **OAuth Providers**, skills (file-tree editor), and the models catalog.

## Cost / usage tracking

The Fleet API has **no cost data** — LLM cost lives in **LangSmith tracing**. Fleet agent runs are
traced to a project named `fleet` in the workspace, and each root run carries `costs.total_cost`,
`token_usage`, and a `custom_metadata` block that identifies the agent and owner.

`app/api/fleet/cost/route.ts` (server-only) computes the dashboard's Spend section:

1. Resolve the `fleet` tracing project's session id (LangSmith `GET /api/v1/sessions?name=fleet`).
2. Query its **root** runs (`POST /api/v1/runs/query`, `is_root: true`) selecting `total_cost`,
   `total_tokens`, and `extra` (metadata).
3. Aggregate server-side and return names + numbers only:
   - **Per agent** — keyed by `assistant_id` / `agent_name` (the platform Agent Builder is labeled).
   - **Per user** — keyed by the agent's `dm_owner` persona tag, mapped to a display name via a
     server-side allowlist. (The Fleet identity endpoints `403` and there is effectively one real
     LangSmith user, so the demo-owner tag is the only viable per-user attribution; untagged / Agent
     Builder runs are excluded from the per-user list but still counted in totals and per-agent.)

It calls the same host as Fleet (`api.smith.langchain.com`) and reuses the server-only
`FLEET_API_KEY` + `FLEET_TENANT_ID`; the key never reaches the browser. Cost only appears once agents
have actually **run** (creating an agent is free); empty workspaces show a "No usage yet" state.

> **Note:** the older `DM Demo —` name prefix for demo agents has been dropped from existing agents.
> Persona headshots live in `public/avatars/` (`PersonaAvatar` falls back to an initials chip).

> Built on Next.js 16 (App Router) + React 19 + Tailwind v4. See `AGENTS.md` for conventions.
