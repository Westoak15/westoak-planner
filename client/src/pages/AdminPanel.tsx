import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { Plus, Pencil, Trash2, X, Check, Eye, EyeOff, Shield, User } from "lucide-react";

interface FaUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  agentId: string | null;
  agency: string | null;
  phone: string | null;
  level: "standard" | "enhanced";
  role: string;
  createdAt?: string;
}

const INPUT = "w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 bg-white";

const EMPTY_FORM = {
  firstName: "", lastName: "", email: "", password: "",
  agentId: "", agency: "", phone: "", level: "standard" as "standard" | "enhanced",
};

export function AdminPanel() {
  const [users, setUsers]       = useState<FaUser[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]     = useState<number | null>(null);
  const [form, setForm]         = useState({ ...EMPTY_FORM });
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState("");
  const [showPw, setShowPw]     = useState(false);

  const load = () => {
    setLoading(true);
    api.get<FaUser[]>("/api/auth/users").then(setUsers).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const u = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  function openCreate() {
    setForm({ ...EMPTY_FORM });
    setEditId(null);
    setError("");
    setShowForm(true);
  }

  function openEdit(fa: FaUser) {
    setForm({
      firstName: fa.firstName, lastName: fa.lastName,
      email: fa.email, password: "",
      agentId: fa.agentId ?? "", agency: fa.agency ?? "",
      phone: fa.phone ?? "", level: fa.level,
    });
    setEditId(fa.id);
    setError("");
    setShowForm(true);
  }

  async function handleSubmit() {
    setError(""); setBusy(true);
    try {
      if (editId) {
        const body: any = { firstName: form.firstName, lastName: form.lastName, agentId: form.agentId, agency: form.agency, phone: form.phone, level: form.level };
        if (form.password) body.password = form.password;
        await api.patch(`/api/auth/users/${editId}`, body);
      } else {
        await api.post("/api/auth/users", form);
      }
      setShowForm(false);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Delete ${name}? Their clients will remain but become unassigned.`)) return;
    await api.delete(`/api/auth/users/${id}`);
    load();
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agent Management</h1>
          <p className="text-sm text-gray-400 mt-0.5">{users.length} field agent{users.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 bg-brand-gradient hover:bg-brand-gradient-hover text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
          <Plus className="w-4 h-4" /> Add Agent
        </button>
      </div>

      {/* User table */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading…</div>
      ) : users.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl">
          <User className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-semibold">No field agents yet</p>
          <p className="text-sm text-gray-400 mt-1">Create an agent to get started</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Agent</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Agent ID</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Agency</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Phone</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Level</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(fa => (
                <tr key={fa.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-900">{fa.firstName} {fa.lastName}</div>
                    <div className="text-xs text-gray-400">{fa.email}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{fa.agentId || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{fa.agency || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{fa.phone || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-semibold ${fa.level === "enhanced" ? "bg-cyan-100 text-cyan-700" : "bg-slate-100 text-gray-600"}`}>
                      {fa.level === "enhanced" ? "Enhanced" : "Standard"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(fa)} className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(fa.id, `${fa.firstName} ${fa.lastName}`)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex justify-between items-center px-6 pt-6 pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-gray-900">{editId ? "Edit Agent" : "New Field Agent"}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">First Name</label>
                  <input value={form.firstName} onChange={e => u("firstName", e.target.value)} className={INPUT} placeholder="First name" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Last Name</label>
                  <input value={form.lastName} onChange={e => u("lastName", e.target.value)} className={INPUT} placeholder="Last name" />
                </div>
              </div>

              {!editId && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Email (Login)</label>
                  <input type="email" value={form.email} onChange={e => u("email", e.target.value)} className={INPUT} placeholder="agent@example.com" />
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">
                  {editId ? "New Password (leave blank to keep current)" : "Temporary Password"}
                </label>
                <div className="relative">
                  <input type={showPw ? "text" : "password"} value={form.password} onChange={e => u("password", e.target.value)} className={INPUT + " pr-11"} placeholder={editId ? "Leave blank to keep current" : "Min 8 characters"} />
                  <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {!editId && <p className="text-xs text-gray-400 mt-1">Agent will be prompted to reset on first login.</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Agent ID</label>
                  <input value={form.agentId} onChange={e => u("agentId", e.target.value)} className={INPUT} placeholder="Optional" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Phone</label>
                  <input value={form.phone} onChange={e => u("phone", e.target.value)} className={INPUT} placeholder="Optional" />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Agency</label>
                <input value={form.agency} onChange={e => u("agency", e.target.value)} className={INPUT} placeholder="Optional" />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Access Level</label>
                <select value={form.level} onChange={e => u("level", e.target.value)} className={INPUT}>
                  <option value="standard">Standard — Clients, Policies, FNA</option>
                  <option value="enhanced">Enhanced — All Modules</option>
                </select>
              </div>

              {error && <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            </div>

            <div className="flex justify-end gap-3 px-6 pb-6">
              <button onClick={() => setShowForm(false)} className="px-4 py-2.5 text-sm font-semibold text-gray-500 hover:text-gray-700">Cancel</button>
              <button onClick={handleSubmit} disabled={busy || (!editId && (!form.firstName || !form.lastName || !form.email || !form.password))}
                className="px-6 py-2.5 bg-brand-gradient hover:bg-brand-gradient-hover disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
                {busy ? "Saving…" : editId ? "Save Changes" : "Create Agent"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
