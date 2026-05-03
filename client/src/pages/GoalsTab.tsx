import { useState, useEffect, useMemo } from "react";
import { api } from "../lib/api";
import {
  Target, Plus, Trash2, Pencil, X, Save, TrendingDown, TrendingUp,
  RefreshCw, Home, Car, GraduationCap, Plane, Shield, Star, DollarSign,
  Calendar, ToggleLeft, ToggleRight, ChevronDown, ChevronUp,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface Goal {
  id: number;
  goalType: string;
  title: string;
  targetAmount: string | null;
  currentAmount: string | null;
  targetDate: string | null;
  status: string;
  notes: string | null;
  // projection fields
  cashflowType: string | null;
  targetYear: number | null;
  projectionImpact: boolean | null;
  priority: number | null;
  monthlyContribution: string | null;
  inflationAdjust: boolean | null;
  startYear: number | null;
  endYear: number | null;
  annualAmount: string | null;
  fundingSource: string | null;
}

// ── Goal type config ─────────────────────────────────────────────────────────

const GOAL_TYPES = [
  { key: "major_purchase",    label: "Major Purchase",     icon: Home,        cashflowType: "outflow",           desc: "House, cottage, renovation, vehicle" },
  { key: "windfall",          label: "Windfall / Inflow",  icon: TrendingUp,  cashflowType: "inflow",            desc: "Inheritance, bonus, property sale" },
  { key: "education",         label: "Education / RESP",   icon: GraduationCap, cashflowType: "savings_target",  desc: "University fund, RESP target" },
  { key: "emergency_fund",    label: "Emergency Fund",     icon: Shield,      cashflowType: "savings_target",    desc: "3-6 months of expenses" },
  { key: "travel_lifestyle",  label: "Travel / Lifestyle", icon: Plane,       cashflowType: "recurring_expense", desc: "Travel years, sabbatical, early retirement gap" },
  { key: "debt_free",         label: "Debt Free",          icon: TrendingDown, cashflowType: "outflow",          desc: "Lump sum debt payoff event" },
  { key: "retirement",        label: "Retirement",         icon: Star,        cashflowType: "savings_target",    desc: "Retirement savings milestone" },
  { key: "custom",            label: "Custom Goal",        icon: Target,      cashflowType: "savings_target",    desc: "Any other financial goal" },
];

const FUNDING_SOURCES = [
  { key: "non_reg", label: "Non-Registered" },
  { key: "tfsa",    label: "TFSA" },
  { key: "rrsp",    label: "RRSP" },
  { key: "cash",    label: "Cash / Savings" },
  { key: "automatic", label: "Auto (engine decides)" },
];

const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "Critical",      color: "text-red-600 bg-red-50 border-red-200" },
  2: { label: "High",          color: "text-amber-600 bg-amber-50 border-amber-200" },
  3: { label: "Medium",        color: "text-blue-600 bg-blue-50 border-blue-200" },
  4: { label: "Low",           color: "text-gray-600 bg-slate-50 border-slate-200" },
  5: { label: "Nice to have",  color: "text-gray-400 bg-slate-50 border-slate-100" },
};

const STATUS_CONFIG: Record<string, { label: string; dot: string }> = {
  in_progress: { label: "In Progress", dot: "bg-blue-500" },
  on_track:    { label: "On Track",    dot: "bg-green-500" },
  at_risk:     { label: "At Risk",     dot: "bg-amber-500" },
  completed:   { label: "Completed",   dot: "bg-gray-400" },
};

const CURRENT_YEAR = new Date().getFullYear();

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt$ = (n: string | number | null) =>
  n ? "$" + Number(n).toLocaleString("en-CA", { maximumFractionDigits: 0 }) : "—";

function emptyForm(typeKey = "major_purchase") {
  const typeInfo = GOAL_TYPES.find(t => t.key === typeKey) ?? GOAL_TYPES[0];
  return {
    goalType:           typeKey,
    title:              "",
    targetAmount:       "",
    currentAmount:      "",
    targetDate:         "",
    status:             "in_progress",
    notes:              "",
    cashflowType:       typeInfo.cashflowType,
    targetYear:         String(CURRENT_YEAR + 5),
    projectionImpact:   false,
    priority:           3,
    monthlyContribution:"",
    inflationAdjust:    true,
    startYear:          String(CURRENT_YEAR + 1),
    endYear:            String(CURRENT_YEAR + 5),
    annualAmount:       "",
    fundingSource:      "non_reg",
  };
}

