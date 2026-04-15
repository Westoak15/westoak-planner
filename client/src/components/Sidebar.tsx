import {
  Users, LayoutDashboard, Scale, PiggyBank,
  Shield, GraduationCap, CreditCard, Receipt, ScrollText, Brain, ClipboardList,
  FileHeart, Settings
} from "lucide-react";
import { cn } from "../lib/utils";

export type Tab =
  | "clients" | "dashboard"
  | "networth" | "retirement" | "insurance" | "fna"
  | "resp" | "debt" | "tax" | "estate" | "ai"
  | "planning" | "admin";

interface Props {
  activeTab: Tab;
  onTab: (t: Tab) => void;
  clientName?: string;
  role?: string;
  level?: string;
}

const ALL_TABS: { key: Tab; label: string; icon: any; dividerBefore?: boolean; gaOnly?: boolean }[] = [
  { key: "clients",    label: "Clients",          icon: Users },
  { key: "dashboard",  label: "Dashboard",         icon: LayoutDashboard, dividerBefore: true },
  { key: "networth",   label: "Net Worth",         icon: Scale },
  { key: "retirement", label: "Retirement",        icon: PiggyBank },
  { key: "insurance",  label: "Policies",          icon: Shield },
  { key: "fna",        label: "FNA",               icon: FileHeart },
  { key: "resp",       label: "RESP",              icon: GraduationCap },
  { key: "debt",       label: "Debt",              icon: CreditCard },
  { key: "tax",        label: "Tax",               icon: Receipt },
  { key: "estate",     label: "Estate",            icon: ScrollText },
  { key: "ai",         label: "AI Insights",       icon: Brain },
  { key: "planning",   label: "Full FP View",      icon: ClipboardList, dividerBefore: true },
  { key: "admin",      label: "Admin",             icon: Settings, dividerBefore: true, gaOnly: true },
];

// Standard FA only sees these tabs
const STANDARD_TABS: Tab[] = ["clients", "insurance", "fna"];

const PLAN_TABS: Tab[] = ["dashboard","networth","retirement","insurance","fna","resp","debt","tax","estate","ai","planning"];

export function Sidebar({ activeTab, onTab, clientName, role, level }: Props) {
  const isGA = role === "ga";
  const isStandard = !isGA && level === "standard";

  const visibleTabs = ALL_TABS.filter(tab => {
    if (tab.gaOnly && !isGA) return false;
    if (isStandard && !STANDARD_TABS.includes(tab.key)) return false;
    return true;
  });

  return (
    <aside className="w-[180px] flex-shrink-0 flex flex-col select-none" style={{
      background: "linear-gradient(180deg, #0c1e3a 0%, #0e2a4a 60%, #0a3556 100%)"
    }}>
      {/* Logo */}
      <div className="py-5 flex flex-col items-center border-b border-white/10 px-3">
        <img src="/koc-logo.png" alt="Knights of Columbus" className="w-24 h-24 object-contain mb-3" />
        <div className="text-white/60 font-medium text-[10px] tracking-wide text-center">Financial Planning Suite</div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 overflow-y-auto overflow-x-hidden">
        {visibleTabs.map(tab => {
          const isActive = activeTab === tab.key;
          const disabled = PLAN_TABS.includes(tab.key) && !clientName && tab.key !== "admin";
          return (
            <div key={tab.key}>
              {tab.dividerBefore && <div className="mx-3 my-1.5 border-t border-white/10" />}
              <button
                onClick={() => !disabled && onTab(tab.key)}
                title={tab.label}
                disabled={disabled}
                className={cn(
                  "w-full flex flex-col items-center justify-center py-3 px-2 rounded-lg mx-auto transition-all relative group focus:outline-none",
                  isActive   ? "bg-white/15 text-white"
                  : disabled ? "text-white/20 cursor-not-allowed"
                  : "text-white/45 hover:text-white/80 hover:bg-white/8 cursor-pointer"
                )}
                style={{ width: "calc(100% - 12px)", marginLeft: "6px" }}
              >
                <tab.icon className={cn("w-5 h-5 mb-1.5 flex-shrink-0", isActive && "text-cyan-400")} />
                <span className="text-[12px] font-medium leading-tight text-center">{tab.label}</span>
                {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-cyan-400 rounded-r" />}
              </button>
            </div>
          );
        })}
      </nav>

      {/* Role indicator */}
      <div className="px-3 py-2 border-t border-white/10">
        {clientName && <div className="text-[9px] text-white/30 text-center truncate mb-1">{clientName}</div>}
        <div className="text-[9px] text-white/20 text-center uppercase tracking-wider">
          {isGA ? "General Agent" : `Field Agent${isStandard ? " · Standard" : " · Enhanced"}`}
        </div>
      </div>
    </aside>
  );
}
