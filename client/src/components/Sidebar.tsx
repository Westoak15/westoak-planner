import {
  Users, LayoutDashboard, Scale, PiggyBank,
  Shield, GraduationCap, Receipt, ScrollText, Brain, ClipboardList,
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
  { key: "clients",    label: "Clients",      icon: Users },
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
  { key: "planning",       label: "Full FP View",   icon: ClipboardList, dividerBefore: true },
  { key: "financialplan",  label: "Financial Plan", icon: Sparkles },
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
    <aside className="w-[180px] flex-shrink-0 flex flex-col select-none bg-white border-r border-slate-200/80">
      {/* Logo */}
      <div className="py-5 flex flex-col items-center border-b border-slate-200/80 px-3">
        <img src="/koc-logo.png" alt="Knights of Columbus" className="w-16 h-16 object-contain mb-2" />
        <div className="text-[10px] font-semibold tracking-[0.12em] uppercase text-brand-gradient">
          Financial Planning
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden">
        {visibleTabs.map(tab => {
          const isActive = activeTab === tab.key;
          const disabled = PLAN_TABS.includes(tab.key) && !clientName && !NO_CLIENT_TABS.includes(tab.key);
          return (
            <div key={tab.key}>
              {tab.dividerBefore && <div className="mx-3 my-2 border-t border-slate-200/70" />}
              <button
                onClick={() => !disabled && onTab(tab.key)}
                title={tab.label}
                disabled={disabled}
                className={cn(
                  "w-[calc(100%-12px)] mx-[6px] flex items-center gap-2.5 py-2 px-3 rounded-lg transition-all relative group focus:outline-none",
                  isActive
                    ? "bg-gradient-to-r from-blue-50 to-cyan-50 text-slate-900 shadow-sm ring-1 ring-cyan-100"
                    : disabled
                    ? "text-slate-300 cursor-not-allowed"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50 cursor-pointer"
                )}
              >
                <tab.icon className={cn("w-4 h-4 flex-shrink-0", isActive ? "text-cyan-600" : "")} />
                <span className={cn("text-[11.5px] leading-tight", isActive ? "font-semibold" : "font-medium")}>
                  {tab.label}
                </span>
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r bg-gradient-to-b from-blue-600 to-cyan-500" />
                )}
              </button>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-slate-200/80 bg-slate-50/50">
        {clientName && (
          <div className="text-[10px] font-medium text-slate-700 text-center truncate mb-1">{clientName}</div>
        )}
        <div className="text-[9px] text-slate-400 text-center uppercase tracking-[0.1em] font-semibold">
          {isGA ? "General Agent" : `Field Agent${isStandard ? " · Standard" : " · Enhanced"}`}
        </div>
      </div>
    </aside>
  );
}
