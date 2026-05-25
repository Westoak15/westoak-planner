/**
 * ScenarioComparisonPanel.tsx
 * Side-by-side retirement scenario comparison — select 2 or 3 projections,
 * see deltas highlighted, save the comparison set.
 */

import { useState, useEffect, useMemo } from "react";
import {
  X, Save, Star, TrendingUp, TrendingDown, Minus,
  ChevronRight, Trophy, AlertTriangle,
} from "lucide-react";
import { translations, type T } from "../../i18n/translations";
import { api } from "../../lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Projection {
  id: number;
  label?: string;
  person?: string;
  currentAge?: number;
  retirementAge?: number;
  desiredRetirementIncome?: string;
  projectedBalance?: string;
  shortfallSurplus?: string;
  successRate?: string;
  rrspBalance?: string;
  tfsaBalance?: string;
  nonRegBalance?: string;
  pensionIncome?: string;
  cppStartAge?: number;
  oasStartAge?: number;
  cppMonthly?: string;
  oasMonthly?: string;
  expectedReturn?: string;
  inflationRate?: string;
  annualContribution?: string;
}

interface CalcResult {
  projTotal:    number;
  funded:       number;
  surplus:      number;
  govIncome:    number;
  withdrawal:   number;
  desiredAtRet: number;
  cppAdjusted:  number;
  oasAdjusted:  number;
}

interface Props {
  clientId:    number;
  onClose:     () => void;
  t?:          T;
}

// ── Calc engine (mirrors RetirementProjectionForm calcProjection) ───────────────

