// Curated catalog of well-known services for the Connections page.
//
// Fleet exposes only raw, org-scoped OAuth *providers* (350+ auto-generated clients with messy slugs)
// and the caller's issued *tokens*. Users shouldn't browse providers — they want to see "which services
// am I connected to?". This module defines a human-friendly service catalog and pure functions that
// cross-reference the real providers + tokens (by keyword match on slug/type/name) to compute each
// service's connection status. No network calls here — callers pass already-fetched data in.
import type { ProviderResponse, TokenSummary } from "@/lib/fleet/types";

export type ServiceCategory =
  | "Google"
  | "Microsoft"
  | "Developer"
  | "Communication"
  | "Sales & CRM"
  | "Productivity"
  | "Other";

export interface ServiceDef {
  key: string;
  name: string;
  description: string;
  category: ServiceCategory;
  /** Icon key understood by AgentIcon (components/brand/agentIcon.tsx). */
  icon: string;
  /** Brand-ish accent color name (resolveAgentColor). */
  color: string;
  /** Lowercase substrings matched against a provider/token slug, type, or name. */
  matchers: string[];
  /** OAuth scopes requested when connecting this service (optional). */
  scopes?: string[];
}

export const SERVICE_CATALOG: ServiceDef[] = [
  // ---- Google ----
  { key: "gmail", name: "Gmail", category: "Google", icon: "mail", color: "red",
    description: "Read, compose, and organize emails in your Gmail inbox.",
    matchers: ["gmail", "google-langsmith", "googlemail"] },
  { key: "gcal", name: "Google Calendar", category: "Google", icon: "calendar", color: "blue",
    description: "View, create, and manage calendar events and meeting schedules.",
    matchers: ["calendar", "gcal", "google-langsmith"] },
  { key: "gdrive", name: "Google Drive", category: "Google", icon: "file", color: "green",
    description: "Create, read, and manage files in Google Drive.",
    matchers: ["drive", "gdrive", "google-langsmith"] },
  { key: "gsheets", name: "Google Sheets", category: "Google", icon: "chart", color: "green",
    description: "Read, update, and analyze data in Google Sheets spreadsheets.",
    matchers: ["sheets", "gsheet", "google-langsmith"] },

  // ---- Microsoft ----
  { key: "outlook", name: "Outlook", category: "Microsoft", icon: "mail", color: "blue",
    description: "Read, draft, and organize Outlook emails, meetings, and calendar events.",
    matchers: ["outlook", "microsoft-graph", "msgraph"] },
  { key: "teams", name: "Teams", category: "Microsoft", icon: "message", color: "purple",
    description: "Send and read messages, channels, and collaboration updates in Microsoft Teams.",
    matchers: ["teams", "msteams"] },
  { key: "sharepoint", name: "SharePoint", category: "Microsoft", icon: "file", color: "teal",
    description: "Browse, read, and manage documents and sites in Microsoft SharePoint.",
    matchers: ["sharepoint"] },

  // ---- Developer ----
  { key: "github", name: "GitHub", category: "Developer", icon: "git", color: "gray",
    description: "Browse repositories, manage issues and pull requests, and review code on GitHub.",
    matchers: ["github"], scopes: ["repo"] },
  { key: "linear", name: "Linear", category: "Developer", icon: "zap", color: "purple",
    description: "Track issues, plan sprints, and coordinate team projects in Linear.",
    matchers: ["linear"] },

  // ---- Communication ----
  { key: "slack", name: "Slack", category: "Communication", icon: "message", color: "purple",
    description: "Send messages, manage channels, and automate notifications in Slack.",
    matchers: ["slack"] },
  { key: "x", name: "X (Twitter)", category: "Communication", icon: "globe", color: "navy",
    description: "Publish posts, monitor mentions, and engage with your audience on X.",
    matchers: ["twitter", "x-oauth", "x-provider"] },

  // ---- Sales & CRM ----
  { key: "salesforce", name: "Salesforce", category: "Sales & CRM", icon: "cloud", color: "blue",
    description: "Query and update accounts, contacts, and opportunities in Salesforce.",
    matchers: ["salesforce"], scopes: ["api", "refresh_token"] },
  { key: "ramp", name: "Ramp", category: "Sales & CRM", icon: "cart", color: "green",
    description: "Access spend, cards, and transaction data in Ramp.",
    matchers: ["ramp"] },
  { key: "ashby", name: "Ashby", category: "Sales & CRM", icon: "users", color: "purple",
    description: "Search candidates, review applications, and analyze recruiting pipeline data in Ashby.",
    matchers: ["ashby"] },
  { key: "avoma", name: "Avoma", category: "Sales & CRM", icon: "phone", color: "orange",
    description: "Access meeting notes, transcripts, and conversation insights from Avoma.",
    matchers: ["avoma"] },

  // ---- Productivity / Other ----
  { key: "notion", name: "Notion", category: "Productivity", icon: "file", color: "gray",
    description: "Read, create, and update pages, databases, and wikis in your Notion workspace.",
    matchers: ["notion"] },
  { key: "arcade", name: "Arcade", category: "Other", icon: "zap", color: "orange",
    description: "Run tools and automations through the Arcade tool-calling platform.",
    matchers: ["arcade"] },
];

export type ServiceStatus = "connected" | "available" | "unavailable";

const hay = (s?: string | null) => (s ?? "").toLowerCase();

function providerMatches(svc: ServiceDef, p: ProviderResponse): boolean {
  const fields = [hay(p.provider_slug), hay(p.provider_type), hay(p.name)];
  return svc.matchers.some((m) => fields.some((f) => f.includes(m)));
}

function tokenMatches(svc: ServiceDef, t: TokenSummary): boolean {
  const f = hay(t.provider_slug);
  return svc.matchers.some((m) => f.includes(m));
}

/** Providers in the org that plausibly belong to this service. */
export function matchProviders(svc: ServiceDef, providers: ProviderResponse[]): ProviderResponse[] {
  return providers.filter((p) => providerMatches(svc, p));
}

/** Caller-owned tokens that belong to this service (i.e. an active connection). */
export function matchTokens(svc: ServiceDef, tokens: TokenSummary[]): TokenSummary[] {
  return tokens.filter((t) => tokenMatches(svc, t));
}

/**
 * Status for a service:
 * - connected   → the caller holds at least one token for it
 * - available   → no token yet, but a provider exists to authorize against
 * - unavailable → no provider registered in the org (can't start an OAuth flow)
 */
export function statusFor(
  svc: ServiceDef,
  providers: ProviderResponse[],
  tokens: TokenSummary[],
): ServiceStatus {
  if (matchTokens(svc, tokens).length > 0) return "connected";
  if (matchProviders(svc, providers).length > 0) return "available";
  return "unavailable";
}

/**
 * Auto-pick the best provider to authorize against when a service maps to many
 * (e.g. 100+ Slack apps): prefer one the caller already has a token for, else the
 * first non-dynamic (hand-registered) provider, else the first match.
 */
export function pickProvider(
  matches: ProviderResponse[],
  tokens: TokenSummary[],
): ProviderResponse | undefined {
  if (matches.length === 0) return undefined;
  const tokenSlugs = new Set(tokens.map((t) => hay(t.provider_slug)));
  const owned = matches.find((p) => tokenSlugs.has(hay(p.provider_slug)));
  if (owned) return owned;
  const stable = matches.find((p) => !p.is_dynamic_client);
  return stable ?? matches[0];
}
