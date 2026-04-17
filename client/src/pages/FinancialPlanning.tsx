import { useQueryClient } from "@tanstack/react-query";
import { EstateScorecard } from "../components/ModuleViews";
import { api } from "../lib/api";
import { useState, useMemo, useEffect, Component, type ReactNode } from "react";

class ErrorBoundary extends Component<{children:ReactNode;fallback?:ReactNode},{error:boolean}> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() { return this.state.error ? (this.props.fallback ?? null) : this.props.children; }
}
import { useQuery } from "@tanstack/react-query";
import {
  useClientPlans, useNetWorthEntries, useCreateNetWorthEntry, useDeleteNetWorthEntry,
  useRetirementProjections, useCreateRetirementProjection, useDeleteRetirementProjection,
  useInsuranceAnalyses, useCreateInsuranceWorksheet,
  useEducationSavings, useCreateEducationSaving, useDeleteEducationSaving,
  useDebtEntries, useCreateDebtEntry, useDeleteDebtEntry,
  useTaxPlanningNotes, useCreateTaxPlanningNote, useDeleteTaxPlanningNote,
  useEstatePlanningNotes, useCreateEstatePlanningNote, useDeleteEstatePlanningNote,
  useAiRecommendations, useGenerateAiRecommendations, useUpdateAiRecommendation, useDeleteAiRecommendation,
  useFinancialPlanningOverview, useAvailableReports,
  usePlanStaleFlags, useSimulationResults, usePlanAssumptions,
  useTaxProjection, useRrspRoom, useTfsaRoom, useCapitalGains, useIncomeSplit,
  useDeleteInsuranceAnalysis,
} from "@/hooks/use-plans";
import { SimulationDashboard } from "@/components/planning/SimulationDashboard";
import {
  CppOasTimingView, InsuranceMethodComparison,
  RespFundingGauge, EstateScorecard, DebtPayoffTimeline,
} from "@/components/planning/ModuleViews";
import {
  Target, DollarSign, PiggyBank, Shield, GraduationCap, CreditCard,
  Receipt, ScrollText, Brain, Plus, Trash2, Sparkles, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle, Clock, FileText, Printer, Loader2, BarChart3,
  Users, Calculator, ChevronDown, ChevronUp, Info, Download, Eye, Gift, FileSignature, Printer,
} from "lucide-react";

// ── Tab definitions ───────────────────────────────────────────────────────────

type TabKey = "overview" | "dashboard" | "networth" | "retirement" | "insurance" | "resp" | "debt" | "tax" | "estate" | "ai";

const tabs: { key: TabKey; label: string; icon: typeof Target }[] = [
  { key: "overview",    label: "Overview",    icon: Target },
  { key: "dashboard",   label: "Dashboard",   icon: BarChart3 },
  { key: "networth",    label: "Net Worth",   icon: DollarSign },
  { key: "retirement",  label: "Retirement",  icon: PiggyBank },
  { key: "insurance",   label: "Insurance",   icon: Shield },
  { key: "resp",        label: "RESP",        icon: GraduationCap },
  { key: "debt",        label: "Debt",        icon: CreditCard },
  { key: "tax",         label: "Tax",         icon: Receipt },
  { key: "estate",      label: "Estate",      icon: ScrollText },
  { key: "ai",          label: "AI Insights", icon: Brain },
];

