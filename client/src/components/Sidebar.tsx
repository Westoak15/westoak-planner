import {
  Users, LayoutDashboard, Scale, PiggyBank,
  Shield, Receipt, Brain,
  Settings, UserCheck, FileText, Target, Sparkles
} from "lucide-react";
import { cn } from "../lib/utils";

export type Tab =
  | "admin" | "agents"
  | "clients" | "dashboard"
  | "networth" | "goals"
  | "retirementhub" | "protection"
  | "expenses"
  | "taxestate" | "ai"
  | "documents" | "fp";

interface Props {
  activeTab: Tab;
  onTab: (t: Tab) => void;
  clientName?: string;
  role?: string;
  level?: string;
}

const ALL_TABS: { key: Tab; label: string; icon: any; dividerBefore?: boolean; gaOnly?: boolean }[] = [
  { key: "admin",         label: "Admin",          icon: Settings, gaOnly: true },
  { key: "agents",        label: "Agents",         icon: UserCheck, dividerBefore: true, gaOnly: true },
  { key: "clients",       label: "Clients",        icon: Users },
  { key: "dashboard",     label: "Dashboard",      icon: LayoutDashboard, dividerBefore: true },
  { key: "networth",      label: "Net Worth",      icon: Scale },
  { key: "goals",         label: "Goals",          icon: Target },
  { key: "retirementhub", label: "Retirement",     icon: PiggyBank },
  { key: "protection",    label: "Protection",     icon: Shield },
  { key: "expenses",      label: "Cash Flow",      icon: Receipt },
  { key: "taxestate",     label: "Tax & Estate",   icon: Scale },
  { key: "ai",            label: "AI Insights",    icon: Brain },
  { key: "documents",     label: "Documents",      icon: FileText, dividerBefore: true },
  { key: "fp",            label: "Financial Plan", icon: Sparkles },
];

const STANDARD_TABS: Tab[] = ["clients", "networth", "protection", "documents"];
const PLAN_TABS: Tab[] = [
  "dashboard", "networth", "goals", "retirementhub", "protection",
  "expenses", "taxestate", "ai", "documents", "fp"
];
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
    <aside className="relative overflow-hidden w-64 flex-shrink-0 min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 border-r border-white/5 flex flex-col select-none">
      {/* Light bleed overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />

      {/* Logo */}
      <div className="relative py-5 flex flex-col items-center border-b border-white/10 px-4">
        <img src="/koc-logo.png" alt="Knights of Columbus" className="w-20 h-20 object-contain mb-2" />
        <div className="text-slate-400 font-medium text-[11px] tracking-wide text-center">Financial Planning Suite</div>
      </div>

      {/* Nav */}
      <nav className="relative flex-1 py-3 px-3 overflow-y-auto overflow-x-hidden space-y-0.5">
        {visibleTabs.map(tab => {
          const isActive = activeTab === tab.key;
          const disabled = PLAN_TABS.includes(tab.key) && !clientName && !NO_CLIENT_TABS.includes(tab.key);
          const Icon = tab.icon;
          return (
            <div key={tab.key}>
              {tab.dividerBefore && <div className="my-2 border-t border-white/5" />}
              <button
                onClick={() => !disabled && onTab(tab.key)}
                title={tab.label}
                disabled={disabled}
                className={cn(
                  "group relative w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 focus:outline-none",
                  isActive
                    ? "bg-white/5 text-white"
                    : disabled
                      ? "text-slate-600 cursor-not-allowed"
                      : "text-slate-400 hover:text-white hover:bg-white/5 hover:translate-x-[2px] cursor-pointer"
                )}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 bg-cyan-400 rounded-r shadow-[0_0_10px_rgba(34,211,238,0.6)]" />
                )}
                <Icon className={cn(
                  "w-4 h-4 flex-shrink-0 transition-transform group-hover:scale-110",
                  isActive ? "text-cyan-400" : "text-slate-400 group-hover:text-white"
                )} />
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="relative px-4 py-3 border-t border-white/10">
        {clientName && <div className="text-[10px] text-slate-400 text-center truncate mb-1">{clientName}</div>}
        <div className="text-[10px] text-slate-500 text-center uppercase tracking-wider">
          {isGA ? "General Agent" : `Field Agent${isStandard ? " · Standard" : " · Enhanced"}`}
        </div>
      </div>
    </aside>
  );
}
