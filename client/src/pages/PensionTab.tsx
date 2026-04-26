import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { Plus, Trash2, Pencil, Save, X, Building2, Calculator, TrendingUp } from "lucide-react";

interface PensionPlan {
  id: number;
  pensionType: string;
  subscriberOwner: string | null;
  employerName: string | null;
  accrualRate: string | null;
  yearsOfService: string | null;
  projectedYearsAtRetirement: string | null;
  bestAverageEarnings: string | null;
  currentBalance: string | null;
  employerMatchPct: string | null;
  retirementAge: number | null;
  indexingType: string | null;
  indexingRate: string | null;
  bridgeBenefit: string | null;
  bridgeBenefitEndAge: number | null;
  survivorBenefitPct: string | null;
  isVested: boolean | null;
  notes: string | null;
}

const PENSION_TYPES = [
  { key: "dbpp",       label: "DBPP — Defined Benefit Pension Plan" },
  { key: "dcpp",       label: "DCPP — Defined Contribution Pension Plan" },
  { key: "group_rrsp", label: "Group RRSP" },
  { key: "dpsp",       label: "DPSP — Deferred Profit Sharing Plan" },
];

const INDEXING_TYPES = [
  { key: "none",    label: "No Indexing" },
  { key: "cpi",     label: "CPI Indexed (full)" },
  { key: "partial", label: "Partial CPI (50%)" },
  { key: "fixed",   label: "Fixed Rate" },
];

const GROWTH_RATES = [0.01, 0.015, 0.02, 0.025, 0.03, 0.035];

const fmt$ = (v: string | number | null) => {
  if (!v) return "—";
  return "$" + Number(v).toLocaleString("en-CA", { maximumFractionDigits: 0 });
};
const fmtPct = (v: string | number | null) => {
  if (!v) return "—";
  return (Number(v) * 100).toFixed(2) + "%";
};

function calcDBPPAnnual(plan: PensionPlan): number {
  const rate   = Number(plan.accrualRate || 0);
  const years  = Number(plan.projectedYearsAtRetirement || plan.yearsOfService || 0);
  const salary = Number(plan.bestAverageEarnings || 0);
  return rate * years * salary;
}

/** Project income at 3.5%/yr and return the average of the best 5 years before retirement */
function calcBest5YearAverage(currentIncome: number, currentAge: number, retirementAge: number, growthRate = 0.035): {
  best5Avg: number;
  projectedAtRetirement: number;
  yearlyProjections: { age: number; income: number }[];
} {
  const yearsToRet = Math.max(0, retirementAge - currentAge);
  const yearlyProjections: { age: number; income: number }[] = [];
  for (let y = 0; y <= yearsToRet; y++) {
    yearlyProjections.push({
      age: currentAge + y,
      income: Math.round(currentIncome * Math.pow(1 + growthRate, y)),
    });
  }
  const projectedAtRetirement = yearlyProjections[yearlyProjections.length - 1]?.income ?? currentIncome;
  // Best 5 years = last 5 years before retirement
  const last5 = yearlyProjections.slice(-5);
  const best5Avg = last5.length > 0
    ? Math.round(last5.reduce((s, y) => s + y.income, 0) / last5.length)
    : currentIncome;
  return { best5Avg, projectedAtRetirement, yearlyProjections };
}

const emptyPlan = (): Partial<PensionPlan> => ({
  pensionType: "dbpp",
  subscriberOwner: "primary",
  employerName: "",
  accrualRate: "0.02",
  yearsOfService: "",
  projectedYearsAtRetirement: "",
  bestAverageEarnings: "",
  currentBalance: "",
  employerMatchPct: "",
  retirementAge: 65,
  indexingType: "none",
  indexingRate: "",
  bridgeBenefit: "",
  bridgeBenefitEndAge: 65,
  survivorBenefitPct: "0.60",
  isVested: true,
  notes: "",
});

