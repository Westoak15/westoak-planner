import { useState } from "react";
import { Receipt, ScrollText, Scale } from "lucide-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HubShell } from "./insightled";
import { TaxTab, EstateNotesTab } from "../pages/FinancialPlanning";

const queryClient = new QueryClient();

interface Props {
  clientId: number;
  client?: any;
  person: "primary" | "spouse" | "combined";
  onPersonChange: (p: "primary" | "spouse" | "combined") => void;
}

export function TaxEstateHub({ clientId, client, person, onPersonChange }: Props) {
  const [subtab, setSubtab] = useState<"tax" | "estate">("tax");
  const hasSpouse = !!client?.spouseFirstName;

  return (
    <QueryClientProvider client={queryClient}>
      <HubShell
        icon={Scale}
        title="Tax & Estate"
        subtitle={
          <>
            <span>Tax planning notes</span>
            <span>•</span>
            <span>Will, POA & beneficiary status</span>
          </>
        }
        subtabs={[
          { key: "tax",    label: "Tax",    icon: Receipt,    badgeTone: "amber"  },
          { key: "estate", label: "Estate", icon: ScrollText, badgeTone: "purple" },
        ]}
        activeSubtab={subtab}
        onSubtabChange={(k) => setSubtab(k as "tax" | "estate")}
        personToggle={
          subtab === "tax"
            ? {
                person,
                onPersonChange,
                primaryLabel: client?.firstName ?? "Primary",
                spouseLabel: hasSpouse ? client.spouseFirstName : null,
                showCombined: true,
              }
            : undefined
        }
      >
        <div className="p-6">
          {subtab === "tax" && (
            <TaxTab clientId={clientId} client={client} person={person === "combined" ? "primary" : person} />
          )}
          {subtab === "estate" && (
            <EstateNotesTab clientId={clientId} planId={null} client={client} />
          )}
        </div>
      </HubShell>
    </QueryClientProvider>
  );
}
