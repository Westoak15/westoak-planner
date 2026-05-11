import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { PolicyImporter } from "../components/PolicyImporter";
import { Plus, Trash2, Pencil, X, Save, Shield, Table } from "lucide-react";

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

const POLICY_TYPES = ["Term Life","Whole Life","Universal Life","Disability (DI)","Long-Term Care (LTC)","Critical Illness","Other"];
const TERM_TYPES   = ["Term Life","Critical Illness"];
const FREQUENCIES  = ["Monthly","Quarterly","Semi-Annual","Annual"];
const INPUT = "fp-input";

const emptyDraft = (): PolicyDraft => ({
  type:"Term Life", insured:"primary", provider:"", policyNumber:"",
  coverageAmount:"", premium:"", premiumFrequency:"Monthly",
  beneficiary:"", inforceDate:"", renewalDate:"", notes:"",
});

function fmt$(v: string | number | null): string {
  const n = parseFloat(String(v ?? "0"));
  if (!n) return "—";
  return "$" + n.toLocaleString("en-CA", { maximumFractionDigits: 0 });
}

function annualPremium(p: Policy): number {
  const v = parseFloat(p.premium || "0");
  const mult: Record<string, number> = { Monthly: 12, Quarterly: 4, "Semi-Annual": 2, Annual: 1 };
  return v * (mult[p.premiumFrequency] ?? 12);
}

function SummaryBar({ items }: { items: { label: string; value: string; color: string; bg: string }[] }) {
  return (
    <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
      {items.map(i => (
        <div key={i.label} className={`${i.bg} rounded-xl p-4`}>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{i.label}</p>
          <p className={`text-xl font-bold ${i.color}`}>{i.value}</p>
        </div>
      ))}
    </div>
  );
}

const TH = ({ children, right }: { children?: React.ReactNode; right?: boolean }) => (
  <th className={`px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide ${right ? "text-right" : "text-left"}`}>{children}</th>
);
const TD = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <td className={`px-4 py-3 text-sm ${right ? "text-right" : ""}`}>{children}</td>
);

export function PoliciesTab({ clientId, client, person = "primary" }: { clientId: number; client?: any; person?: string }) {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]     = useState<number | null>(null);
  const [draft, setDraft]       = useState<PolicyDraft>(emptyDraft());
  const [saving, setSaving]     = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const activePerson  = person === "spouse" ? "spouse" : "primary";
  const hasSpouse     = !!client?.spouseFirstName;
  const spouseName    = client?.spouseFirstName ? `${client.spouseFirstName} ${client.spouseLastName ?? ""}`.trim() : null;
  const clientName    = client?.firstName ?? "Client";
  const filteredPolicies = policies.filter(p =>
    activePerson === "primary" ? p.insured !== "spouse" : p.insured === "spouse"
  );

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
    setDraft({ type:p.type, insured:p.insured, provider:p.provider, policyNumber:p.policyNumber,
      coverageAmount:p.coverageAmount, premium:p.premium, premiumFrequency:p.premiumFrequency,
      beneficiary:p.beneficiary, inforceDate:p.inforceDate ?? "", renewalDate:p.renewalDate ?? "", notes:p.notes });
    setEditId(p.id); setShowForm(true);
  }

  async function save() {
    setSaving(true);
    try {
      if (editId) await api.patch(`/api/clients/${clientId}/policies/${editId}`, draft);
      else        await api.post(`/api/clients/${clientId}/policies`, draft);
      setShowForm(false); load();
    } finally { setSaving(false); }
  }

  async function del(id: number) {
    if (!confirm("Delete this policy?")) return;
    await api.delete(`/api/clients/${clientId}/policies/${id}`); load();
  }

  // ── Summary stats ────────────────────────────────────────────────────────────
  const lifeCoverage = filteredPolicies
    .filter(p => ["Term Life","Whole Life","Universal Life"].includes(p.type))
    .reduce((s, p) => s + parseFloat(p.coverageAmount || "0"), 0);
  const diCoverage = filteredPolicies
    .filter(p => p.type === "Disability (DI)")
    .reduce((s, p) => s + parseFloat(p.coverageAmount || "0"), 0);
  const ciCoverage = filteredPolicies
    .filter(p => p.type === "Critical Illness")
    .reduce((s, p) => s + parseFloat(p.coverageAmount || "0"), 0);
  const totalPremium = filteredPolicies.reduce((s, p) => s + annualPremium(p), 0);

  const isTermType = TERM_TYPES.includes(draft.type);

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Protection</h1>
          <p className="text-sm text-slate-500">{filteredPolicies.length} polic{filteredPolicies.length !== 1 ? "ies" : "y"} on file</p>
        </div>
        <div className="flex items-center gap-2">
  <button onClick={() => setShowImporter(true)}
    className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 px-3 py-2 rounded-xl transition-colors">
    <Table className="w-4 h-4" /> Import Excel
  </button>
  <button onClick={openCreate}
    className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-sm hover:shadow-md transition">
    <Plus className="w-4 h-4" /> Add Policy
  </button>
