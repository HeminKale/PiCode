import { AnalyticsModelPage } from "@/features/analytics/AnalyticsModelPage";

export default async function AnalyticsProjectModelPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <AnalyticsModelPage projectId={projectId} />;
}
