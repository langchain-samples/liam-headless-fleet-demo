// Shared helpers for the Agents area. Client-safe (no secrets).
import type { Agent, AgentPermissions } from "@/lib/fleet/types";

export const DM_PREFIX = "DM Demo — ";

/** Human label for an agent's access level (uppercase enum from the API). */
export function accessLevelLabel(level?: string): string {
  switch ((level || "").toUpperCase()) {
    case "WRITE":
      return "Write";
    case "RUN":
      return "Run";
    case "READ":
      return "Read";
    default:
      return level || "—";
  }
}

export function accessLevelTone(level?: string): "good" | "navy" | "neutral" {
  switch ((level || "").toUpperCase()) {
    case "WRITE":
      return "good";
    case "RUN":
      return "navy";
    default:
      return "neutral";
  }
}

/** Visibility badge text from permissions. */
export function visibilityLabel(p?: AgentPermissions): string {
  if (!p?.visibility) return "—";
  return p.visibility === "tenant" ? "Tenant" : "Personal";
}

export function fmtDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtRelative(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(iso);
}

export function ownerName(agent: Pick<Agent, "owner" | "owner_id">): string {
  return agent.owner?.name || agent.owner_id || "Unknown owner";
}

export function truncate(text: string | undefined, max = 140): string {
  if (!text) return "";
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}

/** Short revision hash for display. */
export function shortRevision(rev?: string): string {
  if (!rev) return "—";
  return rev.length > 12 ? rev.slice(0, 12) : rev;
}

/** Color swatch options for the display picker (names map in agentIcon.tsx). */
export const ICON_COLORS = [
  "blue",
  "navy",
  "green",
  "red",
  "orange",
  "gold",
  "purple",
  "pink",
  "gray",
  "teal",
] as const;
