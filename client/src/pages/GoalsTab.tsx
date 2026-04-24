import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { Target, Plus, Trash2, Pencil, CheckCircle, Clock, AlertCircle, X, Save } from "lucide-react";

interface Goal {
  id: number;
  goalType: string;
  title: string;
  targetAmount: string | null;
  currentAmount: string | null;
  targetDate: string | null;
  status: string;
  notes: string | null;
}

const GOAL_TYPES = [
  { key: "retirement",     label: "Retirement",         icon: "🏖️" },
  { key: "emergency_fund", label: "Emergency Fund",     icon: "🛡️" },
  { key: "debt_free",      label: "Debt Free",          icon: "💳" },
  { key: "education",      label: "Education / RESP",   icon: "🎓" },
  { key: "home_purchase",  label: "Home Purchase",      icon: "🏡" },
  { key: "custom",         label: "Custom Goal",        icon: "⭐" },
];

const STATUS_CONFIG = {
  in_progress: { label: "In Progress", color: "text-blue-600",   bg: "bg-blue-50",   icon: Clock },
  on_track:    { label: "On Track",    color: "text-green-600",  bg: "bg-green-50",  icon: CheckCircle },
  at_risk:     { label: "At Risk",     color: "text-amber-600",  bg: "bg-amber-50",  icon: AlertCircle },
  completed:   { label: "Completed",   color: "text-gray-500",   bg: "bg-gray-50",   icon: CheckCircle },
};

const fmt$ = (n: string | number | null) => {
  if (!n) return "$0";
  return "$" + Number(n).toLocaleString("en-CA", { maximumFractionDigits: 0 });
};

