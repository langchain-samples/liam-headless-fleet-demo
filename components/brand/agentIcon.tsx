"use client";
// Maps Fleet agent `display.icon` strings (e.g. "Bell03", "Rocket01") + `icon_color`
// to a lucide icon + a brand color. Best-effort with a sensible fallback.
import * as React from "react";
import {
  Bell, Bot, Rocket, Mail, Calendar, FileText, MessageSquare, Search, Zap, Database,
  GitBranch, Globe, Briefcase, Users, Bookmark, Sparkles, Cog, Cloud, Code, BarChart3,
  Phone, ShoppingCart, Paperclip, type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  bell: Bell, bot: Bot, rocket: Rocket, mail: Mail, email: Mail, calendar: Calendar,
  file: FileText, document: FileText, message: MessageSquare, chat: MessageSquare,
  search: Search, zap: Zap, bolt: Zap, database: Database, git: GitBranch, globe: Globe,
  web: Globe, briefcase: Briefcase, users: Users, people: Users, bookmark: Bookmark,
  sparkle: Sparkles, star: Sparkles, cog: Cog, settings: Cog, gear: Cog, cloud: Cloud,
  code: Code, chart: BarChart3, analytics: BarChart3, phone: Phone, cart: ShoppingCart,
  paper: Paperclip,
};

// color name -> tailwind text/bg-ish hex used inline
const COLORS: Record<string, string> = {
  blue: "#2b4a78", navy: "#0b2545", green: "#2f7d4f", red: "#9b2226", orange: "#b4690e",
  yellow: "#b8860b", gold: "#b8860b", purple: "#5b3b8c", pink: "#a23b6e", gray: "#41506b",
  grey: "#41506b", teal: "#1f6f6f", cyan: "#1f6f6f",
};

export function resolveAgentIcon(icon?: string): LucideIcon {
  if (!icon) return Bot;
  const key = icon.toLowerCase().replace(/[0-9_\-\s]/g, "");
  for (const [name, Comp] of Object.entries(ICONS)) {
    if (key.includes(name)) return Comp;
  }
  return Bot;
}

export function resolveAgentColor(color?: string): string {
  if (!color) return "#2b4a78";
  return COLORS[color.toLowerCase()] ?? (color.startsWith("#") ? color : "#2b4a78");
}

export function AgentIcon({
  icon,
  color,
  size = 18,
  className,
}: {
  icon?: string;
  color?: string;
  size?: number;
  className?: string;
}) {
  const Comp = resolveAgentIcon(icon);
  return <Comp size={size} color={resolveAgentColor(color)} className={className} strokeWidth={2} />;
}

export function AgentIconTile({
  icon,
  color,
  size = 40,
}: {
  icon?: string;
  color?: string;
  size?: number;
}) {
  const c = resolveAgentColor(color);
  const Comp = resolveAgentIcon(icon);
  return (
    <span
      className="inline-flex items-center justify-center rounded-[10px]"
      style={{ width: size, height: size, background: `${c}1a`, border: `1px solid ${c}33` }}
    >
      <Comp size={Math.round(size * 0.5)} color={c} strokeWidth={2} />
    </span>
  );
}
