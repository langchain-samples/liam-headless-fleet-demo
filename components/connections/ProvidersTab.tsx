"use client";
import * as React from "react";
import { KeyRound, Pencil, Plug, Sparkles, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  Input,
} from "@/components/ui";
import { Dialog, ConfirmDialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { Auth } from "@/lib/fleet/endpoints";
import type {
  CreateProviderRequest,
  DiscoverProviderRequest,
  ProviderResponse,
} from "@/lib/fleet/types";
import { CopyButton, errMessage, fmtDate, LoadingRows, Mono, parseCsv } from "./shared";

/* ----------------------------- Register dialog ----------------------------- */
function RegisterDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);
  const [f, setF] = React.useState({
    provider_slug: "",
    name: "",
    client_id: "",
    client_secret: "",
    auth_url: "",
    token_url: "",
    uses_pkce: true,
    authorization_params: "",
    allowed_redirect_uris: "",
  });

  React.useEffect(() => {
    if (open)
      setF({
        provider_slug: "",
        name: "",
        client_id: "",
        client_secret: "",
        auth_url: "",
        token_url: "",
        uses_pkce: true,
        authorization_params: "",
        allowed_redirect_uris: "",
      });
  }, [open]);

  function parseParams(raw: string): Record<string, string> | undefined {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, string>;
      }
    } catch {
      /* fall through to error */
    }
    throw new Error("Authorization params must be a JSON object, e.g. {\"prompt\":\"consent\"}");
  }

  async function submit() {
    if (!f.provider_slug.trim()) {
      toast.error("Slug required", "Give the provider a unique slug.");
      return;
    }
    setBusy(true);
    try {
      const body: CreateProviderRequest = {
        provider_slug: f.provider_slug.trim(),
        name: f.name.trim() || undefined,
        client_id: f.client_id.trim() || undefined,
        client_secret: f.client_secret.trim() || undefined,
        auth_url: f.auth_url.trim() || undefined,
        token_url: f.token_url.trim() || undefined,
        uses_pkce: f.uses_pkce,
        authorization_params: parseParams(f.authorization_params),
        allowed_redirect_uris: parseCsv(f.allowed_redirect_uris).length
          ? parseCsv(f.allowed_redirect_uris)
          : undefined,
      };
      await Auth.providers.create(body);
      toast.success("Provider registered", `${body.provider_slug} is ready to authorize.`);
      onCreated();
      onClose();
    } catch (e) {
      toast.error("Couldn't register provider", errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Register an OAuth provider"
      description="Add credentials for an OAuth 2.0 provider so agents can connect on your behalf."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            Register provider
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        <Field label="Provider slug" hint="Unique id, e.g. github or notion">
          <Input
            value={f.provider_slug}
            onChange={(e) => setF({ ...f, provider_slug: e.target.value })}
            placeholder="github"
          />
        </Field>
        <Field label="Display name">
          <Input
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
            placeholder="GitHub"
          />
        </Field>
        <Field label="Client ID">
          <Input
            value={f.client_id}
            onChange={(e) => setF({ ...f, client_id: e.target.value })}
            placeholder="Iv1.abc123…"
          />
        </Field>
        <Field label="Client secret" hint="Stored server-side; leave blank for PKCE-only.">
          <Input
            type="password"
            value={f.client_secret}
            onChange={(e) => setF({ ...f, client_secret: e.target.value })}
            placeholder="••••••••"
            autoComplete="new-password"
          />
        </Field>
        <Field label="Authorization URL">
          <Input
            value={f.auth_url}
            onChange={(e) => setF({ ...f, auth_url: e.target.value })}
            placeholder="https://github.com/login/oauth/authorize"
          />
        </Field>
        <Field label="Token URL">
          <Input
            value={f.token_url}
            onChange={(e) => setF({ ...f, token_url: e.target.value })}
            placeholder="https://github.com/login/oauth/access_token"
          />
        </Field>
        <Field
          label="Allowed redirect URIs"
          hint="Comma-separated. Optional."
          className="sm:col-span-2"
        >
          <Input
            value={f.allowed_redirect_uris}
            onChange={(e) => setF({ ...f, allowed_redirect_uris: e.target.value })}
            placeholder="https://app.example.com/auth-callback/github"
          />
        </Field>
        <Field
          label="Authorization params (JSON)"
          hint='Optional extra query params, e.g. {"prompt":"consent"}'
          className="sm:col-span-2"
        >
          <Input
            value={f.authorization_params}
            onChange={(e) => setF({ ...f, authorization_params: e.target.value })}
            placeholder='{"prompt":"consent"}'
            className="font-mono text-[13px]"
          />
        </Field>
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
        <input
          type="checkbox"
          checked={f.uses_pkce}
          onChange={(e) => setF({ ...f, uses_pkce: e.target.checked })}
          className="dm-focus h-4 w-4 rounded border-line-strong accent-navy"
        />
        Use PKCE (recommended)
      </label>
    </Dialog>
  );
}

/* ----------------------------- Discover dialog ----------------------------- */
function DiscoverDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);
  const [f, setF] = React.useState({ mcp_server_url: "", provider_slug: "", name: "" });

  React.useEffect(() => {
    if (open) setF({ mcp_server_url: "", provider_slug: "", name: "" });
  }, [open]);

  async function submit() {
    if (!f.mcp_server_url.trim() || !f.provider_slug.trim()) {
      toast.error("Missing fields", "MCP server URL and provider slug are required.");
      return;
    }
    setBusy(true);
    try {
      const body: DiscoverProviderRequest = {
        mcp_server_url: f.mcp_server_url.trim(),
        provider_slug: f.provider_slug.trim(),
        name: f.name.trim() || undefined,
      };
      const res = await Auth.providers.discover(body);
      toast.success("Provider discovered", `${res.provider_slug} configured from MCP metadata.`);
      onCreated();
      onClose();
    } catch (e) {
      toast.error("Discovery failed", errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Discover from MCP server"
      description="Point us at an MCP server and we'll read its OAuth metadata to configure the provider automatically."
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="accent" onClick={submit} loading={busy}>
            Discover
          </Button>
        </>
      }
    >
      <Field label="MCP server URL">
        <Input
          value={f.mcp_server_url}
          onChange={(e) => setF({ ...f, mcp_server_url: e.target.value })}
          placeholder="https://mcp.example.com/sse"
        />
      </Field>
      <Field label="Provider slug" hint="A unique id for this provider.">
        <Input
          value={f.provider_slug}
          onChange={(e) => setF({ ...f, provider_slug: e.target.value })}
          placeholder="example"
        />
      </Field>
      <Field label="Display name">
        <Input
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
          placeholder="Example Co."
        />
      </Field>
      <p className="rounded-[10px] border border-line bg-paper-2/50 px-3 py-2 text-[12px] text-ink-faint">
        Discovery is idempotent — running it again on the same slug just refreshes the saved
        metadata, so it&apos;s safe to retry.
      </p>
    </Dialog>
  );
}

