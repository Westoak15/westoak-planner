import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { Plus, Trash2, Pencil, X, Save, Shield } from "lucide-react";

interface Policy {
  id: number;
  type: string;
  insured: string;
  provider: string;
  policyNumber: string;
  coverageAmount: string;
  premium: string;
  premiumFrequency: string;
  beneficiary: string;
  inforceDate: string;
  renewalDate: string;
  notes: string;
  createdAt: string;
}

type PolicyDraft = Omit<Policy, "id" | "createdAt">;

// "Life" removed from top — first item is now "Term Life"
const POLICY_TYPES = ["Term Life", "Whole Life", "Universal Life", "Disability (DI)", "Long-Term Care (LTC)", "Critical Illness", "Other"];
const TERM_TYPES = ["Term Life", "Critical Illness"]; // show renewal date
const FREQUENCIES = ["Monthly", "Quarterly", "Semi-Annual", "Annual"];
const INPUT = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500";

const emptyDraft = (): PolicyDraft => ({
  type: "Term Life", insured: "primary", provider: "", policyNumber: "",
  coverageAmount: "", premium: "", premiumFrequency: "Monthly",
  beneficiary: "", inforceDate: "", renewalDate: "", notes: "",
});

function fmt$(val: string | null): string {
  const n = parseFloat(val ?? "0");
  if (!n) return "—";
  return `$${n.toLocaleString("en-CA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function PoliciesTab({ clientId, client, person = "primary" }: { clientId: number; client?: any; person?: string }) {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]     = useState<number | null>(null);
  const [draft, setDraft]       = useState<PolicyDraft>(emptyDraft());
  const [saving, setSaving]     = useState(false);
  const activePerson = person === "spouse" ? "spouse" : "primary";
  const hasSpouse = !!client?.spouseFirstName;
  const spouseName = client?.spouseFirstName
    ? `${client.spouseFirstName} ${client.spouseLastName ?? ""}`.trim()
    : null;
  const clientName = client?.firstName ?? "Client";
  const filteredPolicies = policies.filter(p => activePerson === "primary" ? p.insured !== "spouse" : p.insured === "spouse");
  const load = () => {
    setLoading(true);
    api.get<Policy[]>(`/api/clients/${clientId}/policies`)
      .then(setPolicies).catch(() => setPolicies([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [clientId]);

  const u = (k: keyof PolicyDraft, v: string) => setDraft(d => ({ ...d, [k]: v }));

  function openCreate() { setDraft({ ...emptyDraft(), insured: activePerson }); setEditId(null); setShowForm(true); }

  function openEdit(p: Policy) {
    setDraft({
      type: p.type, insured: p.insured, provider: p.provider,
      policyNumber: p.policyNumber, coverageAmount: p.coverageAmount,
      premium: p.premium, premiumFrequency: p.premiumFrequency,
      beneficiary: p.beneficiary, inforceDate: p.inforceDate ?? "",
      renewalDate: p.renewalDate ?? "", notes: p.notes,
    });
    setEditId(p.id);
    setShowForm(true);
  }

  async function save() {
    setSaving(true);
    try {
      if (editId) {
        await api.patch(`/api/clients/${clientId}/policies/${editId}`, draft);
      } else {
        await api.post(`/api/clients/${clientId}/policies`, draft);
      }
      setShowForm(false);
      load();
    } finally { setSaving(false); }
  }

  async function del(id: number) {
    if (!confirm("Delete this policy?")) return;
    await api.delete(`/api/clients/${clientId}/policies/${id}`);
    load();
  }

  const primaryPolicies = policies.filter(p => p.insured === "primary");
  const spousePolicies  = policies.filter(p => p.insured === "spouse");
  const isTermType = TERM_TYPES.includes(draft.type);

  const PolicyCard = ({ p }: { p: Policy }) => (
    <div className="flex items-center justify-between border border-gray-200 rounded-xl px-4 py-2.5 hover:bg-gray-50 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-xs font-semibold bg-[#0c1e3a]/10 text-[#0c1e3a] px-2 py-0.5 rounded-full whitespace-nowrap">{p.type}</span>
        <span className="text-sm font-semibold text-gray-800 truncate">{p.provider || "—"}</span>
        <span className="text-sm font-bold text-gray-900">{fmt$(p.coverageAmount)}</span>
        {p.premium && <span className="text-xs text-gray-500">{fmt$(p.premium)}/{p.premiumFrequency?.slice(0,2)}</span>}
        {p.inforceDate && <span className="text-xs text-gray-400">In force: {p.inforceDate}</span>}
        {TERM_TYPES.includes(p.type) && p.renewalDate && <span className="text-xs text-amber-600">Renews: {p.renewalDate}</span>}
      </div>
      <div className="flex gap-1 flex-shrink-0">
        <button onClick={() => openEdit(p)} className="p-1.5 text-gray-400 hover:text-[#0c1e3a]"><Pencil className="w-3.5 h-3.5" /></button>
        <button onClick={() => del(p.id)} className="p-1.5 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Insurance Policies</h1>
          <p className="text-sm text-gray-400 mt-0.5">{filteredPolicies.length} polic{filteredPolicies.length !== 1 ? "ies" : "y"} on file</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 bg-[#0c1e3a] hover:bg-[#0e2a4a] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
          <Plus className="w-4 h-4" /> Add Policy
        </button>
      </div>
      
      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading…</div>
      ) : policies.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
          <Shield className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-semibold">No policies on file</p>
          <p className="text-sm text-gray-400 mt-1">Add existing life, disability, or LTC coverage</p>
        </div>
      ) : (
        <div className="space-y-5">
          {filteredPolicies.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-2xl">
              <Shield className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 font-semibold">No policies for {activePerson === "spouse" ? spouseName : clientName}</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredPolicies.map(p => <PolicyCard key={p.id} p={p} />)}
            </div>
          )}
          {false && spousePolicies.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-purple-600 uppercase tracking-wider mb-2">
                {spouseName || "Spouse"}
              </h2>
              <div className="space-y-1.5">
                {spousePolicies.map(p => <PolicyCard key={p.id} p={p} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex justify-between items-center px-6 pt-6 pb-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{editId ? "Edit Policy" : "Add Policy"}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Policy Type</label>
                  <select value={draft.type} onChange={e => u("type", e.target.value)} className={INPUT}>
                    {POLICY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Insured</label>
                  <select value={draft.insured} onChange={e => u("insured", e.target.value)} className={INPUT}>
                    <option value="primary">{client ? `${client.firstName} ${client.lastName}` : "Primary"}</option>
                    {spouseName && <option value="spouse">{spouseName}</option>}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Provider / Company</label>
                  <input value={draft.provider} onChange={e => u("provider", e.target.value)} className={INPUT} placeholder="e.g. Sun Life" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Policy Number</label>
                  <input value={draft.policyNumber} onChange={e => u("policyNumber", e.target.value)} className={INPUT} placeholder="Optional" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Coverage Amount ($)</label>
                  <input type="number" value={draft.coverageAmount} onChange={e => u("coverageAmount", e.target.value)} className={INPUT} placeholder="0" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Premium ($)</label>
                  <div className="flex gap-2">
                    <input type="number" value={draft.premium} onChange={e => u("premium", e.target.value)} className={INPUT} placeholder="0" />
                    <select value={draft.premiumFrequency} onChange={e => u("premiumFrequency", e.target.value)} className="border border-gray-200 rounded-lg px-2 py-2 text-sm w-28">
                      {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Inforce Date</label>
                  <input type="date" value={draft.inforceDate} onChange={e => u("inforceDate", e.target.value)} className={INPUT} />
                </div>
                {isTermType && (
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Renewal Date</label>
                    <input type="date" value={draft.renewalDate} onChange={e => u("renewalDate", e.target.value)} className={INPUT} />
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Beneficiary</label>
                <input value={draft.beneficiary} onChange={e => u("beneficiary", e.target.value)} className={INPUT} placeholder="Optional" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Notes</label>
                <textarea value={draft.notes} onChange={e => u("notes", e.target.value)} className={INPUT} rows={2} placeholder="Optional" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 pb-6">
              <button onClick={() => setShowForm(false)} className="px-4 py-2.5 text-sm font-semibold text-gray-500 hover:text-gray-700">Cancel</button>
              <button onClick={save} disabled={saving || !draft.type}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#0c1e3a] hover:bg-[#0e2a4a] disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
                <Save className="w-4 h-4" /> {saving ? "Saving…" : editId ? "Save Changes" : "Add Policy"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
