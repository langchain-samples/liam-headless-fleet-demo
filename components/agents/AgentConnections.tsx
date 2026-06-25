"use client";
// Manage the OAuth connections (provider-account tokens) an agent can act with.
// Lists, attaches (from the caller's auth-tokens), and removes connections.
import * as React from "react";
import { Trash2, Plus, Link2 } from "lucide-react";
import { Button, Spinner, EmptyState, Select, useToast } from "@/components/ui";
import { Table, THead, TR, TH, TD } from "@/components/ui/Table";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Agents, Auth } from "@/lib/fleet/endpoints";
import { errMessage as errMsg } from "@/lib/fleet/client";
import type { Connection, TokenSummary } from "@/lib/fleet/types";
import { fmtDate } from "./helpers";


export function AgentConnections({ agentId }: { agentId: string }) {
  const toast = useToast();
  const [items, setItems] = React.useState<Connection[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [confirmId, setConfirmId] = React.useState<string | null>(null);

  // Attach flow.
  const [tokens, setTokens] = React.useState<TokenSummary[]>([]);
  const [attachId, setAttachId] = React.useState("");
  const [attaching, setAttaching] = React.useState(false);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const res = await Agents.connections.list(agentId);
      setItems(res.items ?? []);
    } catch (e) {
      setError(errMsg(e, "Couldn't load connections."));
      setItems([]);
    }
  }, [agentId]);

  React.useEffect(() => {
    load();
    Auth.tokens
      .list()
      .then((r) => setTokens(r.items ?? []))
      .catch(() => {});
  }, [load]);

  async function attach() {
    if (!attachId) return;
    setAttaching(true);
    try {
      await Agents.connections.create(agentId, { auth_token_id: attachId });
      toast.success("Connection added");
      setAttachId("");
      await load();
    } catch (e) {
      toast.error("Couldn't add connection", errMsg(e));
    } finally {
      setAttaching(false);
    }
  }

  async function remove(cid: string) {
    setRemovingId(cid);
    try {
      await Agents.connections.remove(agentId, cid);
      setItems((prev) => (prev ? prev.filter((c) => c.id !== cid) : prev));
      toast.success("Connection removed");
    } catch (e) {
      toast.error("Couldn't remove connection", errMsg(e));
    } finally {
      setRemovingId(null);
      setConfirmId(null);
    }
  }

  // Tokens not already attached.
  const attachedTokenIds = new Set((items ?? []).map((c) => c.auth_token_id).filter(Boolean));
  const availableTokens = tokens.filter((t) => !attachedTokenIds.has(t.id));

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-ink-faint">
        Connect provider accounts (OAuth tokens) so this agent can act on your behalf — e.g. send
        email or post to Slack.
      </p>

      {/* attach control */}
      {availableTokens.length > 0 && (
        <div className="flex items-center gap-2">
          <Select
            value={attachId}
            onChange={(e) => setAttachId(e.target.value)}
            aria-label="Choose a connection to attach"
            className="flex-1"
          >
            <option value="">Add an existing connection…</option>
            {availableTokens.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label || t.provider_slug || t.id}
                {t.provider_slug ? ` · ${t.provider_slug}` : ""}
              </option>
            ))}
          </Select>
          <Button type="button" variant="secondary" size="sm" onClick={attach} loading={attaching} disabled={!attachId}>
            <Plus className="h-3.5 w-3.5" />
            Attach
          </Button>
        </div>
      )}

      {items === null ? (
        <div className="flex items-center gap-2 text-sm text-ink-faint">
          <Spinner /> Loading connections…
        </div>
      ) : error ? (
        <EmptyState title="Couldn't load connections" description={error} className="border-0 bg-transparent" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Link2 className="h-7 w-7" />}
          title="No connections"
          description="This agent isn't linked to any provider accounts yet."
          className="border-0 bg-transparent"
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Account</TH>
              <TH>Provider</TH>
              <TH>Scopes</TH>
              <TH>Expires</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <tbody>
            {items.map((c) => (
              <TR key={c.id}>
                <TD className="text-ink">{c.provider_account_label || c.id}</TD>
                <TD className="font-mono text-[12px]">{c.provider_id || "—"}</TD>
                <TD>{c.scopes?.length ? <span className="text-[12px]">{c.scopes.join(", ")}</span> : "—"}</TD>
                <TD>{c.expires_at ? fmtDate(c.expires_at) : "—"}</TD>
                <TD className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={removingId === c.id}
                    onClick={() => setConfirmId(c.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </Button>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}

      <ConfirmDialog
        open={!!confirmId}
        onClose={() => !removingId && setConfirmId(null)}
        onConfirm={() => confirmId && remove(confirmId)}
        title="Remove connection?"
        message="The agent will lose access to this provider account."
        confirmLabel="Remove"
        danger
        loading={!!removingId}
      />
    </div>
  );
}
