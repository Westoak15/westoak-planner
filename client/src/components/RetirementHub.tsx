import React from "react";
import { useState } from "react";
import { translations, type T } from "../i18n/translations";
import { PiggyBank, Building2, TrendingUp, TrendingDown, Calendar, Sparkles } from "lucide-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HubShell } from "./insightled";
import { RetirementTab } from "./planning/RetirementProjectionForm";
import { ScenarioComparisonPanel } from "./planning/ScenarioComparisonPanel";
import { PensionTab } from "../pages/PensionTab";
import { MeltdownTab } from "../pages/MeltdownTab";
import { RetirementStrategist } from "./planning/RetirementStrategist";


const queryClient = new QueryClient();

type Subtab = "projection" | "pension" | "meltdown" | "strategist";

interface Props {
  clientId: number;
  client?: any;
  person: "primary" | "spouse" | "combined";
  onPersonChange: (p: "primary" | "spouse" | "combined") => void;
  t?: T;
}

export function RetirementHub({ clientId, client, person, onPersonChange, t = translations.en }: Props) {
  const [comparing, setComparing] = React.useState(false);
  const [projections, setProjections] = React.useState<any[]>([]);

  React.useEffect(() => {
    import("../lib/api").then(({ api }) => {
      api.get<any[]>(`/api/clients/${clientId}/retirement`)
        .then(setProjections)
        .catch(() => {});
    });
  }, [clientId]);
  const [subtab, setSubtab] = useState<Subtab>("pension");
  const hasSpouse = !!client?.spouseFirstName;

  return (
    <QueryClientProvider client={queryClient}>
      <HubShell
        icon={PiggyBank}
        title={t.retirement.title}
        subtitle={
          <>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Projection through age 95
            </span>
            <span>•</span>
            <span>Pension, savings & meltdown strategy under one roof</span>
          </>
        }
        subtabs={[
          { key: "pension",    label: t.retirement.pension,     icon: Building2,    badgeTone: "purple" },
          { key: "meltdown",   label: "RRSP Meltdown", icon: TrendingDown, badge: "NEW", badgeTone: "cyan" },
          { key: "strategist", label: t.retirement.strategist, icon: Sparkles, badge: "AI", badgeTone: "purple" },
          { key: "projection", label: t.retirement.projection,  icon: TrendingUp,   badgeTone: "cyan" },
        ]}
        activeSubtab={subtab}
        onSubtabChange={(k) => setSubtab(k as Subtab)}
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
            <>
            <div className="flex justify-end px-6 pt-4">
              <button
                onClick={() => setComparing(true)}
                disabled={projections.length < 2}
                className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-gray-600"
                title={projections.length < 2 ? "Create at least 2 projections to compare" : "Compare scenarios side-by-side"}
              >
                ⇄ Compare Scenarios
                {projections.length >= 2 && (
                  <span className="bg-[#0c1e3a] text-white text-[10px] px-1.5 py-0.5 rounded-full">{projections.length}</span>
                )}
              </button>
            </div>
            <RetirementTab clientId={clientId} clientName={client?.firstName} person={person} t={t} />
            {comparing && (
              <ScenarioComparisonPanel
                clientId={clientId}
                projections={projections}
                onClose={() => setComparing(false)}
                t={t}
              />
            )}
          </>
          )}
          {subtab === "pension" && (
            <PensionTab clientId={clientId} client={client} person={person === "combined" ? "primary" : person} t={t} />
          )}
          {subtab === "meltdown" && (
            <MeltdownTab clientId={clientId} client={client} person={person} />
          )}
          {subtab === "strategist" && (
            <RetirementStrategist clientId={clientId} client={client} person={person} />
          )}
        </div>
      </HubShell>
    </QueryClientProvider>
  );
}