const moduleToTabMap: Record<string, TabKey> = {
  retirement: "retirement", insurance: "insurance", education: "resp",
  estate: "estate", debt: "debt", tax: "tax", cashflow: "overview",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function fmt$(n: number): string {
  return `$${Math.abs(n).toLocaleString("en-CA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function pct(n: number): string { return `${(n * 100).toFixed(1)}%`; }

// ── Report helper — opens server-generated HTML report in new window ──────────

async function openReport(clientId: number, type: "comprehensive" | "retirement" | "insurance" | "net-worth") {
  const res = await fetch(`/api/reports/${clientId}/${type}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to generate report");
  const html = await res.text();
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({ clientId }: { clientId: number }) {
  const { data: overview, isLoading } = useFinancialPlanningOverview(clientId);
  const { data: reports } = useAvailableReports(clientId);
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);

  const handleReport = async (type: "comprehensive" | "retirement" | "insurance" | "net-worth") => {
    setGeneratingReport(type);
    try { await openReport(clientId, type); }
    catch (err) { console.error("Report error:", err); }
    finally { setGeneratingReport(null); }
  };

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Loading overview...</div>;
  if (!overview) return null;

  const cards = [
    { label: "Net Worth",            value: `$${Number(overview.netWorth).toLocaleString()}`,          icon: DollarSign,  color: overview.netWorth >= 0 ? "text-green-600" : "text-red-600",    bg: overview.netWorth >= 0 ? "bg-green-50" : "bg-red-50" },
    { label: "Total Assets",         value: `$${Number(overview.totalAssets).toLocaleString()}`,        icon: TrendingUp,  color: "text-green-600", bg: "bg-green-50" },
    { label: "Total Liabilities",    value: `$${Number(overview.totalLiabilities).toLocaleString()}`,   icon: TrendingDown, color: "text-red-500",  bg: "bg-red-50" },
    { label: "Total Debt",           value: `$${Number(overview.totalDebt).toLocaleString()}`,          icon: CreditCard,  color: "text-orange-600", bg: "bg-orange-50" },
    { label: "Financial Goals",      value: overview.goals,                                              icon: Target,      color: "text-primary", bg: "bg-primary/5" },
    { label: "Retirement Plans",     value: overview.retirementProjections,                              icon: PiggyBank,   color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Insurance Analyses",   value: overview.insuranceAnalyses,                                  icon: Shield,      color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Education Plans",      value: overview.educationPlans,                                     icon: GraduationCap, color: "text-teal-600", bg: "bg-teal-50" },
    { label: "Tax Notes",            value: overview.taxNotes,                                           icon: Receipt,     color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Estate Notes",         value: overview.estateNotes,                                        icon: ScrollText,  color: "text-indigo-600", bg: "bg-indigo-50" },
    { label: "AI Recommendations",   value: overview.aiRecommendations,                                  icon: Brain,       color: "text-pink-600", bg: "bg-pink-50" },
    { label: "Pending Actions",      value: overview.pendingRecommendations,                             icon: Clock,       color: "text-yellow-600", bg: "bg-yellow-50" },
  ];

  const reportButtons: Array<{ type: "comprehensive" | "retirement" | "insurance" | "net-worth"; label: string; available: boolean; icon: typeof FileText }> = [
    { type: "comprehensive", label: "Full Plan",       available: true,                        icon: FileText },
    { type: "retirement",    label: "Retirement",      available: !!reports?.retirement,        icon: PiggyBank },
    { type: "insurance",     label: "Insurance",       available: !!reports?.insurance,         icon: Shield },
    { type: "net-worth",     label: "Net Worth",       available: !!reports?.netWorth,          icon: DollarSign },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-display font-bold">Financial Planning Overview</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {reportButtons.map(btn => (
            <button
              key={btn.type}
              onClick={() => handleReport(btn.type)}
              disabled={!btn.available || generatingReport === btn.type}
              data-testid={`button-report-${btn.type}`}
              className="flex items-center space-x-1.5 px-3 py-2 bg-primary text-primary-foreground text-sm rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {generatingReport === btn.type
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <btn.icon className="w-3.5 h-3.5" />}
              <span>{btn.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {cards.map(card => (
          <div key={card.label} className={`border border-border rounded-2xl p-5 ${card.bg}`}>
            <div className="flex items-center space-x-2 mb-2">
              <card.icon className={`w-4 h-4 ${card.color}`} />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{card.label}</p>
            </div>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Net Worth Tab ─────────────────────────────────────────────────────────────

function NetWorthTab({ clientId }: { clientId: number }) {
  const { data: entries = [] } = useNetWorthEntries(clientId);
  const createEntry = useCreateNetWorthEntry();
  const deleteEntry = useDeleteNetWorthEntry(clientId);
  const [showAdd, setShowAdd] = useState(false);
  const [addType, setAddType] = useState<"asset" | "liability">("asset");
  const [form, setForm] = useState({ category: "", name: "", value: "" });

  const assetCats = ["Liquid Assets", "Registered Investments (RRSP/TFSA)", "Non-Registered Investments", "Real Estate", "Business Assets", "Personal Property", "Other"];
  const liabilityCats = ["Mortgages", "Car Loans", "Student Loans", "Credit Cards", "Lines of Credit", "Business Loans", "Other Liabilities"];

  const assets = entries.filter((e: { type: string }) => e.type === "asset");
  const liabilities = entries.filter((e: { type: string }) => e.type === "liability");
  const totalAssets = assets.reduce((s: number, e: { value: string }) => s + parseFloat(e.value || "0"), 0);
  const totalLiabilities = liabilities.reduce((s: number, e: { value: string }) => s + parseFloat(e.value || "0"), 0);
  const netWorth = totalAssets - totalLiabilities;

  const handleAdd = (ev: React.FormEvent) => {
    ev.preventDefault();
    createEntry.mutate({ clientId, data: { type: addType, category: form.category, name: form.name, value: form.value } }, {
      onSuccess: () => { setShowAdd(false); setForm({ category: "", name: "", value: "" }); },
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-display font-bold">Net Worth Statement</h2>
        <button onClick={() => setShowAdd(true)} data-testid="button-fp-add-nw" className="flex items-center space-x-2 px-4 py-2 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/90 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /><span>Add Entry</span>
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="border border-green-200 rounded-2xl p-5 bg-green-50/50" data-testid="fp-total-assets">
          <p className="text-xs font-semibold text-green-600 uppercase tracking-wider">Total Assets</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{fmt$(totalAssets)}</p>
        </div>
        <div className="border border-red-200 rounded-2xl p-5 bg-red-50/50" data-testid="fp-total-liabilities">
          <p className="text-xs font-semibold text-red-500 uppercase tracking-wider">Total Liabilities</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{fmt$(totalLiabilities)}</p>
        </div>
        <div className={`border rounded-2xl p-5 ${netWorth >= 0 ? "border-primary/30 bg-primary/5" : "border-red-300 bg-red-50"}`} data-testid="fp-net-worth">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Net Worth</p>
          <p className={`text-2xl font-bold mt-1 ${netWorth >= 0 ? "text-primary" : "text-red-600"}`}>{netWorth >= 0 ? "" : "-"}{fmt$(netWorth)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border border-border rounded-2xl p-6">
          <h3 className="text-lg font-bold font-display text-green-700 mb-4">Assets</h3>
          {assets.map((item: { id: number; name: string; value: string; category: string }) => (
            <div key={item.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 group" data-testid={`fp-nw-${item.id}`}>
              <div>
                <span className="text-sm font-medium">{item.name}</span>
                <span className="text-xs text-muted-foreground ml-2">({item.category})</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-semibold text-green-600">{fmt$(parseFloat(item.value))}</span>
                <button onClick={() => deleteEntry.mutate(item.id)} data-testid={`button-fp-del-nw-${item.id}`} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded"><Trash2 className="w-3 h-3 text-red-400" /></button>
              </div>
            </div>
          ))}
          {assets.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No assets added yet.</p>}
        </div>

        <div className="border border-border rounded-2xl p-6">
          <h3 className="text-lg font-bold font-display text-red-600 mb-4">Liabilities</h3>
          {liabilities.map((item: { id: number; name: string; value: string; category: string }) => (
            <div key={item.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 group" data-testid={`fp-nw-${item.id}`}>
              <div>
                <span className="text-sm font-medium">{item.name}</span>
                <span className="text-xs text-muted-foreground ml-2">({item.category})</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-semibold text-red-500">{fmt$(parseFloat(item.value))}</span>
                <button onClick={() => deleteEntry.mutate(item.id)} data-testid={`button-fp-del-nw-${item.id}`} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded"><Trash2 className="w-3 h-3 text-red-400" /></button>
              </div>
            </div>
          ))}
          {liabilities.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No liabilities added yet.</p>}
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6">
            <h2 className="text-2xl font-display font-bold mb-6">Add Net Worth Entry</h2>
            <form onSubmit={handleAdd} className="space-y-4" data-testid="form-fp-add-nw">
              <div className="flex space-x-2">
                <button type="button" onClick={() => setAddType("asset")} data-testid="button-fp-type-asset" className={`flex-1 py-2 rounded-xl font-semibold text-sm ${addType === "asset" ? "bg-green-100 text-green-700 border-2 border-green-300" : "bg-muted text-muted-foreground"}`}>Asset</button>
                <button type="button" onClick={() => setAddType("liability")} data-testid="button-fp-type-liability" className={`flex-1 py-2 rounded-xl font-semibold text-sm ${addType === "liability" ? "bg-red-100 text-red-600 border-2 border-red-300" : "bg-muted text-muted-foreground"}`}>Liability</button>
              </div>
              <div>
                <label className="text-sm font-semibold">Category</label>
                <select required value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} data-testid="select-fp-nw-cat" className="w-full px-4 py-3 rounded-xl border mt-1">
                  <option value="">-- Select --</option>
                  {(addType === "asset" ? assetCats : liabilityCats).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><label className="text-sm font-semibold">Description</label><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} data-testid="input-fp-nw-name" className="w-full px-4 py-3 rounded-xl border mt-1" /></div>
              <div><label className="text-sm font-semibold">Value ($)</label><input type="number" step="0.01" required value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} data-testid="input-fp-nw-value" className="w-full px-4 py-3 rounded-xl border mt-1" /></div>
              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setShowAdd(false)} className="px-6 py-3 rounded-xl font-semibold text-muted-foreground hover:bg-muted">Cancel</button>
                <button type="submit" disabled={createEntry.isPending} data-testid="button-fp-submit-nw" className="px-6 py-3 rounded-xl font-semibold bg-primary text-primary-foreground">{createEntry.isPending ? "Adding..." : "Add Entry"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Scenario preview for module tabs ─────────────────────────────────────────

function ModuleScenarioPreview({ planId, module }: { planId: number | null; module: string }) {
  const { data: simResults = [] } = useSimulationResults(planId);
  const moduleResults = simResults.filter(r => r.module === module);
  if (moduleResults.length === 0) return null;
  const scenarioLabels: Record<string, string> = { Conservative: "Stress", Moderate: "Base", Aggressive: "Optimistic" };
  return (
    <div className="border border-border rounded-2xl p-4" data-testid={`module-scenario-${module}`}>
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Monte Carlo Results</p>
      <div className="grid grid-cols-3 gap-3">
        {moduleResults.slice(0, 3).map(r => {
          const pctVal = Math.round(Number(r.successRate) * 100);
          const color = pctVal >= 80 ? "text-green-600 bg-green-50 border-green-200" : pctVal >= 60 ? "text-yellow-600 bg-yellow-50 border-yellow-200" : "text-red-600 bg-red-50 border-red-200";
          return (
            <div key={r.scenario} className={`border rounded-xl p-3 text-center ${color}`} data-testid={`module-scenario-card-${module}-${r.scenario.toLowerCase()}`}>
              <p className="text-xs font-semibold opacity-70">{scenarioLabels[r.scenario] || r.scenario}</p>
              <p className="text-2xl font-bold">{pctVal}%</p>
              <p className="text-xs">success</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Retirement Tab ────────────────────────────────────────────────────────────

function RetirementTab({ clientId, planId }: { clientId: number; planId: number | null }) {
  const { data: projections = [] } = useRetirementProjections(clientId);
  const createProjection = useCreateRetirementProjection();
  const { data: assumptions = [] } = usePlanAssumptions(planId);
  const [showCalc, setShowCalc] = useState(false);
  const [form, setForm] = useState({
    currentAge: "35", retirementAge: "65", lifeExpectancy: "90",
    currentSavings: "100000", annualContribution: "12000",
    expectedReturn: "7", inflationRate: "2", desiredRetirementIncome: "60000",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createProjection.mutate({ clientId, data: {
      currentAge: parseInt(form.currentAge), retirementAge: parseInt(form.retirementAge),
      lifeExpectancy: parseInt(form.lifeExpectancy), currentSavings: form.currentSavings,
      annualContribution: form.annualContribution, expectedReturn: form.expectedReturn,
      inflationRate: form.inflationRate, desiredRetirementIncome: form.desiredRetirementIncome,
    }}, { onSuccess: () => setShowCalc(false) });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-display font-bold">Retirement Planning</h2>
        <button onClick={() => setShowCalc(true)} data-testid="button-fp-add-retirement" className="flex items-center space-x-2 px-4 py-2 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/90 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /><span>New Projection</span>
        </button>
      </div>

      {projections.map((proj: { id: number; currentAge: number; retirementAge: number; lifeExpectancy: number; currentSavings: string; annualContribution: string; expectedReturn: string; projectedBalance: string | null; shortfallSurplus: string | null }) => (
        <div key={proj.id} className="border border-border rounded-2xl p-6" data-testid={`card-fp-retirement-${proj.id}`}>
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-bold">Retirement at Age {proj.retirementAge}</h3>
              <p className="text-sm text-muted-foreground">Current age: {proj.currentAge} | Life expectancy: {proj.lifeExpectancy}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div><p className="text-xs text-muted-foreground uppercase">Current Savings</p><p className="text-lg font-bold">{fmt$(parseFloat(proj.currentSavings))}</p></div>
            <div><p className="text-xs text-muted-foreground uppercase">Annual Contribution</p><p className="text-lg font-bold">{fmt$(parseFloat(proj.annualContribution))}</p></div>
            <div><p className="text-xs text-muted-foreground uppercase">Projected Balance</p><p className="text-lg font-bold text-primary">{fmt$(parseFloat(proj.projectedBalance || "0"))}</p></div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Shortfall / Surplus</p>
              <p className={`text-lg font-bold ${parseFloat(proj.shortfallSurplus || "0") >= 0 ? "text-green-600" : "text-red-600"}`}>
                {fmt$(parseFloat(proj.shortfallSurplus || "0"))}
              </p>
            </div>
          </div>
        </div>
      ))}

      {projections.length === 0 && (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-2xl">
          No retirement projections yet. Create one to see your client's retirement outlook.
        </div>
      )}

      <ErrorBoundary><ModuleScenarioPreview planId={planId} module="retirement" /></ErrorBoundary>
      <ErrorBoundary><CppOasTimingView assumptions={assumptions} /></ErrorBoundary>

      {showCalc && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-6">
            <h2 className="text-2xl font-display font-bold mb-6">Retirement Projection</h2>
            <form onSubmit={handleSubmit} className="space-y-4" data-testid="form-fp-retirement">
              <div className="grid grid-cols-3 gap-4">
                <div><label className="text-sm font-semibold">Current Age</label><input type="number" required value={form.currentAge} onChange={e => setForm({ ...form, currentAge: e.target.value })} data-testid="input-fp-current-age" className="w-full px-3 py-2 rounded-xl border mt-1" /></div>
                <div><label className="text-sm font-semibold">Retirement Age</label><input type="number" required value={form.retirementAge} onChange={e => setForm({ ...form, retirementAge: e.target.value })} data-testid="input-fp-retirement-age" className="w-full px-3 py-2 rounded-xl border mt-1" /></div>
                <div><label className="text-sm font-semibold">Life Expectancy</label><input type="number" required value={form.lifeExpectancy} onChange={e => setForm({ ...form, lifeExpectancy: e.target.value })} data-testid="input-fp-life-exp" className="w-full px-3 py-2 rounded-xl border mt-1" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-semibold">Current Savings ($)</label><input type="number" required value={form.currentSavings} onChange={e => setForm({ ...form, currentSavings: e.target.value })} data-testid="input-fp-current-savings" className="w-full px-3 py-2 rounded-xl border mt-1" /></div>
                <div><label className="text-sm font-semibold">Annual Contribution ($)</label><input type="number" required value={form.annualContribution} onChange={e => setForm({ ...form, annualContribution: e.target.value })} data-testid="input-fp-annual-contrib" className="w-full px-3 py-2 rounded-xl border mt-1" /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="text-sm font-semibold">Expected Return (%)</label><input type="number" step="0.1" required value={form.expectedReturn} onChange={e => setForm({ ...form, expectedReturn: e.target.value })} data-testid="input-fp-return" className="w-full px-3 py-2 rounded-xl border mt-1" /></div>
                <div><label className="text-sm font-semibold">Inflation (%)</label><input type="number" step="0.1" required value={form.inflationRate} onChange={e => setForm({ ...form, inflationRate: e.target.value })} data-testid="input-fp-inflation" className="w-full px-3 py-2 rounded-xl border mt-1" /></div>
                <div><label className="text-sm font-semibold">Desired Income ($)</label><input type="number" required value={form.desiredRetirementIncome} onChange={e => setForm({ ...form, desiredRetirementIncome: e.target.value })} data-testid="input-fp-desired-income" className="w-full px-3 py-2 rounded-xl border mt-1" /></div>
              </div>
              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setShowCalc(false)} className="px-6 py-3 rounded-xl font-semibold text-muted-foreground hover:bg-muted">Cancel</button>
                <button type="submit" disabled={createProjection.isPending} data-testid="button-fp-submit-retirement" className="px-6 py-3 rounded-xl font-semibold bg-primary text-primary-foreground">{createProjection.isPending ? "Calculating..." : "Calculate"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
// ── Insurance Tab ─────────────────────────────────────────────────────────────
// (Retained from original — full worksheet)

type WorksheetForm = {
  primaryName: string; primaryAge: string; primaryAnnualIncome: string;
  spouseName: string; spouseAge: string; spouseAnnualIncome: string;
  familyMembers: string;
  liabilities: { mortgageBalance: string; carLoans: string; linesOfCredit: string; creditCards: string; finalExpenses: string; emergencyFund: string };
  legacy: { educationFund: string; legacyFundForChildren: string; charitableBequest: string; other: string };
  primaryIncome: { replacementPct: string; cppSurvivorBenefit: string; targetAge: string };
  spouseIncome: { replacementPct: string; cppSurvivorBenefit: string; targetAge: string };
  primaryAssets: { liquidSavings: string; rrsps: string; rrspsUse: boolean; nonRegistered: string; nonRegisteredUse: boolean; tfsa: string; tfsaUse: boolean; other: string };
  spouseAssets: { liquidSavings: string; rrsps: string; rrspsUse: boolean; nonRegistered: string; nonRegisteredUse: boolean; tfsa: string; tfsaUse: boolean; other: string };
  primaryExistingCoverage: string; spouseExistingCoverage: string;
  primaryCoveragePurchased: string; spouseCoveragePurchased: string;
  primaryShortfallAcknowledged: string; spouseShortfallAcknowledged: string;
  primarySignature: string; spouseSignature: string; signatureDate: string;
  meetingNotes: string;
};

// Forward declarations so InsuranceTab can reference them
declare function WorksheetField(props: { label: string; value: string; onChange: (v: string) => void; testId: string; prefix?: string }): JSX.Element;
declare function AssetRow(props: { label: string; value: string; onValueChange: (v: string) => void; useIt?: boolean; onToggle?: () => void; testId: string }): JSX.Element;

function WorksheetFieldImpl({ label, value, onChange, testId, prefix = "$" }: { label: string; value: string; onChange: (v: string) => void; testId: string; prefix?: string }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="flex mt-1">
        {prefix && <span className="flex items-center px-3 bg-muted border border-r-0 rounded-l-lg text-sm font-medium">{prefix}</span>}
        <input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          data-testid={testId}
          className={`flex-1 px-3 py-2 border text-sm bg-background ${prefix ? "rounded-r-lg" : "rounded-lg"}`}
          placeholder="0"
        />
      </div>
    </div>
  );
}

function AssetRowImpl({ label, value, onValueChange, useIt, onToggle, testId }: { label: string; value: string; onValueChange: (v: string) => void; useIt?: boolean; onToggle?: () => void; testId: string }) {
  return (
    <div className="flex items-center gap-2">
      {onToggle !== undefined && (
        <input type="checkbox" checked={useIt} onChange={onToggle} data-testid={`toggle-${testId}`} className="rounded" />
      )}
      <div className="flex-1">
        <WorksheetFieldImpl label={label} value={value} onChange={onValueChange} testId={`input-${testId}`} />
      </div>
    </div>
  );
}

export function InsuranceTab({ clientId, planId, client }: { clientId: number; planId: number | null; client?: any }) {
  const { data: analyses = [] } = useInsuranceAnalyses(clientId);
  const { data: nwEntries = [] } = useNetWorthEntries(clientId);
  const [policies, setPolicies] = useState<any[]>([]);
  useEffect(() => { api.get<any[]>(`/api/clients/${clientId}/policies`).then(data => { console.log("Policies loaded:", data); setPolicies(data); }).catch(err => console.error("Policies error:", err)); }, [clientId]);
  const deleteAnalysis = useDeleteInsuranceAnalysis(clientId);
  const createWorksheet = useCreateInsuranceWorksheet();
  const queryClient = useQueryClient();
  const [showWorksheet, setShowWorksheet] = useState(false);
  const [viewingId, setViewingId] = useState<number | null>(null);

  const defaultWs: WorksheetForm = {
    primaryName: "", primaryAge: "", primaryAnnualIncome: "",
    spouseName: "", spouseAge: "", spouseAnnualIncome: "", familyMembers: "2",
    liabilities: { mortgageBalance: "0", carLoans: "0", linesOfCredit: "0", creditCards: "0", finalExpenses: "15000", emergencyFund: "0" },
    legacy: { educationFund: "0", legacyFundForChildren: "0", charitableBequest: "0", other: "0" },
    primaryIncome: { replacementPct: "70", cppSurvivorBenefit: "700", targetAge: "65" },
    spouseIncome: { replacementPct: "70", cppSurvivorBenefit: "700", targetAge: "65" },
    primaryAssets: { liquidSavings: "0", rrsps: "0", rrspsUse: true, nonRegistered: "0", nonRegisteredUse: true, tfsa: "0", tfsaUse: true, other: "0" },
    spouseAssets: { liquidSavings: "0", rrsps: "0", rrspsUse: true, nonRegistered: "0", nonRegisteredUse: true, tfsa: "0", tfsaUse: true, other: "0" },
    primaryExistingCoverage: "0", spouseExistingCoverage: "0",
    primaryCoveragePurchased: "0", spouseCoveragePurchased: "0",
    primaryShortfallAcknowledged: "0", spouseShortfallAcknowledged: "0",
    primarySignature: "", spouseSignature: "", signatureDate: "",
    meetingNotes: "",
  };
  const [form, setForm] = useState<WorksheetForm>(defaultWs);

function buildDefaultFromNW() {
  const sum = (type: string, category: string, owner?: string) =>
    nwEntries.filter((e: any) => e.type === type && e.category === category && (!owner || e.owner === owner))
             .reduce((s: number, e: any) => s + parseFloat(e.value || "0"), 0);
  const policySum = (insured: string) =>
    policies.filter((p: any) => p.insured === insured && ["Life","Term Life","Whole Life","Universal Life"].includes(p.type))
            .reduce((s: number, p: any) => s + parseFloat(p.coverageAmount || "0"), 0);
  return {
    liabilities: {
      mortgageBalance: String(sum("liability", "Mortgage")),
      carLoans:        String(sum("liability", "Car Loan")),
      linesOfCredit:   String(sum("liability", "Line of Credit")),
      creditCards:     String(sum("liability", "Credit Card")),
      finalExpenses:   "15000",
      emergencyFund:   "0",
    },
    primaryAssets: {
      liquidSavings:      String(sum("asset", "Cash/Bank", "primary")),
      rrsps:              String(sum("asset", "RRSP", "primary")),
      rrspsUse:           true,
      nonRegistered:      String(sum("asset", "Non-Registered", "primary")),
      nonRegisteredUse:   true,
      tfsa:               String(sum("asset", "TFSA", "primary")),
      tfsaUse:            true,
      other:              "0",
    },
    spouseAssets: {
      liquidSavings:      String(sum("asset", "Cash/Bank", "spouse")),
      rrsps:              String(sum("asset", "RRSP", "spouse")),
      rrspsUse:           true,
      nonRegistered:      String(sum("asset", "Non-Registered", "spouse")),
      nonRegisteredUse:   true,
      tfsa:               String(sum("asset", "TFSA", "spouse")),
      tfsaUse:            true,
      other:              "0",
    },
      primaryExistingCoverage: String(policySum("primary")),
      spouseExistingCoverage:  String(policySum("spouse")),
  };
}
  const v = (s: string) => parseFloat(s) || 0;
  const subtotalA = Object.values(form.liabilities).reduce((s, val) => s + v(val), 0);
  const subtotalB = Object.values(form.legacy).reduce((s, val) => s + v(val), 0);
  const primaryYears = form.primaryAge ? Math.max(0, v(form.primaryIncome.targetAge) - v(form.primaryAge)) : 0;
  const spouseYears  = form.spouseAge ? Math.max(0, v(form.spouseIncome.targetAge) - v(form.spouseAge)) : 0;
  const annualReplace = (income: string, pct: string, cpp: string) =>
    (v(income) * v(pct) / 100) - (v(cpp) * 12);
  const subtotalC = annualReplace(form.primaryAnnualIncome, form.primaryIncome.replacementPct, form.primaryIncome.cppSurvivorBenefit) * primaryYears;
  const subtotalD = annualReplace(form.spouseAnnualIncome,  form.spouseIncome.replacementPct,  form.spouseIncome.cppSurvivorBenefit)  * spouseYears;
  const calcE = (assets: WorksheetForm["primaryAssets"]) =>
    v(assets.liquidSavings) + (assets.rrspsUse ? v(assets.rrsps) : 0) +
    (assets.nonRegisteredUse ? v(assets.nonRegistered) : 0) + (assets.tfsaUse ? v(assets.tfsa) : 0) + v(assets.other);
  const subtotalE = calcE(form.primaryAssets);
  const subtotalF = calcE(form.spouseAssets);
  const primaryNeed = Math.max(0, subtotalA + subtotalB + subtotalC - subtotalE);
  const spouseNeed  = Math.max(0, subtotalA + subtotalB + subtotalD - subtotalF);
  const primaryNet  = Math.max(0, primaryNeed - v(form.primaryExistingCoverage));
  const spouseNet   = Math.max(0, spouseNeed  - v(form.spouseExistingCoverage));
  const calc = { subtotalA, subtotalB, subtotalC, subtotalD, subtotalE, subtotalF, primaryNeed, spouseNeed, primaryNet, spouseNet, primaryYears, spouseYears };

  const updateLiabilities = (key: keyof WorksheetForm["liabilities"], val: string) =>
    setForm(f => ({ ...f, liabilities: { ...f.liabilities, [key]: val } }));
  const updateLegacy = (key: keyof WorksheetForm["legacy"], val: string) =>
    setForm(f => ({ ...f, legacy: { ...f.legacy, [key]: val } }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (viewingId) {
      api.patch(`/api/insurance/${viewingId}`, {
        worksheetData: { ...form, calc },
        primaryName: form.primaryName,
        primaryAge: form.primaryAge ? parseInt(form.primaryAge) : null,
        spouseName: form.spouseName,
        spouseAge: form.spouseAge ? parseInt(form.spouseAge) : null,
        annualIncome: form.primaryAnnualIncome,
        spouseAnnualIncome: form.spouseAnnualIncome,
      }).then(() => {
        setShowWorksheet(false);
        setForm(defaultWs);
        setViewingId(null);
        queryClient.invalidateQueries({ queryKey: ["/api/clients/:clientId/insurance-analyses", clientId] });
      });
    } else {
      createWorksheet.mutate({ clientId, data: { ...form, calc } }, {
        onSuccess: () => { setShowWorksheet(false); setForm(defaultWs); setViewingId(null); },
      });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-display font-bold">Insurance Needs Analysis</h2>
        <button onClick={() => { 
           console.log("policies at click:", policies.length, "sum:", policies.filter((p:any) => ["Life","Term Life","Whole Life","Universal Life"].includes(p.type) && p.insured==="primary").reduce((s:number,p:any)=>s+parseFloat(p.coverageAmount||"0"),0));
           setForm({ ...defaultWs, ...buildDefaultFromNW(), primaryName: client ? `${client.firstName} ${client.lastName}` : "", primaryAge: client?.dateOfBirth ? String(new Date().getFullYear() - new Date(client.dateOfBirth).getFullYear()) : "", primaryAnnualIncome: client?.annualIncome ? String(client.annualIncome) : "", spouseName: client?.spouseFirstName ? `${client.spouseFirstName} ${client.spouseLastName ?? ""}`.trim() : "", spouseAge: client?.spouseDateOfBirth ? String(new Date().getFullYear() - new Date(client.spouseDateOfBirth).getFullYear()) : "", spouseAnnualIncome: client?.spouseFirstName && client?.spouseAnnualIncome ? String(client.spouseAnnualIncome) : "" }); setViewingId(null); setShowWorksheet(true); }}
          data-testid="button-fp-add-insurance"
          className="flex items-center space-x-2 px-4 py-2 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/90 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /><span>New Analysis</span>
        </button>
      </div>

      {(analyses as any[]).map((a) => (
        <div key={a.id} className="border border-border rounded-2xl p-6" data-testid={`card-fp-insurance-${a.id}`}>
          <div className="flex justify-between items-center mb-3">
            <div>
              <h3 className="text-base font-bold">{a.primaryName || "Family Needs Analysis"}</h3>
              <p className="text-xs text-muted-foreground">Created {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : "-"}</p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => { if (a.worksheetData) { setForm({ ...defaultWs, ...a.worksheetData }); } else { setForm({ ...defaultWs, primaryName: a.primaryName ?? "", primaryAge: a.primaryAge ? String(a.primaryAge) : "", spouseName: a.spouseName ?? "", spouseAge: a.spouseAge ? String(a.spouseAge) : "" }); } setViewingId(a.id); setShowWorksheet(true); }} className="p-1.5 text-primary hover:bg-primary/10 rounded-lg" title="Open"><Eye className="w-4 h-4" /></button>
              <button onClick={async () => { const token = localStorage.getItem("fp_token"); const res = await fetch(`/api/reports/${clientId}/fna/${a.id}`, { headers: { Authorization: `Bearer ${token}` } }); const html = await res.text(); const blob = new Blob([html], { type: "text/html" }); window.open(URL.createObjectURL(blob), "_blank"); }} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg" title="Report"><Printer className="w-4 h-4" /></button>
              <button onClick={() => { if (confirm("Delete this analysis?")) deleteAnalysis.mutate(a.id); }} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg" title="Delete"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <div className="grid grid-cols-2 gap-4 mt-2">
              {(() => {
                const ws = (a.worksheetData ?? {}) as any;
                const calc = ws.calc ?? {};
                const pNet = Math.max(0, parseFloat(calc.primaryNet ?? ws.primaryNeed ?? "0"));
                const sNet = Math.max(0, parseFloat(calc.spouseNet ?? ws.spouseNeed ?? "0"));
                const items = [
                  { label: `${a.primaryName || "Primary"} - Life Need`, val: pNet },
                  ...(a.spouseName ? [{ label: `${a.spouseName} - Life Need`, val: sNet }] : []),
                  { label: "DI Need", val: parseFloat(a.recommendedDisabilityCoverage || "0") },
                  { label: "LTC Need", val: parseFloat(a.criticalIllnessLumpSum || "0") },
                ];
                return items.map(item => (
                  <div key={item.label} className="p-1.5 bg-muted/30 rounded-lg flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className={`text-sm font-bold ${item.val > 0 ? "text-red-600" : "text-green-600"}`}>{fmt$(item.val)}</p>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      ))}

      {analyses.length === 0 && (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-2xl" data-testid="empty-insurance">
          No insurance analyses yet. Create a Family Needs Analysis worksheet.
        </div>
      )}
      
      {showWorksheet && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-3xl w-full max-w-4xl shadow-2xl max-h-[95vh] overflow-y-auto">
            <div className="sticky top-0 bg-background z-10 px-8 pt-6 pb-4 border-b border-border">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-display font-bold" data-testid="text-worksheet-title">Family Needs Analysis</h2>
                  <p className="text-sm text-muted-foreground mt-1">Complete all sections to calculate total life insurance need</p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Primary Net Need</p>
                    <p className={`text-lg font-bold ${calc.primaryNet > 0 ? "text-red-600" : "text-green-600"}`} data-testid="text-ws-primary-net">{fmt$(calc.primaryNet)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Spouse Net Need</p>
                    <p className={`text-lg font-bold ${calc.spouseNet > 0 ? "text-red-600" : "text-green-600"}`} data-testid="text-ws-spouse-net">{fmt$(calc.spouseNet)}</p>
                  </div>
                </div>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="px-8 py-6 space-y-8" data-testid="form-fp-insurance-worksheet">
              <section>
                <div className="flex items-center gap-2 mb-4"><Users className="w-5 h-5 text-primary" /><h3 className="font-display font-bold text-lg">Client Information</h3></div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3 p-4 border border-border rounded-xl">
                    <p className="text-sm font-semibold text-primary">Primary Insured</p>
                    <div><label className="text-xs font-medium text-muted-foreground">Full Name</label><input type="text" required value={form.primaryName} onChange={e => setForm(f => ({ ...f, primaryName: e.target.value }))} data-testid="input-ws-primary-name" className="w-full px-3 py-2 rounded-lg border text-sm mt-1 bg-background" /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <WorksheetFieldImpl label="Age" value={form.primaryAge} onChange={v => setForm(f => ({ ...f, primaryAge: v }))} testId="input-ws-primary-age" prefix="" />
                      <WorksheetFieldImpl label="Annual Income" value={form.primaryAnnualIncome} onChange={v => setForm(f => ({ ...f, primaryAnnualIncome: v }))} testId="input-ws-primary-income" />
                    </div>
                  </div>
                  <div className="space-y-3 p-4 border border-border rounded-xl">
                    <p className="text-sm font-semibold text-purple-600">Spouse</p>
                    <div><label className="text-xs font-medium text-muted-foreground">Full Name</label><input type="text" value={form.spouseName} onChange={e => setForm(f => ({ ...f, spouseName: e.target.value }))} data-testid="input-ws-spouse-name" className="w-full px-3 py-2 rounded-lg border text-sm mt-1 bg-background" /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <WorksheetFieldImpl label="Age" value={form.spouseAge} onChange={v => setForm(f => ({ ...f, spouseAge: v }))} testId="input-ws-spouse-age" prefix="" />
                      <WorksheetFieldImpl label="Annual Income" value={form.spouseAnnualIncome} onChange={v => setForm(f => ({ ...f, spouseAnnualIncome: v }))} testId="input-ws-spouse-income" />
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-red-500" /><h3 className="font-display font-bold text-lg">Household Liabilities</h3></div>
                  <div className="text-right"><span className="text-xs text-muted-foreground">Subtotal (A)</span><p className="font-bold text-red-600" data-testid="text-ws-subtotal-a">{fmt$(calc.subtotalA)}</p></div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <WorksheetFieldImpl label="Mortgage Balance" value={form.liabilities.mortgageBalance} onChange={v => updateLiabilities("mortgageBalance", v)} testId="input-ws-mortgage" />
                  <WorksheetFieldImpl label="Car Loans" value={form.liabilities.carLoans} onChange={v => updateLiabilities("carLoans", v)} testId="input-ws-car-loans" />
                  <WorksheetFieldImpl label="Lines of Credit" value={form.liabilities.linesOfCredit} onChange={v => updateLiabilities("linesOfCredit", v)} testId="input-ws-loc" />
                  <WorksheetFieldImpl label="Credit Cards" value={form.liabilities.creditCards} onChange={v => updateLiabilities("creditCards", v)} testId="input-ws-credit-cards" />
                  <WorksheetFieldImpl label="Final Expenses" value={form.liabilities.finalExpenses} onChange={v => updateLiabilities("finalExpenses", v)} testId="input-ws-final-expenses" />
                  <WorksheetFieldImpl label="Emergency Fund" value={form.liabilities.emergencyFund} onChange={v => updateLiabilities("emergencyFund", v)} testId="input-ws-emergency" />
                </div>
              </section>
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2"><Gift className="w-5 h-5 text-amber-500" /><h3 className="font-display font-bold text-lg">Legacy Needs &amp; Wants</h3></div>
                  <div className="text-right"><span className="text-xs text-muted-foreground">Subtotal (B)</span><p className="font-bold text-amber-600">{fmt$(calc.subtotalB)}</p></div>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <WorksheetFieldImpl label="Education Fund" value={form.legacy.educationFund} onChange={v => updateLegacy("educationFund", v)} testId="input-ws-edu" />
                  <WorksheetFieldImpl label="Legacy Fund for Children" value={form.legacy.legacyFundForChildren} onChange={v => updateLegacy("legacyFundForChildren", v)} testId="input-ws-legacy" />
                  <WorksheetFieldImpl label="Charitable Bequest" value={form.legacy.charitableBequest} onChange={v => updateLegacy("charitableBequest", v)} testId="input-ws-charity" />
                  <WorksheetFieldImpl label="Other" value={form.legacy.other} onChange={v => updateLegacy("other", v)} testId="input-ws-legacy-other" />
                </div>
              </section>

              <section>
                <div className="flex items-center gap-2 mb-4"><TrendingUp className="w-5 h-5 text-blue-500" /><h3 className="font-display font-bold text-lg">Family Income Replacement Need</h3></div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3 p-4 border border-border rounded-xl">
                    <div className="flex justify-between"><p className="text-sm font-semibold text-primary">Primary (C)</p><p className="font-bold text-blue-600">{fmt$(calc.subtotalC)}</p></div>
                    <WorksheetFieldImpl label="Income Replacement %" value={form.primaryIncome.replacementPct} onChange={v => setForm(f => ({ ...f, primaryIncome: { ...f.primaryIncome, replacementPct: v } }))} testId="input-ws-primary-rep-pct" prefix="%" />
                    <WorksheetFieldImpl label="CPP/QPP Survivor Benefit ($/mo)" value={form.primaryIncome.cppSurvivorBenefit} onChange={v => setForm(f => ({ ...f, primaryIncome: { ...f.primaryIncome, cppSurvivorBenefit: v } }))} testId="input-ws-primary-cpp" />
                    <WorksheetFieldImpl label="Target Age (Income Needed To)" value={form.primaryIncome.targetAge} onChange={v => setForm(f => ({ ...f, primaryIncome: { ...f.primaryIncome, targetAge: v } }))} testId="input-ws-primary-target-age" prefix="" />
                    <p className="text-xs text-muted-foreground">Years of income: {calc.primaryYears}</p>
                  </div>
                  <div className="space-y-3 p-4 border border-border rounded-xl">
                    <div className="flex justify-between"><p className="text-sm font-semibold text-purple-600">Spouse (D)</p><p className="font-bold text-blue-600">{fmt$(calc.subtotalD)}</p></div>
                    <WorksheetFieldImpl label="Income Replacement %" value={form.spouseIncome.replacementPct} onChange={v => setForm(f => ({ ...f, spouseIncome: { ...f.spouseIncome, replacementPct: v } }))} testId="input-ws-spouse-rep-pct" prefix="%" />
                    <WorksheetFieldImpl label="CPP/QPP Survivor Benefit ($/mo)" value={form.spouseIncome.cppSurvivorBenefit} onChange={v => setForm(f => ({ ...f, spouseIncome: { ...f.spouseIncome, cppSurvivorBenefit: v } }))} testId="input-ws-spouse-cpp" />
                    <WorksheetFieldImpl label="Target Age (Income Needed To)" value={form.spouseIncome.targetAge} onChange={v => setForm(f => ({ ...f, spouseIncome: { ...f.spouseIncome, targetAge: v } }))} testId="input-ws-spouse-target-age" prefix="" />
                    <p className="text-xs text-muted-foreground">Years of income: {calc.spouseYears}</p>
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center gap-2 mb-4"><PiggyBank className="w-5 h-5 text-green-500" /><h3 className="font-display font-bold text-lg">Financial Assets Available</h3></div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3 p-4 border border-border rounded-xl">
                    <div className="flex justify-between"><p className="text-sm font-semibold text-primary">Primary (E)</p><p className="font-bold text-green-600">{fmt$(calc.subtotalE)}</p></div>
                    <WorksheetFieldImpl label="Liquid Savings" value={form.primaryAssets.liquidSavings} onChange={v => setForm(f => ({ ...f, primaryAssets: { ...f.primaryAssets, liquidSavings: v } }))} testId="input-ws-primary-liquid" />
                    <AssetRowImpl label="RRSPs" value={form.primaryAssets.rrsps} onValueChange={v => setForm(f => ({ ...f, primaryAssets: { ...f.primaryAssets, rrsps: v } }))} useIt={form.primaryAssets.rrspsUse} onToggle={() => setForm(f => ({ ...f, primaryAssets: { ...f.primaryAssets, rrspsUse: !f.primaryAssets.rrspsUse } }))} testId="primary-rrsp" />
                    <AssetRowImpl label="Non-Registered" value={form.primaryAssets.nonRegistered} onValueChange={v => setForm(f => ({ ...f, primaryAssets: { ...f.primaryAssets, nonRegistered: v } }))} useIt={form.primaryAssets.nonRegisteredUse} onToggle={() => setForm(f => ({ ...f, primaryAssets: { ...f.primaryAssets, nonRegisteredUse: !f.primaryAssets.nonRegisteredUse } }))} testId="primary-nonreg" />
                    <AssetRowImpl label="TFSA" value={form.primaryAssets.tfsa} onValueChange={v => setForm(f => ({ ...f, primaryAssets: { ...f.primaryAssets, tfsa: v } }))} useIt={form.primaryAssets.tfsaUse} onToggle={() => setForm(f => ({ ...f, primaryAssets: { ...f.primaryAssets, tfsaUse: !f.primaryAssets.tfsaUse } }))} testId="primary-tfsa" />
                    <WorksheetFieldImpl label="Other" value={form.primaryAssets.other} onChange={v => setForm(f => ({ ...f, primaryAssets: { ...f.primaryAssets, other: v } }))} testId="input-ws-primary-other-asset" />
                  </div>
                  <div className="space-y-3 p-4 border border-border rounded-xl">
                    <div className="flex justify-between"><p className="text-sm font-semibold text-purple-600">Spouse (F)</p><p className="font-bold text-green-600">{fmt$(calc.subtotalF)}</p></div>
                    <WorksheetFieldImpl label="Liquid Savings" value={form.spouseAssets.liquidSavings} onChange={v => setForm(f => ({ ...f, spouseAssets: { ...f.spouseAssets, liquidSavings: v } }))} testId="input-ws-spouse-liquid" />
                    <AssetRowImpl label="RRSPs" value={form.spouseAssets.rrsps} onValueChange={v => setForm(f => ({ ...f, spouseAssets: { ...f.spouseAssets, rrsps: v } }))} useIt={form.spouseAssets.rrspsUse} onToggle={() => setForm(f => ({ ...f, spouseAssets: { ...f.spouseAssets, rrspsUse: !f.spouseAssets.rrspsUse } }))} testId="spouse-rrsp" />
                    <AssetRowImpl label="Non-Registered" value={form.spouseAssets.nonRegistered} onValueChange={v => setForm(f => ({ ...f, spouseAssets: { ...f.spouseAssets, nonRegistered: v } }))} useIt={form.spouseAssets.nonRegisteredUse} onToggle={() => setForm(f => ({ ...f, spouseAssets: { ...f.spouseAssets, nonRegisteredUse: !f.spouseAssets.nonRegisteredUse } }))} testId="spouse-nonreg" />
                    <AssetRowImpl label="TFSA" value={form.spouseAssets.tfsa} onValueChange={v => setForm(f => ({ ...f, spouseAssets: { ...f.spouseAssets, tfsaUse: !f.spouseAssets.tfsaUse } }))} useIt={form.spouseAssets.tfsaUse} onToggle={() => setForm(f => ({ ...f, spouseAssets: { ...f.spouseAssets, tfsaUse: !f.spouseAssets.tfsaUse } }))} testId="spouse-tfsa" />
                    <WorksheetFieldImpl label="Other" value={form.spouseAssets.other} onChange={v => setForm(f => ({ ...f, spouseAssets: { ...f.spouseAssets, other: v } }))} testId="input-ws-spouse-other-asset" />
                  </div>
                </div>
              </section>

              <section className="border-2 border-primary/20 rounded-2xl p-6 bg-primary/5">
                <div className="flex items-center gap-2 mb-4"><Shield className="w-5 h-5 text-primary" /><h3 className="font-display font-bold text-lg">Total Life Insurance Need</h3></div>
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <p className="text-sm font-semibold mb-2">Primary: A + B + C - E</p>
                    <p className="text-2xl font-bold mt-2" data-testid="text-ws-primary-total">{fmt$(calc.primaryNeed)}</p>
                    <div className="mt-3 space-y-2">
                      <WorksheetFieldImpl label="Existing Life Coverage" value={form.primaryExistingCoverage} onChange={v => setForm(f => ({ ...f, primaryExistingCoverage: v }))} testId="input-ws-primary-existing" />
                      <p className={`text-lg font-bold ${calc.primaryNet > 0 ? "text-red-600" : "text-green-600"}`} data-testid="text-ws-primary-net-need">Net Need: {fmt$(calc.primaryNet)}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold mb-2">Spouse: A + B + D - F</p>
                    <p className="text-2xl font-bold mt-2" data-testid="text-ws-spouse-total">{fmt$(calc.spouseNeed)}</p>
                    <div className="mt-3 space-y-2">
                      <WorksheetFieldImpl label="Existing Life Coverage" value={form.spouseExistingCoverage} onChange={v => setForm(f => ({ ...f, spouseExistingCoverage: v }))} testId="input-ws-spouse-existing" />
                      <p className={`text-lg font-bold ${calc.spouseNet > 0 ? "text-red-600" : "text-green-600"}`} data-testid="text-ws-spouse-net-need">Net Need: {fmt$(calc.spouseNet)}</p>
                    </div>
                  </div>
                </div>
              </section>
              <section>
                <div className="flex items-center gap-2 mb-4"><FileSignature className="w-5 h-5 text-gray-500" /><h3 className="font-display font-bold text-lg">Decision &amp; Acknowledgement</h3></div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3 p-4 border border-border rounded-xl">
                    <p className="text-sm font-semibold text-primary">Primary</p>
                    <WorksheetFieldImpl label="Coverage Amount Purchased" value={form.primaryCoveragePurchased} onChange={v => setForm(f => ({ ...f, primaryCoveragePurchased: v }))} testId="input-ws-primary-purchased" />
                    <div><label className="text-xs font-medium text-muted-foreground">Acknowledged Shortfall</label>
                    <p className="text-sm font-bold text-red-600 mt-1">{fmt$(Math.max(0, calc.primaryNet - v(form.primaryCoveragePurchased)))}</p></div>
                    <div><label className="text-xs font-medium text-muted-foreground">Signature (Printed Name)</label><input type="text" value={form.primarySignature} onChange={e => setForm(f => ({ ...f, primarySignature: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm mt-1 bg-background" /></div>
                  </div>
                  <div className="space-y-3 p-4 border border-border rounded-xl">
                    <p className="text-sm font-semibold text-purple-600">Spouse</p>
                    <WorksheetFieldImpl label="Coverage Amount Purchased" value={form.spouseCoveragePurchased} onChange={v => setForm(f => ({ ...f, spouseCoveragePurchased: v }))} testId="input-ws-spouse-purchased" />
                    <div><label className="text-xs font-medium text-muted-foreground">Acknowledged Shortfall</label>
                    <p className="text-sm font-bold text-red-600 mt-1">{fmt$(Math.max(0, calc.spouseNet - v(form.spouseCoveragePurchased)))}</p></div>
                    <div><label className="text-xs font-medium text-muted-foreground">Signature (Printed Name)</label><input type="text" value={form.spouseSignature} onChange={e => setForm(f => ({ ...f, spouseSignature: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm mt-1 bg-background" /></div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6 mt-4">
                  <div><label className="text-xs font-medium text-muted-foreground">Date</label><input type="date" value={form.signatureDate} onChange={e => setForm(f => ({ ...f, signatureDate: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm mt-1 bg-background" /></div>
                </div>
                <div className="mt-4"><label className="text-xs font-medium text-muted-foreground">Meeting Notes</label><textarea value={form.meetingNotes} onChange={e => setForm(f => ({ ...f, meetingNotes: e.target.value }))} rows={3} className="w-full px-3 py-2 rounded-lg border text-sm mt-1 bg-background" /></div>
              </section>

              <div className="sticky bottom-0 bg-background pt-4 pb-2 border-t border-border flex justify-between items-center">
                <div className="flex items-center gap-2">
                  {viewingId && (
                    <button type="button"
                      onClick={async () => { const token = localStorage.getItem("fp_token"); const res = await fetch(`/api/reports/${clientId}/fna/${viewingId}`, { headers: { Authorization: `Bearer ${token}` } }); const html = await res.text(); const blob = new Blob([html], { type: "text/html" }); window.open(URL.createObjectURL(blob), "_blank"); }}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold border border-border hover:bg-muted text-sm">
                      <Printer className="w-4 h-4" /> Report
                    </button>
                  )}
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowWorksheet(false)} data-testid="button-ws-cancel" className="px-6 py-3 rounded-xl font-semibold text-muted-foreground hover:bg-muted">Cancel</button>
                  <button type="submit" disabled={createWorksheet.isPending} data-testid="button-ws-save" className="px-8 py-3 rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                    {createWorksheet.isPending ? <><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Saving...</> : viewingId ? "Update Analysis" : "Save Analysis"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── RESP Tab ──────────────────────────────────────────────────────────────────

function RESPTab({ clientId, planId }: { clientId: number; planId: number | null }) {
  const { data: savings = [] } = useEducationSavings(clientId);
  const { data: simResults = [] } = useSimulationResults(planId);
  const createSaving = useCreateEducationSaving();
  const deleteSaving = useDeleteEducationSaving(clientId);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ childName: "", childAge: "", targetAge: "18", currentBalance: "0", monthlyContribution: "0", expectedReturn: "5", estimatedCost: "80000", accountType: "RESP", notes: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createSaving.mutate({ clientId, data: { childName: form.childName, childAge: parseInt(form.childAge), targetAge: parseInt(form.targetAge), currentBalance: form.currentBalance, monthlyContribution: form.monthlyContribution, expectedReturn: form.expectedReturn, estimatedCost: form.estimatedCost, accountType: form.accountType, notes: form.notes || undefined } },
      { onSuccess: () => { setShowAdd(false); setForm({ childName: "", childAge: "", targetAge: "18", currentBalance: "0", monthlyContribution: "0", expectedReturn: "5", estimatedCost: "80000", accountType: "RESP", notes: "" }); } });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-display font-bold">Education Savings (RESP)</h2>
        <button onClick={() => setShowAdd(true)} data-testid="button-fp-add-resp" className="flex items-center space-x-2 px-4 py-2 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/90 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /><span>Add Plan</span>
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {(savings as any[]).map(s => {
          const yearsLeft = Math.max(0, s.targetAge - s.childAge);
          const bal = parseFloat(s.currentBalance);
          const monthly = parseFloat(s.monthlyContribution);
          const rate = parseFloat(s.expectedReturn) / 100 / 12;
          const months = yearsLeft * 12;
          const projected = months > 0 ? bal * Math.pow(1 + rate, months) + monthly * ((Math.pow(1 + rate, months) - 1) / rate) : bal;
          const gap = parseFloat(s.estimatedCost) - projected;
          return (
            <div key={s.id} className="border border-border rounded-2xl p-6" data-testid={`card-fp-resp-${s.id}`}>
              <div className="flex justify-between items-start">
                <div><h3 className="text-lg font-bold">{s.childName}</h3><p className="text-sm text-muted-foreground">Age {s.childAge} | {s.accountType} | Target: Age {s.targetAge}</p></div>
                <button onClick={() => { if (confirm("Delete?")) deleteSaving.mutate(s.id); }} data-testid={`button-fp-del-resp-${s.id}`} className="p-2 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div><p className="text-xs text-muted-foreground uppercase">Current Balance</p><p className="text-lg font-bold text-primary">{fmt$(bal)}</p></div>
                <div><p className="text-xs text-muted-foreground uppercase">Monthly Contribution</p><p className="text-lg font-bold">{fmt$(monthly)}</p></div>
                <div><p className="text-xs text-muted-foreground uppercase">Projected at Target</p><p className="text-lg font-bold text-blue-600">{fmt$(Math.round(projected))}</p></div>
                <div><p className="text-xs text-muted-foreground uppercase">Gap / Surplus</p><p className={`text-lg font-bold ${gap > 0 ? "text-red-600" : "text-green-600"}`}>{gap > 0 ? "-" : "+"}{fmt$(Math.abs(Math.round(gap)))}</p></div>
              </div>
              {s.notes && <p className="mt-4 text-sm text-muted-foreground bg-muted/30 p-3 rounded-xl">{s.notes}</p>}
            </div>
          );
        })}
      </div>
      {savings.length === 0 && <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-2xl">No education savings plans yet.</div>}
      <ModuleScenarioPreview planId={planId} module="education" />
      <RespFundingGauge results={simResults} savings={savings as any[]} />
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-display font-bold mb-6">Add Education Savings Plan</h2>
            <form onSubmit={handleSubmit} className="space-y-4" data-testid="form-fp-resp">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-semibold">Child Name</label><input required value={form.childName} onChange={e => setForm({ ...form, childName: e.target.value })} data-testid="input-fp-resp-name" className="w-full px-3 py-2 rounded-xl border mt-1" /></div>
                <div><label className="text-sm font-semibold">Account Type</label><select value={form.accountType} onChange={e => setForm({ ...form, accountType: e.target.value })} data-testid="select-fp-resp-type" className="w-full px-3 py-2 rounded-xl border mt-1"><option value="RESP">RESP</option><option value="RDSP">RDSP</option><option value="Other">Other</option></select></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="text-sm font-semibold">Current Age</label><input type="number" required value={form.childAge} onChange={e => setForm({ ...form, childAge: e.target.value })} data-testid="input-fp-resp-age" className="w-full px-3 py-2 rounded-xl border mt-1" /></div>
                <div><label className="text-sm font-semibold">Target Age</label><input type="number" required value={form.targetAge} onChange={e => setForm({ ...form, targetAge: e.target.value })} data-testid="input-fp-resp-target" className="w-full px-3 py-2 rounded-xl border mt-1" /></div>
                <div><label className="text-sm font-semibold">Return (%)</label><input type="number" step="0.1" required value={form.expectedReturn} onChange={e => setForm({ ...form, expectedReturn: e.target.value })} data-testid="input-fp-resp-return" className="w-full px-3 py-2 rounded-xl border mt-1" /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="text-sm font-semibold">Balance ($)</label><input type="number" required value={form.currentBalance} onChange={e => setForm({ ...form, currentBalance: e.target.value })} data-testid="input-fp-resp-balance" className="w-full px-3 py-2 rounded-xl border mt-1" /></div>
                <div><label className="text-sm font-semibold">Monthly ($)</label><input type="number" required value={form.monthlyContribution} onChange={e => setForm({ ...form, monthlyContribution: e.target.value })} data-testid="input-fp-resp-monthly" className="w-full px-3 py-2 rounded-xl border mt-1" /></div>
                <div><label className="text-sm font-semibold">Est. Cost ($)</label><input type="number" required value={form.estimatedCost} onChange={e => setForm({ ...form, estimatedCost: e.target.value })} data-testid="input-fp-resp-cost" className="w-full px-3 py-2 rounded-xl border mt-1" /></div>
              </div>
              <div><label className="text-sm font-semibold">Notes</label><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} data-testid="input-fp-resp-notes" className="w-full px-3 py-2 rounded-xl border mt-1 min-h-[80px]" /></div>
              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setShowAdd(false)} className="px-6 py-3 rounded-xl font-semibold text-muted-foreground hover:bg-muted">Cancel</button>
                <button type="submit" disabled={createSaving.isPending} data-testid="button-fp-submit-resp" className="px-6 py-3 rounded-xl font-semibold bg-primary text-primary-foreground">{createSaving.isPending ? "Adding..." : "Add Plan"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Debt Tab ──────────────────────────────────────────────────────────────────

function DebtTab({ clientId, planId }: { clientId: number; planId: number | null }) {
  const { data: debts = [] } = useDebtEntries(clientId);
  const createDebt = useCreateDebtEntry();
  const deleteDebt = useDeleteDebtEntry(clientId);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", category: "Credit Card", balance: "", interestRate: "", minimumPayment: "", term: "", notes: "" });
  const categories = ["Mortgage", "Car Loan", "Student Loan", "Credit Card", "Personal Loan", "Line of Credit", "Other"];
  const totalDebt = (debts as any[]).reduce((s, d) => s + parseFloat(d.balance || "0"), 0);
  const avgRate = debts.length > 0 ? (debts as any[]).reduce((s, d) => s + parseFloat(d.interestRate || "0"), 0) / debts.length : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createDebt.mutate({ clientId, data: { name: form.name, category: form.category, balance: form.balance, interestRate: form.interestRate, minimumPayment: form.minimumPayment || "0", term: form.term || undefined, notes: form.notes || undefined } },
      { onSuccess: () => { setShowAdd(false); setForm({ name: "", category: "Credit Card", balance: "", interestRate: "", minimumPayment: "", term: "", notes: "" }); } });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-display font-bold">Debt Management</h2>
        <button onClick={() => setShowAdd(true)} data-testid="button-fp-add-debt" className="flex items-center space-x-2 px-4 py-2 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/90 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /><span>Add Debt</span>
        </button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="border border-red-200 rounded-2xl p-5 bg-red-50/50" data-testid="fp-total-debt"><p className="text-xs font-semibold text-red-500 uppercase tracking-wider">Total Debt</p><p className="text-2xl font-bold text-red-600 mt-1">{fmt$(totalDebt)}</p></div>
        <div className="border border-border rounded-2xl p-5" data-testid="fp-debt-accounts"><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Accounts</p><p className="text-2xl font-bold mt-1">{debts.length}</p></div>
        <div className="border border-orange-200 rounded-2xl p-5 bg-orange-50/50" data-testid="fp-avg-rate"><p className="text-xs font-semibold text-orange-600 uppercase tracking-wider">Avg Interest Rate</p><p className="text-2xl font-bold text-orange-700 mt-1">{avgRate.toFixed(1)}%</p></div>
      </div>
      <div className="border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50"><tr>
            <th className="text-left px-4 py-3 font-semibold">Name</th>
            <th className="text-left px-4 py-3 font-semibold">Category</th>
            <th className="text-right px-4 py-3 font-semibold">Balance</th>
            <th className="text-right px-4 py-3 font-semibold">Rate</th>
            <th className="text-right px-4 py-3 font-semibold">Min. Payment</th>
            <th className="text-center px-4 py-3 font-semibold">Actions</th>
          </tr></thead>
          <tbody>
            {(debts as any[]).map(d => (
              <tr key={d.id} className="border-t hover:bg-muted/30" data-testid={`row-fp-debt-${d.id}`}>
                <td className="px-4 py-3 font-medium">{d.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{d.category}</td>
                <td className="px-4 py-3 text-right font-semibold text-red-600">{fmt$(parseFloat(d.balance))}</td>
                <td className="px-4 py-3 text-right">{parseFloat(d.interestRate).toFixed(1)}%</td>
                <td className="px-4 py-3 text-right">{fmt$(parseFloat(d.minimumPayment))}</td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => { if (confirm("Delete?")) deleteDebt.mutate(d.id); }} data-testid={`button-fp-del-debt-${d.id}`} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-400" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {debts.length === 0 && <div className="text-center py-12 text-muted-foreground">No debts tracked yet.</div>}
      </div>
      <ModuleScenarioPreview planId={planId} module="debt" />
      <DebtPayoffTimeline debts={debts as any[]} />
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-6">
            <h2 className="text-2xl font-display font-bold mb-6">Add Debt Account</h2>
            <form onSubmit={handleSubmit} className="space-y-4" data-testid="form-fp-debt">
              <div><label className="text-sm font-semibold">Name</label><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} data-testid="input-fp-debt-name" className="w-full px-3 py-2 rounded-xl border mt-1" placeholder="e.g. TD Visa" /></div>
              <div><label className="text-sm font-semibold">Category</label><select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} data-testid="select-fp-debt-cat" className="w-full px-3 py-2 rounded-xl border mt-1">{categories.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="text-sm font-semibold">Balance ($)</label><input type="number" step="0.01" required value={form.balance} onChange={e => setForm({ ...form, balance: e.target.value })} data-testid="input-fp-debt-balance" className="w-full px-3 py-2 rounded-xl border mt-1" /></div>
                <div><label className="text-sm font-semibold">Rate (%)</label><input type="number" step="0.01" required value={form.interestRate} onChange={e => setForm({ ...form, interestRate: e.target.value })} data-testid="input-fp-debt-rate" className="w-full px-3 py-2 rounded-xl border mt-1" /></div>
                <div><label className="text-sm font-semibold">Min Payment ($)</label><input type="number" step="0.01" value={form.minimumPayment} onChange={e => setForm({ ...form, minimumPayment: e.target.value })} data-testid="input-fp-debt-min" className="w-full px-3 py-2 rounded-xl border mt-1" /></div>
              </div>
              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setShowAdd(false)} className="px-6 py-3 rounded-xl font-semibold text-muted-foreground hover:bg-muted">Cancel</button>
                <button type="submit" disabled={createDebt.isPending} data-testid="button-fp-submit-debt" className="px-6 py-3 rounded-xl font-semibold bg-primary text-primary-foreground">{createDebt.isPending ? "Adding..." : "Add Debt"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
// ── Tax Tab (complete rework — engine-backed) ─────────────────────────────────

type TaxSubTab = "notes" | "rrsp" | "tfsa" | "projection" | "capgains" | "splitting";

const taxSubTabs: Array<{ key: TaxSubTab; label: string }> = [
  { key: "notes",      label: "Planning Notes" },
  { key: "rrsp",       label: "RRSP Room" },
  { key: "tfsa",       label: "TFSA Room" },
  { key: "projection", label: "Tax Projection" },
  { key: "capgains",   label: "Capital Gains" },
  { key: "splitting",  label: "Income Splitting" },
];

function TaxNotesPanel({ clientId }: { clientId: number }) {
  const { data: notes = [] } = useTaxPlanningNotes(clientId);
  const createNote = useCreateTaxPlanningNote();
  const deleteNote = useDeleteTaxPlanningNote(clientId);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ taxYear: String(new Date().getFullYear()), category: "General", title: "", content: "" });
  const categories = ["General", "RRSP Optimization", "TFSA Strategy", "Income Splitting", "Capital Gains", "Tax Loss Harvesting", "Charitable Donations", "Corporate Tax", "Other"];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createNote.mutate({ clientId, data: { taxYear: parseInt(form.taxYear), category: form.category, title: form.title, content: form.content } },
      { onSuccess: () => { setShowAdd(false); setForm({ taxYear: String(new Date().getFullYear()), category: "General", title: "", content: "" }); } });
  };

  const grouped = (notes as any[]).reduce((acc, n) => {
    if (!acc[n.taxYear]) acc[n.taxYear] = [];
    acc[n.taxYear].push(n);
    return acc;
  }, {} as Record<number, any[]>);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowAdd(true)} data-testid="button-fp-add-tax" className="flex items-center space-x-2 px-3 py-2 bg-secondary text-secondary-foreground text-sm font-semibold rounded-xl hover:bg-secondary/90">
          <Plus className="w-4 h-4" /><span>Add Note</span>
        </button>
      </div>
      {Object.entries(grouped).sort(([a], [b]) => Number(b) - Number(a)).map(([year, yearNotes]) => (
        <div key={year} className="border border-border rounded-2xl p-5">
          <h3 className="text-base font-bold mb-3">Tax Year {year}</h3>
          <div className="space-y-3">
            {(yearNotes as any[]).map(n => (
              <div key={n.id} className="border border-border/50 rounded-xl p-4 hover:bg-muted/30 group" data-testid={`card-fp-tax-${n.id}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-semibold text-amber-600 uppercase">{n.category}</span>
                    <h4 className="font-semibold mt-1">{n.title}</h4>
                    <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{n.content}</p>
                  </div>
                  <button onClick={() => { if (confirm("Delete?")) deleteNote.mutate(n.id); }} data-testid={`button-fp-del-tax-${n.id}`} className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {notes.length === 0 && <div className="text-center py-10 text-muted-foreground border border-dashed border-border rounded-2xl">No tax planning notes yet.</div>}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6">
            <h2 className="text-xl font-display font-bold mb-5">Add Tax Planning Note</h2>
            <form onSubmit={handleSubmit} className="space-y-4" data-testid="form-fp-tax">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-semibold">Tax Year</label><input type="number" required value={form.taxYear} onChange={e => setForm({ ...form, taxYear: e.target.value })} data-testid="input-fp-tax-year" className="w-full px-3 py-2 rounded-xl border mt-1" /></div>
                <div><label className="text-sm font-semibold">Category</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} data-testid="select-fp-tax-cat" className="w-full px-3 py-2 rounded-xl border mt-1">
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="text-sm font-semibold">Title</label><input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} data-testid="input-fp-tax-title" className="w-full px-3 py-2 rounded-xl border mt-1" /></div>
              <div><label className="text-sm font-semibold">Content</label><textarea required value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} data-testid="input-fp-tax-content" className="w-full px-3 py-2 rounded-xl border mt-1 min-h-[120px]" /></div>
              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setShowAdd(false)} className="px-6 py-3 rounded-xl font-semibold text-muted-foreground hover:bg-muted">Cancel</button>
                <button type="submit" disabled={createNote.isPending} data-testid="button-fp-submit-tax" className="px-6 py-3 rounded-xl font-semibold bg-primary text-primary-foreground">{createNote.isPending ? "Adding..." : "Add Note"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function RrspRoomPanel({ clientId }: { clientId: number }) {
  const rrspRoom = useRrspRoom(clientId);
  const [form, setForm] = useState({ currentCarryForwardRoom: "0", priorYearEarnedIncome: "80000", currentYearContributions: "0", pensionAdjustment: "0", currentAge: "35" });

  const handleCalc = () => {
    rrspRoom.mutate({
      currentCarryForwardRoom:    parseFloat(form.currentCarryForwardRoom),
      priorYearEarnedIncome:      parseFloat(form.priorYearEarnedIncome),
      currentYearContributions:   parseFloat(form.currentYearContributions),
      pensionAdjustment:          parseFloat(form.pensionAdjustment),
      currentAge:                 parseInt(form.currentAge),
    });
  };

  const result = rrspRoom.data;

  return (
    <div className="space-y-5">
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
        <strong>RRSP Room Calculator</strong> — Based on CRA's 18% of prior year earned income, subject to the annual dollar limit.
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {[
          { label: "Carry-Forward Room ($)", key: "currentCarryForwardRoom" },
          { label: "Prior Year Earned Income ($)", key: "priorYearEarnedIncome" },
          { label: "Contributions Made This Year ($)", key: "currentYearContributions" },
          { label: "Pension Adjustment ($)", key: "pensionAdjustment" },
          { label: "Current Age", key: "currentAge" },
        ].map(f => (
          <div key={f.key}>
            <label className="text-sm font-semibold">{f.label}</label>
            <input type="number" value={(form as any)[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border mt-1 text-sm" />
          </div>
        ))}
      </div>
      <button onClick={handleCalc} disabled={rrspRoom.isPending} data-testid="button-calc-rrsp" className="flex items-center space-x-2 px-5 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-50">
        <Calculator className="w-4 h-4" /><span>{rrspRoom.isPending ? "Calculating..." : "Calculate Room"}</span>
      </button>
      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "New Room This Year",    value: fmt$(result.summary.newRoomThisYear),         color: "text-green-600" },
              { label: "Carry-Forward",         value: fmt$(result.summary.carryForwardBroughtIn),   color: "text-blue-600" },
              { label: "Total Available Room",  value: fmt$(result.summary.totalAvailableRoom),      color: "text-primary" },
              { label: "Closing Room",          value: fmt$(result.summary.closingRoom),             color: "text-purple-600" },
            ].map(card => (
              <div key={card.label} className="border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground uppercase">{card.label}</p>
                <p className={`text-xl font-bold mt-1 ${card.color}`}>{card.value}</p>
              </div>
            ))}
          </div>
          {result.summary.yearsUntilConversion !== null && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              <strong>Note:</strong> RRSP must convert to RRIF by December 31 of the year the annuitant turns 71. Approximately <strong>{result.summary.yearsUntilConversion} years</strong> remaining.
            </div>
          )}
          <div className="border border-border rounded-xl p-4">
            <p className="text-sm font-semibold mb-3">Future Annual RRSP Limits</p>
            <div className="grid grid-cols-5 gap-2">
              {result.futureLimits.map(fl => (
                <div key={fl.year} className="text-center p-2 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">{fl.year}</p>
                  <p className="text-sm font-bold">{fmt$(fl.limit)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TfsaRoomPanel({ clientId }: { clientId: number }) {
  const tfsaRoom = useTfsaRoom(clientId);
  const [form, setForm] = useState({ yearTurned18: String(new Date().getFullYear() - 30), currentCarryForwardRoom: "0", currentYearContributions: "0", currentYearWithdrawals: "0" });

  const handleCalc = () => {
    tfsaRoom.mutate({
      yearTurned18:             parseInt(form.yearTurned18),
      currentCarryForwardRoom:  parseFloat(form.currentCarryForwardRoom),
      currentYearContributions: parseFloat(form.currentYearContributions),
      currentYearWithdrawals:   parseFloat(form.currentYearWithdrawals),
    });
  };

  const result = tfsaRoom.data;

  return (
    <div className="space-y-5">
      <div className="p-4 bg-teal-50 border border-teal-200 rounded-xl text-sm text-teal-800">
        <strong>TFSA Room Calculator</strong> — Cumulative room accrues from the year you turn 18 (or 2009, whichever is later). Withdrawals are re-added at the start of the following year.
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Year Turned 18", key: "yearTurned18" },
          { label: "Carry-Forward Room ($)", key: "currentCarryForwardRoom" },
          { label: "Contributions This Year ($)", key: "currentYearContributions" },
          { label: "Withdrawals Last Year ($)", key: "currentYearWithdrawals" },
        ].map(f => (
          <div key={f.key}>
            <label className="text-sm font-semibold">{f.label}</label>
            <input type="number" value={(form as any)[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border mt-1 text-sm" />
          </div>
        ))}
      </div>
      <button onClick={handleCalc} disabled={tfsaRoom.isPending} data-testid="button-calc-tfsa" className="flex items-center space-x-2 px-5 py-2.5 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700 disabled:opacity-50">
        <Calculator className="w-4 h-4" /><span>{tfsaRoom.isPending ? "Calculating..." : "Calculate Room"}</span>
      </button>
      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Annual Limit This Year",  value: fmt$(result.summary.annualLimitThisYear),   color: "text-green-600" },
              { label: "Cumulative Room (2009+)", value: fmt$(result.cumulativeRoomSince2009),        color: "text-blue-600" },
              { label: "Total Available Room",    value: fmt$(result.summary.totalAvailableRoom),     color: "text-teal-600" },
              { label: "Closing Room",            value: fmt$(result.summary.closingRoom),            color: "text-primary" },
            ].map(card => (
              <div key={card.label} className="border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground uppercase">{card.label}</p>
                <p className={`text-xl font-bold mt-1 ${card.color}`}>{card.value}</p>
              </div>
            ))}
          </div>
          <div className="border border-border rounded-xl p-4">
            <p className="text-sm font-semibold mb-3">Future Annual TFSA Limits</p>
            <div className="grid grid-cols-5 gap-2">
              {result.futureLimits.map(fl => (
                <div key={fl.year} className="text-center p-2 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">{fl.year}</p>
                  <p className="text-sm font-bold">{fmt$(fl.limit)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TaxProjectionPanel({ clientId }: { clientId: number }) {
  const [taxInput, setTaxInput] = useState<Record<string, unknown> | null>(null);
  const taxProjection = useTaxProjection(clientId, taxInput);
  const [form, setForm] = useState({
    currentAge: "40", retirementAge: "65", planToAge: "90", province: "ON",
    employmentIncome: "120000", selfEmploymentIncome: "0", otherIncome: "0", incomeGrowthRate: "0.03",
    rrspBalance: "200000", rrspContributionRoom: "50000", rrspAnnualContribution: "18000",
    tfsaBalance: "80000", tfsaContributionRoom: "20000", tfsaAnnualContribution: "7000",
    nonRegBalance: "50000", nonRegAcb: "40000", nonRegAnnualContrib: "5000", portfolioYield: "0.06",
    desiredRetirementIncome: "80000", pensionIncome: "0", cppStartAge: "65", oasStartAge: "65",
  });
  const [showTable, setShowTable] = useState(false);
  const provinces = ["ON", "BC", "AB", "QC", "MB", "SK", "NS", "NB", "PE", "NL"];

  const [projResult, setProjResult] = useState<any>(null);
 
  const handleCalc = () => {
    const input: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(form)) {
      input[k] = isNaN(Number(v)) ? v : Number(v);
    }
   taxProjection.mutate({ clientId, data: input } as any, {
     onSuccess: (data: any) => setProjResult(data),
});
};

const result = projResult; 
  return (
    <div className="space-y-5">
      <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl text-sm text-purple-800">
        <strong>Tax Projection</strong> — Year-by-year income, tax, and wealth projection through retirement using 2024 federal and provincial tax brackets.
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div><label className="text-sm font-semibold">Current Age</label><input type="number" value={form.currentAge} onChange={e => setForm(f => ({ ...f, currentAge: e.target.value }))} className="w-full px-3 py-2 rounded-xl border mt-1 text-sm" /></div>
        <div><label className="text-sm font-semibold">Retirement Age</label><input type="number" value={form.retirementAge} onChange={e => setForm(f => ({ ...f, retirementAge: e.target.value }))} className="w-full px-3 py-2 rounded-xl border mt-1 text-sm" /></div>
        <div><label className="text-sm font-semibold">Plan To Age</label><input type="number" value={form.planToAge} onChange={e => setForm(f => ({ ...f, planToAge: e.target.value }))} className="w-full px-3 py-2 rounded-xl border mt-1 text-sm" /></div>
        <div><label className="text-sm font-semibold">Province</label>
          <select value={form.province} onChange={e => setForm(f => ({ ...f, province: e.target.value }))} className="w-full px-3 py-2 rounded-xl border mt-1 text-sm">
            {provinces.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div><label className="text-sm font-semibold">Employment Income ($)</label><input type="number" value={form.employmentIncome} onChange={e => setForm(f => ({ ...f, employmentIncome: e.target.value }))} className="w-full px-3 py-2 rounded-xl border mt-1 text-sm" /></div>
        <div><label className="text-sm font-semibold">RRSP Balance ($)</label><input type="number" value={form.rrspBalance} onChange={e => setForm(f => ({ ...f, rrspBalance: e.target.value }))} className="w-full px-3 py-2 rounded-xl border mt-1 text-sm" /></div>
        <div><label className="text-sm font-semibold">TFSA Balance ($)</label><input type="number" value={form.tfsaBalance} onChange={e => setForm(f => ({ ...f, tfsaBalance: e.target.value }))} className="w-full px-3 py-2 rounded-xl border mt-1 text-sm" /></div>
        <div><label className="text-sm font-semibold">Desired Retirement Income ($)</label><input type="number" value={form.desiredRetirementIncome} onChange={e => setForm(f => ({ ...f, desiredRetirementIncome: e.target.value }))} className="w-full px-3 py-2 rounded-xl border mt-1 text-sm" /></div>
        <div><label className="text-sm font-semibold">RRSP Annual Contribution ($)</label><input type="number" value={form.rrspAnnualContribution} onChange={e => setForm(f => ({ ...f, rrspAnnualContribution: e.target.value }))} className="w-full px-3 py-2 rounded-xl border mt-1 text-sm" /></div>
        <div><label className="text-sm font-semibold">TFSA Annual Contribution ($)</label><input type="number" value={form.tfsaAnnualContribution} onChange={e => setForm(f => ({ ...f, tfsaAnnualContribution: e.target.value }))} className="w-full px-3 py-2 rounded-xl border mt-1 text-sm" /></div>
        <div><label className="text-sm font-semibold">Portfolio Yield</label><input type="number" step="0.01" value={form.portfolioYield} onChange={e => setForm(f => ({ ...f, portfolioYield: e.target.value }))} className="w-full px-3 py-2 rounded-xl border mt-1 text-sm" /></div>
        <div><label className="text-sm font-semibold">CPP Start Age</label><input type="number" value={form.cppStartAge} onChange={e => setForm(f => ({ ...f, cppStartAge: e.target.value }))} className="w-full px-3 py-2 rounded-xl border mt-1 text-sm" /></div>
      </div>
      <button onClick={handleCalc} disabled={taxProjection.isPending} data-testid="button-calc-tax-projection" className="flex items-center space-x-2 px-5 py-2.5 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 disabled:opacity-50">
        <Calculator className="w-4 h-4" /><span>{taxProjection.isPending ? "Projecting..." : "Run Tax Projection"}</span>
      </button>
      {result?.summary && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Tax Paid (lifetime)",  value: fmt$(result.summary.totalTaxPaid),      color: "text-red-600" },
              { label: "Avg Effective Rate",          value: pct(result.summary.avgEffectiveRate),   color: "text-amber-600" },
              { label: "Final Wealth",                value: fmt$(result.summary.finalWealth),       color: "text-green-600" },
              { label: "Peak Tax Year",               value: fmt$(result.summary.peakTax),           color: "text-red-500" },
            ].map(card => (
              <div key={card.label} className="border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground uppercase">{card.label}</p>
                <p className={`text-xl font-bold mt-1 ${card.color}`}>{card.value}</p>
              </div>
            ))}
          </div>
          {result.summary.lowestMarginalRateYear && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
              <strong>Optimal Year for Capital Gains Realization:</strong> {result.summary.lowestMarginalRateYear.year} (Age {result.summary.lowestMarginalRateYear.age}) — Lowest projected marginal rate of {pct(result.summary.lowestMarginalRateYear.rate)}.
            </div>
          )}
          <button onClick={() => setShowTable(t => !t)} className="flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80">
            {showTable ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {showTable ? "Hide" : "Show"} Year-by-Year Table ({result.years?.length} years)
          </button>
          {showTable && result.years && (
            <div className="border border-border rounded-xl overflow-auto max-h-[400px]">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    {["Year", "Age", "Phase", "Gross Income", "Taxable", "Total Tax", "Eff. Rate", "Marg. Rate", "Net Income", "Total Wealth"].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(result.years as any[]).map((row, i) => (
                    <tr key={row.year} className={`border-t ${i % 2 === 0 ? "" : "bg-muted/20"} ${row.phase === "retirement" ? "text-blue-700" : ""}`}>
                      <td className="px-3 py-1.5">{row.year}</td>
                      <td className="px-3 py-1.5">{row.age}</td>
                      <td className="px-3 py-1.5 capitalize">{row.phase}</td>
                      <td className="px-3 py-1.5">{fmt$(row.totalGrossIncome)}</td>
                      <td className="px-3 py-1.5">{fmt$(row.totalTaxableIncome)}</td>
                      <td className="px-3 py-1.5 text-red-600">{fmt$(row.totalTax)}</td>
                      <td className="px-3 py-1.5">{pct(row.effectiveRate)}</td>
                      <td className="px-3 py-1.5">{pct(row.marginalRate)}</td>
                      <td className="px-3 py-1.5 text-green-700">{fmt$(row.netIncome)}</td>
                      <td className="px-3 py-1.5 font-semibold">{fmt$(row.totalWealth)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CapitalGainsPanel({ clientId }: { clientId: number }) {
  const capitalGains = useCapitalGains(clientId);
  const [positions, setPositions] = useState([{ name: "", marketValue: "", adjustedCostBase: "" }]);
  const [currentIncome, setCurrentIncome] = useState("120000");
  const [province, setProvince] = useState("ON");

  const addPosition = () => setPositions(p => [...p, { name: "", marketValue: "", adjustedCostBase: "" }]);
  const updatePos = (i: number, field: string, val: string) => setPositions(p => p.map((pos, idx) => idx === i ? { ...pos, [field]: val } : pos));
  const removePos = (i: number) => setPositions(p => p.filter((_, idx) => idx !== i));

  const handleCalc = () => {
    const filled = positions.filter(p => p.name && p.marketValue && p.adjustedCostBase);
    if (filled.length === 0) return;
    capitalGains.mutate({
      positions: filled.map(p => ({ name: p.name, marketValue: parseFloat(p.marketValue), adjustedCostBase: parseFloat(p.adjustedCostBase) })),
      currentIncome: parseFloat(currentIncome),
      province,
    });
  };

  const result = capitalGains.data;

  return (
    <div className="space-y-5">
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
        <strong>Capital Gains Analysis</strong> — Analyze unrealized gains, estimate tax at different realization amounts, and find the optimal year to crystallize gains (using 2024 inclusion rates: 50% under $250k, 2/3 over $250k).
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Investment Positions</p>
          <button onClick={addPosition} className="flex items-center gap-1 text-sm text-primary hover:text-primary/80"><Plus className="w-3 h-3" />Add Position</button>
        </div>
        {positions.map((pos, i) => (
          <div key={i} className="grid grid-cols-3 gap-3 items-end">
            <div><label className="text-xs font-medium text-muted-foreground">Security Name</label><input value={pos.name} onChange={e => updatePos(i, "name", e.target.value)} placeholder="e.g. BCE Inc" className="w-full px-3 py-2 rounded-xl border mt-1 text-sm" /></div>
            <div><label className="text-xs font-medium text-muted-foreground">Market Value ($)</label><input type="number" value={pos.marketValue} onChange={e => updatePos(i, "marketValue", e.target.value)} className="w-full px-3 py-2 rounded-xl border mt-1 text-sm" /></div>
            <div className="flex gap-2">
              <div className="flex-1"><label className="text-xs font-medium text-muted-foreground">ACB ($)</label><input type="number" value={pos.adjustedCostBase} onChange={e => updatePos(i, "adjustedCostBase", e.target.value)} className="w-full px-3 py-2 rounded-xl border mt-1 text-sm" /></div>
              {positions.length > 1 && <button onClick={() => removePos(i)} className="mt-5 p-2 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>}
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="text-sm font-semibold">Current Annual Income ($)</label><input type="number" value={currentIncome} onChange={e => setCurrentIncome(e.target.value)} className="w-full px-3 py-2 rounded-xl border mt-1 text-sm" /></div>
        <div><label className="text-sm font-semibold">Province</label>
          <select value={province} onChange={e => setProvince(e.target.value)} className="w-full px-3 py-2 rounded-xl border mt-1 text-sm">
            {["ON", "BC", "AB", "QC", "MB", "SK", "NS", "NB", "PE", "NL"].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>
      <button onClick={handleCalc} disabled={capitalGains.isPending} data-testid="button-calc-capgains" className="flex items-center space-x-2 px-5 py-2.5 bg-amber-600 text-white font-semibold rounded-xl hover:bg-amber-700 disabled:opacity-50">
        <Calculator className="w-4 h-4" /><span>{capitalGains.isPending ? "Analyzing..." : "Analyze Capital Gains"}</span>
      </button>
      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="border border-border rounded-xl p-4"><p className="text-xs text-muted-foreground uppercase">Total Unrealized Gain</p><p className="text-xl font-bold text-green-600">{fmt$(result.totalUnrealizedGain)}</p></div>
            <div className="border border-border rounded-xl p-4"><p className="text-xs text-muted-foreground uppercase">Loss Harvesting Opportunity</p><p className="text-xl font-bold text-blue-600">{fmt$(result.harvestingOpportunity)}</p></div>
            <div className="border border-border rounded-xl p-4"><p className="text-xs text-muted-foreground uppercase">Optimal Year to Realize</p><p className="text-xl font-bold text-primary">{result.recommendedYear}</p></div>
          </div>
          <div className="p-3 bg-muted/50 rounded-xl text-sm text-muted-foreground">{result.reasoning}</div>
          {result.scenarios.length > 0 && (
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50"><tr>
                  <th className="px-4 py-3 text-left">Scenario</th>
                  <th className="px-4 py-3 text-right">Amount Realized</th>
                  <th className="px-4 py-3 text-right">Inclusion Rate</th>
                  <th className="px-4 py-3 text-right">Est. Tax</th>
                  <th className="px-4 py-3 text-right">Net Proceeds</th>
                  <th className="px-4 py-3 text-right">Eff. Tax Rate</th>
                </tr></thead>
                <tbody>
                  {result.scenarios.map(s => (
                    <tr key={s.label} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{s.label}</td>
                      <td className="px-4 py-3 text-right">{fmt$(s.amountRealized)}</td>
                      <td className="px-4 py-3 text-right">{(s.inclusionRate * 100).toFixed(0)}%</td>
                      <td className="px-4 py-3 text-right text-red-600">{fmt$(s.estimatedTax)}</td>
                      <td className="px-4 py-3 text-right text-green-600">{fmt$(s.netProceeds)}</td>
                      <td className="px-4 py-3 text-right">{(s.effectiveGainsTaxRate * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function IncomeSplittingPanel({ clientId }: { clientId: number }) {
  const incomeSplit = useIncomeSplit(clientId);
  const [form, setForm] = useState({
    selfIncome: "150000", spouseIncome: "60000", eligiblePensionIncome: "0",
    selfRrspBalance: "300000", spouseRrspBalance: "80000", yearsToRetirement: "15", province: "ON",
  });

  const handleCalc = () => {
    incomeSplit.mutate({
      selfIncome:            parseFloat(form.selfIncome),
      spouseIncome:          parseFloat(form.spouseIncome),
      eligiblePensionIncome: parseFloat(form.eligiblePensionIncome),
      selfRrspBalance:       parseFloat(form.selfRrspBalance),
      spouseRrspBalance:     parseFloat(form.spouseRrspBalance),
      yearsToRetirement:     parseInt(form.yearsToRetirement),
      province:              form.province,
    });
  };

  const result = incomeSplit.data;

  return (
    <div className="space-y-5">
      <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-sm text-indigo-800">
        <strong>Income Splitting Analysis</strong> — Evaluates pension income splitting (T1032), spousal RRSP contributions, and TFSA shifting to minimize combined family tax.
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <div><label className="text-sm font-semibold">Primary Income ($)</label><input type="number" value={form.selfIncome} onChange={e => setForm(f => ({ ...f, selfIncome: e.target.value }))} className="w-full px-3 py-2 rounded-xl border mt-1 text-sm" /></div>
        <div><label className="text-sm font-semibold">Spouse Income ($)</label><input type="number" value={form.spouseIncome} onChange={e => setForm(f => ({ ...f, spouseIncome: e.target.value }))} className="w-full px-3 py-2 rounded-xl border mt-1 text-sm" /></div>
        <div><label className="text-sm font-semibold">Eligible Pension Income ($)</label><input type="number" value={form.eligiblePensionIncome} onChange={e => setForm(f => ({ ...f, eligiblePensionIncome: e.target.value }))} className="w-full px-3 py-2 rounded-xl border mt-1 text-sm" /></div>
        <div><label className="text-sm font-semibold">Primary RRSP Balance ($)</label><input type="number" value={form.selfRrspBalance} onChange={e => setForm(f => ({ ...f, selfRrspBalance: e.target.value }))} className="w-full px-3 py-2 rounded-xl border mt-1 text-sm" /></div>
        <div><label className="text-sm font-semibold">Spouse RRSP Balance ($)</label><input type="number" value={form.spouseRrspBalance} onChange={e => setForm(f => ({ ...f, spouseRrspBalance: e.target.value }))} className="w-full px-3 py-2 rounded-xl border mt-1 text-sm" /></div>
        <div><label className="text-sm font-semibold">Years to Retirement</label><input type="number" value={form.yearsToRetirement} onChange={e => setForm(f => ({ ...f, yearsToRetirement: e.target.value }))} className="w-full px-3 py-2 rounded-xl border mt-1 text-sm" /></div>
        <div><label className="text-sm font-semibold">Province</label>
          <select value={form.province} onChange={e => setForm(f => ({ ...f, province: e.target.value }))} className="w-full px-3 py-2 rounded-xl border mt-1 text-sm">
            {["ON", "BC", "AB", "QC", "MB", "SK", "NS", "NB", "PE", "NL"].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>
      <button onClick={handleCalc} disabled={incomeSplit.isPending} data-testid="button-calc-income-split" className="flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50">
        <Calculator className="w-4 h-4" /><span>{incomeSplit.isPending ? "Analyzing..." : "Analyze Income Splitting"}</span>
      </button>
      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Strategy",              value: result.strategy.replace(/_/g, " ").toUpperCase(), color: "text-indigo-600" },
              { label: "Current Combined Tax",  value: fmt$(result.currentCombinedTax),                  color: "text-red-600" },
              { label: "Optimized Combined Tax",value: fmt$(result.optimizedCombinedTax),               color: "text-green-600" },
              { label: "Annual Tax Savings",    value: fmt$(result.annualTaxSavings),                    color: "text-green-700" },
            ].map(card => (
              <div key={card.label} className="border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground uppercase">{card.label}</p>
                <p className={`text-lg font-bold mt-1 ${card.color}`}>{card.value}</p>
              </div>
            ))}
          </div>
          {result.lifetimeTaxSavings > 0 && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
              <p className="font-semibold text-green-800">Estimated Lifetime Savings: {fmt$(result.lifetimeTaxSavings)}</p>
              <p className="text-sm text-green-700 mt-2">{result.details}</p>
            </div>
          )}
          {result.lifetimeTaxSavings === 0 && (
            <div className="p-4 bg-muted/50 border border-border rounded-xl">
              <p className="text-sm text-muted-foreground">{result.details}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TaxTab({ clientId }: { clientId: number }) {
  const [activeSubTab, setActiveSubTab] = useState<TaxSubTab>("projection");

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-display font-bold">Tax Planning</h2>
      </div>
      <div className="flex gap-1 p-1 bg-muted/50 rounded-xl overflow-x-auto flex-wrap">
        {taxSubTabs.map(t => (
          <button key={t.key} onClick={() => setActiveSubTab(t.key)}
            data-testid={`button-tax-subtab-${t.key}`}
            className={`px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${activeSubTab === t.key ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="animate-in fade-in duration-200">
        {activeSubTab === "notes"      && <TaxNotesPanel       clientId={clientId} />}
        {activeSubTab === "rrsp"       && <RrspRoomPanel        clientId={clientId} />}
        {activeSubTab === "tfsa"       && <TfsaRoomPanel        clientId={clientId} />}
        {activeSubTab === "projection" && <TaxProjectionPanel   clientId={clientId} />}
        {activeSubTab === "capgains"   && <CapitalGainsPanel    clientId={clientId} />}
        {activeSubTab === "splitting"  && <IncomeSplittingPanel clientId={clientId} />}
      </div>
    </div>
  );
}

// ── Estate Tab ────────────────────────────────────────────────────────────────

function EstateNotesTab({ clientId, planId }: { clientId: number; planId: number | null }) {
  const { data: notes = [] } = useEstatePlanningNotes(clientId);
  const { data: assumptions = [] } = usePlanAssumptions(planId);
  const createNote = useCreateEstatePlanningNote();
  const deleteNote = useDeleteEstatePlanningNote(clientId);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ category: "Will", title: "", content: "" });
  const categories = ["Will", "Power of Attorney", "Trust", "Beneficiary Designations", "Estate Tax", "Succession Planning", "Charitable Giving", "Other"];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createNote.mutate({ clientId, data: { category: form.category, title: form.title, content: form.content } },
      { onSuccess: () => { setShowAdd(false); setForm({ category: "Will", title: "", content: "" }); } });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-display font-bold">Estate Planning Notes</h2>
        <button onClick={() => setShowAdd(true)} data-testid="button-fp-add-estate" className="flex items-center space-x-2 px-4 py-2 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/90 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /><span>Add Note</span>
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {(notes as any[]).map(n => (
          <div key={n.id} className="border border-border rounded-2xl p-6 hover:shadow-md transition-shadow group" data-testid={`card-fp-estate-${n.id}`}>
            <div className="flex justify-between items-start">
              <span className="text-xs font-semibold text-indigo-600 uppercase bg-indigo-50 px-2 py-1 rounded-lg">{n.category}</span>
              <button onClick={() => { if (confirm("Delete?")) deleteNote.mutate(n.id); }} data-testid={`button-fp-del-estate-${n.id}`} className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button>
            </div>
            <h3 className="text-lg font-bold mt-3">{n.title}</h3>
            <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{n.content}</p>
          </div>
        ))}
      </div>
      {notes.length === 0 && <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-2xl">No estate planning notes yet.</div>}
      <EstateScorecard notes={notes as any[]} province={(assumptions as any[]).find(a => a.scenario === "Moderate")?.province} />
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6">
            <h2 className="text-2xl font-display font-bold mb-6">Add Estate Planning Note</h2>
            <form onSubmit={handleSubmit} className="space-y-4" data-testid="form-fp-estate">
              <div><label className="text-sm font-semibold">Category</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} data-testid="select-fp-estate-cat" className="w-full px-3 py-2 rounded-xl border mt-1">
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><label className="text-sm font-semibold">Title</label><input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} data-testid="input-fp-estate-title" className="w-full px-3 py-2 rounded-xl border mt-1" /></div>
              <div><label className="text-sm font-semibold">Content</label><textarea required value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} data-testid="input-fp-estate-content" className="w-full px-3 py-2 rounded-xl border mt-1 min-h-[120px]" /></div>
              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setShowAdd(false)} className="px-6 py-3 rounded-xl font-semibold text-muted-foreground hover:bg-muted">Cancel</button>
                <button type="submit" disabled={createNote.isPending} data-testid="button-fp-submit-estate" className="px-6 py-3 rounded-xl font-semibold bg-primary text-primary-foreground">{createNote.isPending ? "Adding..." : "Add Note"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── AI Tab ────────────────────────────────────────────────────────────────────

export function AITab({ clientId }: { clientId: number }) {
  const { data: recommendations = [] } = useAiRecommendations(clientId);
  const generateRecs = useGenerateAiRecommendations();
  const updateRec = useUpdateAiRecommendation(clientId);
  const deleteRec = useDeleteAiRecommendation(clientId);

  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const sorted = [...(recommendations as any[])].sort((a, b) => (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1));

  const statusIcon = (status: string) => {
    if (status === "completed") return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (status === "in_progress") return <Clock className="w-4 h-4 text-blue-500" />;
    if (status === "dismissed") return <AlertTriangle className="w-4 h-4 text-muted-foreground" />;
    return <Clock className="w-4 h-4 text-yellow-500" />;
  };

  const priorityBadge = (priority: string) => {
    const colors: Record<string, string> = { high: "bg-red-100 text-red-700", medium: "bg-yellow-100 text-yellow-700", low: "bg-green-100 text-green-700" };
    return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors[priority] || colors.medium}`}>{priority}</span>;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-display font-bold">AI Recommendations</h2>
        <button onClick={() => generateRecs.mutate(clientId)} disabled={generateRecs.isPending} data-testid="button-fp-generate-ai"
          className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50">
          <Sparkles className="w-4 h-4" /><span>{generateRecs.isPending ? "Analyzing..." : "Generate Insights"}</span>
        </button>
      </div>
      {generateRecs.isPending && (
        <div className="border border-purple-200 rounded-2xl p-6 bg-purple-50/50 text-center">
          <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-purple-700 font-medium">AI is analyzing your client's financial data...</p>
        </div>
      )}
      <div className="space-y-4">
        {sorted.map((rec) => (
          <div key={rec.id} className={`border rounded-2xl p-6 ${rec.status === "completed" ? "bg-muted/30 border-border/50" : rec.status === "dismissed" ? "bg-muted/20 border-border/30 opacity-60" : "border-border"}`} data-testid={`card-fp-ai-${rec.id}`}>
            <div className="flex justify-between items-start">
              <div className="flex items-center space-x-3">
                {statusIcon(rec.status)}
                <div>
                  <div className="flex items-center space-x-2 flex-wrap gap-1">
                    <h3 className="font-bold">{rec.title}</h3>
                    {priorityBadge(rec.priority)}
                    <span className="text-xs text-muted-foreground uppercase bg-muted px-2 py-0.5 rounded">{rec.category}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{rec.content}</p>
                </div>
              </div>
              <div className="flex items-center space-x-1 flex-shrink-0 ml-4">
                {rec.status === "pending" && (
                  <>
                    <button onClick={() => updateRec.mutate({ id: rec.id, data: { status: "in_progress" } })} data-testid={`button-fp-ai-start-${rec.id}`} className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 font-semibold hover:bg-blue-100">Start</button>
                    <button onClick={() => updateRec.mutate({ id: rec.id, data: { status: "dismissed" } })} data-testid={`button-fp-ai-dismiss-${rec.id}`} className="text-xs px-3 py-1.5 rounded-lg bg-muted text-muted-foreground font-semibold hover:bg-muted/80">Dismiss</button>
                  </>
                )}
                {rec.status === "in_progress" && (
                  <button onClick={() => updateRec.mutate({ id: rec.id, data: { status: "completed" } })} data-testid={`button-fp-ai-complete-${rec.id}`} className="text-xs px-3 py-1.5 rounded-lg bg-green-50 text-green-600 font-semibold hover:bg-green-100">Complete</button>
                )}
                <button onClick={() => { if (confirm("Delete?")) deleteRec.mutate(rec.id); }} data-testid={`button-fp-del-ai-${rec.id}`} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-3 h-3 text-red-400" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {recommendations.length === 0 && !generateRecs.isPending && (
        <div className="text-center py-12 border border-dashed border-border rounded-2xl">
          <Brain className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No AI recommendations yet. Click "Generate Insights" to analyze your client's financial data.</p>
        </div>
      )}
    </div>
  );
}

// ── Main Layout ───────────────────────────────────────────────────────────────

export function FinancialPlanningContent({ initialClientId }: { initialClientId?: number }) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [selectedClientId, setSelectedClientId] = useState<number | null>(initialClientId ?? null);

  const { data: clients = [] } = useQuery<Array<{ id: number; firstName: string; lastName: string }>>({
    queryKey: ["/api/clients"],
  });

  const { data: plans = [] } = useClientPlans(selectedClientId ?? 0);
  const sortedPlans = [...plans].sort((a, b) => b.id - a.id);
  const activePlanId = sortedPlans.length > 0 ? sortedPlans[0].id : null;
  const { data: allFlags = [] } = usePlanStaleFlags(activePlanId);

  const unresolvedFlags = (allFlags as any[]).filter(f => !f.resolvedAt);
  const recentlyResolvedFlags = (allFlags as any[]).filter(f => {
    if (!f.resolvedAt) return false;
    return new Date(f.resolvedAt).getTime() > Date.now() - 24 * 60 * 60 * 1000;
  });

  const staleTabKeys = new Set(unresolvedFlags.map(f => moduleToTabMap[f.module]).filter(Boolean));
  const recalculatedTabKeys = new Set(recentlyResolvedFlags.map(f => moduleToTabMap[f.module]).filter(Boolean));

  return (
    <div className="flex h-full" data-testid="fp-popout-container">
      <aside className="w-[200px] flex-shrink-0 bg-muted/30 border-r border-border flex flex-col">
        <div className="p-3 border-b border-border">
          <select
            value={selectedClientId ?? ""}
            onChange={e => setSelectedClientId(Number(e.target.value) || null)}
            data-testid="select-fp-client"
            className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="">-- Select Client --</option>
            {(clients as any[]).map(c => (
              <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
            ))}
          </select>
        </div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto" data-testid="fp-sidebar-nav">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              disabled={!selectedClientId}
              data-testid={`tab-fp-${t.key}`}
              className={`flex items-center space-x-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === t.key && selectedClientId
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : selectedClientId
                    ? "text-muted-foreground hover:bg-muted hover:text-foreground"
                    : "text-muted-foreground/50 cursor-not-allowed"
              }`}
            >
              <t.icon className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{t.label}</span>
              {staleTabKeys.has(t.key) && (
                <span className="ml-auto flex-shrink-0 w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Data has changed — review needed" data-testid={`stale-indicator-${t.key}`} />
              )}
              {!staleTabKeys.has(t.key) && recalculatedTabKeys.has(t.key) && (
                <span className="ml-auto flex-shrink-0 w-2 h-2 rounded-full bg-blue-500" title="Recently recalculated" data-testid={`recalculated-indicator-${t.key}`} />
              )}
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex-1 overflow-y-auto p-6">
        {selectedClientId && unresolvedFlags.length > 0 && (
          <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3" data-testid="stale-banner">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <div className="text-sm">
              <span className="font-medium text-amber-800">{unresolvedFlags.length} module{unresolvedFlags.length > 1 ? "s" : ""} pending recalculation</span>
              <span className="text-amber-600 ml-2">Changed: {new Date((unresolvedFlags as any)[0].createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        )}
        {selectedClientId && unresolvedFlags.length === 0 && recentlyResolvedFlags.length > 0 && (
          <div className="mb-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3" data-testid="recalculated-banner">
            <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span className="text-sm font-medium text-blue-800">{recentlyResolvedFlags.length} module{recentlyResolvedFlags.length > 1 ? "s" : ""} recalculated — review updated projections</span>
          </div>
        )}

        {selectedClientId ? (
          <>
            {activeTab === "overview"   && <OverviewTab      clientId={selectedClientId} />}
            {activeTab === "dashboard"  && activePlanId && <SimulationDashboard planId={activePlanId} />}
            {activeTab === "dashboard"  && !activePlanId && (
              <div className="border border-dashed border-border rounded-2xl p-8 text-center text-muted-foreground">
                <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No financial plan for this client</p>
                <p className="text-sm mt-1">Create a financial plan first to access the simulation dashboard</p>
              </div>
            )}
            {activeTab === "networth"   && <NetWorthTab      clientId={selectedClientId} />}
            {activeTab === "retirement" && <RetirementTab    clientId={selectedClientId} planId={activePlanId} />}
            {activeTab === "insurance"  && <InsuranceTab     clientId={selectedClientId} planId={activePlanId} />}
            {activeTab === "resp"       && <RESPTab          clientId={selectedClientId} planId={activePlanId} />}
            {activeTab === "debt"       && <DebtTab          clientId={selectedClientId} planId={activePlanId} />}
            {activeTab === "tax"        && <TaxTab           clientId={selectedClientId} />}
            {activeTab === "estate"     && <EstateNotesTab   clientId={selectedClientId} planId={activePlanId} />}
            {activeTab === "ai"         && <AITab            clientId={selectedClientId} />}
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center py-16">
              <FileText className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-muted-foreground" data-testid="text-fp-heading">Select a Client</h2>
              <p className="text-muted-foreground mt-2">Choose a client from the sidebar to view their financial plan.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function FinancialPlanning() {
  return <FinancialPlanningContent />;
}











































