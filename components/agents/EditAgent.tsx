"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader, PageBody } from "@/components/brand/AppShell";
import { Card, CardBody, Skeleton, EmptyState, Button } from "@/components/ui";
import { AgentForm } from "@/components/agents/AgentForm";
import { Agents } from "@/lib/fleet/endpoints";
import { FleetClientError } from "@/lib/fleet/client";
import type { Agent } from "@/lib/fleet/types";

export function EditAgent({ id }: { id: string }) {
  const [agent, setAgent] = React.useState<Agent | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const a = await Agents.get(id, ["owner", "files"]);
        if (active) setAgent(a);
      } catch (e) {
        if (active)
          setError(
            e instanceof FleetClientError ? e.detail || e.message : "Couldn't load this agent.",
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <>
      <PageHeader
        title={agent ? `Edit ${agent.name}` : "Edit agent"}
        subtitle="Tune this agent's configuration."
        actions={
          <Link
            href={`/agents/${id}`}
            className="dm-focus inline-flex items-center gap-1.5 rounded text-[13px] text-ink-soft hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        }
      />
      <PageBody>
        {loading ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardBody className="space-y-3">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </CardBody>
                </Card>
              ))}
            </div>
            <div className="space-y-6">
              <Card>
                <CardBody>
                  <Skeleton className="h-24 w-full" />
                </CardBody>
              </Card>
            </div>
          </div>
        ) : error || !agent ? (
          <EmptyState
            title="Couldn't load agent"
            description={error || "This agent may have been deleted."}
            action={
              <Link href="/agents">
                <Button variant="secondary">Back to roster</Button>
              </Link>
            }
          />
        ) : (
          <AgentForm agent={agent} />
        )}
      </PageBody>
    </>
  );
}
