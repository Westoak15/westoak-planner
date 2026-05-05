import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

const EXPENSE_CATEGORIES = [
  "Housing", "Utilities", "Food & Groceries", "Transportation",
  "Healthcare", "Insurance Premiums", "Childcare & Education",
  "Entertainment & Leisure", "Clothing & Personal Care",
  "Savings & Investments", "Debt Payments", "Travel", "Other",
];

const CAT_COLORS: Record<string, string> = {
  "Housing":                 "#3b82f6",
  "Utilities":               "#06b6d4",
  "Food & Groceries":        "#10b981",
  "Transportation":          "#8b5cf6",
  "Healthcare":              "#ef4444",
  "Insurance Premiums":      "#f59e0b",
  "Childcare & Education":   "#ec4899",
  "Entertainment & Leisure": "#14b8a6",
  "Clothing & Personal Care":"#a78bfa",
  "Savings & Investments":   "#22c55e",
  "Debt Payments":           "#f97316",
  "Travel":                  "#0ea5e9",
  "Other":                   "#94a3b8",
};

interface Expense {
  id: number;
  category: string;
  description: string | null;
  monthlyAmount: string;
  isEssential: boolean;
  includeInRetirement: boolean;
  retirementAdjustmentPct: number;
  notes: string | null;
}

async function apiReq(method: string, path: string, body?: unknown) {
  const token = localStorage.getItem("fp_token");
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message ?? `HTTP ${res.status}`); }
  return res.status === 204 ? null : res.json();
}

