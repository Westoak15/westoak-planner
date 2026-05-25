import { useState } from "react";
import { translations, type T } from "../i18n/translations";
import { PiggyBank, Building2, TrendingUp, TrendingDown, Calendar, Sparkles } from "lucide-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HubShell } from "./insightled";
import { RetirementTab } from "./planning/RetirementProjectionForm";
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
            <RetirementTab clientId={clientId} clientName={client?.firstName} person={person} t={t} />
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
