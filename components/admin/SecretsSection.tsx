"use client";
import * as React from "react";
import { KeyRound, Plus, Trash2, Layers, ShieldCheck, AlertTriangle, Check } from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Badge,
  Input,
  Field,
  Skeleton,
  EmptyState,
} from "@/components/ui";
import { Dialog, ConfirmDialog } from "@/components/ui/Dialog";
import { Table, THead, TR, TH, TD } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { Secrets, Models } from "@/lib/fleet/endpoints";
import { errMessage as errMsg } from "@/lib/fleet/client";
import type { SecretItem, FleetModel } from "@/lib/fleet/types";


/** Add / update a single secret. Value is write-only: type=password, cleared on submit, never echoed. */
function SetSecretDialog({
  open,
  onClose,
  onSaved,
  presetName,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  presetName?: string;
}) {
  const toast = useToast();
  const [name, setName] = React.useState("");
  const [value, setValue] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setName(presetName ?? "");
      setValue("");
    }
  }, [open, presetName]);

  const submit = async () => {
    const key = name.trim();
    if (!key || !value) return;
    setSaving(true);
    try {
      await Secrets.set(key, value);
      // Clear the secret value from memory immediately — never retained or echoed.
      setValue("");
      setName("");
      toast.success("Secret saved", `“${key}” has been set.`);
      onSaved();
      onClose();
    } catch (e) {
      toast.error("Could not save secret", errMsg(e));
    } finally {
      setValue(""); // defensive: ensure value never lingers
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={presetName ? `Set “${presetName}”` : "Add / update secret"}
      description="Values are write-only. Once saved, the value can never be read back — only overwritten."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving} disabled={!name.trim() || !value}>
            Save secret
          </Button>
        </>
      }
    >
      <Field label="Name" hint="The secret key, e.g. OPENAI_API_KEY.">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="OPENAI_API_KEY"
          disabled={!!presetName}
          autoFocus={!presetName}
        />
      </Field>
      <Field label="Value" hint="Stored encrypted upstream and never displayed again.">
        <Input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="••••••••••••••••"
          autoComplete="new-password"
          autoFocus={!!presetName}
        />
      </Field>
    </Dialog>
  );
}

/** Bulk edit secrets: one row per key. Empty value with the row marked "delete" sends value:null. */
type BulkRow = { key: string; value: string; remove: boolean };

function BulkEditDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [rows, setRows] = React.useState<BulkRow[]>([{ key: "", value: "", remove: false }]);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) setRows([{ key: "", value: "", remove: false }]);
  }, [open]);

  const update = (i: number, patch: Partial<BulkRow>) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const addRow = () => setRows((r) => [...r, { key: "", value: "", remove: false }]);
  const dropRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));

  const submit = async () => {
    const items = rows
      .filter((r) => r.key.trim())
      .map((r) => ({ key: r.key.trim(), value: r.remove ? null : r.value }))
      // ignore set-rows with empty value (nothing to set) but keep delete-rows
      .filter((r) => r.value === null || r.value !== "");
    if (!items.length) {
      toast.info("Nothing to apply", "Add a key with a value, or mark a row to delete.");
      return;
    }
    setSaving(true);
    try {
      await Secrets.bulk(items);
      // Wipe any secret values from local state right away.
      setRows([{ key: "", value: "", remove: false }]);
      const sets = items.filter((i) => i.value !== null).length;
      const dels = items.length - sets;
      toast.success("Bulk update applied", `${sets} set · ${dels} deleted.`);
      onSaved();
      onClose();
    } catch (e) {
      toast.error("Bulk update failed", errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title="Bulk edit secrets"
      description="Set multiple secrets at once. Mark a row “delete” to remove that key (sends value: null)."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            Apply changes
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              className="flex-1"
              placeholder="KEY_NAME"
              value={row.key}
              onChange={(e) => update(i, { key: e.target.value })}
            />
            <Input
              className="flex-1"
              type="password"
              autoComplete="new-password"
              placeholder={row.remove ? "— will be deleted —" : "value"}
              value={row.remove ? "" : row.value}
              disabled={row.remove}
              onChange={(e) => update(i, { value: e.target.value })}
            />
            <label className="flex shrink-0 items-center gap-1.5 text-[12px] text-ink-soft">
              <input
                type="checkbox"
                checked={row.remove}
                onChange={(e) => update(i, { remove: e.target.checked })}
                className="dm-focus h-4 w-4 rounded border-line-strong accent-[var(--color-bad)]"
              />
              delete
            </label>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => dropRow(i)}
              disabled={rows.length === 1}
              aria-label="Remove row"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button variant="ghost" size="sm" className="mt-3" onClick={addRow}>
        <Plus className="h-4 w-4" /> Add row
      </Button>
    </Dialog>
  );
}

