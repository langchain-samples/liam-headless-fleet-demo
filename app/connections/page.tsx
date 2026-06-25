"use client";
import * as React from "react";
import { PageHeader, PageBody } from "@/components/brand/AppShell";
import { Auth } from "@/lib/fleet/endpoints";
import type { ProviderResponse, TokenSummary } from "@/lib/fleet/types";
import { errMessage } from "@/components/connections/shared";
import { ConnectionsCatalog } from "@/components/connections/ConnectionsCatalog";

export default function ConnectionsPage() {
  // Org-scoped providers (the OAuth recipes) + the caller's own tokens (their connections).
  // Both feed the catalog: providers decide what's connectable, tokens decide what's connected.
  const [providers, setProviders] = React.useState<ProviderResponse[]>([]);
  const [tokens, setTokens] = React.useState<TokenSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadTokens = React.useCallback(async () => {
    try {
      const { items } = await Auth.tokens.list();
      setTokens(items ?? []);
    } catch (e) {
      setError(errMessage(e));
    }
  }, []);

  const loadAll = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [provRes, tokRes] = await Promise.all([Auth.providers.list(), Auth.tokens.list()]);
      setProviders(provRes.items ?? []);
      setTokens(tokRes.items ?? []);
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadAll();
  }, [loadAll]);

  return (
    <>
      <PageHeader
        title="Connections"
        subtitle="Connect a service once — your agents can use it automatically."
      />
      <PageBody>
        <ConnectionsCatalog
          providers={providers}
          tokens={tokens}
          loading={loading}
          error={error}
          reloadTokens={loadTokens}
        />
      </PageBody>
    </>
  );
}
