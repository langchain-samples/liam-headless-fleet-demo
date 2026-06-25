import { EditAgent } from "@/components/agents/EditAgent";

export default async function EditAgentPage(props: PageProps<"/agents/[id]/edit">) {
  const { id } = await props.params;
  return <EditAgent id={id} />;
}
