import { ThreadConsole } from "@/components/threads/ThreadConsole";

// Next.js 16: params is a Promise — await it, then hand the id to the client console.
export default async function ThreadDetailPage(props: PageProps<"/threads/[id]">) {
  const { id } = await props.params;
  return <ThreadConsole threadId={id} />;
}
