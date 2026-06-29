"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { KeyRound, CheckCircle2, ExternalLink } from "lucide-react";
import { Button, Card, CardBody, CardHeader, CardTitle, Field, Input, useToast } from "@/components/ui";
import { validateFleetKey } from "./actions";

// Settings — each user supplies their own LangSmith API key so the app acts as
// them (their own connections + run attribution). The key is validated
// server-side, then persisted into the session JWT via update(); it is never
// shown back or stored in the client-visible session.
export default function SettingsPage() {
  const { data: session, update } = useSession();
  const toast = useToast();
  const hasKey = Boolean(session?.user?.hasFleetKey);

  const [key, setKey] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await validateFleetKey(key);
      if (!res.ok) {
        setError(res.error ?? "Invalid key.");
        return;
      }
      // Persist into the JWT (jwt callback handles trigger==="update").
      await update({ fleetKey: key.trim() });
      setKey("");
      toast.success("API key saved", "You're now acting as yourself in Fleet.");
    } catch {
      setError("Something went wrong saving your key.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setSaving(true);
    setError(null);
    try {
      await update({ fleetKey: "" });
      toast.success("API key removed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8 sm:px-8">
      <header className="mb-6">
        <h1 className="font-serif text-2xl font-bold tracking-tight text-ink">Settings</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Connect your own LangSmith identity so agents run as you.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-ink-faint" />
            Your LangSmith API key
          </CardTitle>
        </CardHeader>
        <CardBody>
          {hasKey ? (
            <div className="mb-4 flex items-center gap-2 rounded-[8px] border border-good/30 bg-good-soft px-3 py-2 text-[13px] text-good">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>A key is set. Agents and threads run as you. Enter a new key below to replace it.</span>
            </div>
          ) : (
            <div className="mb-4 rounded-[8px] border border-warn/30 bg-warn-soft px-3 py-2 text-[13px] text-warn">
              No key set yet — set one to use agents and threads.
            </div>
          )}

          <form onSubmit={handleSave}>
            <Field label="LangSmith API key" hint="A personal key (lsv2_…) from LangSmith → Settings → API Keys, scoped to the Testing workspace. Stored encrypted; never shown to anyone.">
              <Input
                type="password"
                autoComplete="off"
                placeholder="lsv2_pt_………"
                value={key}
                onChange={(e) => setKey(e.target.value)}
              />
            </Field>

            <div className="mt-3 flex items-start gap-2 rounded-[8px] border border-navy-400/30 bg-paper-2 px-3 py-2.5 text-[12px] text-ink-soft">
              <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" />
              <span>
                The key must belong to the <span className="font-medium text-ink">Testing workspace</span>.
                If you don&apos;t have access, ask <span className="font-medium text-ink">Liam</span> (or
                another DE) to add you to it.
              </span>
            </div>

            {error && (
              <p role="alert" className="mt-2 rounded-[8px] border border-bad/30 bg-bad-soft px-3 py-2 text-[13px] text-bad">
                {error}
              </p>
            )}

            <div className="mt-4 flex items-center gap-2">
              <Button type="submit" loading={saving} disabled={!key.trim()}>
                Save & validate
              </Button>
              {hasKey && (
                <Button type="button" variant="secondary" onClick={handleRemove} disabled={saving}>
                  Remove key
                </Button>
              )}
            </div>
          </form>

          <a
            href="https://smith.langchain.com/settings"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-1 text-[12px] text-ink-faint underline decoration-line-strong underline-offset-2 hover:text-navy"
          >
            Get your LangSmith API key <ExternalLink className="h-3 w-3" />
          </a>
        </CardBody>
      </Card>
    </div>
  );
}
