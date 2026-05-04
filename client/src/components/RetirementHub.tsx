import { useState } from "react";
import { PiggyBank, Building2, TrendingUp, Calendar } from "lucide-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HubShell } from "./insightled";
import { RetirementTab } from "./planning/RetirementProjectionForm";
import { PensionTab } from "../pages/PensionTab";

const queryClient = new QueryClient();

interface Props {
  clientId: number;
  client?: any;
  person: "primary" | "spouse" | "combined";
  onPersonChange: (p: "primary" | "spouse" | "combined") => void;
}

export function RetirementHub({ clientId, client, person, onPersonChange }: Props) {
  const [subtab, setSubtab] = useState<"projection" | "pension">("projection");
  const hasSpouse = !!client?.spouseFirstName;

  return (
    <QueryClientProvider client={queryClient}>
      <HubShell
        icon={PiggyBank}
        title="Retirement"
        subtitle={
          <>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Projection through age 95
            </span>
            <span>•</span>
            <span>Pension and savings under one roof</span>
          </>
        }
        subtabs={[
          { key: "projection", label: "Projection",  icon: TrendingUp, badgeTone: "cyan" },
          { key: "pension",    label: "Pension",     icon: Building2,  badgeTone: "purple" },
        ]}
        activeSubtab={subtab}
        onSubtabChange={(k) => setSubtab(k as "projection" | "pension")}
        personToggle={{
          person,
          onPersonChange,
          primaryLabel: client?.firstName ?? "Primary",
          spouseLabel: hasSpouse ? client.spouseFirstName : null,
          showCombined: true,
        }}
      >
        <div className="p-6">
          {subtab === "projection" && (
            <RetirementTab clientId={clientId} clientName={client?.firstName} />
          )}
          {subtab === "pension" && (
            <PensionTab clientId={clientId} client={client} person={person === "combined" ? "primary" : person} />
          )}
        </div>
      </HubShell>
    </QueryClientProvider>
  );
}