export function PensionTab({ clientId, client, person = "primary" }: {
  clientId: number; client?: any; person?: string;
}) {
  const [plans, setPlans]         = useState<PensionPlan[]>([]);
  const [showForm, setShowForm]   = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm]           = useState<any>(emptyPlan());
  const [busy, setBusy]           = useState(false);
  const [showProjection, setShowProjection] = useState(false);
  const [growthRate, setGrowthRate] = useState(0.035);

  const activePerson = person === "spouse" ? "spouse" : "primary";
  const clientName   = client?.firstName ?? "Client";
  const spouseName   = client?.spouseFirstName ?? "Spouse";

  const load = () => api.get<PensionPlan[]>(`/api/clients/${clientId}/pensions`).then(setPlans).catch(() => {});
  useEffect(() => { load(); }, [clientId]);

  const upd = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  // Auto-calculate projected years when service years change
  useEffect(() => {
    if (!form?.yearsOfService || !form?.retirementAge) return;
    const owner     = form.subscriberOwner ?? "primary";
    const isPrimary = owner === "primary";
    const dob       = isPrimary ? client?.dateOfBirth : client?.spouseDateOfBirth;
    const age       = dob ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;
    const retAge    = Number(form.retirementAge);
    if (age && retAge) {
      upd("projectedYearsAtRetirement", String(Number(form.yearsOfService) + (retAge - age)));
    }
  }, [form?.yearsOfService]);

  // Derive income projection info for the current form
  const formOwner     = form.subscriberOwner ?? "primary";
  const formIsPrimary = formOwner === "primary";
  const formDob       = formIsPrimary ? client?.dateOfBirth : client?.spouseDateOfBirth;
  const formAge       = formDob ? Math.floor((Date.now() - new Date(formDob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;
  const formIncome    = Number(formIsPrimary ? client?.annualIncome : client?.spouseAnnualIncome) || 0;
  const formRetAge    = Number(form.retirementAge) || 65;
  const projection    = formAge && formIncome ? calcBest5YearAverage(formIncome, formAge, formRetAge, growthRate) : null;

  function prefillFromOwner(owner: string) {
    const isPrimary = owner === "primary";
    const dob       = isPrimary ? client?.dateOfBirth : client?.spouseDateOfBirth;
    const salary    = isPrimary ? client?.annualIncome : client?.spouseAnnualIncome;
    const retAge    = isPrimary ? (client?.retirementAge ?? 65) : (client?.spouseRetirementAge ?? 65);
    const penType   = isPrimary ? client?.pensionType : (client as any)?.spousePensionType;
    const typeMap: Record<string, string> = { "DBPP": "dbpp", "DCPP": "dcpp", "Group RRSP": "group_rrsp", "DPSP": "dpsp" };
    const age       = dob ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;
    const currentService = Number(form?.yearsOfService || 0);
    const projYears = (age && retAge) ? String(currentService + (retAge - age)) : "";

    // Calculate best 5yr average from current income
    const currentIncome = Number(salary) || 0;
    const best5Avg = (age && currentIncome && retAge)
      ? calcBest5YearAverage(currentIncome, age, retAge, growthRate).best5Avg
      : currentIncome;

    upd("subscriberOwner", owner);
    if (retAge)    upd("retirementAge", retAge);
    if (projYears) upd("projectedYearsAtRetirement", projYears);
    if (penType && typeMap[penType]) upd("pensionType", typeMap[penType]);
    if (best5Avg)  upd("bestAverageEarnings", String(best5Avg));
  }

  function openNew(owner: "primary" | "spouse" = "primary") {
    setEditingId(null);
    const base      = emptyPlan();
    const isPrimary = owner === "primary";
    const salary    = isPrimary ? client?.annualIncome : client?.spouseAnnualIncome;
    const retAge    = isPrimary ? (client?.retirementAge ?? 65) : (client?.spouseRetirementAge ?? 65);
    const penType   = isPrimary ? client?.pensionType : (client as any)?.spousePensionType;
    const mappedType = penType ? penType.toLowerCase().replace(" ", "_") : "dbpp";
    const dob       = isPrimary ? client?.dateOfBirth : client?.spouseDateOfBirth;
    const age       = dob ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;
    const currentService = 0;
    const projYears = (age && retAge) ? String(currentService + (retAge - age)) : "";
    const currentIncome = Number(salary) || 0;
    const best5Avg  = (age && currentIncome && retAge)
      ? calcBest5YearAverage(currentIncome, age, retAge, growthRate).best5Avg
      : currentIncome;
    setForm({
      ...base,
      subscriberOwner: owner,
      pensionType: mappedType,
      bestAverageEarnings: best5Avg ? String(best5Avg) : "",
      retirementAge: retAge,
      projectedYearsAtRetirement: projYears,
    });
    setShowProjection(false);
    setShowForm(true);
  }

  function openEdit(p: PensionPlan) {
    setEditingId(p.id);
    const validTypes = ["dbpp","dcpp","group_rrsp","dpsp"];
    const pensionType = validTypes.includes(p.pensionType) ? p.pensionType : "dbpp";
    setForm({ ...p, pensionType, accrualRate: p.accrualRate ?? "0.02", survivorBenefitPct: p.survivorBenefitPct ?? "0.60" });
    setShowProjection(false);
    setShowForm(true);
  }

  async function save() {
    setBusy(true);
    try {
      if (editingId) await api.patch(`/api/pensions/${editingId}`, form);
      else await api.post(`/api/clients/${clientId}/pensions`, form);
      setShowForm(false); setEditingId(null); await load();
    } catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  }

  async function del(id: number) {
    if (!confirm("Delete this pension plan?")) return;
    await api.delete(`/api/pensions/${id}`); await load();
  }

  const resolvedType = ["dbpp","dcpp","group_rrsp","dpsp"].includes(form.pensionType) ? form.pensionType : "dbpp";
  const isDBPP = resolvedType === "dbpp";
  const isDCPP = ["dcpp","group_rrsp","dpsp"].includes(resolvedType);

  const filteredPlans = plans.filter(p =>
    activePerson === "primary" ? p.subscriberOwner !== "spouse" : p.subscriberOwner === "spouse"
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Pension Plans</h2>
          <p className="text-sm text-gray-500 mt-0.5">Employer pension plans and defined benefit entitlements</p>
        </div>
        <button onClick={() => openNew(activePerson)}
          className="flex items-center gap-1.5 text-sm font-semibold text-white bg-[#0c1e3a] hover:bg-[#0e2a4a] px-3 py-2 rounded-xl">
          <Plus className="w-4 h-4" /> Add Plan
        </button>
      </div>

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">{editingId ? "Edit Pension Plan" : "Add Pension Plan"}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 space-y-5">
              {/* Owner + Type + Employer — top row */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Plan Owner</label>
                  <select value={form.subscriberOwner ?? "primary"} onChange={e => prefillFromOwner(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm">
                    <option value="primary">{client?.firstName ?? "Primary"} {client?.lastName ?? ""}</option>
                    {client?.spouseFirstName && <option value="spouse">{client.spouseFirstName} {client.spouseLastName ?? ""}</option>}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Pension Type</label>
                  <select value={form.pensionType} onChange={e => upd("pensionType", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm">
                    {PENSION_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Employer Name</label>
                  <input value={form.employerName ?? ""} onChange={e => upd("employerName", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" placeholder="e.g. Ontario Teachers'" />
                </div>
              </div>

              {/* DBPP Fields */}
              {isDBPP && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Defined Benefit Formula</p>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <label className="text-xs text-gray-500 font-semibold">Income Growth:</label>
                        <select value={growthRate} onChange={e => setGrowthRate(Number(e.target.value))}
                          className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white">
                          {GROWTH_RATES.map(r => (
                            <option key={r} value={r}>{(r * 100).toFixed(1)}%</option>
                          ))}
                        </select>
                      </div>
                      {projection && (
                        <button onClick={() => setShowProjection(v => !v)}
                          className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline">
                          <TrendingUp className="w-3.5 h-3.5" />
                          {showProjection ? "Hide" : "Show"} Income Projection
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Income context bar */}
                  {projection && (
                    <div className="grid grid-cols-3 gap-3 bg-white/70 rounded-xl p-3 border border-blue-100">
                      <div>
                        <p className="text-[10px] font-semibold text-gray-500 uppercase">Current Income</p>
                        <p className="text-sm font-bold text-gray-800">{fmt$(formIncome)}</p>
                        <p className="text-[10px] text-gray-400">Age {formAge}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-gray-500 uppercase">Projected at Ret. Age {formRetAge}</p>
                        <p className="text-sm font-bold text-blue-700">{fmt$(projection.projectedAtRetirement)}</p>
                        <p className="text-[10px] text-gray-400">@ 3.5%/yr growth</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-gray-500 uppercase">Best 5-Year Average</p>
                        <p className="text-sm font-bold text-green-700">{fmt$(projection.best5Avg)}</p>
                        <p className="text-[10px] text-gray-400">Avg of last 5 yrs pre-retirement</p>
                      </div>
                    </div>
                  )}

                  {/* Projection table */}
                  {showProjection && projection && (
                    <div className="bg-white rounded-xl border border-blue-100 overflow-hidden max-h-48 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-blue-50 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold text-gray-500">Age</th>
                            <th className="px-3 py-2 text-right font-semibold text-gray-500">Projected Income</th>
                            <th className="px-3 py-2 text-right font-semibold text-gray-500">Cumulative Growth</th>
                          </tr>
                        </thead>
                        <tbody>
                          {projection.yearlyProjections.map((y, i) => (
                            <tr key={i} className={`border-t border-gray-100 ${i >= projection.yearlyProjections.length - 5 ? "bg-green-50 font-semibold" : ""}`}>
                              <td className="px-3 py-1.5">{y.age}{i >= projection.yearlyProjections.length - 5 ? " ★" : ""}</td>
                              <td className="px-3 py-1.5 text-right">{fmt$(y.income)}</td>
                              <td className="px-3 py-1.5 text-right text-gray-400">+{(((y.income / formIncome) - 1) * 100).toFixed(1)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* DBPP formula inputs */}
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Accrual Rate</label>
                      <input type="number" step="0.001" value={form.accrualRate ?? ""} onChange={e => upd("accrualRate", e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white" placeholder="0.02" />
                      <p className="text-[10px] text-gray-400 mt-0.5">e.g. 0.02 = 2%</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Years of Service (Current)</label>
                      <input type="number" value={form.yearsOfService ?? ""} onChange={e => upd("yearsOfService", e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white" placeholder="0" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Projected Years at Retirement</label>
                      <input type="number" value={form.projectedYearsAtRetirement ?? ""} onChange={e => upd("projectedYearsAtRetirement", e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white" placeholder="0" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Retirement Age</label>
                      <input type="number" value={form.retirementAge ?? ""} onChange={e => upd("retirementAge", +e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white" placeholder="65" />
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    <div className="col-span-2">
                      <label className="text-xs font-semibold text-gray-500 block mb-1">
                        Best/Average Earnings ($)
                        {projection && (
                          <button onClick={() => upd("bestAverageEarnings", String(projection.best5Avg))}
                            className="ml-2 text-[10px] text-blue-600 font-semibold hover:underline">
                            ↑ Use projected best 5yr avg ({fmt$(projection.best5Avg)})
                          </button>
                        )}
                      </label>
                      <input type="number" value={form.bestAverageEarnings ?? ""} onChange={e => upd("bestAverageEarnings", e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white" placeholder="0" />
                    </div>
                    <div className="col-span-2 flex items-end">
                      {form.accrualRate && form.projectedYearsAtRetirement && form.bestAverageEarnings && (
                        <div className="bg-blue-700 text-white rounded-xl p-3 w-full">
                          <p className="text-[10px] uppercase font-bold text-blue-200">Estimated Annual Pension</p>
                          <p className="text-2xl font-bold">{fmt$(calcDBPPAnnual(form as any))}</p>
                          <p className="text-[10px] text-blue-300 mt-0.5">
                            {fmtPct(form.accrualRate)} × {form.projectedYearsAtRetirement} yrs × {fmt$(form.bestAverageEarnings)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Indexing + Bridge */}
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Indexing</label>
                      <select value={form.indexingType ?? "none"} onChange={e => upd("indexingType", e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white">
                        {INDEXING_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                      </select>
                    </div>
                    {form.indexingType === "fixed" && (
                      <div>
                        <label className="text-xs font-semibold text-gray-500 block mb-1">Fixed Rate</label>
                        <input type="number" step="0.001" value={form.indexingRate ?? ""} onChange={e => upd("indexingRate", e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white" placeholder="0.02" />
                      </div>
                    )}
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Bridge Benefit ($/yr)</label>
                      <input type="number" value={form.bridgeBenefit ?? ""} onChange={e => upd("bridgeBenefit", e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white" placeholder="0 — pre-65 top-up" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Bridge Ends at Age</label>
                      <input type="number" value={form.bridgeBenefitEndAge ?? ""} onChange={e => upd("bridgeBenefitEndAge", +e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white" placeholder="65" />
                    </div>
                  </div>
                </div>
              )}

              {/* DCPP / Group RRSP Fields */}
              {isDCPP && (
                <div className="bg-teal-50 border border-teal-100 rounded-xl p-5 space-y-4">
                  <p className="text-xs font-bold text-teal-700 uppercase tracking-wide">Defined Contribution Details</p>

                  {/* Income context */}
                  {formIncome > 0 && (
                    <div className="bg-white/70 rounded-xl p-3 border border-teal-100">
                      <p className="text-[10px] font-semibold text-gray-500 uppercase">Current Income</p>
                      <p className="text-sm font-bold text-gray-800">{fmt$(formIncome)}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Current Balance ($)</label>
                      <input type="number" value={form.currentBalance ?? ""} onChange={e => upd("currentBalance", e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white" placeholder="0" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Employer Match %</label>
                      <input type="number" step="0.01" value={form.employerMatchPct ?? ""} onChange={e => upd("employerMatchPct", e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white" placeholder="0.04 = 4%" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Years of Service</label>
                      <input type="number" value={form.yearsOfService ?? ""} onChange={e => upd("yearsOfService", e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white" placeholder="0" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Retirement Age</label>
                      <input type="number" value={form.retirementAge ?? ""} onChange={e => upd("retirementAge", +e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white" placeholder="65" />
                    </div>
                  </div>
                </div>
              )}

              {/* Common Fields */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Survivor Benefit</label>
                  <select value={form.survivorBenefitPct ?? "0.60"} onChange={e => upd("survivorBenefitPct", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm">
                    <option value="0">No survivor benefit</option>
                    <option value="0.50">50% survivor benefit</option>
                    <option value="0.60">60% survivor benefit</option>
                    <option value="0.66">66.67% survivor benefit</option>
                    <option value="0.75">75% survivor benefit</option>
                    <option value="1.00">100% joint & survivor</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Notes</label>
                  <input value={form.notes ?? ""} onChange={e => upd("notes", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" placeholder="Optional" />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={!!form.isVested} onChange={e => upd("isVested", e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300" />
                    <span className="font-semibold">Vested</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end p-6 border-t border-gray-100">
              <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 px-4 py-2">Cancel</button>
              <button onClick={save} disabled={busy}
                className="flex items-center gap-1.5 bg-[#0c1e3a] hover:bg-[#0e2a4a] disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl">
                <Save className="w-3.5 h-3.5" /> {busy ? "Saving…" : editingId ? "Save Changes" : "Add Pension"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pension Cards */}
      {filteredPlans.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <Building2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-500">No pension plans yet</p>
          <p className="text-xs text-gray-400 mt-1">Add employer pension plans to include in retirement projections</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPlans.map(p => {
            const typeInfo     = PENSION_TYPES.find(t => t.key === p.pensionType) ?? PENSION_TYPES[0];
            const isDB         = p.pensionType === "dbpp";
            const annualPension = isDB ? calcDBPPAnnual(p) : 0;
            const indexInfo    = INDEXING_TYPES.find(t => t.key === (p.indexingType ?? "none"));

            // Income projection for card display
            const cardOwner     = (p.subscriberOwner ?? "primary") === "spouse";
            const cardDob       = cardOwner ? client?.spouseDateOfBirth : client?.dateOfBirth;
            const cardAge       = cardDob ? Math.floor((Date.now() - new Date(cardDob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;
            const cardIncome    = Number(cardOwner ? client?.spouseAnnualIncome : client?.annualIncome) || 0;
            const cardRetAge    = p.retirementAge ?? 65;
            const cardProj      = cardAge && cardIncome ? calcBest5YearAverage(cardIncome, cardAge, cardRetAge, growthRate) : null;

            return (
              <div key={p.id} className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="w-4 h-4 text-[#0c1e3a]" />
                      <h3 className="font-bold text-gray-900">{p.employerName || "Unnamed Plan"}</h3>
                      <span className="text-xs bg-[#0c1e3a]/10 text-[#0c1e3a] font-semibold px-2 py-0.5 rounded-full">
                        {typeInfo.label.split("—")[0].trim()}
                      </span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {p.subscriberOwner === "spouse" ? (client?.spouseFirstName ?? "Spouse") : (client?.firstName ?? "Primary")}
                      </span>
                      {p.isVested && <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">Vested</span>}
                    </div>
                    {p.employerName && <p className="text-xs text-gray-400">{typeInfo.label}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(p)} className="p-1.5 text-gray-300 hover:text-blue-500 rounded-lg hover:bg-blue-50"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => del(p.id)} className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {isDB && (
                    <>
                      <div className="bg-blue-50 rounded-xl p-3 md:col-span-2">
                        <div className="flex items-center gap-2 mb-1">
                          <Calculator className="w-3.5 h-3.5 text-blue-600" />
                          <p className="text-[10px] font-bold text-blue-600 uppercase">Estimated Annual Pension</p>
                        </div>
                        <p className="text-xl font-bold text-blue-700">{fmt$(annualPension)}</p>
                        <p className="text-[10px] text-blue-500 mt-0.5">
                          {fmtPct(p.accrualRate)} × {p.projectedYearsAtRetirement || p.yearsOfService || 0} yrs × {fmt$(p.bestAverageEarnings)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-semibold">Years of Service</p>
                        <p className="text-sm font-semibold text-gray-800 mt-0.5">{p.yearsOfService || "—"} current / {p.projectedYearsAtRetirement || "—"} projected</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-semibold">Indexing</p>
                        <p className="text-sm font-semibold text-gray-800 mt-0.5">{indexInfo?.label ?? "—"}</p>
                      </div>
                      {cardProj && (
                        <div className="col-span-2 bg-gray-50 rounded-xl p-3 border border-gray-100">
                          <p className="text-[10px] text-gray-400 uppercase font-semibold mb-2">Income Projection (3.5%/yr)</p>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <p className="text-[10px] text-gray-400">Current</p>
                              <p className="text-sm font-semibold">{fmt$(cardIncome)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-gray-400">At Ret. Age {cardRetAge}</p>
                              <p className="text-sm font-semibold text-blue-700">{fmt$(cardProj.projectedAtRetirement)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-gray-400">Best 5yr Avg</p>
                              <p className="text-sm font-semibold text-green-700">{fmt$(cardProj.best5Avg)}</p>
                            </div>
                          </div>
                        </div>
                      )}
                      {p.bridgeBenefit && Number(p.bridgeBenefit) > 0 && (
                        <div>
                          <p className="text-[10px] text-gray-400 uppercase font-semibold">Bridge Benefit</p>
                          <p className="text-sm font-semibold text-gray-800 mt-0.5">{fmt$(p.bridgeBenefit)}/yr until age {p.bridgeBenefitEndAge}</p>
                        </div>
                      )}
                    </>
                  )}
                  {!isDB && (
                    <>
                      <div className="bg-teal-50 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-teal-600 uppercase">Current Balance</p>
                        <p className="text-xl font-bold text-teal-700">{fmt$(p.currentBalance)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-semibold">Employer Match</p>
                        <p className="text-sm font-semibold text-gray-800 mt-0.5">{fmtPct(p.employerMatchPct)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-semibold">Years of Service</p>
                        <p className="text-sm font-semibold text-gray-800 mt-0.5">{p.yearsOfService || "—"}</p>
                      </div>
                      {cardIncome > 0 && (
                        <div>
                          <p className="text-[10px] text-gray-400 uppercase font-semibold">Current Income</p>
                          <p className="text-sm font-semibold text-gray-800 mt-0.5">{fmt$(cardIncome)}</p>
                        </div>
                      )}
                    </>
                  )}
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-semibold">Retirement Age</p>
                    <p className="text-sm font-semibold text-gray-800 mt-0.5">{p.retirementAge || 65}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-semibold">Survivor Benefit</p>
                    <p className="text-sm font-semibold text-gray-800 mt-0.5">
                      {p.survivorBenefitPct ? fmtPct(p.survivorBenefitPct) : "None"}
                    </p>
                  </div>
                </div>
                {p.notes && <p className="text-xs text-gray-500 mt-3 italic border-t border-gray-100 pt-2">{p.notes}</p>}
              </div>
            );
          })}

          {/* Summary */}
          {filteredPlans.filter(p => p.pensionType === "dbpp").length > 0 && (
            <div className="bg-[#0c1e3a] text-white rounded-xl p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-white/60 mb-2">Total Estimated Annual Pension Income at Retirement</p>
              <p className="text-2xl font-bold">
                {fmt$(filteredPlans.filter(p => p.pensionType === "dbpp").reduce((s, p) => s + calcDBPPAnnual(p), 0))}
              </p>
              <p className="text-xs text-white/50 mt-1">DBPP plans only — feed this into your retirement projections as pension income</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