</div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Life Coverage",    value: lifeCoverage > 0 ? fmt$(lifeCoverage)           : "—", color: lifeCoverage > 0 ? "text-blue-600"    : "text-slate-400" },
          { label: "Disability",       value: diCoverage > 0   ? fmt$(diCoverage) + "/mo"     : "—", color: diCoverage > 0   ? "text-violet-600"  : "text-slate-400" },
          { label: "Critical Illness", value: ciCoverage > 0   ? fmt$(ciCoverage)             : "—", color: ciCoverage > 0   ? "text-emerald-600" : "text-slate-400" },
          { label: "Annual Premium",   value: fmt$(totalPremium),                                    color: "text-slate-700" },
        ].map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition-all duration-200">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className={`text-xl font-semibold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Gap insights */}
      {filteredPolicies.length > 0 && lifeCoverage === 0 && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-red-600 font-medium">
          ⚠ No life insurance on file — income replacement needs may be unmet.
        </div>
      )}
      {filteredPolicies.length > 0 && diCoverage === 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-700 font-medium">
          ⚠ No disability coverage on file — income at risk if unable to work.
        </div>
      )}

      {/* Policy cards */}
      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading…</div>
      ) : filteredPolicies.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl">
          <Shield className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-semibold">No policies on file</p>
          <p className="text-sm text-slate-400 mt-1">Add existing life, disability, or LTC coverage</p>
          <button onClick={openCreate} className="mt-4 text-sm text-blue-600 hover:underline">Add your first policy</button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPolicies.map(p => {
            const insuredName = p.insured === "spouse" ? (spouseName ?? "Spouse") : clientName;
            return (
              <div key={p.id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md hover:-translate-y-[1px] transition-all duration-200 group">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{p.type}</span>
                      {TERM_TYPES.includes(p.type) && p.renewalDate && (
                        <span className="text-xs font-medium text-amber-600">Renews {p.renewalDate}</span>
                      )}
                    </div>
                    <p className="font-medium text-slate-900">{p.provider || "—"}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {insuredName}
                      {p.policyNumber ? ` · #${p.policyNumber}` : ""}
                      {p.inforceDate ? ` · Since ${p.inforceDate}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-blue-600">{fmt$(p.coverageAmount)}</p>
                    <p className="text-xs text-slate-500">{fmt$(annualPremium(p))}/yr</p>
                  </div>
                </div>
                <div className="mt-3 flex justify-between items-center text-xs text-slate-500 border-t border-slate-100 pt-3">
                  <span>Beneficiary: {p.beneficiary || "—"}</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={() => openEdit(p)} className="p-1.5 text-slate-400 hover:text-blue-600 rounded-md hover:bg-blue-50 transition">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => del(p.id)} className="p-1.5 text-slate-400 hover:text-red-500 rounded-md hover:bg-red-50 transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {p.notes && (
                  <p className="mt-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">{p.notes}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

            {/* Form modal */}
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
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Provider</label>
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
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Premium</label>
                  <div className="flex gap-2">
                    <input type="number" value={draft.premium} onChange={e => u("premium", e.target.value)} className={INPUT} placeholder="0" />
                    <select value={draft.premiumFrequency} onChange={e => u("premiumFrequency", e.target.value)} className="border border-gray-200 rounded-lg px-2 py-2 text-sm w-32">
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
      {showImporter && (
        <PolicyImporter
          clientId={clientId}
          client={client}
          onImported={() => { load(); setShowImporter(false); }}
          onClose={() => setShowImporter(false)}
        />
      )}
    </div>
  );
}
