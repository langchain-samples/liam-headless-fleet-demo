// Typed mirrors of the Fleet API (Swagger 2.0) definitions the UI consumes.
// Hand-authored subset — see ~/.claude/skills/fleet-api for the full reference.

// ---------- shared ----------
export interface Paginated<T> {
  items: T[];
  next_cursor?: string | null;
}

export interface FleetError {
  type?: string;
  code?: string;
  detail?: string;
  message?: string;
  status: number;
}

export type AccessLevel = "READ" | "RUN" | "WRITE";

// ---------- models ----------
export interface FleetModel {
  id: string;
  display_name?: string;
  provider?: string;
  source?: string; // built_in | custom
  is_default?: boolean;
  required_secrets?: string[];
  playground_settings_id?: string;
}
export interface ListModelsResponse {
  items: FleetModel[];
}

// ---------- agents ----------
export interface UserRef {
  id: string;
  name: string;
}
export interface AgentDisplay {
  icon?: string;
  icon_color?: string;
}
export interface AgentModel {
  id?: string;
}
export interface SharedUsers {
  read?: string[];
  run?: string[];
  update?: string[];
}
export interface AgentPermissions {
  identity?: "personal" | "shared";
  visibility?: "tenant" | "user";
  tenant_access_level?: "read" | "run" | "write";
  shared_users?: SharedUsers;
}
export interface SandboxConfig {
  scope?: "thread" | "agent";
  idle_ttl_seconds?: number;
  delete_after_stop_seconds?: number;
  sandbox_id?: string;
  snapshot_id?: string;
  policy_ids?: string[];
}
export interface AgentBackend {
  type?: "state" | "sandbox";
  sandbox_config?: SandboxConfig;
}
export interface AgentOptions {
  trace_inputs_outputs?: boolean;
  user_timezone?: string;
  tools_url?: string;
  slack_oauth_provider_id?: string;
  triggers_paused?: boolean;
  skip_memory_write_protection?: boolean;
}
export interface ToolSpec {
  name?: string;
  display_name?: string;
  mcp_server_name?: string;
  mcp_server_url?: string;
}
export type InterruptRule = boolean | Record<string, unknown>;
export interface ToolsConfig {
  tools?: ToolSpec[];
  interrupt_config?: Record<string, InterruptRule>;
}
export interface SubagentSpec {
  name?: string;
  description?: string;
  system_prompt?: string;
  instructions?: string;
  model?: AgentModel;
  tools?: ToolsConfig;
}
export interface FileEntry {
  type?: "file" | "skill";
  content?: string;
  repo_handle?: string;
  commit_id?: string;
}
export interface Agent {
  id: string;
  name: string;
  description?: string;
  owner_id?: string;
  owner?: UserRef;
  is_owner?: boolean;
  access_level?: AccessLevel;
  revision?: string;
  model?: AgentModel;
  backend?: AgentBackend;
  options?: AgentOptions;
  permissions?: AgentPermissions;
  display?: AgentDisplay;
  system_prompt?: string;
  instructions?: string;
  tools?: ToolsConfig;
  subagents?: SubagentSpec[];
  files?: Record<string, FileEntry>;
  extras?: Record<string, unknown>;
  configurable?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}
export type AgentSummary = Agent;
export type ListAgentsResponse = Paginated<AgentSummary>;

export interface CreateAgentRequest {
  name: string;
  description?: string;
  model?: AgentModel;
  system_prompt?: string;
  tools?: ToolsConfig;
  subagents?: SubagentSpec[];
  backend?: AgentBackend;
  options?: AgentOptions;
  permissions?: AgentPermissions;
  display?: AgentDisplay;
  files?: Record<string, FileEntry | null>;
  configurable?: Record<string, unknown>;
  extras?: Record<string, unknown>;
}
export interface UpdateAgentRequest extends Partial<CreateAgentRequest> {
  remove_file_paths?: string[];
}
export interface CloneAgentRequest {
  name?: string;
  permissions?: AgentPermissions;
}

// ---------- agent health ----------
export interface MCPServerHealth {
  name?: string;
  url?: string;
  ok?: boolean;
  is_default?: boolean;
  error?: string;
  error_code?: string;
}
export interface MCPCheck {
  ok?: boolean;
  servers?: MCPServerHealth[];
}
export interface HealthResponse {
  agent_id?: string;
  checked_at?: string;
  mcp_check?: MCPCheck;
}

// ---------- agent connections ----------
export interface Connection {
  id: string;
  agent_id?: string;
  auth_token_id?: string;
  provider_id?: string;
  provider_account_label?: string;
  scopes?: string[];
  created_by?: string;
  created_at?: string;
  expires_at?: string;
}
export interface CreateConnectionRequest {
  auth_token_id: string;
}

// ---------- threads ----------
export type ThreadStatus = "idle" | "busy" | "interrupted" | "error";
export interface Thread {
  id: string;
  thread_id?: string;
  agent_id?: string;
  title?: string;
  status?: ThreadStatus;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}
