// Typed convenience functions over the browser `api()` client — one per Fleet endpoint.
import { api } from "./client";
import type {
  Agent, ListAgentsResponse, CreateAgentRequest, UpdateAgentRequest, CloneAgentRequest, HealthResponse,
  Connection, CreateConnectionRequest,
  Thread, ThreadDetail, ListThreadsResponse, CountResponse, CreateThreadRequest, CreateThreadAndRunRequest,
  UpdateThreadRequest, BulkUpdateThreadsRequest,
  ListModelsResponse,
  ListSecretsResponse, BulkUpsertItem,
  ProviderResponse, CreateProviderRequest, DiscoverProviderRequest,
  CreateSessionRequest, CreateSessionResponse, GetSessionResponse,
  TokenSummary, ListTokensResponse, UpdateTokenRequest,
  Integration, ListIntegrationsResponse, CreateIntegrationRequest, UpdateIntegrationRequest,
  Skill, ListSkillsResponse, CreateSkillRequest, UpdateSkillRequest,
  ListTenantsResponse, User,
} from "./types";

const inc = (a?: string[]) => (a && a.length ? a.join(",") : undefined);

// ---------------- agents ----------------
export const Agents = {
  list: (q: {
    page_size?: number; cursor?: string; name?: string;
    audience?: "user" | "tenant"; sort_by?: string; sort_order?: "asc" | "desc"; include?: string[];
  } = {}) =>
    api<ListAgentsResponse>("agents", { query: { ...q, include: inc(q.include) } }),
  get: (id: string, include: string[] = ["owner"]) =>
    api<Agent>(`agents/${id}`, { query: { include: inc(include) } }),
  create: (body: CreateAgentRequest, include: string[] = ["owner"]) =>
    api<Agent>("agents", { method: "POST", body, query: { include: inc(include) } }),
  update: (id: string, body: UpdateAgentRequest, include: string[] = ["owner"]) =>
    api<Agent>(`agents/${id}`, { method: "PATCH", body, query: { include: inc(include) } }),
  remove: (id: string) => api<void>(`agents/${id}`, { method: "DELETE" }),
  clone: (id: string, body: CloneAgentRequest = {}) =>
    api<Agent>(`agents/${id}/clone`, { method: "POST", body }),
  health: (id: string) => api<HealthResponse>(`agents/${id}/health`),
  connections: {
    list: (id: string) => api<{ items: Connection[] }>(`agents/${id}/connections`),
    create: (id: string, body: CreateConnectionRequest) =>
      api<Connection>(`agents/${id}/connections`, { method: "POST", body }),
    remove: (id: string, cid: string) =>
      api<void>(`agents/${id}/connections/${cid}`, { method: "DELETE" }),
  },
};

// ---------------- threads ----------------
export const Threads = {
  list: (q: {
    agent_id: string; page_size?: number; cursor?: string;
    status?: string; is_pinned?: boolean; test_run?: boolean; requires_attention?: boolean;
  }) => api<ListThreadsResponse>("threads", { query: q }),
  count: (agent_id?: string) => api<CountResponse>("threads/count", { query: { agent_id } }),
  get: (id: string) => api<ThreadDetail>(`threads/${id}`),
  create: (body: CreateThreadRequest) => api<Thread>("threads", { method: "POST", body }),
  createAndRun: (body: CreateThreadAndRunRequest) =>
    api<unknown>("threads/runs", { method: "POST", body }),
  update: (id: string, body: UpdateThreadRequest) =>
    api<Thread>(`threads/${id}`, { method: "PATCH", body }),
  remove: (id: string) => api<void>(`threads/${id}`, { method: "DELETE" }),
  resolveInterrupt: (id: string) =>
    api<void>(`threads/${id}/resolve-interrupt`, { method: "POST", body: {} }),
  bulkModify: (body: BulkUpdateThreadsRequest) =>
    api<unknown>("threads/bulk-modify", { method: "POST", body }),
  search: (body: unknown) => api<unknown>("threads/search", { method: "POST", body }),
  run: (id: string, body: unknown) =>
    api<unknown>(`threads/${id}/runs`, { method: "POST", body }),
};

