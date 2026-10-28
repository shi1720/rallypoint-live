import { Viewer } from "@/components/rally/viewer";
export default async function WatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Viewer id={id} />;
}
