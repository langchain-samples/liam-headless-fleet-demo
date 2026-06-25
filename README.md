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

- **Dashboard** (`/`) — admin-only overview: stat tiles, employees and the agents each built.
- **Agents** (`/agents`) — roster, and a per-agent page with a live **Chat** mode and an **Edit**
  mode (name, model, system prompt, tools, subagents, skills, connections, backend, permissions).
  Building a new agent is chat-first via the workspace Agent Builder (`/agents/new`), with a manual
  form fallback. Clone and delete supported.
- **Threads** (`/threads`) — per-agent inbox with attention count + filters, and a live chat console
  that streams runs over Server-Sent Events; resolve-interrupt, bulk pin/mark-read.
- **Connections** (`/connections`) — OAuth providers (register / discover from MCP), the
  authorization-session flow (verification URL + polling), and connection tokens.
- **Workspace** (`/admin`) — secrets (write-only, with a model-required-secrets cross-check),
  integrations (MCP servers), skills (file-tree editor), and the models catalog.

Objects created from the UI are name-prefixed `DM Demo —` / `dm-demo-` for easy cleanup.

> Built on Next.js 16 (App Router) + React 19 + Tailwind v4. See `AGENTS.md` for conventions.