/* ----------------------------- Edit dialog ----------------------------- */
function EditDialog({
  provider,
  onClose,
  onSaved,
}: {
  provider: ProviderResponse | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);
  const [f, setF] = React.useState({
    name: "",
    client_id: "",
    client_secret: "",
    auth_url: "",
    token_url: "",
    uses_pkce: false,
  });

  React.useEffect(() => {
    if (provider)
      setF({
        name: provider.name ?? "",
        client_id: provider.client_id ?? "",
        client_secret: "",
        auth_url: provider.auth_url ?? "",
        token_url: provider.token_url ?? "",
        uses_pkce: !!provider.uses_pkce,
      });
  }, [provider]);

  async function submit() {
    if (!provider) return;
    setBusy(true);
    try {
      // Only send fields that changed — absent/null fields are left unchanged by the API.
      const body: Partial<CreateProviderRequest> = {};
      if (f.name.trim() !== (provider.name ?? "")) body.name = f.name.trim();
      if (f.client_id.trim() !== (provider.client_id ?? "")) body.client_id = f.client_id.trim();
      if (f.client_secret.trim()) body.client_secret = f.client_secret.trim();
      if (f.auth_url.trim() !== (provider.auth_url ?? "")) body.auth_url = f.auth_url.trim();
      if (f.token_url.trim() !== (provider.token_url ?? "")) body.token_url = f.token_url.trim();
      if (f.uses_pkce !== !!provider.uses_pkce) body.uses_pkce = f.uses_pkce;

      if (Object.keys(body).length === 0) {
        toast.info("Nothing to update", "No fields were changed.");
        onClose();
        return;
      }
      await Auth.providers.update(provider.provider_slug, body);
      toast.success("Provider updated", `${provider.provider_slug} saved.`);
      onSaved();
      onClose();
    } catch (e) {
      toast.error("Update failed", errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={!!provider}
      onClose={onClose}
      title={provider ? `Edit ${provider.provider_slug}` : "Edit provider"}
      description="Only changed fields are sent — blank credential fields are left untouched."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        <Field label="Display name" className="sm:col-span-2">
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Client ID">
          <Input value={f.client_id} onChange={(e) => setF({ ...f, client_id: e.target.value })} />
        </Field>
        <Field label="Client secret" hint="Leave blank to keep the current secret.">
          <Input
            type="password"
            value={f.client_secret}
            onChange={(e) => setF({ ...f, client_secret: e.target.value })}
            placeholder="••••••••"
            autoComplete="new-password"
          />
        </Field>
        <Field label="Authorization URL">
          <Input value={f.auth_url} onChange={(e) => setF({ ...f, auth_url: e.target.value })} />
        </Field>
        <Field label="Token URL">
          <Input value={f.token_url} onChange={(e) => setF({ ...f, token_url: e.target.value })} />
        </Field>
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
        <input
          type="checkbox"
          checked={f.uses_pkce}
          onChange={(e) => setF({ ...f, uses_pkce: e.target.checked })}
          className="dm-focus h-4 w-4 rounded border-line-strong accent-navy"
        />
        Use PKCE
      </label>
    </Dialog>
  );
}

/* ----------------------------- Provider card ----------------------------- */
function ProviderCard({
  p,
  onEdit,
  onDelete,
}: {
  p: ProviderResponse;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex items-start justify-between gap-3 pb-2">
        <div className="min-w-0">
          <CardTitle className="truncate">{p.name || p.provider_slug}</CardTitle>
          <div className="mt-1 flex items-center gap-2">
            <Mono>{p.provider_slug}</Mono>
            {p.uses_pkce && <Badge tone="navy">PKCE</Badge>}
            {p.provider_type && <Badge tone="neutral">{p.provider_type}</Badge>}
            {p.is_dynamic_client && <Badge tone="accent">dynamic</Badge>}
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Edit provider">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Delete provider">
            <Trash2 className="h-4 w-4 text-bad" />
          </Button>
        </div>
      </CardHeader>
      <CardBody className="space-y-1.5 pt-1 text-[12px]">
        {p.mcp_server_url && (
          <Row label="MCP">
            <Mono className="truncate">{p.mcp_server_url}</Mono>
          </Row>
        )}
        {p.auth_url && (
          <Row label="Auth">
            <Mono className="truncate">{p.auth_url}</Mono>
          </Row>
        )}
        {p.token_url && (
          <Row label="Token">
            <Mono className="truncate">{p.token_url}</Mono>
          </Row>
        )}
        <Row label="Created">
          <span className="text-ink-faint">{fmtDate(p.created_at)}</span>
        </Row>
      </CardBody>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="w-14 shrink-0 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
        {label}
      </span>
      <div className="min-w-0 flex-1 truncate">{children}</div>
    </div>
  );
}

/* ----------------------------- Tab ----------------------------- */
export function ProvidersTab({
  providers,
  loading,
  error,
  reload,
}: {
  providers: ProviderResponse[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}) {
  const toast = useToast();
  const [registerOpen, setRegisterOpen] = React.useState(false);
  const [discoverOpen, setDiscoverOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ProviderResponse | null>(null);
  const [deleting, setDeleting] = React.useState<ProviderResponse | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);

  async function doDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await Auth.providers.remove(deleting.provider_slug);
      toast.success("Provider deleted", `${deleting.provider_slug} removed; issued tokens revoked.`);
      setDeleting(null);
      reload();
    } catch (e) {
      toast.error("Delete failed", errMessage(e));
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-faint">
          OAuth providers your agents can connect to. Register one manually or discover it from an
          MCP server.
        </p>
        <div className="flex gap-2">
          <Button variant="accent" onClick={() => setDiscoverOpen(true)}>
            <Sparkles className="h-4 w-4" />
            Discover from MCP
          </Button>
          <Button onClick={() => setRegisterOpen(true)}>
            <KeyRound className="h-4 w-4" />
            Register provider
          </Button>
        </div>
      </div>

      {loading ? (
        <Card>
          <LoadingRows rows={3} cols={3} />
        </Card>
      ) : error ? (
        <EmptyState
          icon={<Plug className="h-8 w-8" />}
          title="Couldn't load providers"
          description={error}
          action={
            <Button variant="secondary" onClick={reload}>
              Try again
            </Button>
          }
        />
      ) : providers.length === 0 ? (
        <EmptyState
          icon={<Plug className="h-8 w-8" />}
          title="No providers yet"
          description="Like Michael's golden ticket idea, this only works once it's set up. Register a provider to get started."
          action={
            <Button onClick={() => setRegisterOpen(true)}>
              <KeyRound className="h-4 w-4" />
              Register provider
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {providers.map((p) => (
            <ProviderCard
              key={p.id}
              p={p}
              onEdit={() => setEditing(p)}
              onDelete={() => setDeleting(p)}
            />
          ))}
        </div>
      )}

      <RegisterDialog
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        onCreated={reload}
      />
      <DiscoverDialog
        open={discoverOpen}
        onClose={() => setDiscoverOpen(false)}
        onCreated={reload}
      />
      <EditDialog provider={editing} onClose={() => setEditing(null)} onSaved={reload} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={doDelete}
        title={`Delete ${deleting?.provider_slug ?? "provider"}?`}
        message="This permanently removes the provider. Any tokens already issued for it will be revoked and connected agents will lose access."
        confirmLabel="Delete provider"
        danger
        loading={deleteBusy}
      />

      <CalloutNote />
    </div>
  );
}

function CalloutNote() {
  return (
    <p className="mt-6 flex items-start gap-2 rounded-[10px] border border-line bg-paper-2/40 px-3.5 py-2.5 text-[12px] text-ink-faint">
      <span className="mt-0.5">
        <CopyButton value="POST /auth-callback/{slug}" label="" />
      </span>
      <span>
        After a user authorizes, the provider redirects to{" "}
        <code className="rounded bg-paper-2 px-1 py-0.5 font-mono text-[11px] text-ink-soft">
          POST /auth-callback/&#123;slug&#125;
        </code>{" "}
        to complete the exchange. That callback is handled by the Fleet backend — you don&apos;t need to
        implement it here.
      </span>
    </p>
  );
}
