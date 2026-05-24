import { useState } from "react";
import { translations, type T } from "../i18n/translations";
import { Sparkles, ClipboardList, FileSpreadsheet } from "lucide-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HubShell } from "./insightled";
import { FinancialPlanTab } from "./planning/FinancialPlanTab";
import { FinancialPlanningContent } from "../pages/FinancialPlanning";

const queryClient = new QueryClient();

interface Props {
  clientId: number;
  client?: any;
}

export function FinancialPlanHub({ clientId, client, t = translations.en }: Props) {
  const [subtab, setSubtab] = useState<"summary" | "workflow">("summary");

  return (
    <QueryClientProvider client={queryClient}>
      <HubShell
        icon={Sparkles}
        title="Financial Plan"
        subtitle={
          <>
            <span>Plan summary</span>
            <span>•</span>
            <span>End-to-end planning workflow</span>
          </>
        }
        subtabs={[
          { key: "summary",  label: "Plan Summary",     icon: FileSpreadsheet, badgeTone: "cyan"   },
          { key: "workflow", label: "Detailed Workflow", icon: ClipboardList,   badgeTone: "purple" },
        ]}
        activeSubtab={subtab}
        onSubtabChange={(k) => setSubtab(k as "summary" | "workflow")}
      >
        <div className={subtab === "summary" ? "p-6" : ""}>
          {subtab === "summary" && (
            <FinancialPlanTab t={t} clientId={clientId} clientName={client?.firstName} />
          )}
          {subtab === "workflow" && (
            <FinancialPlanningContent initialClientId={clientId} />
          )}
        </div>
      </HubShell>
    </QueryClientProvider>
  );
}
