import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ── Auth helper ───────────────────────────────────────────────────────────────

function authHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("fp_token") ?? ""}`,
  };
}

async function apiFetch(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, headers: { ...authHeaders(), ...(init?.headers ?? {}) } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? "Request failed");
  }
  return res.json();
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface RetirementProjection {
  id?: number;
  clientId?: number;
  label?: string;
  currentAge?: number;
  retirementAge?: number;
  lifeExpectancy?: number;
  currentSavings?: string;
  rrspBalance?: string;
  tfsaBalance?: string;
  nonRegBalance?: string;
  annualContribution?: string;
  annualTfsaContribution?: string;
  expectedReturn?: string;
  inflationRate?: string;
  desiredRetirementIncome?: string;
  pensionIncome?: string;
  cppStartAge?: number;
  oasStartAge?: number;
  cppMonthly?: string;
  oasMonthly?: string;
  projectedBalance?: string;
  shortfallSurplus?: string;
  successRate?: string;
  notes?: string;
}

interface Props {
  clientId: number;
  clientName?: string;
  projection?: RetirementProjection;
  onSaved?: (proj: RetirementProjection) => void;
  onCancel?: () => void;
}

// ── Form state defaults ───────────────────────────────────────────────────────

const DEFAULTS = {
  label: "",
  currentAge: 40,
  retirementAge: 65,
  lifeExpectancy: 90,
  rrspBalance: "",
  tfsaBalance: "",
  nonRegBalance: "",
  annualContribution: "",
  annualTfsaContribution: "7000",
  expectedReturn: "6.5",
  inflationRate: "2.0",
  desiredRetirementIncome: "",
  pensionIncome: "0",
  cppMonthly: "900",
  cppStartAge: 65,
  oasMonthly: "700",
  oasStartAge: 65,
  notes: "",
};

type FormState = typeof DEFAULTS;

// ── Live calculation ──────────────────────────────────────────────────────────

function calcProjection(f: FormState) {
  const age     = +f.currentAge    || 40;
  const ret     = +f.retirementAge || 65;
  const life    = +f.lifeExpectancy|| 90;
  const rrsp    = +f.rrspBalance   || 0;
  const tfsa    = +f.tfsaBalance   || 0;
  const nonReg  = +f.nonRegBalance || 0;
  const contrib = +f.annualContribution || 0;
  const tfsaC   = +f.annualTfsaContribution || 0;
  const rate    = (+f.expectedReturn || 6.5) / 100;
  const infl    = (+f.inflationRate  || 2.0) / 100;
  const desired = +f.desiredRetirementIncome || 0;
  const pension = +f.pensionIncome  || 0;
  const cpp     = +f.cppMonthly     || 900;
  const cppAge  = +f.cppStartAge    || 65;
  const oas     = +f.oasMonthly     || 700;
  const oasAge  = +f.oasStartAge    || 65;

  const yToRet = Math.max(0, ret - age);
  const yInRet = Math.max(1, life - ret);

  // Accumulate to retirement
  let pRrsp = rrsp, pTfsa = tfsa, pNonReg = nonReg;
  for (let i = 0; i < yToRet; i++) {
    pRrsp   = (pRrsp   + contrib) * (1 + rate);
    pTfsa   = (pTfsa   + tfsaC)  * (1 + rate);
    pNonReg =  pNonReg            * (1 + rate);
  }
  const projTotal = Math.round(pRrsp + pTfsa + pNonReg);

  // Guaranteed income at retirement (in today's dollars for simplicity)
  const cppAnnual = ret >= cppAge ? cpp * 12 : 0;
  const oasAnnual = ret >= oasAge ? oas * 12 : 0;
  const govIncome = cppAnnual + oasAnnual + pension;

  // Desired income inflation-adjusted to retirement year
  const desiredAtRet = desired > 0 ? desired * Math.pow(1 + infl, yToRet) : 0;

  // Withdrawal needed from portfolio per year
  const withdrawal = Math.max(0, desiredAtRet - govIncome);

  // Sustainable withdrawal (real-rate annuity)
  const realRate = rate - infl;
  const swr = realRate > 0 && projTotal > 0
    ? projTotal * realRate / (1 - Math.pow(1 + realRate, -yInRet))
    : projTotal / Math.max(1, yInRet);

  const surplus   = Math.round(swr - withdrawal);
  const funded    = desiredAtRet > 0 ? Math.min(100, Math.round((swr / desiredAtRet) * 100)) : 100;
  const shortfall = surplus < 0 ? Math.abs(surplus) : 0;

  return { projTotal, govIncome, withdrawal: Math.round(withdrawal), surplus, funded, shortfall, desiredAtRet: Math.round(desiredAtRet) };
}

function fmt(n: number) {
  return "$" + Math.abs(Math.round(n)).toLocaleString();
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RetirementProjectionForm({ clientId, clientName, projection, onSaved, onCancel }: Props) {
  const qc = useQueryClient();

  // Initialise form from an existing projection or defaults
  const [f, setF] = useState<FormState>(() => ({
    ...DEFAULTS,
    ...(projection
      ? {
          label:                    projection.label              ?? "",
          currentAge:               projection.currentAge         ?? DEFAULTS.currentAge,
          retirementAge:            projection.retirementAge      ?? DEFAULTS.retirementAge,
          lifeExpectancy:           projection.lifeExpectancy     ?? DEFAULTS.lifeExpectancy,
          rrspBalance:              projection.rrspBalance        ?? "",
          tfsaBalance:              projection.tfsaBalance        ?? "",
          nonRegBalance:            projection.nonRegBalance      ?? "",
          annualContribution:       projection.annualContribution ?? "",
          annualTfsaContribution:   projection.annualTfsaContribution ?? "7000",
          expectedReturn:           projection.expectedReturn     ?? "6.5",
          inflationRate:            projection.inflationRate      ?? "2.0",
          desiredRetirementIncome:  projection.desiredRetirementIncome ?? "",
          pensionIncome:            projection.pensionIncome      ?? "0",
          cppMonthly:               projection.cppMonthly        ?? "900",
          cppStartAge:              projection.cppStartAge        ?? 65,
          oasMonthly:               projection.oasMonthly        ?? "700",
          oasStartAge:              projection.oasStartAge        ?? 65,
          notes:                    projection.notes              ?? "",
        }
      : {}),
  }));

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setF(prev => ({ ...prev, [field]: e.target.type === "number" ? e.target.value : e.target.value }));
  };

  const calc = useMemo(() => calcProjection(f), [f]);

  // ── Save mutation ───────────────────────────────────────────────────────────
  const saveMut = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        label:                   f.label || undefined,
        currentAge:              +f.currentAge,
        retirementAge:           +f.retirementAge,
        lifeExpectancy:          +f.lifeExpectancy,
        rrspBalance:             f.rrspBalance   || "0",
        tfsaBalance:             f.tfsaBalance   || "0",
        nonRegBalance:           f.nonRegBalance || "0",
        annualContribution:      f.annualContribution       || "0",
        annualTfsaContribution:  f.annualTfsaContribution   || "0",
        expectedReturn:          f.expectedReturn,
        inflationRate:           f.inflationRate,
        desiredRetirementIncome: f.desiredRetirementIncome  || "0",
        pensionIncome:           f.pensionIncome,
        cppMonthly:              f.cppMonthly,
        cppStartAge:             +f.cppStartAge,
        oasMonthly:              f.oasMonthly,
        oasStartAge:             +f.oasStartAge,
        projectedBalance:        String(calc.projTotal),
        shortfallSurplus:        String(calc.surplus),
        successRate:             String(calc.funded),
        notes:                   f.notes || undefined,
      };

      if (projection?.id) {
        return apiFetch(`/api/retirement/${projection.id}`, { method: "PATCH", body: JSON.stringify(body) });
      }
      return apiFetch(`/api/clients/${clientId}/retirement`, { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: [`/api/clients/${clientId}/retirement`] });
      onSaved?.(saved);
    },
  });

  // ── Funding bar color ───────────────────────────────────────────────────────
  const barColor   = calc.funded >= 90 ? "#16a34a" : calc.funded >= 70 ? "#d97706" : "#dc2626";
  const surplusCol = calc.surplus >= 0 ? "#16a34a" : "#dc2626";

  // ── Metric cards ────────────────────────────────────────────────────────────
  const metrics = [
    { label: `Projected portfolio at ${f.retirementAge}`, value: fmt(calc.projTotal),    sub: "RRSP · TFSA · Non-Reg" },
    { label: "Guaranteed income / yr",                    value: fmt(calc.govIncome),    sub: "CPP + OAS + Pension" },
    { label: "Portfolio withdrawal / yr",                  value: fmt(calc.withdrawal),   sub: "needed from investments" },
    {
      label: calc.surplus >= 0 ? "Surplus / yr" : "Shortfall / yr",
      value: fmt(Math.abs(calc.surplus)),
      sub:   calc.surplus >= 0 ? "Portfolio can sustain this" : "Annual gap to close",
      color: surplusCol,
    },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">

      {/* Header */}
      <div className="flex items-start justify-between mb-7">
        <div>
          <p className="text-xs font-medium tracking-widest text-gray-400 uppercase mb-1">Retirement Planning</p>
          <h2 className="text-xl font-semibold text-gray-900">
            {clientName ?? "Client"} — {projection?.id ? "Edit Projection" : "New Projection"}
          </h2>
        </div>
        {onCancel && (
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-lg leading-none p-1">✕</button>
        )}
      </div>

      {/* ── Section: Client ── */}
      <div className="mb-7">
        <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-3">Client</p>
        <div className="grid grid-cols-4 gap-3">
          <div className="col-span-1">
            <label className="block text-xs text-gray-500 mb-1">Label (optional)</label>
            <input type="text" value={f.label} onChange={set("label")} placeholder="e.g. Base case" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Current age</label>
            <input type="number" value={f.currentAge} onChange={set("currentAge")} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Retirement age</label>
            <input type="number" value={f.retirementAge} onChange={set("retirementAge")} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Life expectancy</label>
            <input type="number" value={f.lifeExpectancy} onChange={set("lifeExpectancy")} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400" />
          </div>
        </div>
      </div>

      {/* ── Section: Portfolio ── */}
      <div className="border-t border-gray-100 pt-6 mb-7">
        <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-3">Current Portfolio</p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">RRSP balance ($)</label>
            <input type="number" value={f.rrspBalance} onChange={set("rrspBalance")} placeholder="0" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">TFSA balance ($)</label>
            <input type="number" value={f.tfsaBalance} onChange={set("tfsaBalance")} placeholder="0" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Non-reg balance ($)</label>
            <input type="number" value={f.nonRegBalance} onChange={set("nonRegBalance")} placeholder="0" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400" />
          </div>
        </div>
      </div>

      {/* ── Section: Growth & Contributions ── */}
      <div className="border-t border-gray-100 pt-6 mb-7">
        <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-3">Growth &amp; Contributions</p>
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Annual RRSP contrib. ($)</label>
            <input type="number" value={f.annualContribution} onChange={set("annualContribution")} placeholder="0" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Annual TFSA contrib. ($)</label>
            <input type="number" value={f.annualTfsaContribution} onChange={set("annualTfsaContribution")} placeholder="7000" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Expected return (%)</label>
            <input type="number" step="0.1" value={f.expectedReturn} onChange={set("expectedReturn")} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Inflation rate (%)</label>
            <input type="number" step="0.1" value={f.inflationRate} onChange={set("inflationRate")} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400" />
          </div>
        </div>
      </div>

      {/* ── Section: Retirement Income ── */}
      <div className="border-t border-gray-100 pt-6 mb-7">
        <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-3">Retirement Income</p>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Desired annual income ($)</label>
            <input type="number" value={f.desiredRetirementIncome} onChange={set("desiredRetirementIncome")} placeholder="75000" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">DB / other pension income / yr ($)</label>
            <input type="number" value={f.pensionIncome} onChange={set("pensionIncome")} placeholder="0" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400" />
          </div>
          <div>{/* spacer */}</div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">CPP monthly ($)</label>
            <input type="number" value={f.cppMonthly} onChange={set("cppMonthly")} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">CPP start age</label>
            <select value={f.cppStartAge} onChange={set("cppStartAge")} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400">
              <option value={60}>60 — early (reduced)</option>
              <option value={65}>65 — standard</option>
              <option value={70}>70 — maximum</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">OAS monthly ($)</label>
            <input type="number" value={f.oasMonthly} onChange={set("oasMonthly")} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">OAS start age</label>
            <select value={f.oasStartAge} onChange={set("oasStartAge")} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400">
              <option value={65}>65 — standard</option>
              <option value={70}>70 — maximum</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Section: Live Income Analysis ── */}
      <div className="border-t border-gray-100 pt-6 mb-7">
        <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-3">Income analysis at retirement</p>

        {/* Metric cards */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          {metrics.map((m, i) => (
            <div key={i} className="bg-gray-50 rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500 leading-snug mb-1">{m.label}</p>
              <p className="text-xl font-semibold" style={{ color: m.color ?? "#111827" }}>{m.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{m.sub}</p>
            </div>
          ))}
        </div>

        {/* Funding bar */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs text-gray-500">Income coverage</span>
            <span className="text-sm font-medium" style={{ color: barColor }}>{calc.funded}% funded</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${calc.funded}%`, backgroundColor: barColor }}
            />
          </div>
          {calc.desiredAtRet > 0 && (
            <p className="text-xs text-gray-400 mt-1.5">
              Based on {(+f.expectedReturn - +f.inflationRate).toFixed(1)}% real return over {Math.max(1, +f.lifeExpectancy - +f.retirementAge)}-year retirement
              {" · "}Desired income inflation-adjusted to {fmt(calc.desiredAtRet)}/yr at age {f.retirementAge}
            </p>
          )}
        </div>
      </div>

      {/* ── Notes ── */}
      <div className="border-t border-gray-100 pt-6 mb-7">
        <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-3">Notes</p>
        <textarea
          value={f.notes}
          onChange={set("notes")}
          rows={3}
          placeholder="Advisor notes, assumptions, follow-up items…"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
        />
      </div>

      {/* ── Actions ── */}
      <div className="flex justify-end gap-3">
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-5 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending}
          className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
        >
          {saveMut.isPending ? "Saving…" : projection?.id ? "Update projection" : `Save projection`}
        </button>
      </div>

      {saveMut.isError && (
        <p className="text-xs text-red-500 mt-3 text-right">{(saveMut.error as Error).message}</p>
      )}

    </div>
  );
}

