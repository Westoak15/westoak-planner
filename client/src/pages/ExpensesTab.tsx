import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil } from "lucide-react";

const EXPENSE_CATEGORIES = [
  "Housing", "Utilities", "Food & Groceries", "Transportation",
  "Healthcare", "Insurance Premiums", "Childcare & Education",
  "Entertainment & Leisure", "Clothing & Personal Care",
  "Savings & Investments", "Debt Payments", "Travel", "Other",
];

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

const INPUT_CLS = "w-full px-3 py-2.5 rounded-xl border border-[var(--border-light)] bg-[var(--bg-panel)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-cyan)] focus:ring-0 placeholder:text-[var(--text-tertiary)]";
const LABEL_CLS = "text-sm font-semibold block mb-1 text-[var(--text-secondary)]";

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
  const [form, setForm] = useState({ category: "Housing", description: "", monthlyAmount: "", isEssential: true, includeInRetirement: true, retirementAdjustmentPct: "100", notes: "" });

  const totalMonthly = expenses.reduce((s, e) => s + parseFloat(e.monthlyAmount || "0"), 0);
  const retirementMonthly = expenses.filter(e => e.includeInRetirement).reduce((s, e) => s + parseFloat(e.monthlyAmount || "0") * (e.retirementAdjustmentPct || 100) / 100, 0);
  const byCategory = expenses.reduce<Record<string, Expense[]>>((acc, e) => { if (!acc[e.category]) acc[e.category] = []; acc[e.category].push(e); return acc; }, {});

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
    <div className="fp-insightled p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Household Expenses</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-0.5">Track monthly expenses to inform retirement income needs</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-blue)] hover:opacity-90 text-[var(--bg-base)] text-sm font-semibold px-4 py-2.5 rounded-xl transition-opacity">
          <Plus className="w-4 h-4" /> Add Expense
        </button>
      </div>

      {/* Summary KPI tiles */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Monthly Total", value: `$${totalMonthly.toLocaleString("en-CA", { maximumFractionDigits: 0 })}`, sub: `$${(totalMonthly*12).toLocaleString("en-CA", { maximumFractionDigits: 0 })}/yr` },
          { label: "In Retirement (adjusted)", value: `$${retirementMonthly.toLocaleString("en-CA", { maximumFractionDigits: 0 })}/mo`, sub: `$${(retirementMonthly*12).toLocaleString("en-CA", { maximumFractionDigits: 0 })}/yr` },
          { label: "Categories", value: String(Object.keys(byCategory).length), sub: `${expenses.length} line items` },
        ].map(c => (
          <div key={c.label} className="fp-insightled-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">{c.label}</p>
            <p className="text-2xl font-bold mt-1 text-[var(--accent-cyan)] font-mono">{c.value}</p>
            <p className="text-xs text-[var(--text-tertiary)]">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Retirement guardrail */}
      {expenses.length > 0 && (
        <div className="border border-[var(--accent-amber)]/25 bg-[var(--accent-amber)]/5 rounded-xl p-4 flex gap-3">
          <span className="text-[var(--accent-amber)] text-lg flex-shrink-0">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-[var(--accent-amber)]">Retirement Income Guardrail</p>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
              Estimated retirement expenses: <strong>${(retirementMonthly*12).toLocaleString("en-CA", { maximumFractionDigits: 0 })}/year</strong>.
              {retirementMonthly > 0 && ` 4% rule portfolio needed: $${(retirementMonthly*12/0.04).toLocaleString("en-CA", { maximumFractionDigits: 0 })}`}
            </p>
          </div>
        </div>
      )}

      {/* Expense list */}
      {Object.keys(byCategory).length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-[var(--border-subtle)] rounded-2xl">
          <p className="text-sm text-slate-500">No expenses yet</p>
          <p className="text-xs text-slate-400 mt-1">Add household expenses to build your plan</p>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="mt-4 inline-flex items-center gap-1.5 bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" /> Add First Expense
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(byCategory).map(([cat, items]) => {
            const catTotal = items.reduce((s, e) => s + parseFloat(e.monthlyAmount || "0"), 0);
            return (
              <div key={cat} className="fp-insightled-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-white/[0.03] border-b border-[var(--border-subtle)]">
                  <span className="text-sm font-semibold text-[var(--text-primary)]">{cat}</span>
                  <span className="text-sm font-bold text-[var(--accent-cyan)] font-mono">${catTotal.toLocaleString("en-CA", { maximumFractionDigits: 0 })}/mo</span>
                </div>
                <div className="divide-y divide-[var(--border-subtle)]">
                  {items.map(e => (
                    <div key={e.id} className="flex items-center justify-between px-4 py-2.5 group hover:bg-white/[0.03]">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${e.isEssential ? "bg-[var(--accent-rose)]" : "bg-[var(--accent-blue)]"}`} title={e.isEssential ? "Essential" : "Discretionary"} />
                        <span className="text-sm truncate text-[var(--text-secondary)]">{e.description || cat}</span>
                        {!e.includeInRetirement && <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-[var(--text-tertiary)]">excl. retirement</span>}
                        {e.includeInRetirement && e.retirementAdjustmentPct !== 100 && (
                          <span className="text-[10px] bg-[var(--accent-amber)]/10 text-[var(--accent-amber)] border border-[var(--accent-amber)]/20 px-1.5 py-0.5 rounded">{e.retirementAdjustmentPct}% in retirement</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-sm font-semibold text-[var(--text-primary)] font-mono">${parseFloat(e.monthlyAmount).toLocaleString("en-CA", { maximumFractionDigits: 0 })}/mo</span>
                        <span className="text-xs text-[var(--text-tertiary)] font-mono">${(parseFloat(e.monthlyAmount)*12).toLocaleString("en-CA", { maximumFractionDigits: 0 })}/yr</span>
                        <button onClick={() => startEdit(e)} className="p-1 rounded hover:bg-white/8 opacity-0 group-hover:opacity-100 text-[var(--text-tertiary)] hover:text-[var(--accent-blue)]"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => { if (confirm("Delete?")) deleteExp.mutate(e.id); }} className="p-1 rounded hover:bg-[var(--accent-rose)]/10 opacity-0 group-hover:opacity-100 text-[var(--text-tertiary)] hover:text-[var(--accent-rose)]"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={resetForm} />
          <div className="w-full max-w-lg bg-[var(--bg-card)] shadow-2xl flex flex-col h-full border-l border-[var(--border-subtle)]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">{editing !== null ? "Edit Expense" : "Add Expense"}</h2>
              <button onClick={resetForm} className="p-2 rounded-lg hover:bg-white/8 text-[var(--text-tertiary)]"><Plus className="w-4 h-4 rotate-45" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL_CLS}>Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={INPUT_CLS}>
                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLS}>Monthly Amount ($)</label>
                  <input type="number" min="0" step="10" value={form.monthlyAmount} onChange={e => setForm(f => ({ ...f, monthlyAmount: e.target.value }))} className={INPUT_CLS} placeholder="0" />
                </div>
              </div>
              <div>
                <label className={LABEL_CLS}>Description <span className="font-normal text-[var(--text-tertiary)]">(optional)</span></label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Mortgage payment, groceries..." className={INPUT_CLS} />
              </div>
              <div className="space-y-3 bg-[var(--bg-panel)] rounded-xl p-4 border border-[var(--border-subtle)]">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Retirement Planning</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isEssential} onChange={e => setForm(f => ({ ...f, isEssential: e.target.checked }))} className="w-4 h-4 rounded accent-[var(--accent-cyan)]" />
                  <span className="text-sm font-medium text-[var(--text-secondary)]">Essential expense</span>
                  <span className="text-xs text-[var(--text-tertiary)]">(housing, food, healthcare)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.includeInRetirement} onChange={e => setForm(f => ({ ...f, includeInRetirement: e.target.checked }))} className="w-4 h-4 rounded accent-[var(--accent-cyan)]" />
                  <span className="text-sm font-medium text-[var(--text-secondary)]">Include in retirement income need</span>
                </label>
                {form.includeInRetirement && (
                  <div>
                    <label className="text-sm font-semibold block mb-1 text-[var(--text-secondary)]">Retirement adjustment: <span className="text-[var(--accent-cyan)]">{form.retirementAdjustmentPct}%</span></label>
                    <input type="range" min="0" max="150" step="5" value={form.retirementAdjustmentPct} onChange={e => setForm(f => ({ ...f, retirementAdjustmentPct: e.target.value }))} className="w-full accent-[var(--accent-cyan)]" />
                    <div className="flex justify-between text-[10px] text-[var(--text-tertiary)] mt-0.5"><span>0%</span><span>100% (same)</span><span>150%</span></div>
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">${(parseFloat(form.monthlyAmount||"0")*parseInt(form.retirementAdjustmentPct)/100).toLocaleString("en-CA",{maximumFractionDigits:0})}/mo in retirement</p>
                  </div>
                )}
              </div>
              <div>
                <label className={LABEL_CLS}>Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={INPUT_CLS + " resize-none"} />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg-panel)] flex justify-end gap-3">
              <button onClick={resetForm} className="px-5 py-2.5 rounded-xl font-semibold text-[var(--text-secondary)] hover:bg-white/8">Cancel</button>
              <button onClick={handleSubmit} disabled={createExp.isPending || updateExp.isPending || !form.monthlyAmount}
                className="px-6 py-2.5 rounded-xl font-semibold bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-blue)] hover:opacity-90 text-[var(--bg-base)] disabled:opacity-50">
                {editing !== null ? "Save Changes" : "Add Expense"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
