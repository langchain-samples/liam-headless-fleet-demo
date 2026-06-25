import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader, PageBody } from "@/components/brand/AppShell";
import { AgentForm } from "@/components/agents/AgentForm";

export default function NewAgentManualPage() {
  return (
    <>
      <PageHeader
        title="New agent — manual"
        subtitle="Fill out the configuration yourself."
        actions={
          <Link
            href="/agents/new"
            className="dm-focus inline-flex items-center gap-1.5 rounded text-[13px] text-ink-soft hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" /> Build with AI
          </Link>
        }
      />
      <PageBody>
        <AgentForm />
      </PageBody>
    </>
  );
}