// ── Retirement Projections Tab ─────────────────────────────────────────────────
// Drop-in replacement for the existing retirement tab.
// Usage: <RetirementTab clientId={clientId} />

export function RetirementTab({ clientId, clientName }: { clientId: number; clientName?: string }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<RetirementProjection | null>(null);

  const { data: projections = [], isLoading } = useQuery<RetirementProjection[]>({
    queryKey: [`/api/clients/${clientId}/retirement`],
    queryFn: () => apiFetch(`/api/clients/${clientId}/retirement`),
    enabled: !!clientId,
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/retirement/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [`/api/clients/${clientId}/retirement`] }),
  });

  if (adding || editing) {
    return (
      <RetirementProjectionForm
        clientId={clientId}
        clientName={clientName}
        projection={editing ?? undefined}
        onSaved={() => { setAdding(false); setEditing(null); }}
        onCancel={() => { setAdding(false); setEditing(null); }}
      />
    );
  }

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-semibold text-gray-900">Retirement Projections</h3>
        <div className="flex gap-2">
          <button
            onClick={() => {/* trigger retirement checkup / simulate */}}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Retirement Checkup
          </button>
          <button
            onClick={() => setAdding(true)}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            + Add Projection
          </button>
        </div>
      </div>

      {/* Empty state */}
      {isLoading && <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>}
      {!isLoading && projections.length === 0 && (
        <div className="border border-dashed border-gray-200 rounded-xl py-12 text-center">
          <p className="text-gray-400 text-sm mb-3">No projections yet</p>
          <button onClick={() => setAdding(true)} className="text-sm text-blue-600 hover:underline">
            Create the first projection →
          </button>
        </div>
      )}

      {/* Projection cards */}
      <div className="space-y-4">
        {projections.map((proj) => {
          const funded   = proj.successRate ? +proj.successRate : null;
          const barColor = funded === null ? "#9ca3af" : funded >= 90 ? "#16a34a" : funded >= 70 ? "#d97706" : "#dc2626";
          const surplus  = proj.shortfallSurplus ? +proj.shortfallSurplus : null;

          return (
            <div key={proj.id} className="border border-gray-200 rounded-xl p-6 hover:border-gray-300 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="font-medium text-gray-900 text-base">
                    {proj.label || (clientName ?? "Projection")}
                  </h4>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Age {proj.currentAge} → {proj.retirementAge} · {proj.lifeExpectancy} yr plan
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditing(proj)}
                    className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => proj.id && confirm("Delete this projection?") && deleteMut.mutate(proj.id)}
                    className="text-xs px-3 py-1.5 border border-red-100 rounded-lg text-red-500 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Summary grid */}
              <div className="grid grid-cols-4 gap-3 mb-4">
                {[
                  { label: "Projected balance", value: proj.projectedBalance ? "$" + Math.round(+proj.projectedBalance).toLocaleString() : "—" },
                  { label: "CPP + OAS / mo",    value: proj.cppMonthly && proj.oasMonthly ? "$" + (Math.round(+proj.cppMonthly) + Math.round(+proj.oasMonthly)).toLocaleString() : "—" },
                  { label: "Desired income",     value: proj.desiredRetirementIncome ? "$" + Math.round(+proj.desiredRetirementIncome).toLocaleString() + "/yr" : "—" },
                  {
                    label: surplus !== null && surplus >= 0 ? "Surplus / yr" : "Shortfall / yr",
                    value: surplus !== null ? "$" + Math.abs(Math.round(surplus)).toLocaleString() : "—",
                    color: surplus !== null ? (surplus >= 0 ? "#16a34a" : "#dc2626") : undefined,
                  },
                ].map((m, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg px-3 py-2.5">
                    <p className="text-xs text-gray-500 mb-0.5">{m.label}</p>
                    <p className="text-sm font-semibold" style={{ color: m.color ?? "#111827" }}>{m.value}</p>
                  </div>
                ))}
              </div>

              {/* Funding bar */}
              {funded !== null && (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-400">Income coverage</span>
                    <span className="text-xs font-medium" style={{ color: barColor }}>{funded}% funded</span>
                  </div>
                  <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(funded, 100)}%`, backgroundColor: barColor }} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default RetirementProjectionForm;