// ---------------- models ----------------
export const Models = {
  list: (q: { include_served_default?: boolean; include_oss_models?: boolean } = {}) =>
    api<ListModelsResponse>("models", { query: q }),
};

// ---------------- secrets ----------------
export const Secrets = {
  list: (q: { page_size?: number; cursor?: string } = {}) =>
    api<ListSecretsResponse>("secrets", { query: q }),
  set: (name: string, value: string) =>
    api<unknown>(`secrets/${encodeURIComponent(name)}`, { method: "PUT", body: { value } }),
  remove: (name: string) =>
    api<void>(`secrets/${encodeURIComponent(name)}`, { method: "DELETE" }),
  bulk: (secrets: BulkUpsertItem[]) =>
    api<unknown>("secrets", { method: "POST", body: { secrets } }),
};

// ---------------- auth ----------------
export const Auth = {
  providers: {
    list: () => api<{ items: ProviderResponse[] }>("auth-providers"),
    get: (slug: string) => api<ProviderResponse>(`auth-providers/${slug}`),
    create: (body: CreateProviderRequest) =>
      api<ProviderResponse>("auth-providers", { method: "POST", body }),
    discover: (body: DiscoverProviderRequest) =>
      api<ProviderResponse>("auth-providers/discover", { method: "POST", body }),
    update: (slug: string, body: Partial<CreateProviderRequest>) =>
      api<ProviderResponse>(`auth-providers/${slug}`, { method: "PATCH", body }),
    remove: (slug: string) => api<void>(`auth-providers/${slug}`, { method: "DELETE" }),
  },
  sessions: {
    create: (body: CreateSessionRequest) =>
      api<CreateSessionResponse>("auth-sessions", { method: "POST", body }),
    get: (id: string, wait_seconds?: number) =>
      api<GetSessionResponse>(`auth-sessions/${id}`, { query: { wait_seconds } }),
  },
  tokens: {
    list: (q: { provider_slug?: string; is_default?: boolean } = {}) =>
      api<ListTokensResponse>("auth-tokens", { query: q }),
    update: (id: string, body: UpdateTokenRequest) =>
      api<TokenSummary>(`auth-tokens/${id}`, { method: "PATCH", body }),
    remove: (id: string) => api<void>(`auth-tokens/${id}`, { method: "DELETE" }),
  },
};

// ---------------- integrations ----------------
export const Integrations = {
  list: (q: { source?: string; page_size?: number; cursor?: string } = {}) =>
    api<ListIntegrationsResponse>("integrations", { query: q }),
  get: (id: string) => api<Integration>(`integrations/${id}`),
  create: (body: CreateIntegrationRequest) =>
    api<Integration>("integrations", { method: "POST", body }),
  update: (id: string, body: UpdateIntegrationRequest) =>
    api<Integration>(`integrations/${id}`, { method: "PATCH", body }),
  remove: (id: string) => api<void>(`integrations/${id}`, { method: "DELETE" }),
};

// ---------------- skills ----------------
export const Skills = {
  list: (q: { page_size?: number; cursor?: string; include?: string[] } = {}) =>
    api<ListSkillsResponse>("skills", { query: { ...q, include: inc(q.include) } }),
  get: (id: string) => api<Skill>(`skills/${id}`),
  create: (body: CreateSkillRequest) => api<Skill>("skills", { method: "POST", body }),
  update: (id: string, body: UpdateSkillRequest) =>
    api<Skill>(`skills/${id}`, { method: "PATCH", body }),
  remove: (id: string) => api<void>(`skills/${id}`, { method: "DELETE" }),
};

// ---------------- tenants / users ----------------
export const Tenants = {
  list: (org_id: string, q: { page_size?: number; cursor?: string } = {}) =>
    api<ListTenantsResponse>(`orgs/${org_id}/tenants`, { query: q }),
};
export const Users = {
  current: () => api<User>("users/current"),
  inTenant: (tenant_id: string, id: string) =>
    api<User>(`tenants/${tenant_id}/users/${id}`),
};
