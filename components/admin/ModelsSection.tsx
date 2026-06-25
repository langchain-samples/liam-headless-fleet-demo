"use client";
import * as React from "react";
import { Cpu, Check, AlertTriangle, Building2 } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Badge,
  Skeleton,
  EmptyState,
} from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { Models, Secrets } from "@/lib/fleet/endpoints";
import { errMessage as errMsg } from "@/lib/fleet/client";
import type { FleetModel, SecretItem } from "@/lib/fleet/types";


export function ModelsSection() {
  const toast = useToast();
  const [models, setModels] = React.useState<FleetModel[] | null>(null);
  const [secrets, setSecrets] = React.useState<SecretItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const [m, s] = await Promise.all([
          Models.list({ include_oss_models: true }),
          // Secrets inform the cross-check chips; tolerate failure independently.
          Secrets.list({ page_size: 200 }).catch(() => ({ items: [] as SecretItem[] })),
        ]);
        if (!active) return;
        setModels(m.items);
        setSecrets(s.items);
      } catch (e) {
        if (!active) return;
        toast.error("Could not load models", errMsg(e));
        setModels([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [toast]);

  const presentNames = React.useMemo(
    () => new Set(secrets.filter((s) => s.set !== false).map((s) => s.name)),
    [secrets],
  );

  const grouped = React.useMemo(() => {
    const map = new Map<string, FleetModel[]>();
    for (const m of models ?? []) {
      const key = m.provider || "other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [models]);

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu className="h-[18px] w-[18px] text-navy-400" />
          <CardTitle>Model catalog</CardTitle>
        </div>
        <Badge tone="neutral">read-only</Badge>
      </CardHeader>
      <CardBody>
        <p className="mb-4 text-[13px] text-ink-faint">
          Models available to this workspace, grouped by provider. Required-secret chips are cross-checked against
          what&apos;s set — green means the key is present, amber means it&apos;s missing.
        </p>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : (models?.length ?? 0) === 0 ? (
          <EmptyState
            icon={<Cpu className="h-7 w-7" />}
            title="No models available"
            description="The catalog came back empty. Check your workspace configuration."
          />
        ) : (
          <div className="space-y-6">
            {grouped.map(([provider, list]) => (
              <div key={provider}>
                <h4 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-faint">
                  {provider} · {list.length}
                </h4>
                <div className="space-y-2">
                  {list.map((m) => (
                    <div
                      key={m.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-line bg-paper-2/30 px-3.5 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-ink">{m.display_name || m.id}</span>
                          {m.is_default && <Badge tone="navy">default</Badge>}
                          {m.source && <Badge tone="neutral">{m.source}</Badge>}
                        </div>
                        <code className="font-mono text-[12px] text-ink-faint">{m.id}</code>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(m.required_secrets ?? []).length === 0 ? (
                          <span className="text-[12px] text-ink-faint">no secrets required</span>
                        ) : (
                          m.required_secrets!.map((req) => {
                            const present = presentNames.has(req);
                            return (
                              <Badge key={req} tone={present ? "good" : "warn"} title={req}>
                                {present ? (
                                  <Check className="h-3 w-3" />
                                ) : (
                                  <AlertTriangle className="h-3 w-3" />
                                )}
                                <code className="font-mono">{req}</code>
                              </Badge>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/**
 * Workspace info footer. Tenant lookup requires an org id we cannot read client-side,
 * so this stays graceful: it shows a static note rather than crashing or blocking.
 */
export function WorkspaceInfoFooter() {
  return (
    <div className="mt-6 flex items-center gap-2 rounded-[10px] border border-line bg-paper-2/40 px-4 py-3 text-[12px] text-ink-faint">
      <Building2 className="h-4 w-4 shrink-0" />
      <span>
        Workspace: <span className="font-medium text-ink-soft">Scranton Branch</span> · LangChain Inc. · Fleet.
        Tenant directory is unavailable with this key.
      </span>
    </div>
  );
}
