"use client";
// Reusable OAuth connect flow, extracted from AuthorizeTab.tsx so the Connections
// catalog can drive it from a card's "Connect" button.
//
// Flow: create an auth session → if it returns a verification_url, open it in a new
// tab for the user to authorize → long-poll the session (server-side wait_seconds=25)
// until it reaches a terminal state, with a 5-minute client deadline and an
// AbortController so an unmount or a restart cancels cleanly.
import * as React from "react";
import { useToast } from "@/components/ui/Toast";
import { Auth } from "@/lib/fleet/endpoints";
import type { CreateSessionResponse } from "@/lib/fleet/types";
import { errMessage } from "./shared";

export type ConnectPhase = "idle" | "pending" | "success" | "failed" | "expired";

/** Defensively classify a session status string into a terminal phase. */
function classifyStatus(status?: string): Exclude<ConnectPhase, "idle"> {
  const s = (status || "").toLowerCase();
  if (/(success|complete|completed|authorized|active|done|ready|granted)/.test(s)) return "success";
  if (/(expire|timeout|timed_out)/.test(s)) return "expired";
  if (/(fail|error|denied|revoked|cancel|reject|invalid)/.test(s)) return "failed";
  return "pending";
}

export interface UseConnect {
  phase: ConnectPhase;
  /** The provider_slug currently being connected (null when idle). */
  activeSlug: string | null;
  verificationUrl: string | null;
  /** True when the browser blocked the auto-opened authorization popup. */
  popupBlocked: boolean;
  /** Start an OAuth authorization against a provider. */
  connect: (providerSlug: string, scopes?: string[]) => Promise<void>;
  /** Reset to idle and cancel any in-flight polling. */
  reset: () => void;
}

export function useConnect(onConnected: () => void): UseConnect {
  const toast = useToast();
  const [phase, setPhase] = React.useState<ConnectPhase>("idle");
  const [activeSlug, setActiveSlug] = React.useState<string | null>(null);
  const [verificationUrl, setVerificationUrl] = React.useState<string | null>(null);
  const [popupBlocked, setPopupBlocked] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);

  // Cancel in-flight polling on unmount.
  React.useEffect(() => () => abortRef.current?.abort(), []);

  const reset = React.useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase("idle");
    setActiveSlug(null);
    setVerificationUrl(null);
    setPopupBlocked(false);
  }, []);

  const poll = React.useCallback(
    async (id: string, signal: AbortSignal) => {
      const deadline = Date.now() + 5 * 60 * 1000; // 5-minute safety cap
      while (!signal.aborted && Date.now() < deadline) {
        let res;
        try {
          res = await Auth.sessions.get(id, 25); // server-side long-poll up to 25s
        } catch (e) {
          if (signal.aborted) return;
          setPhase("failed");
          toast.error("Lost contact with session", errMessage(e));
          return;
        }
        if (signal.aborted) return;
        const p = classifyStatus(res.status);
        if (p !== "pending") {
          setPhase(p);
          setVerificationUrl(null);
          if (p === "success") {
            toast.success("Connected", "Authorization complete.");
            onConnected();
          } else if (p === "failed") {
            toast.error("Authorization failed", res.status || "The provider rejected the request.");
          } else {
            toast.info("Session expired", "Start the connection again to retry.");
          }
          return;
        }
        // still pending: the long-poll already waited server-side, loop again.
      }
      if (!signal.aborted) {
        setPhase("expired");
        toast.info("Timed out", "Stopped waiting after 5 minutes.");
      }
    },
    [onConnected, toast],
  );

  const connect = React.useCallback(
    async (providerSlug: string, scopes?: string[]) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setActiveSlug(providerSlug);
      setVerificationUrl(null);
      setPopupBlocked(false);
      setPhase("pending");

      let created: CreateSessionResponse;
      try {
        created = await Auth.sessions.create({
          provider_slug: providerSlug,
          // The API requires `scopes` to always be present as an array
          // (empty [] is allowed; null/missing is rejected).
          scopes: scopes ?? [],
          strategy: "REUSE",
          is_default: true,
        });
      } catch (e) {
        setPhase("failed");
        toast.error("Couldn't start connection", errMessage(e));
        return;
      }
      if (ac.signal.aborted) return;

      const initial = classifyStatus(created.status);
      if (initial === "success") {
        setPhase("success");
        toast.success("Connected", "Already authorized.");
        onConnected();
        return;
      }

      if (created.verification_url) {
        setVerificationUrl(created.verification_url);
        // Open the provider's consent screen in a new tab. If the browser blocks
        // it (returns null / throws), flag it so the card surfaces the link to click.
        let win: Window | null = null;
        try {
          win = window.open(created.verification_url, "_blank", "noopener,noreferrer");
        } catch {
          win = null;
        }
        if (!win) setPopupBlocked(true);
      } else if (initial !== "pending") {
        setPhase(initial);
        return;
      }

      void poll(created.id, ac.signal);
    },
    [onConnected, poll, toast],
  );

  return { phase, activeSlug, verificationUrl, popupBlocked, connect, reset };
}
