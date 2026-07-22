import { AnalyticsWorkspaceGate } from "@/components/AnalyticsWorkspaceGate";
import { AnalyticsModelPage } from "@/features/analytics/AnalyticsModelPage";

export default async function AnalyticsProjectModelPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <AnalyticsWorkspaceGate><AnalyticsModelPage projectId={projectId} /></AnalyticsWorkspaceGate>;
}
