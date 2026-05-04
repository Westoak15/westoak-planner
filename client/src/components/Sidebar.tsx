import {
  Users, LayoutDashboard, Scale, PiggyBank,
  Shield, GraduationCap, CreditCard, Receipt, ScrollText, Brain, ClipboardList,
  FileHeart, Settings, UserCheck, FileText, Target, Building2, Sparkles
} from "lucide-react";
import { cn } from "../lib/utils";

export type Tab =
  | "clients" | "dashboard"
  | "networth" | "retirement" | "insurance" | "fna"
  | "resp" | "expenses" | "tax" | "estate" | "ai"
  | "planning" | "reports" | "letters" | "goals" | "pension" | "admin" | "agents"
  | "financialplan";

interface Props {
  activeTab: Tab;
  onTab: (t: Tab) => void;
  clientName?: string;
  role?: string;
  level?: string;
}

const ALL_TABS: { key: Tab; label: string; icon: any; dividerBefore?: boolean; gaOnly?: boolean }[] = [
  { key: "admin",      label: "Admin",        icon: Settings, gaOnly: true }, 
  { key: "agents",     label: "Agents",       icon: UserCheck, dividerBefore: true, gaOnly: true }, 
  { key: "clients", label: "Clients", icon: Users },
  { key: "dashboard",  label: "Dashboard",    icon: LayoutDashboard, dividerBefore: true },
  { key: "networth",   label: "Net Worth",    icon: Scale },  
  { key: "goals",      label: "Goals",        icon: Target },
  { key: "pension",    label: "Pension",      icon: Building2 },
  { key: "retirement", label: "Retirement",   icon: PiggyBank },
  { key: "insurance",  label: "Policies",     icon: Shield },
  { key: "fna",        label: "FNA",          icon: FileHeart },
  { key: "resp",       label: "RESP",         icon: GraduationCap },
  { key: "expenses",   label: "Expenses",     icon: Receipt },
  { key: "tax",        label: "Tax",          icon: Receipt },
  { key: "estate",     label: "Estate",       icon: ScrollText },
  { key: "reports",    label: "Reports",      icon: FileText }, 
  { key: "letters",    label: "Letters",      icon: FileText },
  { key: "ai",         label: "AI Insights",  icon: Brain },
  { key: "planning",      label: "Full FP View",    icon: ClipboardList, dividerBefore: true },
  { key: "financialplan", label: "Financial Plan",   icon: Sparkles },

];

const STANDARD_TABS: Tab[] = ["clients", "networth", "insurance", "fna", "letters"];
const PLAN_TABS: Tab[] = ["dashboard","networth", "goals", "pension", "retirement","insurance", "expenses","fna","resp","tax","estate", "reports", "letters", "ai","planning","financialplan"];
const NO_CLIENT_TABS: Tab[] = ["clients", "admin", "agents"];

export function Sidebar({ activeTab, onTab, clientName, role, level }: Props) {
  const isGA = role === "ga";
  const isStandard = !isGA && level === "standard";

  const visibleTabs = ALL_TABS.filter(tab => {
    if (tab.gaOnly && !isGA) return false;
    if (isStandard && !STANDARD_TABS.includes(tab.key)) return false;
    return true;
  });

  return (
    <aside className="w-[160px] flex-shrink-0 flex flex-col select-none relative" style={{
      background: "linear-gradient(180deg, #0c1e3a 0%, #0e2a4a 60%, #0a3556 100%)"
    }}>
      {/* Depth overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />

      {/* Logo */}
      <div className="py-4 flex flex-col items-center border-b border-white/10 px-3 relative z-10">
        <img src="/koc-logo.png" alt="Knights of Columbus" className="w-20 h-20 object-contain mb-2" />
        <div className="text-white/60 font-medium text-[10px] tracking-wide text-center">Financial Planning Suite</div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 overflow-y-auto overflow-x-hidden relative z-10">
        {visibleTabs.map(tab => {
          const isActive = activeTab === tab.key;
          const disabled = PLAN_TABS.includes(tab.key) && !clientName && !NO_CLIENT_TABS.includes(tab.key);
          return (
            <div key={tab.key}>
              {tab.dividerBefore && <div className="mx-3 my-1.5 border-t border-white/10" />}
              <button
                onClick={() => !disabled && onTab(tab.key)}
                title={tab.label}
                disabled={disabled}
                className={cn(
                  "w-full flex items-center gap-2.5 py-2 px-3 rounded-lg mx-auto transition-all duration-200 relative group focus:outline-none",
                  isActive   ? "bg-white/10 text-white"
                  : disabled ? "text-white/20 cursor-not-allowed"
                  : "text-white/45 hover:text-white/80 hover:bg-white/5 hover:translate-x-[2px] cursor-pointer"
                )}
                style={{ width: "calc(100% - 12px)", marginLeft: "6px" }}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-cyan-400 rounded-r shadow-[0_0_10px_rgba(34,211,238,0.6)]" />
                )}
                <tab.icon className={cn("w-4 h-4 flex-shrink-0 transition-transform group-hover:scale-105", isActive && "text-cyan-400")} />
                <span className="text-[11px] font-medium leading-tight">{tab.label}</span>
              </button>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-white/10 relative z-10">
        {clientName && <div className="text-[9px] text-white/30 text-center truncate mb-1">{clientName}</div>}
        <div className="text-[9px] text-white/20 text-center uppercase tracking-wider">
          {isGA ? "General Agent" : `Field Agent${isStandard ? " · Standard" : " · Enhanced"}`}
        </div>
      </div>
    </aside>
  );
}


