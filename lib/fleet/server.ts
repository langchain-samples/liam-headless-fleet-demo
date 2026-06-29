// Server-only Fleet API client. The API key NEVER leaves this module / the server.
// All browser traffic goes through /api/fleet/* route handlers that call into here.
import "server-only";
import type { FleetError } from "./types";

const BASE = process.env.FLEET_API_BASE || "https://api.smith.langchain.com/v1/fleet";
const API_KEY = process.env.FLEET_API_KEY || "";
const TENANT_ID = process.env.FLEET_TENANT_ID || "";
export const ORG_ID = process.env.FLEET_ORG_ID || "";

// Only this host may be reached through the proxy (SSRF guard).
const ALLOWED_HOST = new URL(BASE).host;

export class FleetApiError extends Error {
  status: number;
  code?: string;
  detail?: string;
  constructor(status: number, body: Partial<FleetError> | string) {
    const detail = typeof body === "string" ? body : body.detail || body.message;
    super(detail || `Fleet API error ${status}`);
    this.status = status;
    this.detail = detail;
    this.code = typeof body === "string" ? undefined : body.code;
  }
}

export interface FleetFetchInit {
  method?: string;
  // Some org/identity-scoped endpoints must NOT send X-Tenant-Id.
  tenantScoped?: boolean;
  body?: unknown;
  headers?: Record<string, string>;
  // raw query string already URL-encoded (without leading ?)
  query?: string;
  // pass through for streaming
  signal?: AbortSignal;
  accept?: string;
  // Per-user LangSmith key (lsv2_...). When set, the request acts AS that user
  // instead of the shared FLEET_API_KEY. Used by the action proxy so each
  // logged-in user's own connections / run attribution apply. The analytics
  // (cost) route deliberately does NOT pass this — it uses the shared key.
  apiKey?: string;
}

function buildUrl(path: string, query?: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${BASE}${clean}`);
  if (query) url.search = query.startsWith("?") ? query : `?${query}`;
  if (url.host !== ALLOWED_HOST) {
    throw new FleetApiError(400, `Refusing to call non-allowlisted host ${url.host}`);
  }
  return url.toString();
}

export function fleetHeaders(init: FleetFetchInit = {}): Headers {
  const h = new Headers();
  // Per-user key when provided, else the shared workspace key.
  h.set("X-Api-Key", init.apiKey || API_KEY);
  if (init.tenantScoped !== false) h.set("X-Tenant-Id", TENANT_ID);
  if (init.body !== undefined) h.set("Content-Type", "application/json");
  h.set("Accept", init.accept || "application/json");
  for (const [k, v] of Object.entries(init.headers || {})) h.set(k, v);
  return h;
}

/** Low-level fetch returning the raw Response (used by the proxy + stream routes). */
export async function fleetRaw(path: string, init: FleetFetchInit = {}): Promise<Response> {
  const url = buildUrl(path, init.query);
  return fetch(url, {
    method: init.method || "GET",
    headers: fleetHeaders(init),
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: init.signal,
    cache: "no-store",
  });
}

/** Typed JSON fetch used by server-side helpers / RSC. Throws FleetApiError on !ok. */
export async function fleetJson<T>(path: string, init: FleetFetchInit = {}): Promise<T> {
  const res = await fleetRaw(path, init);
  const text = await res.text();
  let parsed: unknown = undefined;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  if (!res.ok) {
    throw new FleetApiError(
      res.status,
      (parsed as Partial<FleetError>) ?? `HTTP ${res.status}`,
    );
  }
  return parsed as T;
}

export function isConfigured(): boolean {
  return Boolean(API_KEY && TENANT_ID);
}