function ProgressBar({ current, target, status }: { current: number; target: number; status: string }) {
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const color = status === "completed" ? "bg-green-500" : 
                status === "at_risk"   ? "bg-amber-500" : 
                status === "on_track"  ? "bg-green-500" : "bg-blue-500";
  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{fmt$(current)} saved</span>
        <span>{pct.toFixed(0)}% of {fmt$(target)}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const emptyGoal = () => ({ goalType: "custom", title: "", targetAmount: "", currentAmount: "", targetDate: "", status: "in_progress", notes: "" });

export function GoalsTab({ clientId, client, person = "primary" }: { clientId: number; client?: any; person?: string }) {
  const [goals, setGoals]       = useState<Goal[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm]         = useState(emptyGoal());
  const [busy, setBusy]         = useState(false);

  const load = () => api.get<Goal[]>(`/api/clients/${clientId}/goals`).then(setGoals).catch(() => {});
  useEffect(() => { load(); }, [clientId]);

  const upd = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  function openNew() {
    setEditingId(null);
    setForm(emptyGoal());
    setShowForm(true);
  }

  function openEdit(g: Goal) {
    setEditingId(g.id);
    setForm({
      goalType:     g.goalType,
      title:        g.title,
      targetAmount: g.targetAmount ?? "",
      currentAmount: g.currentAmount ?? "",
      targetDate:   g.targetDate ?? "",
      status:       g.status,
      notes:        g.notes ?? "",
    });
    setShowForm(true);
  }

  async function save() {
    if (!form.title) return;
    setBusy(true);
    try {
      if (editingId) {
        await api.patch(`/api/goals/${editingId}`, form);
      } else {
        await api.post(`/api/clients/${clientId}/goals`, form);
      }
      setShowForm(false);
      setEditingId(null);
      await load();
    } catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  }

  async function del(id: number) {
    if (!confirm("Delete this goal?")) return;
    await api.delete(`/api/goals/${id}`);
    await load();
  }

  const activeGoals    = goals.filter(g => g.status !== "completed");
  const completedGoals = goals.filter(g => g.status === "completed");

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Financial Goals</h2>
          <p className="text-sm text-gray-500 mt-0.5">Track progress toward key financial milestones</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-1.5 text-sm font-semibold text-white bg-[#0c1e3a] hover:bg-[#0e2a4a] px-4 py-2 rounded-xl">
          <Plus className="w-4 h-4" /> Add Goal
        </button>
      </div>

      {/* Summary bar */}
      {goals.length > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total Goals",  value: goals.length,                              color: "text-gray-700" },
            { label: "On Track",     value: goals.filter(g => g.status === "on_track").length,    color: "text-green-600" },
            { label: "At Risk",      value: goals.filter(g => g.status === "at_risk").length,     color: "text-amber-600" },
            { label: "Completed",    value: goals.filter(g => g.status === "completed").length,   color: "text-blue-600" },
          ].map(s => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-3 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-[500px]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">{editingId ? "Edit Goal" : "New Goal"}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Goal Type</label>
                <select value={form.goalType} onChange={e => upd("goalType", e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm">
                  {GOAL_TYPES.map(t => <option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Goal Title</label>
                <input value={form.title} onChange={e => upd("title", e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
                  placeholder="e.g. Retire by age 60" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Target Amount ($)</label>
                  <input type="number" value={form.targetAmount} onChange={e => upd("targetAmount", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" placeholder="0" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Current Amount ($)</label>
                  <input type="number" value={form.currentAmount} onChange={e => upd("currentAmount", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" placeholder="0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Target Date</label>
                  <input type="date" value={form.targetDate} onChange={e => upd("targetDate", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Status</label>
                  <select value={form.status} onChange={e => upd("status", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm">
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Notes</label>
                <input value={form.notes} onChange={e => upd("notes", e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" placeholder="Optional" />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-5">
              <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 px-4 py-2">Cancel</button>
              <button onClick={save} disabled={busy || !form.title}
                className="flex items-center gap-1.5 bg-[#0c1e3a] hover:bg-[#0e2a4a] disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl">
                <Save className="w-3.5 h-3.5" /> {busy ? "Saving…" : editingId ? "Save Changes" : "Add Goal"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active goals */}
      {activeGoals.length === 0 && completedGoals.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <Target className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-500">No goals yet</p>
          <p className="text-xs text-gray-400 mt-1">Add financial goals to track progress</p>
        </div>
      ) : (
        <div className="space-y-6">
          {activeGoals.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Active Goals</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeGoals.map(g => {
                  const typeInfo = GOAL_TYPES.find(t => t.key === g.goalType) ?? GOAL_TYPES[5];
                  const statusInfo = STATUS_CONFIG[g.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.in_progress;
                  const StatusIcon = statusInfo.icon;
                  const hasProgress = g.targetAmount && Number(g.targetAmount) > 0;
                  return (
                    <div key={g.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{typeInfo.icon}</span>
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{g.title}</p>
                            <p className="text-xs text-gray-400">{typeInfo.label}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusInfo.bg} ${statusInfo.color}`}>
                            <StatusIcon className="w-3 h-3" />{statusInfo.label}
                          </span>
                          <button onClick={() => openEdit(g)} className="p-1 text-gray-300 hover:text-blue-500"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => del(g.id)} className="p-1 text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                      {hasProgress && (
                        <ProgressBar current={Number(g.currentAmount || 0)} target={Number(g.targetAmount)} status={g.status} />
                      )}
                      {g.targetDate && (
                        <p className="text-xs text-gray-400 mt-2">🗓 Target: {new Date(g.targetDate).toLocaleDateString("en-CA", { year: "numeric", month: "long" })}</p>
                      )}
                      {g.notes && <p className="text-xs text-gray-500 mt-1 italic">{g.notes}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {completedGoals.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Completed Goals</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {completedGoals.map(g => {
                  const typeInfo = GOAL_TYPES.find(t => t.key === g.goalType) ?? GOAL_TYPES[5];
                  return (
                    <div key={g.id} className="bg-gray-50 border border-gray-200 rounded-xl p-4 opacity-75">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{typeInfo.icon}</span>
                          <div>
                            <p className="font-semibold text-gray-700 text-sm line-through">{g.title}</p>
                            <p className="text-xs text-gray-400">{typeInfo.label}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <button onClick={() => del(g.id)} className="p-1 text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