// ── Timeline Component ───────────────────────────────────────────────────────

function GoalTimeline({ goals, clientAge }: { goals: Goal[]; clientAge?: number }) {
  const startYear = CURRENT_YEAR;
  const endYear   = CURRENT_YEAR + (clientAge ? Math.max(5, 90 - clientAge) : 30);
  const span      = endYear - startYear;
  const impactGoals = goals.filter(g => g.targetYear || g.startYear);

  if (impactGoals.length === 0) return null;

  const pct = (year: number) => Math.max(0, Math.min(100, ((year - startYear) / span) * 100));

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 mb-5">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Goal Timeline</p>
      <div className="relative h-8">
        {/* Track */}
        <div className="absolute top-3.5 left-0 right-0 h-0.5 bg-slate-200 rounded" />
        {/* Year labels */}
        {[0, 25, 50, 75, 100].map(p => {
          const yr = Math.round(startYear + (span * p / 100));
          return (
            <span key={p} className="absolute top-5 text-[9px] text-gray-400 -translate-x-1/2" style={{ left: `${p}%` }}>
              {yr}
            </span>
          );
        })}
        {/* Goal pins */}
        {impactGoals.map(g => {
          const year = g.cashflowType === "recurring_expense" ? (g.startYear ?? CURRENT_YEAR) : (g.targetYear ?? CURRENT_YEAR);
          const left = pct(year);
          const typeInfo = GOAL_TYPES.find(t => t.key === g.goalType) ?? GOAL_TYPES[7];
          const Icon = typeInfo.icon;
          const isOutflow = g.cashflowType === "outflow" || g.cashflowType === "recurring_expense";
          return (
            <div key={g.id} className="absolute -translate-x-1/2 top-0 flex flex-col items-center" style={{ left: `${left}%` }}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 border-white shadow-sm ${isOutflow ? "bg-red-100" : "bg-green-100"}`}
                title={`${g.title} (${year})`}>
                <Icon className={`w-3.5 h-3.5 ${isOutflow ? "text-red-600" : "text-green-600"}`} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Goal Card ────────────────────────────────────────────────────────────────

function GoalCard({ goal, onEdit, onDelete }: { goal: Goal; onEdit: () => void; onDelete: () => void }) {
  const typeInfo  = GOAL_TYPES.find(t => t.key === goal.goalType) ?? GOAL_TYPES[7];
  const Icon      = typeInfo.icon;
  const priority  = PRIORITY_LABELS[goal.priority ?? 3];
  const status    = STATUS_CONFIG[goal.status] ?? STATUS_CONFIG.in_progress;
  const isOutflow = goal.cashflowType === "outflow" || goal.cashflowType === "recurring_expense";
  const hasProgress = goal.cashflowType === "savings_target" && goal.targetAmount && Number(goal.targetAmount) > 0;
  const pct = hasProgress ? Math.min(100, (Number(goal.currentAmount || 0) / Number(goal.targetAmount)) * 100) : 0;

  return (
    <div className={`bg-white border rounded-xl p-4 hover:shadow-sm transition-all ${goal.projectionImpact ? "border-blue-600/20 shadow-[inset_0_0_0_1px_rgba(12,30,58,0.08)]" : "border-slate-200"}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isOutflow ? "bg-red-50" : "bg-green-50"}`}>
            <Icon className={`w-4 h-4 ${isOutflow ? "text-red-600" : "text-green-600"}`} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 text-sm truncate">{goal.title}</p>
            <p className="text-xs text-gray-400">{typeInfo.label}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {goal.projectionImpact && (
            <span className="text-[9px] font-bold bg-brand-gradient text-white px-1.5 py-0.5 rounded">IN PLAN</span>
          )}
          <button onClick={onEdit} className="p-1 text-gray-300 hover:text-blue-500"><Pencil className="w-3.5 h-3.5" /></button>
          <button onClick={onDelete} className="p-1 text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {/* Key numbers */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {goal.cashflowType === "recurring_expense" ? (
          <>
            <div className="bg-slate-50 rounded-lg px-2.5 py-1.5">
              <p className="text-[10px] text-gray-400 mb-0.5">Annual Cost</p>
              <p className="text-sm font-bold text-gray-900">{fmt$(goal.annualAmount)}</p>
            </div>
            <div className="bg-slate-50 rounded-lg px-2.5 py-1.5">
              <p className="text-[10px] text-gray-400 mb-0.5">Years</p>
              <p className="text-sm font-bold text-gray-900">{goal.startYear} – {goal.endYear}</p>
            </div>
          </>
        ) : (
          <>
            <div className="bg-slate-50 rounded-lg px-2.5 py-1.5">
              <p className="text-[10px] text-gray-400 mb-0.5">
                {goal.cashflowType === "inflow" ? "Expected Inflow" : "Target Amount"}
              </p>
              <p className={`text-sm font-bold ${isOutflow ? "text-red-700" : "text-gray-900"}`}>
                {isOutflow && goal.cashflowType !== "inflow" ? "−" : ""}{fmt$(goal.targetAmount)}
              </p>
            </div>
            <div className="bg-slate-50 rounded-lg px-2.5 py-1.5">
              <p className="text-[10px] text-gray-400 mb-0.5">Target Year</p>
              <p className="text-sm font-bold text-gray-900">{goal.targetYear ?? "—"}</p>
            </div>
          </>
        )}
      </div>

      {/* Progress bar for savings targets */}
      {hasProgress && (
        <div className="mb-3">
          <div className="flex justify-between text-[10px] text-gray-400 mb-1">
            <span>{fmt$(goal.currentAmount)} saved</span>
            <span>{pct.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-brand-gradient rounded-full" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {/* Monthly contribution */}
      {goal.monthlyContribution && Number(goal.monthlyContribution) > 0 && (
        <p className="text-xs text-gray-500 mb-2">
          <span className="font-semibold">{fmt$(goal.monthlyContribution)}/mo</span> contributing
        </p>
      )}

      {/* Footer badges */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${priority.color}`}>
          {priority.label}
        </span>
        <span className="flex items-center gap-1 text-[9px] text-gray-400">
          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
          {status.label}
        </span>
        {goal.fundingSource && goal.fundingSource !== "automatic" && (
          <span className="text-[9px] text-gray-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
            {FUNDING_SOURCES.find(f => f.key === goal.fundingSource)?.label ?? goal.fundingSource}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Goal Form ────────────────────────────────────────────────────────────────

function GoalForm({
  initial, onSave, onCancel, busy, clientId,
}: {
  initial: ReturnType<typeof emptyForm>;
  onSave: (f: ReturnType<typeof emptyForm>) => void;
  onCancel: () => void;
  busy: boolean;
  clientId: number;
}) {
  const [form, setForm] = useState(initial);
  const [liabilities, setLiabilities] = useState<Array<{
    id: number; name: string | null; category: string | null;
    balance: number; interestRate: number | null;
    minimumPayment: number | null; annualCost: number | null; source: string;
  }>>([]);
  const [selectedLiabilities, setSelectedLiabilities] = useState<Set<number>>(new Set());
  const upd = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const typeInfo = GOAL_TYPES.find(t => t.key === form.goalType) ?? GOAL_TYPES[0];

  // Load liabilities when debt_free type selected
  useEffect(() => {
    if (form.goalType === "debt_free" && liabilities.length === 0) {
      api.get<any[]>(`/api/clients/${clientId}/liabilities`)
        .then(setLiabilities)
        .catch(() => {});
    }
  }, [form.goalType]);

  function toggleLiability(id: number) {
    setSelectedLiabilities(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);

      // Recalculate totals from new selection
      const selected = liabilities.filter(l => next.has(l.id));
      const totalBalance = selected.reduce((s, l) => s + l.balance, 0);
      const totalAnnual  = selected.reduce((s, l) => s + (l.annualCost ?? 0), 0);
      const names = selected.map(l => l.name || l.category || "Debt").join(", ");

      setForm(f => ({
        ...f,
        title:        selected.length === 1 ? `Pay off ${names}` : selected.length > 1 ? `Pay off: ${names}` : f.title,
        targetAmount: String(Math.round(totalBalance)),
        annualAmount: totalAnnual > 0 ? String(Math.round(totalAnnual)) : f.annualAmount,
        cashflowType: "outflow",
      }));

      return next;
    });
  }

  // When goalType changes, update cashflowType to default for that type
  function changeType(key: string) {
    const info = GOAL_TYPES.find(t => t.key === key) ?? GOAL_TYPES[0];
    setForm(f => ({ ...f, goalType: key, cashflowType: info.cashflowType }));
  }

  const isRecurring = form.cashflowType === "recurring_expense";
  const isSavings   = form.cashflowType === "savings_target";
  const isOneTime   = form.cashflowType === "outflow" || form.cashflowType === "inflow";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h3 className="text-base font-bold text-gray-900">{initial.title ? "Edit Goal" : "New Goal"}</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Goal Type */}
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1.5">Goal Type</label>
            <div className="grid grid-cols-2 gap-2">
              {GOAL_TYPES.map(t => {
                const Icon = t.icon;
                return (
                  <button key={t.key} onClick={() => changeType(t.key)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left text-xs transition-all ${
                      form.goalType === t.key
                        ? "border-blue-600 bg-brand-soft text-blue-600 font-semibold"
                        : "border-slate-200 text-gray-600 hover:border-slate-300"
                    }`}>
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5">{typeInfo.desc}</p>
          </div>

          {/* Title */}
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Goal Title</label>
            <input value={form.title} onChange={e => upd("title", e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-blue-600"
              placeholder={typeInfo.label + " goal"} />
          </div>

          {/* Cashflow type override */}
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Cashflow Type</label>
            <select value={form.cashflowType} onChange={e => upd("cashflowType", e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-blue-600">
              <option value="outflow">One-time outflow (expense)</option>
              <option value="inflow">One-time inflow (receipt)</option>
              <option value="savings_target">Savings target (accumulation)</option>
              <option value="recurring_expense">Recurring annual expense</option>
            </select>
          </div>

          {/* Liability multi-select for debt_free goals */}
          {form.goalType === "debt_free" && liabilities.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1.5">
                Select Liabilities to Pay Off
                {selectedLiabilities.size > 0 && (
                  <span className="ml-2 text-blue-600 font-bold">{selectedLiabilities.size} selected</span>
                )}
              </label>
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                {liabilities.map(l => {
                  const isSelected = selectedLiabilities.has(l.id);
                  const label = l.name || l.category || `Liability #${l.id}`;
                  return (
                    <div key={l.id} onClick={() => toggleLiability(l.id)}
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${isSelected ? "bg-brand-soft" : "hover:bg-slate-50"}`}>
                      <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${isSelected ? "bg-brand-gradient border-blue-600" : "border-slate-300"}`}>
                        {isSelected && <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{label}</p>
                        <p className="text-xs text-gray-400">
                          {l.interestRate != null ? `${l.interestRate}% · ` : ""}
                          {l.minimumPayment ? `$${l.minimumPayment.toLocaleString("en-CA", { maximumFractionDigits: 0 })}/mo` : ""}
                          {l.annualCost ? ` · $${l.annualCost.toLocaleString("en-CA", { maximumFractionDigits: 0 })}/yr` : ""}
                        </p>
                      </div>
                      <p className={`text-sm font-bold flex-shrink-0 ${isSelected ? "text-blue-600" : "text-gray-700"}`}>
                        ${l.balance.toLocaleString("en-CA", { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Totals row */}
              {selectedLiabilities.size > 0 && (() => {
                const sel = liabilities.filter(l => selectedLiabilities.has(l.id));
                const totalBalance = sel.reduce((s, l) => s + l.balance, 0);
                const totalAnnual  = sel.reduce((s, l) => s + (l.annualCost ?? 0), 0);
                const totalMonthly = sel.reduce((s, l) => s + (l.minimumPayment ?? 0), 0);
                return (
                  <div className="mt-2 bg-brand-soft rounded-xl px-3 py-2.5 grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-[10px] text-gray-400">Total Balance</p>
                      <p className="text-sm font-bold text-blue-600">${totalBalance.toLocaleString("en-CA", { maximumFractionDigits: 0 })}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400">Monthly Payments</p>
                      <p className="text-sm font-bold text-gray-700">${totalMonthly.toLocaleString("en-CA", { maximumFractionDigits: 0 })}/mo</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400">Annual Cost</p>
                      <p className="text-sm font-bold text-gray-700">${totalAnnual.toLocaleString("en-CA", { maximumFractionDigits: 0 })}/yr</p>
                    </div>
                  </div>
                );
              })()}
              <p className="text-[10px] text-gray-400 mt-1.5">Selecting liabilities auto-fills the title, target amount, and annual cost below</p>
            </div>
          )}

          {/* One-time fields */}
          {isOneTime && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">
                  {form.cashflowType === "inflow" ? "Expected Amount ($)" : "Cost / Amount ($)"}
                </label>
                <input type="number" value={form.targetAmount} onChange={e => upd("targetAmount", e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" placeholder="0" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Target Year</label>
                <input type="number" value={form.targetYear} onChange={e => upd("targetYear", e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  min={CURRENT_YEAR} max={CURRENT_YEAR + 60} />
              </div>
            </div>
          )}

          {/* Savings target fields */}
          {isSavings && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Target Amount ($)</label>
                  <input type="number" value={form.targetAmount} onChange={e => upd("targetAmount", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" placeholder="0" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Current Balance ($)</label>
                  <input type="number" value={form.currentAmount} onChange={e => upd("currentAmount", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" placeholder="0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Target Year</label>
                  <input type="number" value={form.targetYear} onChange={e => upd("targetYear", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                    min={CURRENT_YEAR} max={CURRENT_YEAR + 60} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Monthly Contribution ($)</label>
                  <input type="number" value={form.monthlyContribution} onChange={e => upd("monthlyContribution", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" placeholder="0" />
                </div>
              </div>
            </>
          )}

          {/* Recurring expense fields */}
          {isRecurring && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Start Year</label>
                <input type="number" value={form.startYear} onChange={e => upd("startYear", e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  min={CURRENT_YEAR} max={CURRENT_YEAR + 60} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">End Year</label>
                <input type="number" value={form.endYear} onChange={e => upd("endYear", e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  min={CURRENT_YEAR} max={CURRENT_YEAR + 60} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Annual Cost ($)</label>
                <input type="number" value={form.annualAmount} onChange={e => upd("annualAmount", e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" placeholder="0" />
              </div>
            </div>
          )}

          {/* Priority, status, funding */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Priority</label>
              <select value={form.priority} onChange={e => upd("priority", Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm">
                {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Status</label>
              <select value={form.status} onChange={e => upd("status", e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm">
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Funding Source</label>
              <select value={form.fundingSource} onChange={e => upd("fundingSource", e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm">
                {FUNDING_SOURCES.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
            </div>
          </div>

          {/* Inflation adjust */}
          <div className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2.5">
            <div>
              <p className="text-xs font-semibold text-gray-700">Inflation-adjust amount</p>
              <p className="text-[10px] text-gray-400">Grow the goal amount with inflation to target year</p>
            </div>
            <button onClick={() => upd("inflationAdjust", !form.inflationAdjust)}
              className={`transition-colors ${form.inflationAdjust ? "text-blue-600" : "text-gray-300"}`}>
              {form.inflationAdjust ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
            </button>
          </div>

          {/* Projection impact toggle */}
          <div className={`flex items-center justify-between rounded-xl px-3 py-2.5 border transition-all ${
            form.projectionImpact ? "bg-brand-soft border-blue-600/20" : "bg-slate-50 border-slate-200"
          }`}>
            <div>
              <p className={`text-xs font-semibold ${form.projectionImpact ? "text-blue-600" : "text-gray-700"}`}>
                Include in Monte Carlo projection
              </p>
              <p className="text-[10px] text-gray-400">
                {form.projectionImpact
                  ? "This goal will be injected as a cashflow event in the retirement simulation"
                  : "Enable to factor this goal into retirement success probability"}
              </p>
            </div>
            <button onClick={() => upd("projectionImpact", !form.projectionImpact)}
              className={`transition-colors ${form.projectionImpact ? "text-blue-600" : "text-gray-300"}`}>
              {form.projectionImpact ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
            </button>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Notes (optional)</label>
            <textarea value={form.notes} onChange={e => upd("notes", e.target.value)} rows={2}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm resize-none focus:outline-none focus:border-blue-600"
              placeholder="Any additional context..." />
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-6 py-4 flex gap-3 justify-end rounded-b-2xl">
          <button onClick={onCancel} className="text-sm text-gray-500 px-4 py-2 hover:text-gray-700">Cancel</button>
          <button onClick={() => onSave(form)} disabled={busy || !form.title}
            className="flex items-center gap-1.5 bg-brand-gradient hover:bg-brand-gradient-hover disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl">
            <Save className="w-3.5 h-3.5" />
            {busy ? "Saving…" : "Save Goal"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Summary Bar ──────────────────────────────────────────────────────────────

function GoalsSummary({ goals }: { goals: Goal[] }) {
  const totalOutflows = goals
    .filter(g => g.cashflowType === "outflow" || g.cashflowType === "recurring_expense")
    .reduce((s, g) => {
      if (g.cashflowType === "recurring_expense" && g.annualAmount && g.startYear && g.endYear) {
        return s + parseFloat(g.annualAmount) * (g.endYear - g.startYear + 1);
      }
      return s + parseFloat(g.targetAmount || "0");
    }, 0);
  const totalInflows = goals
    .filter(g => g.cashflowType === "inflow")
    .reduce((s, g) => s + parseFloat(g.targetAmount || "0"), 0);
  const inPlan = goals.filter(g => g.projectionImpact).length;
  const totalMonthly = goals
    .filter(g => g.cashflowType === "savings_target" && g.monthlyContribution)
    .reduce((s, g) => s + parseFloat(g.monthlyContribution || "0"), 0);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
      {[
        { label: "Total Goals",        value: goals.length,      sub: "active",                  color: "text-gray-900" },
        { label: "Projected Outflows", value: fmt$(totalOutflows), sub: "major purchases + recurring", color: "text-red-700" },
        { label: "Expected Inflows",   value: fmt$(totalInflows), sub: "windfalls + receipts",    color: "text-green-700" },
        { label: "In Monte Carlo",     value: inPlan,             sub: `${fmt$(totalMonthly)}/mo saved`, color: "text-blue-600" },
      ].map(s => (
        <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-3">
          <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          <p className="text-xs font-semibold text-gray-600 mt-0.5">{s.label}</p>
          <p className="text-[10px] text-gray-400">{s.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function GoalsTab({ clientId, client }: { clientId: number; client?: any }) {
  const [goals, setGoals]       = useState<Goal[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [busy, setBusy]         = useState(false);
  const [filter, setFilter]     = useState<"all" | "plan" | "savings" | "events">("all");

  const clientAge = client?.dateOfBirth
    ? new Date().getFullYear() - new Date(client.dateOfBirth).getFullYear()
    : undefined;

  const load = () => api.get<Goal[]>(`/api/clients/${clientId}/goals`).then(setGoals).catch(() => {});
  useEffect(() => { load(); }, [clientId]);

  function openNew() {
    setEditingGoal(null);
    setShowForm(true);
  }

  function openEdit(g: Goal) {
    setEditingGoal(g);
    setShowForm(true);
  }

  async function save(form: ReturnType<typeof emptyForm>) {
    if (!form.title) return;
    setBusy(true);
    try {
      if (editingGoal) {
        await api.patch(`/api/goals/${editingGoal.id}`, form);
      } else {
        await api.post(`/api/clients/${clientId}/goals`, form);
      }
      setShowForm(false);
      setEditingGoal(null);
      await load();
    } catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  }

  async function del(id: number) {
    if (!confirm("Delete this goal?")) return;
    await api.delete(`/api/goals/${id}`);
    await load();
  }

  const formInitial = useMemo(() => {
    if (!editingGoal) return emptyForm();
    return {
      goalType:            editingGoal.goalType,
      title:               editingGoal.title,
      targetAmount:        editingGoal.targetAmount  ?? "",
      currentAmount:       editingGoal.currentAmount ?? "",
      targetDate:          editingGoal.targetDate    ?? "",
      status:              editingGoal.status,
      notes:               editingGoal.notes         ?? "",
      cashflowType:        editingGoal.cashflowType  ?? "savings_target",
      targetYear:          String(editingGoal.targetYear  ?? CURRENT_YEAR + 5),
      projectionImpact:    editingGoal.projectionImpact ?? false,
      priority:            editingGoal.priority ?? 3,
      monthlyContribution: editingGoal.monthlyContribution ?? "",
      inflationAdjust:     editingGoal.inflationAdjust ?? true,
      startYear:           String(editingGoal.startYear ?? CURRENT_YEAR + 1),
      endYear:             String(editingGoal.endYear   ?? CURRENT_YEAR + 5),
      annualAmount:        editingGoal.annualAmount ?? "",
      fundingSource:       editingGoal.fundingSource ?? "non_reg",
    };
  }, [editingGoal]);

  const filtered = useMemo(() => {
    if (filter === "all")     return goals.filter(g => g.status !== "completed");
    if (filter === "plan")    return goals.filter(g => g.projectionImpact);
    if (filter === "savings") return goals.filter(g => g.cashflowType === "savings_target");
    if (filter === "events")  return goals.filter(g => g.cashflowType === "outflow" || g.cashflowType === "inflow" || g.cashflowType === "recurring_expense");
    return goals;
  }, [goals, filter]);

  const completed = goals.filter(g => g.status === "completed");

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Financial Goals</h2>
          <p className="text-sm text-gray-400 mt-0.5">Goals with "IN PLAN" are wired into the Monte Carlo simulation</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-1.5 text-sm font-semibold text-white bg-brand-gradient hover:bg-brand-gradient-hover px-4 py-2 rounded-xl">
          <Plus className="w-4 h-4" /> Add Goal
        </button>
      </div>

      {goals.length > 0 && (
        <>
          <GoalsSummary goals={goals} />
          <GoalTimeline goals={goals} clientAge={clientAge} />
        </>
      )}

      {/* Filter tabs */}
      {goals.length > 0 && (
        <div className="flex gap-1 mb-4">
          {[
            { key: "all",     label: "Active" },
            { key: "plan",    label: `In Plan (${goals.filter(g => g.projectionImpact).length})` },
            { key: "savings", label: "Savings" },
            { key: "events",  label: "Cashflow Events" },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key as any)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                filter === f.key
                  ? "bg-brand-gradient text-white"
                  : "text-gray-500 hover:text-gray-700 hover:bg-slate-100"
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Goal cards */}
      {filtered.length === 0 && goals.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <Target className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-500">No goals yet</p>
          <p className="text-xs text-gray-400 mt-1 mb-4">Add goals to track progress and inject them into your retirement simulation</p>
          <button onClick={openNew}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-brand-gradient hover:bg-brand-gradient-hover px-4 py-2 rounded-xl">
            <Plus className="w-4 h-4" /> Add your first goal
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-sm text-gray-400">No goals in this category</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered
            .sort((a, b) => (a.priority ?? 3) - (b.priority ?? 3))
            .map(g => (
              <GoalCard key={g.id} goal={g} onEdit={() => openEdit(g)} onDelete={() => del(g.id)} />
            ))}
        </div>
      )}

      {/* Completed goals (collapsed) */}
      {completed.length > 0 && (
        <details className="mt-6 group">
          <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-600 flex items-center gap-1 select-none">
            <ChevronDown className="w-3.5 h-3.5 group-open:rotate-180 transition-transform" />
            {completed.length} completed goal{completed.length > 1 ? "s" : ""}
          </summary>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-3 opacity-60">
            {completed.map(g => (
              <GoalCard key={g.id} goal={g} onEdit={() => openEdit(g)} onDelete={() => del(g.id)} />
            ))}
          </div>
        </details>
      )}

      {/* Form */}
      {showForm && (
        <GoalForm
          initial={formInitial}
          onSave={save}
          onCancel={() => { setShowForm(false); setEditingGoal(null); }}
          busy={busy}
          clientId={clientId}
        />
      )}
    </div>
  );
}