function calcFromProjection(p: Projection): CalcResult {
  const age     = p.currentAge    || 40;
  const ret     = p.retirementAge || 65;
  const life    = 90;
  const rrsp    = Number(p.rrspBalance   || 0);
  const tfsa    = Number(p.tfsaBalance   || 0);
  const nonReg  = Number(p.nonRegBalance || 0);
  const contrib = Number(p.annualContribution || 0);
  const rate    = (Number(p.expectedReturn || 6.5)) / 100;
  const infl    = (Number(p.inflationRate  || 2.0)) / 100;
  const desired = Number(p.desiredRetirementIncome || 0);
  const pension = Number(p.pensionIncome  || 0);
  const cpp     = Number(p.cppMonthly     || 900);
  const cppAge  = p.cppStartAge || 65;
  const oas     = Number(p.oasMonthly     || 700);
  const oasAge  = p.oasStartAge || 65;

  const yToRet = Math.max(0, ret - age);
  const yInRet = Math.max(1, life - ret);

  let pRrsp = rrsp, pTfsa = tfsa, pNonReg = nonReg;
  for (let i = 0; i < yToRet; i++) {
    pRrsp   = (pRrsp + contrib) * (1 + rate);
    pTfsa   = pTfsa             * (1 + rate);
    pNonReg = pNonReg           * (1 + rate);
  }
  const projTotal = Math.round(pRrsp + pTfsa + pNonReg);

  const cppFactor = cppAge <= 65 ? 1 - 0.006*(65-cppAge)*12 : 1 + 0.007*(cppAge-65)*12;
  const oasFactor = oasAge <= 65 ? 1 : 1 + 0.006*(oasAge-65)*12;
  const cppAnnualAtRet = ret >= cppAge ? Math.round(cpp * cppFactor * 12 * Math.pow(1+infl, yToRet)) : 0;
  const oasAnnualAtRet = ret >= oasAge ? Math.round(oas * oasFactor * 12 * Math.pow(1+infl, yToRet)) : 0;
  const pensionAtRet   = pension > 0 ? Math.round(pension * Math.pow(1+infl, yToRet)) : 0;
  const govIncome      = cppAnnualAtRet + oasAnnualAtRet + pensionAtRet;
  const desiredAtRet   = desired > 0 ? Math.round(desired * Math.pow(1+infl, yToRet)) : 0;
  const withdrawal     = Math.max(0, desiredAtRet - govIncome);

  const realRate = rate - infl;
  const swr = realRate > 0 && projTotal > 0
    ? projTotal * realRate / (1 - Math.pow(1+realRate, -yInRet))
    : projTotal / Math.max(1, yInRet);

  const surplus = Math.round(swr - withdrawal);
  const funded  = desiredAtRet > 0 ? Math.min(100, Math.round((swr / desiredAtRet) * 100)) : 100;

  return {
    projTotal, funded, surplus, govIncome, withdrawal,
    desiredAtRet, cppAdjusted: cppAnnualAtRet, oasAdjusted: oasAnnualAtRet,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(n: number) {
  return (n < 0 ? "-$" : "$") + Math.abs(Math.round(n)).toLocaleString();
}
function fmtK(n: number) {
  return (n < 0 ? "-$" : "$") + Math.abs(Math.round(n / 1000)).toLocaleString() + "K";
}

type DeltaDir = "up" | "down" | "neutral";
function deltaDir(base: number, cmp: number, higherIsBetter = true): DeltaDir {
  const diff = cmp - base;
  if (Math.abs(diff) < 0.5) return "neutral";
  return (diff > 0) === higherIsBetter ? "up" : "down";
}

function DeltaBadge({ base, value, fmt = fmt$, higherIsBetter = true }:
  { base: number; value: number; fmt?: (n: number) => string; higherIsBetter?: boolean }) {
  const diff = value - base;
  if (Math.abs(diff) < 0.5) return <span className="text-gray-400 text-xs">—</span>;
  const dir = deltaDir(base, value, higherIsBetter);
  const color = dir === "up" ? "text-emerald-600" : "text-red-500";
  const Icon  = dir === "up" ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${color}`}>
      <Icon className="w-3 h-3" />
      {fmt(Math.abs(diff))}
    </span>
  );
}

function FundingBar({ pct, size = "md" }: { pct: number; size?: "sm" | "md" }) {
  const h = size === "sm" ? "h-1.5" : "h-2.5";
  const color = pct >= 90 ? "bg-emerald-500" : pct >= 70 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className={`w-full bg-gray-100 rounded-full ${h} mt-1`}>
      <div className={`${color} ${h} rounded-full transition-all`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

// ── Comparison rows config ────────────────────────────────────────────────────

type RowConfig = {
  key:   string;
  label: string;
  getValue:  (p: Projection, c: CalcResult) => number;
  format:    (n: number) => string;
  higher?:   boolean;  // true = higher is better
  isPercent?: boolean;
  extra?: (p: Projection, c: CalcResult) => string;
};

const ROWS: RowConfig[] = [
  {
    key: "retirementAge",
    label: "Retirement Age",
    getValue: (p) => p.retirementAge || 65,
    format: (n) => String(n),
    higher: false,
  },
  {
    key: "projTotal",
    label: "Projected Portfolio",
    getValue: (_, c) => c.projTotal,
    format: fmtK,
    higher: true,
  },
  {
    key: "funded",
    label: "Funding Rate",
    getValue: (_, c) => c.funded,
    format: (n) => `${n}%`,
    higher: true,
    isPercent: true,
  },
  {
    key: "desiredIncome",
    label: "Desired Annual Income",
    getValue: (p) => Number(p.desiredRetirementIncome || 0),
    format: fmt$,
    higher: true,
  },
  {
    key: "govIncome",
    label: "Gov't Income (CPP+OAS+Pension)",
    getValue: (_, c) => c.govIncome,
    format: fmt$,
    higher: true,
  },
  {
    key: "surplus",
    label: "Annual Surplus / (Deficit)",
    getValue: (_, c) => c.surplus,
    format: fmt$,
    higher: true,
  },
  {
    key: "cppAge",
    label: "CPP Start Age",
    getValue: (p) => p.cppStartAge || 65,
    format: (n) => String(n),
    higher: false,
    extra: (p, c) => `+${fmt$(c.cppAdjusted)}/yr`,
  },
  {
    key: "oasAge",
    label: "OAS Start Age",
    getValue: (p) => p.oasStartAge || 65,
    format: (n) => String(n),
    higher: false,
    extra: (p, c) => `+${fmt$(c.oasAdjusted)}/yr`,
  },
  {
    key: "contrib",
    label: "Annual Contribution",
    getValue: (p) => Number(p.annualContribution || 0),
    format: fmt$,
    higher: true,
  },
  {
    key: "return",
    label: "Expected Return",
    getValue: (p) => Number(p.expectedReturn || 6.5),
    format: (n) => `${n.toFixed(1)}%`,
    higher: true,
  },
];

// ── Main component ────────────────────────────────────────────────────────────

export function ScenarioComparisonPanel({ clientId, onClose, t = translations.en }: Props) {
  const [projections, setProjections] = useState<Projection[]>([]);
  const [loading, setLoading]         = useState(true);
  const [selected, setSelected]       = useState<number[]>([]);
  const [labels, setLabels]           = useState<Record<number, string>>({});
  const [savedLabel, setSavedLabel]   = useState("");
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [step, setStep]               = useState<"select" | "compare">("select");

  // Self-fetch projections on mount
  useEffect(() => {
    const token = localStorage.getItem("authToken") || localStorage.getItem("fp_token") || "";
    fetch(`/api/clients/${clientId}/retirement`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      credentials: "include",
    })
      .then(r => r.ok ? r.json() : [])
      .then((data: any[]) => setProjections(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clientId]);

  const compared = useMemo(() =>
    projections.filter(p => p.id !== undefined && selected.includes(p.id!)),
    [projections, selected]
  );

  const calcs = useMemo(() =>
    compared.map(p => calcFromProjection(p)),
    [compared]
  );

  const bestIdx = useMemo(() => {
    if (calcs.length === 0) return 0;
    return calcs.reduce((best, c, i) => c.funded > calcs[best].funded ? i : best, 0);
  }, [calcs]);

  function toggleSelect(id: number) {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 3 ? [...prev, id] : prev
    );
  }

  function getLabel(p: Projection) {
    return labels[p.id!] ?? p.label ?? `Scenario ${p.id}`;
  }

  async function handleSave() {
    if (selected.length < 2) return;
    setSaving(true);
    try {
      await api.post(`/api/clients/${clientId}/scenario-comparisons`, {
        label: savedLabel || "Scenario Comparison",
        scenarioIds: selected,
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  // ── Step 1: Select projections ─────────────────────────────────────────────
  if (step === "select") {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Compare Scenarios</h2>
              <p className="text-sm text-gray-400 mt-0.5">Select 2 or 3 projections to compare side by side</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Projection list */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
            {loading && (
              <p className="text-sm text-gray-400 text-center py-8">Loading projections…</p>
            )}
            {!loading && projections.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">No projections on file. Create at least 2 projections first.</p>
            )}
            {!loading && projections.length === 1 && (
              <p className="text-sm text-amber-500 text-center py-2">Only 1 projection found — create a second projection to compare.</p>
            )}
            {projections.map((p) => {
              const isSelected = selected.includes(p.id!);
              const calc = calcFromProjection(p);
              const order = selected.indexOf(p.id!);
              return (
                <button
                  key={p.id}
                  onClick={() => toggleSelect(p.id!)}
                  className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border-2 text-left transition-all ${
                    isSelected
                      ? "border-[#0c1e3a] bg-[#0c1e3a]/5"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  {/* Selection indicator */}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold transition-all ${
                    isSelected ? "bg-[#0c1e3a] text-white" : "bg-gray-100 text-gray-400"
                  }`}>
                    {isSelected ? order + 1 : ""}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{p.label || `Projection ${p.id}`}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Retire at {p.retirementAge || 65} · Target {fmt$(Number(p.desiredRetirementIncome || 0))}/yr
                    </p>
                  </div>
                  {/* Funding bar preview */}
                  <div className="text-right flex-shrink-0 w-24">
                    <p className={`text-sm font-bold ${calc.funded >= 90 ? "text-emerald-600" : calc.funded >= 70 ? "text-amber-600" : "text-red-500"}`}>
                      {calc.funded}%
                    </p>
                    <FundingBar pct={calc.funded} size="sm" />
                    <p className="text-[10px] text-gray-400 mt-0.5">funded</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
            <p className="text-sm text-gray-400">
              {selected.length === 0 ? "Select 2–3 scenarios" :
               selected.length === 1 ? "Select 1 more" :
               `${selected.length} selected — ready to compare`}
            </p>
            <div className="flex gap-3">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
                Cancel
              </button>
              <button
                onClick={() => setStep("compare")}
                disabled={selected.length < 2}
                className="px-5 py-2 bg-[#0c1e3a] hover:bg-[#0e2a4a] disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Compare →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2: Comparison view ────────────────────────────────────────────────
  const colW = compared.length === 2 ? "w-64" : "w-48";

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-[#0c1e3a] rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <ChevronRight className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Scenario Comparison</h2>
              <p className="text-xs text-white/60">{compared.length} scenarios — click any name to rename</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable comparison table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            {/* Scenario name headers */}
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider w-52 bg-gray-50">
                  Metric
                </th>
                {compared.map((p, i) => (
                  <th key={p.id} className={`px-4 py-3 text-center ${colW} ${i === bestIdx ? "bg-emerald-50" : "bg-white"}`}>
                    <div className="flex flex-col items-center gap-1">
                      {i === bestIdx && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                          <Trophy className="w-2.5 h-2.5" /> Best Funded
                        </span>
                      )}
                      <input
                        value={getLabel(p)}
                        onChange={e => setLabels(l => ({ ...l, [p.id!]: e.target.value }))}
                        className={`text-sm font-bold text-center bg-transparent border-b-2 transition-colors outline-none w-full ${
                          i === bestIdx ? "text-emerald-700 border-emerald-300 focus:border-emerald-500" : "text-[#0c1e3a] border-transparent focus:border-[#0c1e3a]"
                        }`}
                      />
                      <span className="text-[10px] text-gray-400 capitalize">{p.person || "primary"}</span>
                    </div>
                  </th>
                ))}
                {compared.length > 1 && (
                  <th className="px-4 py-3 text-center bg-slate-50 w-36">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      vs. Scenario 1
                    </span>
                  </th>
                )}
              </tr>
            </thead>

            <tbody>
              {ROWS.map((row, ri) => {
                const values = compared.map((p, i) => row.getValue(p, calcs[i]));
                const baseVal = values[0];
                const isHighlight = row.key === "funded" || row.key === "surplus" || row.key === "projTotal";

                return (
                  <tr key={row.key} className={`border-b border-gray-100 ${ri % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                    <td className="px-5 py-3 text-xs font-semibold text-gray-500 bg-inherit">
                      {row.label}
                    </td>
                    {compared.map((p, i) => {
                      const val = values[i];
                      const dir = i > 0 ? deltaDir(baseVal, val, row.higher !== false) : "neutral";
                      let color = "text-gray-900";
                      if (isHighlight) {
                        if (row.key === "funded") {
                          color = val >= 90 ? "text-emerald-600" : val >= 70 ? "text-amber-600" : "text-red-500";
                        } else if (row.key === "surplus") {
                          color = val >= 0 ? "text-emerald-600" : "text-red-500";
                        }
                      }
                      return (
                        <td key={p.id} className={`px-4 py-3 text-center ${i === bestIdx ? "bg-emerald-50/50" : ""}`}>
                          <p className={`font-semibold ${color} ${isHighlight ? "text-base" : "text-sm"}`}>
                            {row.format(val)}
                          </p>
                          {row.key === "funded" && <FundingBar pct={val} />}
                          {row.extra && (
                            <p className="text-[10px] text-gray-400 mt-0.5">{row.extra(p, calcs[i])}</p>
                          )}
                        </td>
                      );
                    })}
                    {/* Delta column — compares last selected scenario vs first */}
                    {compared.length > 1 && (
                      <td className="px-4 py-3 text-center bg-slate-50/50">
                        {compared.length === 2 ? (
                          <DeltaBadge base={values[0]} value={values[1]} fmt={row.format} higherIsBetter={row.higher !== false} />
                        ) : (
                          <div className="space-y-1">
                            {values.slice(1).map((v, di) => (
                              <div key={di} className="flex items-center justify-center gap-1">
                                <span className="text-[10px] text-gray-400">S{di+2}:</span>
                                <DeltaBadge base={values[0]} value={v} fmt={row.format} higherIsBetter={row.higher !== false} />
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer — save + back */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <button onClick={() => setStep("select")} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
            ← Change scenarios
          </button>

          <div className="flex items-center gap-3">
            {saved ? (
              <span className="text-sm text-emerald-600 font-semibold">✓ Saved</span>
            ) : (
              <>
                <input
                  value={savedLabel}
                  onChange={e => setSavedLabel(e.target.value)}
                  placeholder="Label (optional)"
                  className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 w-44 focus:outline-none focus:ring-2 focus:ring-[#0c1e3a]/20"
                />
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-[#0c1e3a] hover:bg-[#0e2a4a] text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {saving ? "Saving…" : "Save Comparison"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
