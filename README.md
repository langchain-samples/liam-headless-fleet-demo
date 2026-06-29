# Dunder Mifflin · Agent Fleet

A demo UI for **LangChain Headless Fleet**, themed as an internal tool for Dunder Mifflin Paper Co.
that lets "employees" build, run, and manage Fleet agents. It exercises the full Fleet API surface
(agents, threads/runs with live SSE streaming, OAuth connections, secrets, integrations, skills,
models, tenants) through a polished Next.js front end.

The whole site is gated behind **Google sign-in restricted to `@langchain.dev`**, and each signed-in
user drives Fleet with **their own LangSmith API key** — so agents run as the real person, with their
own connections and run attribution. See [Authentication](#authentication).

## Architecture

```
                    ┌─ proxy.ts (NextAuth middleware): every route requires a session;
                    │   only /login + static assets are public
Browser (React) ──► /api/fleet/*  (Next route handlers)  ──+ X-Api-Key + X-Tenant-Id ──►  Fleet API
                        ▲ injects the SIGNED-IN USER's key (from the session JWT), server-side only
```

- **No API key ever reaches the browser.** All Fleet calls go through the server-side proxy at
  `app/api/fleet/[...path]/route.ts` (and `app/api/fleet/stream/route.ts` for SSE), which injects the
  current user's key + `X-Tenant-Id` and allowlists the upstream host.
- **Per-user identity.** The proxy reads the caller's personal LangSmith key from their NextAuth
  session JWT (`lib/fleet/userKey.ts`) and sends *that* as `X-Api-Key` — never a shared key. Each
  request acts as the real user, so OAuth connections (Slack, etc.) and run attribution are per-user.
- Typed client + endpoints live in `lib/fleet/` (`server.ts` is server-only; `client.ts`/`endpoints.ts`
  are used by the browser and only ever call our own `/api/fleet/*`).
- Design system in `components/ui`, brand shell in `components/brand`, feature areas under `app/*`.
- **Cost analytics** use a second server-only route (`app/api/fleet/cost/route.ts`) that reads the
  workspace's LangSmith **tracing** data — see [Cost / usage tracking](#cost--usage-tracking). This
  route deliberately uses the **shared admin key** (`FLEET_API_KEY`) for workspace-wide aggregation,
  not the per-user key; no key reaches the browser there either.

## Authentication

Two layers, both server-enforced:

1. **Who may enter — Google OAuth, `@langchain.dev` only.** NextAuth/Auth.js v5 with a Google
   provider. The access policy lives in `lib/auth/access.ts` (server-only): it requires a
   Google-**verified** email whose domain is in `ALLOWED_EMAIL_DOMAINS` (exact match — `evil-langchain.dev`
   and `langchain.dev.evil.com` are both rejected), and **fails closed** if the allowlist is unset.
   `proxy.ts` gates every route; `/login` is the only public page. Branded sign-in at `app/login/`.
2. **What they act as — per-user LangSmith key.** Each user pastes their own personal key (`lsv2_…`)
   on `/settings`; a server action validates it against Fleet before saving. The key is stored as a
   claim in the **encrypted session JWT** (HTTP-only; never copied into the client-visible session —
   the client only sees a `hasFleetKey` boolean). Until a user sets a key, action routes return
   `401 no_fleet_key` and the sidebar prompts them to Settings (no fallback to a shared key).

## Setup

Create `.env.local` (gitignored) with:

```bash
# --- Fleet API ---
FLEET_API_BASE=https://api.smith.langchain.com/v1/fleet
FLEET_API_KEY=lsv2_...           # shared/admin key — used ONLY by the cost route (workspace-wide analytics)
FLEET_TENANT_ID=<workspace-uuid> # required by workspace-scoped endpoints
FLEET_ORG_ID=<org-uuid>          # optional

# --- Auth (Google OAuth via NextAuth/Auth.js) ---
NEXTAUTH_URL=http://localhost:3030          # prod: https://<your-domain> (no trailing slash). AUTH_URL also works.
NEXTAUTH_SECRET=<openssl rand -base64 32>   # signs/encrypts the session JWT. AUTH_SECRET also works.
GOOGLE_CLIENT_ID=<oauth client id>          # Google Cloud → Credentials → OAuth client (Web application)
GOOGLE_CLIENT_SECRET=<oauth client secret>
ALLOWED_EMAIL_DOMAINS=langchain.dev         # comma-separated; REQUIRED (empty = deny everyone, fail closed)
```

**Google OAuth client** — add these Authorized redirect URIs to the OAuth client:

```
http://localhost:3030/api/auth/callback/google         # local
https://<your-domain>/api/auth/callback/google          # production
```

> **Note on keys.** `FLEET_API_KEY` here is the **shared admin key** used only for the cost/analytics
> route. End users do **not** use it for actions — each user supplies their own key in `/settings`,
> which is injected per-request by the proxy. See [Authentication](#authentication).
>
> **Deploying (Vercel).** Set all the above as project env vars. `NEXTAUTH_URL` **must** be the full
> `https://` origin — a scheme-less value (e.g. `headless-fleet-demo.vercel.app`) makes NextAuth throw
> on every route. `.env.local` is gitignored and never ships; configure prod separately.

## Run

```bash
npm install
npm run dev          # http://localhost:3030 (PORT=3030 matches NEXTAUTH_URL; OAuth callback needs the port to match)
npm run build        # production build
npx tsc --noEmit     # typecheck
```

First run, signed in: you'll be prompted to set your LangSmith API key in **Settings** before agents
and threads will load.

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
- **Settings** (`/settings`) — where each user pastes and validates their personal LangSmith API key
  (stored server-side in the session JWT). The sidebar shows a "set your API key" prompt until one is
  saved; agent/thread calls return `401 no_fleet_key` until then.

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
     server-side allowlist. (Per-user spend is grouped by the demo-owner tag rather than the real
     caller; untagged / Agent Builder runs are excluded from the per-user list but still counted in
     totals and per-agent.)

It calls the same host as Fleet (`api.smith.langchain.com`) and **intentionally uses the shared
`FLEET_API_KEY` + `FLEET_TENANT_ID`** (not the per-user key) — workspace-wide aggregation needs a key
that can read the whole tracing project, so this route is the one place the admin key is used. The key
never reaches the browser. Cost only appears once agents have actually **run** (creating an agent is
free); empty workspaces show a "No usage yet" state.

> **Note:** the older `DM Demo —` name prefix for demo agents has been dropped from existing agents.
> Persona headshots live in `public/avatars/` (`PersonaAvatar` falls back to an initials chip).

> Built on Next.js 16 (App Router) + React 19 + Tailwind v4. See `AGENTS.md` for conventions.
