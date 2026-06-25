// Cost analytics from the workspace's LangSmith tracing project ("fleet").
//
// The Fleet API itself has no cost data — it lives in LangSmith run traces. This
// server-only route queries the LangSmith runs API (same host as Fleet, reusing the
// server-only FLEET_API_KEY + FLEET_TENANT_ID, which can read the workspace's `fleet`
// project) and aggregates total_cost / total_tokens per agent and per user. The key
// never reaches the browser. Returns names + numbers only — no run inputs/outputs.
import { NextResponse } from "next/server";
import { isConfigured } from "@/lib/fleet/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BASE = process.env.FLEET_API_BASE || "https://api.smith.langchain.com/v1/fleet";
const LS_BASE = new URL(BASE).origin; // https://api.smith.langchain.com
const API_KEY = process.env.FLEET_API_KEY || "";
const TENANT_ID = process.env.FLEET_TENANT_ID || "";
const PROJECT = "fleet";
// Known platform Agent Builder assistant id (runs lack a friendly agent_name).
const AGENT_BUILDER_ID = "47c35ef5-979e-5ab8-8dce-a69ded2244ab";

// Trusted allowlist: agent `dm_owner` tag (persona id) -> display name. The Fleet
// identity endpoints all 403 and there's only one real LangSmith user, so per-user
// spend is grouped by the demo owner tagged on each agent. We map ONLY known ids
// (never echo an arbitrary tag string). Untagged + Agent Builder runs roll into the
// workspace bucket.
const PERSONA_NAMES: Record<string, string> = {
  "michael-scott": "Michael Scott",
  "jim-halpert": "Jim Halpert",
  "pam-beesly": "Pam Beesly",
  "dwight-schrute": "Dwight Schrute",
  "angela-martin": "Angela Martin",
  "kevin-malone": "Kevin Malone",
  "toby-flenderson": "Toby Flenderson",
  "stanley-hudson": "Stanley Hudson",
};

function lsHeaders(): HeadersInit {
  return {
    "X-Api-Key": API_KEY,
    "X-Tenant-Id": TENANT_ID,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

interface Bucket {
  key: string;
  name: string;
  personaId?: string;
  cost: number;
  tokens: number;
  runs: number;
}

export async function GET() {
  if (!isConfigured()) {
    return NextResponse.json({ code: "not_configured", detail: "Server not configured.", status: 503 }, { status: 503 });
  }
  try {
    // 1) Resolve the `fleet` tracing project's session id.
    const sessRes = await fetch(
      `${LS_BASE}/api/v1/sessions?name=${encodeURIComponent(PROJECT)}`,
      { headers: lsHeaders(), cache: "no-store" },
    );
    if (!sessRes.ok) {
      return NextResponse.json({ detail: `Could not read tracing project (${sessRes.status}).`, perAgent: [], perUser: [], totalCost: 0, totalTokens: 0, runs: 0 }, { status: 200 });
    }
    const sessJson = await sessRes.json();
    const sessions = Array.isArray(sessJson) ? sessJson : sessJson.items ?? [];
    const session = sessions.find((s: { name?: string }) => s.name === PROJECT) ?? sessions[0];
    if (!session?.id) {
      return NextResponse.json({ perAgent: [], perUser: [], totalCost: 0, totalTokens: 0, runs: 0 }, { status: 200 });
    }

    // 2) Query ROOT runs in that project (root runs carry total_cost + attribution).
    const runsRes = await fetch(`${LS_BASE}/api/v1/runs/query`, {
      method: "POST",
      headers: lsHeaders(),
      cache: "no-store",
      body: JSON.stringify({
        session: [session.id],
        is_root: true,
        limit: 100,
        select: ["total_cost", "total_tokens", "extra"],
      }),
    });
    if (!runsRes.ok) {
      return NextResponse.json({ detail: `Could not read runs (${runsRes.status}).`, perAgent: [], perUser: [], totalCost: 0, totalTokens: 0, runs: 0 }, { status: 200 });
    }
    const runsJson = await runsRes.json();
    const runs: Array<{ total_cost?: number; total_tokens?: number; extra?: { metadata?: Record<string, unknown> } }> =
      runsJson.runs ?? (Array.isArray(runsJson) ? runsJson : []);

    // 3) Aggregate per agent and per user (= demo persona via dm_owner).
    const agents = new Map<string, Bucket>();
    const users = new Map<string, Bucket>();

    let totalCost = 0, totalTokens = 0, totalRuns = 0;
    for (const r of runs) {
      const md = r.extra?.metadata ?? {};
      const cost = typeof r.total_cost === "number" ? r.total_cost : 0;
      const tokens = typeof r.total_tokens === "number" ? r.total_tokens : 0;
      totalCost += cost; totalTokens += tokens; totalRuns += 1;

      // Per agent — by assistant_id / agent_name (Agent Builder labeled).
      const assistantId = String(md.assistant_id ?? "");
      const agentName =
        (md.agent_name && String(md.agent_name)) ||
        (assistantId === AGENT_BUILDER_ID ? "Agent Builder" : assistantId ? `Agent ${assistantId.slice(0, 8)}` : "Unknown agent");
      const aKey = assistantId || agentName;
      const a = agents.get(aKey) ?? { key: aKey, name: agentName, cost: 0, tokens: 0, runs: 0 };
      a.cost += cost; a.tokens += tokens; a.runs += 1;
      agents.set(aKey, a);

      // Per user — by the agent's dm_owner persona tag (the only viable attribution).
      // Only runs tagged with a known persona count toward per-user spend; untagged
      // runs and the Agent Builder are NOT real users, so they're omitted here (they
      // still count in the total and in per-agent).
      const owner = String(md.dm_owner ?? "");
      if (PERSONA_NAMES[owner]) {
        const u = users.get(owner) ?? { key: owner, name: PERSONA_NAMES[owner], cost: 0, tokens: 0, runs: 0 };
        u.cost += cost; u.tokens += tokens; u.runs += 1;
        users.set(owner, u);
      }
    }

    const byCost = (x: Bucket, y: Bucket) => y.cost - x.cost;
    return NextResponse.json({
      totalCost,
      totalTokens,
      runs: totalRuns,
      perAgent: [...agents.values()].sort(byCost),
      perUser: [...users.values()].sort(byCost),
    });
  } catch (e) {
    return NextResponse.json(
      { detail: e instanceof Error ? e.message : "Cost query failed.", perAgent: [], perUser: [], totalCost: 0, totalTokens: 0, runs: 0 },
      { status: 200 },
    );
  }
}
