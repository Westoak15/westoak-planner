import { useState } from "react";
import { useSimulationResults } from "@/hooks/use-plans";
import { ScenarioComparison, ScenarioSummaryCards } from "./ScenarioComparison";
import { PercentileChartGrid } from "./PercentileChart";
import { SensitivityDisplay } from "./SensitivityDisplay";
import { ActionItemsPanel } from "./ActionItemsPanel";
import { SnapshotManager } from "./SnapshotManager";
import { AssumptionEditor } from "./AssumptionEditor";
import { BarChart3, Settings, TrendingUp, ListChecks, Camera, Activity } from "lucide-react";

type DashboardTab = "scenarios" | "charts" | "sensitivity" | "actions" | "snapshots" | "assumptions";

const dashTabs: Array<{ key: DashboardTab; label: string; icon: typeof BarChart3 }> = [
  { key: "scenarios", label: "Scenarios", icon: BarChart3 },
  { key: "charts", label: "Projections", icon: TrendingUp },
  { key: "sensitivity", label: "Sensitivity", icon: Activity },
  { key: "actions", label: "Action Items", icon: ListChecks },
  { key: "snapshots", label: "Snapshots", icon: Camera },
  { key: "assumptions", label: "Assumptions", icon: Settings },
];

export function SimulationDashboard({ planId }: { planId: number }) {
  const [activeTab, setActiveTab] = useState<DashboardTab>("scenarios");
  const { data: simResults = [] } = useSimulationResults(planId);

  const baseResults = simResults.filter(r => r.scenario === "Moderate");
  const hasResults = simResults.length > 0;

  return (
    <div className="space-y-6" data-testid="simulation-dashboard">
      {hasResults && <ScenarioSummaryCards planId={planId} />}

      <div className="flex gap-1 p-1 bg-muted/50 rounded-xl overflow-x-auto">
        {dashTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
              activeTab === tab.key
                ? "bg-white text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid={`button-dash-tab-${tab.key}`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="animate-in fade-in duration-200">
        {activeTab === "scenarios" && <ScenarioComparison planId={planId} />}
        {activeTab === "charts" && (
          <PercentileChartGrid results={baseResults.length > 0 ? baseResults : simResults.slice(0, 4)} />
        )}
        {activeTab === "sensitivity" && <SensitivityDisplay results={simResults} />}
        {activeTab === "actions" && <ActionItemsPanel planId={planId} />}
        {activeTab === "snapshots" && <SnapshotManager planId={planId} />}
        {activeTab === "assumptions" && <AssumptionEditor planId={planId} />}
      </div>
    </div>
  );
}