export function SecretsSection() {
  const toast = useToast();
  const [secrets, setSecrets] = React.useState<SecretItem[] | null>(null);
  const [models, setModels] = React.useState<FleetModel[] | null>(null);
  const [loading, setLoading] = React.useState(true);

  const [setDialog, setSetDialog] = React.useState<{ open: boolean; presetName?: string }>({ open: false });
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [confirmDel, setConfirmDel] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [allSecrets, m] = await Promise.all([
        // page_size caps at 100 — page through to collect every secret name.
        (async () => {
          const items: SecretItem[] = [];
          let cursor: string | undefined;
          do {
            const page = await Secrets.list({ page_size: 100, cursor });
            items.push(...page.items);
            cursor = page.next_cursor ?? undefined;
          } while (cursor);
          return items;
        })(),
        // Models inform the cross-check panel; tolerate failure independently.
        Models.list({ include_oss_models: true }).catch(() => ({ items: [] as FleetModel[] })),
      ]);
      setSecrets(allSecrets);
      setModels(m.items);
    } catch (e) {
      toast.error("Could not load secrets", errMsg(e));
      setSecrets([]);
      setModels([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Set of secret names that are present (set === true, or simply listed).
  const presentNames = React.useMemo(
    () => new Set((secrets ?? []).filter((s) => s.set !== false).map((s) => s.name)),
    [secrets],
  );

  // Cross-check: union of required_secrets across all models.
  const requiredSecrets = React.useMemo(() => {
    const set = new Set<string>();
    for (const m of models ?? []) for (const r of m.required_secrets ?? []) set.add(r);
    return [...set].sort();
  }, [models]);

  const missingCount = requiredSecrets.filter((r) => !presentNames.has(r)).length;

  const onDelete = async () => {
    if (!confirmDel) return;
    setDeleting(true);
    try {
      await Secrets.remove(confirmDel);
      toast.success("Secret deleted", `“${confirmDel}” removed.`);
      setConfirmDel(null);
      void load();
    } catch (e) {
      toast.error("Could not delete secret", errMsg(e));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Model API keys cross-check panel */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-[18px] w-[18px] text-navy-400" />
            <CardTitle>Model API keys</CardTitle>
          </div>
          {requiredSecrets.length > 0 &&
            (missingCount === 0 ? (
              <Badge tone="good">
                <Check className="h-3 w-3" /> All set
              </Badge>
            ) : (
              <Badge tone="warn">
                <AlertTriangle className="h-3 w-3" /> {missingCount} missing
              </Badge>
            ))}
        </CardHeader>
        <CardBody>
          <p className="mb-3 text-[13px] text-ink-faint">
            Secrets every model in the catalog expects. We cross-check the names against what&apos;s set in this
            workspace — values are never read.
          </p>
          {loading ? (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-7 w-40" />
              ))}
            </div>
          ) : requiredSecrets.length === 0 ? (
            <p className="text-sm text-ink-faint">No models declare required secrets.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {requiredSecrets.map((name) => {
                const present = presentNames.has(name);
                return (
                  <span
                    key={name}
                    className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-paper-2/60 py-1 pl-2.5 pr-1.5 text-[12px]"
                  >
                    <code className="font-mono text-ink-soft">{name}</code>
                    {present ? (
                      <Badge tone="good">
                        <Check className="h-3 w-3" /> set
                      </Badge>
                    ) : (
                      <button
                        onClick={() => setSetDialog({ open: true, presetName: name })}
                        className="dm-focus rounded-full"
                        title={`Set ${name}`}
                      >
                        <Badge tone="warn" className="cursor-pointer hover:brightness-95">
                          <AlertTriangle className="h-3 w-3" /> missing · set
                        </Badge>
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Secrets table */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="h-[18px] w-[18px] text-navy-400" />
            <CardTitle>Workspace secrets</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setBulkOpen(true)}>
              <Layers className="h-4 w-4" /> Bulk edit
            </Button>
            <Button size="sm" onClick={() => setSetDialog({ open: true })}>
              <Plus className="h-4 w-4" /> Add / update secret
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <p className="mb-3 inline-flex items-center gap-1.5 rounded-md bg-paper-2/70 px-2.5 py-1.5 text-[12px] text-ink-soft">
            <ShieldCheck className="h-3.5 w-3.5 text-good" />
            Names only. Secret values are write-only and never displayed.
          </p>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (secrets?.length ?? 0) === 0 ? (
            <EmptyState
              icon={<KeyRound className="h-7 w-7" />}
              title="No secrets yet"
              description="Like the supply closet before an order — empty. Add an API key to get your models running."
              action={
                <Button size="sm" onClick={() => setSetDialog({ open: true })}>
                  <Plus className="h-4 w-4" /> Add secret
                </Button>
              }
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <tbody>
                {secrets!.map((s) => (
                  <TR key={s.name}>
                    <TD>
                      <code className="font-mono text-[13px] text-ink">{s.name}</code>
                    </TD>
                    <TD>
                      {s.set === false ? (
                        <Badge tone="warn">not set</Badge>
                      ) : (
                        <Badge tone="good">
                          <Check className="h-3 w-3" /> set
                        </Badge>
                      )}
                    </TD>
                    <TD className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSetDialog({ open: true, presetName: s.name })}
                        >
                          Update
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${s.name}`}
                          onClick={() => setConfirmDel(s.name)}
                        >
                          <Trash2 className="h-4 w-4 text-bad" />
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </CardBody>
      </Card>

      <SetSecretDialog
        open={setDialog.open}
        presetName={setDialog.presetName}
        onClose={() => setSetDialog({ open: false })}
        onSaved={load}
      />
      <BulkEditDialog open={bulkOpen} onClose={() => setBulkOpen(false)} onSaved={load} />
      <ConfirmDialog
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        onConfirm={onDelete}
        title="Delete secret?"
        message={
          <>
            This permanently removes <code className="font-mono text-ink">{confirmDel}</code> from the workspace.
            Any model or agent relying on it will stop working.
          </>
        }
        confirmLabel="Delete"
        danger
        loading={deleting}
      />
    </div>
  );
}
