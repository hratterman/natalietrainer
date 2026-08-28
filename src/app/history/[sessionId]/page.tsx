import { redirect } from "next/navigation";

export default async function HistoryDetailPage({ params }: PageProps<"/history/[sessionId]">) {
  const { sessionId } = await params;
  // The debrief page already renders the full read-only review.
  redirect(`/train/${sessionId}/debrief`);
}
