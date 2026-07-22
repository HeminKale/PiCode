import { AnalyticsPredictionsPage } from "@/features/analytics/AnalyticsPredictionsPage";

export default async function AnalyticsProjectPredictionsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <AnalyticsPredictionsPage projectId={projectId} />;
}
