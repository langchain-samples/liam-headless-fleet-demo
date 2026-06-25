import { AgentDetail } from "@/components/agents/AgentDetail";

export default async function AgentDetailPage(props: PageProps<"/agents/[id]">) {
  const { id } = await props.params;
  return <AgentDetail id={id} />;
}
