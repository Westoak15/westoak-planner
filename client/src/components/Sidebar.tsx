import {
  Users, LayoutDashboard, Scale, PiggyBank,
  Shield, Receipt, Brain,
  Settings, UserCheck, FileText, Target, Sparkles
} from "lucide-react";
import { cn } from "../lib/utils";

export type Tab =
  | "admin" | "agents"
  | "clients" | "overview" | "dashboard"
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
  { key: "overview",      label: "Overview",       icon: LayoutDashboard, dividerBefore: true },
  { key: "dashboard",     label: "Dashboard",      icon: LayoutDashboard },
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
  "overview", "dashboard", "networth", "goals", "retirementhub", "protection",
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
    <aside className="w-64 flex-shrink-0 min-h-screen bg-slate-50 border-r border-slate-200 flex flex-col select-none">

      {/* Logo */}
      <div className="p-4 flex flex-col items-center gap-2 border-b border-slate-200">
        <img src="/koc-logo.png" alt="Knights of Columbus" className="w-16 h-16 object-contain" />
        <p className="text-xs text-slate-500 font-medium tracking-wide text-center">Financial Planning Suite</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto overflow-x-hidden">
        {visibleTabs.map(tab => {
          const isActive = activeTab === tab.key;
          const disabled = PLAN_TABS.includes(tab.key) && !clientName && !NO_CLIENT_TABS.includes(tab.key);
          const Icon = tab.icon;
          return (
            <div key={tab.key}>
              {tab.dividerBefore && <div className="my-2 border-t border-slate-200" />}
              <button
                onClick={() => !disabled && onTab(tab.key)}
                title={tab.label}
                disabled={disabled}
                className={cn(
                  "group relative w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 focus:outline-none",
                  isActive
                    ? "bg-white text-slate-900 shadow-sm"
                    : disabled
                      ? "text-slate-300 cursor-not-allowed"
                      : "text-slate-500 hover:text-slate-900 hover:bg-white cursor-pointer"
                )}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 bg-blue-500 rounded-r" />
                )}
                <Icon className={cn(
                  "w-4 h-4 flex-shrink-0 transition-transform group-hover:scale-105",
                  isActive ? "text-blue-500" : "text-slate-400 group-hover:text-slate-700"
                )} />
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-slate-200">
        {clientName && <div className="text-[10px] text-slate-500 text-center truncate mb-1">{clientName}</div>}
        <div className="text-xs text-slate-400 text-center">
          {isGA ? "General Agent" : `Field Agent${isStandard ? " · Standard" : " · Enhanced"}`}
        </div>
      </div>
    </aside>
  );
}
