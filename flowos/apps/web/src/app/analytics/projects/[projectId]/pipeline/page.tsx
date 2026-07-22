import { AnalyticsPipelinePage } from "@/features/analytics/AnalyticsPipelinePage";

export default async function AnalyticsProjectPipelinePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <AnalyticsPipelinePage projectId={projectId} />;
}
