"use client";
import * as React from "react";
import { PageHeader, PageBody } from "@/components/brand/AppShell";
import { Tabs } from "@/components/ui";
import { SecretsSection } from "@/components/admin/SecretsSection";
import { IntegrationsSection } from "@/components/admin/IntegrationsSection";
import { ProvidersSection } from "@/components/admin/ProvidersSection";
import { SkillsSection } from "@/components/admin/SkillsSection";
import { ModelsSection, WorkspaceInfoFooter } from "@/components/admin/ModelsSection";

type TabId = "secrets" | "integrations" | "providers" | "skills" | "models";

const TABS: { id: TabId; label: string }[] = [
  { id: "secrets", label: "Secrets" },
  { id: "integrations", label: "Integrations" },
  { id: "providers", label: "OAuth Providers" },
  { id: "skills", label: "Skills" },
  { id: "models", label: "Models" },
];

export default function AdminPage() {
  const [tab, setTab] = React.useState<TabId>("secrets");

  return (
    <>
      <PageHeader title="Workspace" subtitle="Secrets, integrations, OAuth providers, skills, and models." />
      <PageBody>
        <Tabs
          tabs={TABS}
          value={tab}
          onChange={(id) => setTab(id as TabId)}
          className="mb-6"
        />

        {tab === "secrets" && <SecretsSection />}
        {tab === "integrations" && <IntegrationsSection />}
        {tab === "providers" && <ProvidersSection />}
        {tab === "skills" && <SkillsSection />}
        {tab === "models" && (
          <>
            <ModelsSection />
            <WorkspaceInfoFooter />
          </>
        )}
      </PageBody>
    </>
  );
}