export interface ThreadDetail extends Thread {
  values?: Record<string, unknown>;
  interrupts?: Record<string, unknown>;
  config?: Record<string, unknown>;
  error?: unknown;
  state_updated_at?: string | null;
}
export type ThreadSummary = Thread;
export type ListThreadsResponse = Paginated<ThreadSummary>;
export interface CountResponse {
  attention_count: number;
}
export interface CreateThreadOptions {
  test_run?: boolean;
  skip_memory_write_protection?: boolean;
}
export interface CreateThreadRequest {
  agent_id?: string;
  thread_id?: string;
  if_exists?: "do_nothing" | "raise";
  metadata?: Record<string, unknown>;
  options?: CreateThreadOptions;
}
export interface CreateThreadAndRunRequest {
  agent_id: string;
  thread?: {
    thread_id?: string;
    if_exists?: "do_nothing" | "raise";
    metadata?: Record<string, unknown>;
    options?: CreateThreadOptions;
  };
}
// OptionalField wrappers in PATCH: we model as plain optionals at the UI layer.
export interface UpdateThreadRequest {
  title?: string | null;
  metadata?: {
    is_pinned?: boolean;
    is_test_run?: boolean;
    read_status?: boolean;
    skip_memory_write_protection?: boolean;
    sandbox_recreated_at?: string;
  };
}
export interface BulkUpdateThreadsRequest {
  thread_ids: string[];
  data: UpdateThreadRequest;
}

// ---------- secrets ----------
export interface SecretItem {
  name: string;
  set?: boolean;
}
export type ListSecretsResponse = Paginated<SecretItem>;
export interface BulkUpsertItem {
  key: string;
  value: string | null;
}

// ---------- auth: providers / sessions / tokens ----------
export interface ProviderResponse {
  id: string;
  organization_id?: string;
  provider_slug: string;
  name?: string;
  provider_type?: string;
  mcp_server_url?: string;
  client_id?: string;
  auth_url?: string;
  token_url?: string;
  uses_pkce?: boolean;
  code_challenge_method?: string | null;
  token_endpoint_auth_method?: string;
  authorization_params?: Record<string, string>;
  allowed_redirect_uris?: string[];
  is_dynamic_client?: boolean;
  created_at?: string;
  updated_at?: string;
}
export interface CreateProviderRequest {
  provider_slug: string;
  name?: string;
  client_id?: string;
  client_secret?: string;
  auth_url?: string;
  token_url?: string;
  uses_pkce?: boolean;
  token_endpoint_auth_method?: string;
  authorization_params?: Record<string, string>;
  allowed_redirect_uris?: string[];
}
export interface DiscoverProviderRequest {
  mcp_server_url: string;
  provider_slug: string;
  name?: string;
}
export interface CreateSessionRequest {
  provider_slug: string;
  scopes?: string[];
  strategy?: "REUSE" | "CREATE";
  is_default?: boolean;
  token_id?: string;
  redirect_uri?: string;
}
export interface CreateSessionResponse {
  id: string;
  provider_slug?: string;
  status?: string;
  verification_url?: string;
  token?: string;
  metadata?: Record<string, unknown>;
}
export interface GetSessionResponse {
  id: string;
  status?: string;
}
export interface TokenSummary {
  id: string;
  provider_slug?: string;
  label?: string;
  is_default?: boolean;
  scopes?: string[];
  created_at?: string;
  updated_at?: string;
  expires_at?: string | null;
}
export type ListTokensResponse = Paginated<TokenSummary>;
export interface UpdateTokenRequest {
  label?: string;
  is_default?: boolean;
}

// ---------- integrations ----------
export interface HeaderInput {
  key: string;
  value?: string;
}
export interface AuthMethod {
  type?: string;
  scopes?: string[];
  secret_names?: string[];
  provider_match?: { by?: string; value?: string };
}
export interface Integration {
  id: string;
  name?: string;
  url?: string;
  source?: string;
  external_system_id?: string;
  enabled?: boolean;
  can_invoke?: boolean;
  transport?: string;
  auth_methods?: AuthMethod[];
  headers?: HeaderInput[];
  created_at?: string;
  updated_at?: string;
}
export type ListIntegrationsResponse = Paginated<Integration>;
export interface CreateIntegrationRequest {
  name: string;
  url: string;
  source?: string;
  external_system_id?: string;
  auth_methods?: AuthMethod[];
  headers?: HeaderInput[];
}
export interface UpdateIntegrationRequest {
  name?: string;
  url?: string;
  auth_methods?: AuthMethod[];
  headers?: HeaderInput[];
}

// ---------- skills ----------
export interface SkillFileEntry {
  type?: string;
  content?: string;
}
export interface SkillOwner {
  identity_id?: string;
  ls_user_id?: string;
  full_name?: string;
  email?: string;
  created_at?: string;
}
export interface Skill {
  id: string;
  name: string;
  description?: string;
  visibility?: string;
  files?: Record<string, SkillFileEntry>;
  commit_hash?: string;
  commit_id?: string;
  owners?: SkillOwner[];
  created_at?: string;
  updated_at?: string;
}
export type ListSkillsResponse = Paginated<Skill>;
export interface CreateSkillRequest {
  name: string;
  files: Record<string, SkillFileEntry>;
}
export interface UpdateSkillRequest {
  files: Record<string, SkillFileEntry | null>;
}

// ---------- tenants / users ----------
export interface Tenant {
  id: string;
  name?: string;
  tenant_handle?: string;
  organization_id?: string;
  is_personal?: boolean;
  data_plane_url?: string;
  permissions?: string[];
  created_at?: string;
}
export type ListTenantsResponse = Paginated<Tenant>;
export interface User {
  id: string;
  name?: string;
  email?: string;
  avatar_url?: string;
}
