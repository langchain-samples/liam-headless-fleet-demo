// The workspace "Agent Builder" — a platform deep-agent that interviews the user
// and builds an agent for them. It is NOT in the agents listing (GET /agents/{id}
// 404s for it), but it is runnable via thread runs with this assistant_id.
export const AGENT_BUILDER_ID =
  process.env.NEXT_PUBLIC_AGENT_BUILDER_ID || "47c35ef5-979e-5ab8-8dce-a69ded2244ab";

export const AGENT_BUILDER_NAME = "Agent Builder";
export const AGENT_BUILDER_ICON = "sparkle";
export const AGENT_BUILDER_COLOR = "gold";
