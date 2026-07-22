import { AnalyticsWorkspaceGate } from "@/components/AnalyticsWorkspaceGate";
import { AnalyticsProjectsPage } from "@/features/analytics/AnalyticsProjectsPage";

export default function AnalyticsPage() {
  return <AnalyticsWorkspaceGate><AnalyticsProjectsPage /></AnalyticsWorkspaceGate>;
}
