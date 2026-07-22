import { AnalyticsWorkspaceGate } from "@/components/AnalyticsWorkspaceGate";
import { AnalyticsPipelinePage } from "@/features/analytics/AnalyticsPipelinePage";

export default async function AnalyticsProjectPipelinePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <AnalyticsWorkspaceGate><AnalyticsPipelinePage projectId={projectId} /></AnalyticsWorkspaceGate>;
}
