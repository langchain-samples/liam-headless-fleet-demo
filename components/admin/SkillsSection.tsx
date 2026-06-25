"use client";
import * as React from "react";
import { BookOpen, Plus, Trash2, FileText, Pencil } from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Badge,
  Input,
  Textarea,
  Field,
  Skeleton,
  EmptyState,
  cn,
} from "@/components/ui";
import { Dialog, ConfirmDialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { Skills } from "@/lib/fleet/endpoints";
import { errMessage as errMsg } from "@/lib/fleet/client";
import type { Skill, SkillFileEntry, CreateSkillRequest } from "@/lib/fleet/types";

const DEMO_PREFIX = "dm-demo-";


function ownerNames(s: Skill): string {
  const names = (s.owners ?? []).map((o) => o.full_name || o.email).filter(Boolean) as string[];
  return names.length ? names.join(", ") : "—";
}

type FileRow = { path: string; content: string };

/** Create a new skill: name + a SKILL.md editor plus optional extra path→content rows. */
function CreateSkillDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [name, setName] = React.useState("");
  const [skillMd, setSkillMd] = React.useState("");
  const [extra, setExtra] = React.useState<FileRow[]>([]);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setName("");
      setSkillMd("# Skill\n\nDescribe what this skill does and when to use it.\n");
      setExtra([]);
    }
  }, [open]);

  const addRow = () => setExtra((r) => [...r, { path: "", content: "" }]);
  const updRow = (i: number, patch: Partial<FileRow>) =>
    setExtra((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const dropRow = (i: number) => setExtra((r) => r.filter((_, idx) => idx !== i));

  const submit = async () => {
    const raw = name.trim();
    if (!raw) return;
    const finalName = raw.startsWith(DEMO_PREFIX) ? raw : `${DEMO_PREFIX}${raw}`;
    const files: Record<string, SkillFileEntry> = {
      "SKILL.md": { type: "file", content: skillMd },
    };
    for (const row of extra) {
      const path = row.path.trim();
      if (path) files[path] = { type: "file", content: row.content };
    }
    setSaving(true);
    try {
      const body: CreateSkillRequest = { name: finalName, files };
      await Skills.create(body);
      toast.success("Skill created", finalName);
      onSaved();
      onClose();
    } catch (e) {
      toast.error("Could not create skill", errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="xl"
      title="Create skill"
      description={`A “${DEMO_PREFIX}” prefix is added automatically so demo skills are easy to find.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving} disabled={!name.trim()}>
            Create skill
          </Button>
        </>
      }
    >
      <Field label="Name">
        <div className="flex items-center gap-2">
          <span className="rounded-l-[10px] border border-r-0 border-line-strong bg-paper-2 px-2.5 py-2 font-mono text-[13px] text-ink-faint">
            {DEMO_PREFIX}
          </span>
          <Input
            className="rounded-l-none"
            value={name.startsWith(DEMO_PREFIX) ? name.slice(DEMO_PREFIX.length) : name}
            onChange={(e) => setName(e.target.value)}
            placeholder="paper-quote-helper"
            autoFocus
          />
        </div>
      </Field>
      <Field label="SKILL.md" hint="The skill definition. Markdown describing the capability.">
        <Textarea
          className="min-h-[180px]"
          value={skillMd}
          onChange={(e) => setSkillMd(e.target.value)}
        />
      </Field>
      <Field label="Additional files" hint="Optional. Add supporting files by path.">
        <div className="space-y-3">
          {extra.map((row, i) => (
            <div key={i} className="rounded-[10px] border border-line p-3">
              <div className="mb-2 flex items-center gap-2">
                <Input
                  className="flex-1"
                  placeholder="path/to/file.md"
                  value={row.path}
                  onChange={(e) => updRow(i, { path: e.target.value })}
                />
                <Button variant="ghost" size="icon" aria-label="Remove file" onClick={() => dropRow(i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <Textarea
                placeholder="File contents…"
                value={row.content}
                onChange={(e) => updRow(i, { content: e.target.value })}
              />
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={addRow}>
            <Plus className="h-4 w-4" /> Add file
          </Button>
        </div>
      </Field>
    </Dialog>
  );
}

/** View a skill's file tree + content, with sparse edit (set content; delete = null). */
function SkillDetailDialog({
  skill,
  open,
  onClose,
  onSaved,
}: {
  skill: Skill | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [detail, setDetail] = React.useState<Skill | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [activePath, setActivePath] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open || !skill) return;
    setEditing(false);
    setDetail(null);
    setActivePath(null);
    setLoading(true);
    Skills.get(skill.id)
      .then((full) => {
        setDetail(full);
        const paths = Object.keys(full.files ?? {});
        setActivePath(paths.includes("SKILL.md") ? "SKILL.md" : (paths[0] ?? null));
      })
      .catch((e) => toast.error("Could not load skill", errMsg(e)))
      .finally(() => setLoading(false));
  }, [open, skill, toast]);

  const files = detail?.files ?? {};
  const paths = Object.keys(files).sort();
  const activeContent = activePath ? (files[activePath]?.content ?? "") : "";

  const startEdit = () => {
    setDraft(activeContent);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!detail || !activePath) return;
    setSaving(true);
    try {
      const updated = await Skills.update(detail.id, {
        files: { [activePath]: { type: "file", content: draft } },
      });
      setDetail(updated);
      setEditing(false);
      toast.success("Skill updated", activePath);
      onSaved();
    } catch (e) {
      toast.error("Could not save file", errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const deleteFile = async (path: string) => {
    if (!detail) return;
    try {
      // Sparse patch: a path set to null deletes it.
      const updated = await Skills.update(detail.id, { files: { [path]: null } });
      setDetail(updated);
      const remaining = Object.keys(updated.files ?? {});
      setActivePath(remaining[0] ?? null);
      toast.success("File removed", path);
      onSaved();
    } catch (e) {
      toast.error("Could not remove file", errMsg(e));
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="xl"
      title={skill?.name ?? "Skill"}
      description={skill?.description}
    >
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : paths.length === 0 ? (
        <p className="text-sm text-ink-faint">This skill has no files.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
          <div className="space-y-1 sm:border-r sm:border-line sm:pr-3">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Files</p>
            {paths.map((p) => (
              <div key={p} className="group flex items-center gap-1">
                <button
                  onClick={() => {
                    setActivePath(p);
                    setEditing(false);
                  }}
                  className={cn(
                    "dm-focus flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[13px]",
                    activePath === p ? "bg-navy text-white" : "text-ink-soft hover:bg-paper-2",
                  )}
                >
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate font-mono">{p}</span>
                </button>
                {paths.length > 1 && (
                  <button
                    onClick={() => deleteFile(p)}
                    className="dm-focus rounded p-1 text-ink-faint opacity-0 hover:bg-paper-2 hover:text-bad group-hover:opacity-100"
                    aria-label={`Delete ${p}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="min-w-0">
            <div className="mb-2 flex items-center justify-between">
              <code className="font-mono text-[12px] text-ink-faint">{activePath}</code>
              {editing ? (
                <div className="flex gap-1.5">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={saveEdit} loading={saving}>
                    Save
                  </Button>
                </div>
              ) : (
                <Button variant="ghost" size="sm" onClick={startEdit} disabled={!activePath}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
              )}
            </div>
            {editing ? (
              <Textarea
                className="min-h-[320px]"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
            ) : (
              <pre className="max-h-[420px] overflow-auto rounded-[10px] border border-line bg-paper-2/50 p-3 font-mono text-[12px] leading-relaxed text-ink-soft whitespace-pre-wrap">
                {activeContent || "(empty file)"}
              </pre>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}

export function SkillsSection() {
  const toast = useToast();
  const [skills, setSkills] = React.useState<Skill[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [detail, setDetail] = React.useState<Skill | null>(null);
  const [confirmDel, setConfirmDel] = React.useState<Skill | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await Skills.list({ include: ["files"], page_size: 200 });
      setSkills(res.items);
    } catch (e) {
      toast.error("Could not load skills", errMsg(e));
      setSkills([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const onDelete = async () => {
    if (!confirmDel) return;
    setDeleting(true);
    try {
      await Skills.remove(confirmDel.id);
      toast.success("Skill deleted", confirmDel.name);
      setConfirmDel(null);
      void load();
    } catch (e) {
      toast.error("Could not delete skill", errMsg(e));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-[18px] w-[18px] text-navy-400" />
          <CardTitle>Skills</CardTitle>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Create skill
        </Button>
      </CardHeader>
      <CardBody>
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : (skills?.length ?? 0) === 0 ? (
          <EmptyState
            icon={<BookOpen className="h-7 w-7" />}
            title="No skills yet"
            description="A skill is a reusable playbook for your agents. Write one up — think of it as the training manual nobody read."
            action={
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" /> Create skill
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {skills!.map((s) => {
              const fileCount = Object.keys(s.files ?? {}).length;
              return (
                <Card
                  key={s.id}
                  className="cursor-pointer transition-shadow hover:shadow-md"
                  onClick={() => setDetail(s)}
                >
                  <CardBody className="pt-5">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="truncate font-semibold text-ink">{s.name}</h4>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${s.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDel(s);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-bad" />
                      </Button>
                    </div>
                    {s.description && (
                      <p className="mt-1 line-clamp-2 text-[13px] text-ink-faint">{s.description}</p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      {s.visibility && <Badge tone="navy">{s.visibility}</Badge>}
                      {fileCount > 0 && (
                        <Badge tone="neutral">
                          {fileCount} file{fileCount === 1 ? "" : "s"}
                        </Badge>
                      )}
                      {s.commit_hash && (
                        <Badge tone="neutral">
                          <code className="font-mono">{s.commit_hash.slice(0, 7)}</code>
                        </Badge>
                      )}
                    </div>
                    <p className="mt-2 truncate text-[12px] text-ink-faint">Owners: {ownerNames(s)}</p>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </CardBody>

      <CreateSkillDialog open={createOpen} onClose={() => setCreateOpen(false)} onSaved={load} />
      <SkillDetailDialog
        skill={detail}
        open={!!detail}
        onClose={() => setDetail(null)}
        onSaved={load}
      />
      <ConfirmDialog
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        onConfirm={onDelete}
        title="Delete skill?"
        message={
          <>
            Permanently delete <span className="font-medium text-ink">{confirmDel?.name}</span> and all its files?
          </>
        }
        confirmLabel="Delete"
        danger
        loading={deleting}
      />
    </Card>
  );
}
