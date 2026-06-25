"use client";
// Workspace admin wrapper around the OAuth-providers manager. Providers are org-scoped
// plumbing (register/discover/edit/delete the OAuth recipes agents authorize against) —
// an admin concern, so it lives here under Workspace rather than on the user-facing
// Connections page. Owns the provider load state; renders the existing ProvidersTab.
import * as React from "react";
import { Auth } from "@/lib/fleet/endpoints";
import type { ProviderResponse } from "@/lib/fleet/types";
import { errMessage } from "@/components/connections/shared";
import { ProvidersTab } from "@/components/connections/ProvidersTab";

export function ProvidersSection() {
  const [providers, setProviders] = React.useState<ProviderResponse[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { items } = await Auth.providers.list();
      setProviders(items ?? []);
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  return <ProvidersTab providers={providers} loading={loading} error={error} reload={load} />;
}
