"use client";
// Demo "users" = Dunder Mifflin employees. The Fleet API can't enumerate real
// users (403), so personas live on the front end. Agents are attributed to a
// persona via `extras.dm_owner` (set at create time); see personaFor().
import * as React from "react";
import type { Agent } from "@/lib/fleet/types";

export interface Persona {
  id: string;
  name: string;
  title: string;
  initials: string;
  color: string; // brand-ish hex
  role: "admin" | "member";
  /** Real LangSmith owner names that should also map to this persona, if any. */
  aliases?: string[];
}

export const PERSONAS: Persona[] = [
  { id: "michael-scott", name: "Michael Scott", title: "Regional Manager", initials: "MS", color: "#0b2545", role: "admin", aliases: ["Liam Bush", "Michael Walker"] },
  { id: "jim-halpert", name: "Jim Halpert", title: "Sales", initials: "JH", color: "#2b4a78", role: "member" },
  { id: "pam-beesly", name: "Pam Beesly", title: "Reception", initials: "PB", color: "#b4690e", role: "member" },
  { id: "dwight-schrute", name: "Dwight Schrute", title: "Asst. Regional Manager", initials: "DS", color: "#2f7d4f", role: "member" },
  { id: "angela-martin", name: "Angela Martin", title: "Accounting", initials: "AM", color: "#5b3b8c", role: "member" },
  { id: "kevin-malone", name: "Kevin Malone", title: "Accounting", initials: "KM", color: "#a23b6e", role: "member" },
  { id: "toby-flenderson", name: "Toby Flenderson", title: "Human Resources", initials: "TF", color: "#1f6f6f", role: "member" },
  { id: "stanley-hudson", name: "Stanley Hudson", title: "Sales", initials: "SH", color: "#9b2226", role: "member" },
];

export const UNASSIGNED: Persona = {
  id: "unassigned",
  name: "Unassigned",
  title: "No owner",
  initials: "—",
  color: "#75809a",
  role: "member",
};

const BY_ID = new Map(PERSONAS.map((p) => [p.id, p]));
export function getPersona(id: string | undefined): Persona {
  return (id && BY_ID.get(id)) || UNASSIGNED;
}

/** Resolve which persona "owns" an agent: extras.dm_owner first, then real owner name. */
export function personaFor(agent: Agent): Persona {
  const tag = (agent.extras?.dm_owner as string | undefined) || undefined;
  if (tag && BY_ID.has(tag)) return BY_ID.get(tag)!;
  const ownerName = agent.owner?.name;
  if (ownerName) {
    const match = PERSONAS.find(
      (p) => p.name === ownerName || p.aliases?.includes(ownerName),
    );
    if (match) return match;
  }
  return UNASSIGNED;
}

/* ------------------------------- context ------------------------------- */
interface PersonaCtx {
  current: Persona;
  currentId: string;
  isAdmin: boolean;
  setPersona: (id: string) => void;
}
const Ctx = React.createContext<PersonaCtx | null>(null);
const STORAGE_KEY = "dm_persona";
const DEFAULT_ID = "michael-scott";

export function PersonaProvider({ children }: { children: React.ReactNode }) {
  const [currentId, setCurrentId] = React.useState<string>(DEFAULT_ID);

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && BY_ID.has(saved)) setCurrentId(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const setPersona = React.useCallback((id: string) => {
    if (!BY_ID.has(id)) return;
    setCurrentId(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  const value = React.useMemo<PersonaCtx>(() => {
    const current = getPersona(currentId);
    return { current, currentId, isAdmin: current.role === "admin", setPersona };
  }, [currentId, setPersona]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePersona(): PersonaCtx {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("usePersona must be used within <PersonaProvider>");
  return ctx;
}

/** Small avatar chip for a persona. */
export function PersonaAvatar({ persona, size = 32 }: { persona: Persona; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: persona.color, fontSize: size * 0.38 }}
      aria-hidden
    >
      {persona.initials}
    </span>
  );
}
