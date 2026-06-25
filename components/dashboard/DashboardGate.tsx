"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { usePersona } from "@/lib/personas";
import { PageHeader, PageBody } from "@/components/brand/AppShell";
import { Dashboard } from "./Dashboard";
import { Spinner } from "@/components/ui";

/**
 * The dashboard is an admin-only overview. Non-admin personas are redirected to
 * their agents — they don't get a dashboard.
 */
export function DashboardGate() {
  const { isAdmin } = usePersona();
  const router = useRouter();

  React.useEffect(() => {
    if (!isAdmin) router.replace("/agents");
  }, [isAdmin, router]);

  if (!isAdmin) {
    return (
      <PageBody>
        <div className="flex items-center justify-center gap-2 py-20 text-ink-faint">
          <Spinner className="h-5 w-5" /> Taking you to your agents…
        </div>
      </PageBody>
    );
  }

  return (
    <>
      <PageHeader
        title="Admin Dashboard"
        subtitle="Admin overview — every employee and the agents they've built."
      />
      <PageBody>
        <Dashboard />
      </PageBody>
    </>
  );
}