function Stat({ label, value, sub, color = "text-slate-900" }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-xl font-semibold mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

const fmt = (n: number) => `$${Math.round(n).toLocaleString("en-CA")}`;

export function ExpensesTab({ clientId }: { clientId: number }) {
  const qc = useQueryClient();
  const key = ["expenses", clientId];

  const { data: expenses = [] } = useQuery<Expense[]>({
    queryKey: key,
    queryFn: () => apiReq("GET", `/api/clients/${clientId}/expenses`),
  });

  const createExp = useMutation({ mutationFn: (d: any) => apiReq("POST", `/api/clients/${clientId}/expenses`, d), onSuccess: () => qc.invalidateQueries({ queryKey: key }) });
  const updateExp = useMutation({ mutationFn: ({ id, ...d }: any) => apiReq("PATCH", `/api/clients/${clientId}/expenses/${id}`, d), onSuccess: () => qc.invalidateQueries({ queryKey: key }) });
  const deleteExp = useMutation({ mutationFn: (id: number) => apiReq("DELETE", `/api/clients/${clientId}/expenses/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: key }) });

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [form, setForm] = useState({ category: "Housing", description: "", monthlyAmount: "", isEssential: true, includeInRetirement: true, retirementAdjustmentPct: "100", notes: "" });

  const totalMonthly       = expenses.reduce((s, e) => s + parseFloat(e.monthlyAmount || "0"), 0);
  const retirementMonthly  = expenses.filter(e => e.includeInRetirement).reduce((s, e) => s + parseFloat(e.monthlyAmount || "0") * (e.retirementAdjustmentPct || 100) / 100, 0);
  const requiredPortfolio  = retirementMonthly * 12 / 0.04;
  const byCategory         = expenses.reduce<Record<string, Expense[]>>((acc, e) => { if (!acc[e.category]) acc[e.category] = []; acc[e.category].push(e); return acc; }, {});

  // Biggest category for actionability hint
  const biggestCat = Object.entries(byCategory).sort((a, b) => {
    const aTotal = a[1].reduce((s, e) => s + parseFloat(e.monthlyAmount || "0"), 0);
    const bTotal = b[1].reduce((s, e) => s + parseFloat(e.monthlyAmount || "0"), 0);
    return bTotal - aTotal;
  })[0];
  const biggestSaving = biggestCat ? biggestCat[1].reduce((s, e) => s + parseFloat(e.monthlyAmount || "0"), 0) * 0.10 * 12 / 0.04 : 0;

  // Pie chart data
  const pieData = Object.entries(byCategory).map(([cat, items]) => ({
    name: cat,
    value: Math.round(items.reduce((s, e) => s + parseFloat(e.monthlyAmount || "0"), 0)),
  })).filter(d => d.value > 0).sort((a, b) => b.value - a.value);

  function resetForm() { setForm({ category: "Housing", description: "", monthlyAmount: "", isEssential: true, includeInRetirement: true, retirementAdjustmentPct: "100", notes: "" }); setEditing(null); setShowForm(false); }

  function startEdit(e: Expense) {
    setForm({ category: e.category, description: e.description || "", monthlyAmount: e.monthlyAmount, isEssential: e.isEssential, includeInRetirement: e.includeInRetirement, retirementAdjustmentPct: String(e.retirementAdjustmentPct || 100), notes: e.notes || "" });
    setEditing(e.id); setShowForm(true);
  }

  function handleSubmit() {
    const payload = { ...form, retirementAdjustmentPct: parseInt(form.retirementAdjustmentPct) || 100 };
    if (editing !== null) {
      updateExp.mutate({ id: editing, ...payload }, { onSuccess: resetForm });
    } else {
      createExp.mutate(payload, { onSuccess: resetForm });
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Cash Flow</h1>
          <p className="text-sm text-slate-500">Monthly expenses and retirement income needs</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-sm hover:shadow-md transition">
          <Plus className="w-4 h-4" /> Add Expense
        </button>
      </div>

      {expenses.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl">
          <p className="text-slate-500 font-semibold">No expenses yet</p>
          <p className="text-xs text-slate-400 mt-1">Add household expenses to build your plan</p>
          <button onClick={() => { resetForm(); setShowForm(true); }}
            className="mt-4 inline-flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-sm hover:shadow-md transition">
            <Plus className="w-4 h-4" /> Add First Expense
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* LEFT — sticky summary + chart + guardrail */}
          <div className="lg:col-span-2 space-y-5">

            {/* Stats — sticky */}
            <div className="sticky top-0 z-10 pb-2 bg-slate-50">
              <div className="grid grid-cols-3 gap-4">
                <Stat label="Monthly Spend"      value={fmt(totalMonthly)}             sub={`${fmt(totalMonthly * 12)}/yr`} />
                <Stat label="Retirement Spend"   value={`${fmt(retirementMonthly)}/mo`} sub={`${fmt(retirementMonthly * 12)}/yr`} />
                <Stat label="Required Portfolio" value={fmt(requiredPortfolio)}         sub="at 4% rule" color={requiredPortfolio > 0 ? "text-amber-600" : "text-slate-900"} />
              </div>
            </div>

            {/* Donut chart */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <p className="text-sm font-medium text-slate-600 mb-3">Spending Breakdown</p>
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} dataKey="value">
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={CAT_COLORS[entry.name] ?? "#94a3b8"} />
                      ))}
                    </Pie>
                    <Tooltip
                      wrapperStyle={{ zIndex: 50 }}
                      contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px" }}
                      formatter={(value: number) => [`${fmt(value)}/mo`, ""]}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Guardrail */}
            {retirementMonthly > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                <p className="text-sm font-medium text-amber-700">Retirement Income Guardrail</p>
                <p className="text-sm text-amber-600 mt-1">
                  Your spending requires <strong>{fmt(requiredPortfolio)}</strong> invested (4% rule) to sustain <strong>{fmt(retirementMonthly * 12)}/yr</strong> in retirement.
                </p>
              </div>
            )}

            {/* Actionability hint */}
            {biggestCat && biggestSaving > 0 && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
                Reducing <strong>{biggestCat[0]}</strong> by 10% lowers required portfolio by ~<strong>{fmt(biggestSaving)}</strong>.
              </div>
            )}
          </div>

          {/* RIGHT — scrollable category list */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 h-[600px] overflow-y-auto">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Categories</p>
            {Object.entries(byCategory)
              .sort((a, b) => {
                const aTotal = a[1].reduce((s, e) => s + parseFloat(e.monthlyAmount || "0"), 0);
                const bTotal = b[1].reduce((s, e) => s + parseFloat(e.monthlyAmount || "0"), 0);
                return bTotal - aTotal;
              })
              .map(([cat, items]) => {
                const catTotal = items.reduce((s, e) => s + parseFloat(e.monthlyAmount || "0"), 0);
                const retTotal = items.filter(e => e.includeInRetirement).reduce((s, e) => s + parseFloat(e.monthlyAmount || "0") * (e.retirementAdjustmentPct || 100) / 100, 0);
                const pct = totalMonthly > 0 ? Math.round((catTotal / totalMonthly) * 100) : 0;
                const isOpen = openCat === cat;
                return (
                  <div key={cat} className="border-b border-slate-100 last:border-0">
                    <div
                      onClick={() => setOpenCat(isOpen ? null : cat)}
                      className="py-3 cursor-pointer hover:bg-slate-50 px-2 rounded-lg transition -mx-2"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: CAT_COLORS[cat] ?? "#94a3b8" }} />
                          <p className="text-sm font-medium text-slate-900 truncate">{cat}</p>
                        </div>
                        <p className="text-sm font-semibold text-blue-600 flex-shrink-0 ml-2">{fmt(catTotal)}/mo</p>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 h-1 bg-slate-100 rounded overflow-hidden">
                          <div className="h-full rounded" style={{ width: `${pct}%`, backgroundColor: CAT_COLORS[cat] ?? "#94a3b8" }} />
                        </div>
                        <span className="text-xs text-slate-400 flex-shrink-0">{pct}%</span>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isOpen && (
                      <div className="px-2 pb-3 space-y-1">
                        <div className="flex justify-between text-xs text-slate-400 mb-2">
                          <span>{fmt(catTotal * 12)}/yr</span>
                          {retTotal !== catTotal && <span className="text-amber-600">{fmt(retTotal)}/mo in retirement</span>}
                        </div>
                        {items.map(e => (
                          <div key={e.id} className="flex items-center justify-between py-1 group rounded px-1 hover:bg-slate-50">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${e.isEssential ? "bg-red-400" : "bg-blue-400"}`} />
                              <span className="text-xs text-slate-600 truncate">{e.description || cat}</span>
                              {e.includeInRetirement && e.retirementAdjustmentPct !== 100 && (
                                <span className="text-[10px] bg-amber-50 text-amber-600 px-1 py-0.5 rounded">{e.retirementAdjustmentPct}%</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <span className="text-xs font-medium text-slate-700">{fmt(parseFloat(e.monthlyAmount))}</span>
                              <button onClick={ev => { ev.stopPropagation(); startEdit(e); }} className="p-0.5 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-600"><Pencil className="w-3 h-3" /></button>
                              <button onClick={ev => { ev.stopPropagation(); if (confirm("Delete?")) deleteExp.mutate(e.id); }} className="p-0.5 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                            </div>
                          </div>
                        ))}
                        <button
                          onClick={e => { e.stopPropagation(); resetForm(); setForm(f => ({ ...f, category: cat })); setShowForm(true); }}
                          className="text-xs text-blue-600 hover:underline mt-1"
                        >+ Add to {cat}</button>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>

        </div>
      )}

      {/* Add/Edit form */}
      {showForm && (
        <div className="fixed inset-0 z-[200] flex">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={resetForm} />
          <div className="w-full max-w-lg bg-white shadow-2xl flex flex-col h-full border-l border-slate-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">{editing !== null ? "Edit Expense" : "Add Expense"}</h2>
              <button onClick={resetForm} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400"><Plus className="w-4 h-4 rotate-45" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold block mb-1 text-slate-600">Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold block mb-1 text-slate-600">Monthly Amount ($)</label>
                  <input type="number" min="0" step="10" value={form.monthlyAmount} onChange={e => setForm(f => ({ ...f, monthlyAmount: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="0" />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold block mb-1 text-slate-600">Description <span className="font-normal text-slate-400">(optional)</span></label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Mortgage payment, groceries..." className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div className="space-y-3 bg-slate-50 rounded-xl p-4 border border-slate-200">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Retirement Planning</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isEssential} onChange={e => setForm(f => ({ ...f, isEssential: e.target.checked }))} className="w-4 h-4 rounded accent-blue-600" />
                  <span className="text-sm font-medium text-slate-700">Essential expense</span>
                  <span className="text-xs text-slate-400">(housing, food, healthcare)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.includeInRetirement} onChange={e => setForm(f => ({ ...f, includeInRetirement: e.target.checked }))} className="w-4 h-4 rounded accent-blue-600" />
                  <span className="text-sm font-medium text-slate-700">Include in retirement income need</span>
                </label>
                {form.includeInRetirement && (
                  <div>
                    <label className="text-sm font-semibold block mb-1 text-slate-600">Retirement adjustment: <span className="text-blue-600">{form.retirementAdjustmentPct}%</span></label>
                    <input type="range" min="0" max="150" step="5" value={form.retirementAdjustmentPct} onChange={e => setForm(f => ({ ...f, retirementAdjustmentPct: e.target.value }))} className="w-full accent-blue-600" />
                    <div className="flex justify-between text-[10px] text-slate-400 mt-0.5"><span>0%</span><span>100% (same)</span><span>150%</span></div>
                    <p className="text-xs text-slate-400 mt-1">{fmt(parseFloat(form.monthlyAmount || "0") * parseInt(form.retirementAdjustmentPct) / 100)}/mo in retirement</p>
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-semibold block mb-1 text-slate-600">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
              <button onClick={resetForm} className="px-5 py-2.5 rounded-xl font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
              <button onClick={handleSubmit} disabled={createExp.isPending || updateExp.isPending || !form.monthlyAmount}
                className="px-6 py-2.5 rounded-xl font-semibold bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:shadow-md disabled:opacity-50 transition">
                {editing !== null ? "Save Changes" : "Add Expense"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
