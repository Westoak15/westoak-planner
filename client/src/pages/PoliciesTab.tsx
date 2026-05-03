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

const POLICY_TYPES = ["Term Life","Whole Life","Universal Life","Disability (DI)","Long-Term Care (LTC)","Critical Illness","Other"];
const TERM_TYPES   = ["Term Life","Critical Illness"];
const FREQUENCIES  = ["Monthly","Quarterly","Semi-Annual","Annual"];
const INPUT = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500";

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
    <div className="p-6 max-w-5xl mx-auto">

      {/* Summary bar */}
      <SummaryBar items={[
        { label: "Life coverage",     value: fmt$(lifeCoverage),   color: "text-blue-600",    bg: "bg-blue-50"   },
        { label: "Disability",        value: diCoverage > 0 ? fmt$(diCoverage) + "/mo" : "—", color: "text-violet-600", bg: "bg-violet-50" },
        { label: "Critical illness",  value: fmt$(ciCoverage),     color: "text-emerald-600", bg: "bg-emerald-50"},
        { label: "Total premium/yr",  value: fmt$(totalPremium),   color: "text-gray-700",    bg: "bg-slate-100"  },
      ]} />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Insurance Policies</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {filteredPolicies.length} polic{filteredPolicies.length !== 1 ? "ies" : "y"} on file
          </p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 bg-brand-gradient hover:bg-brand-gradient-hover text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          <Plus className="w-4 h-4" /> Add Policy
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading…</div>
      ) : filteredPolicies.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl">
          <Shield className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-semibold">No policies on file</p>
          <p className="text-sm text-gray-400 mt-1">Add existing life, disability, or LTC coverage</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <TH>Type</TH>
                <TH>Insured</TH>
                <TH>Provider</TH>
                <TH right>Coverage</TH>
                <TH right>Premium / yr</TH>
                <TH>Inforce</TH>
                {filteredPolicies.some(p => TERM_TYPES.includes(p.type)) && <TH>Renews</TH>}
                <TH>Beneficiary</TH>
                <TH></TH>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPolicies.map(p => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <TD>
                    <span className="bg-brand-tint text-blue-600 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">
                      {p.type}
                    </span>
                  </TD>
                  <TD>
                    <span className="text-gray-600 text-xs">
                      {p.insured === "spouse" ? (spouseName ?? "Spouse") : clientName}
                    </span>
                  </TD>
                  <TD><span className="font-medium text-gray-800">{p.provider || "—"}</span></TD>
                  <TD right><span className="font-semibold text-gray-900">{fmt$(p.coverageAmount)}</span></TD>
                  <TD right>
                    <span className="text-gray-600">{fmt$(annualPremium(p))}</span>
                    <span className="text-gray-400 text-xs ml-1">({fmt$(p.premium)}/{p.premiumFrequency?.slice(0,2)})</span>
                  </TD>
                  <TD><span className="text-gray-400 text-xs">{p.inforceDate || "—"}</span></TD>
                  {filteredPolicies.some(pp => TERM_TYPES.includes(pp.type)) && (
                    <TD>
                      {TERM_TYPES.includes(p.type) && p.renewalDate
                        ? <span className="text-amber-600 text-xs font-medium">{p.renewalDate}</span>
                        : <span className="text-gray-300">—</span>}
                    </TD>
                  )}
                  <TD><span className="text-gray-400 text-xs">{p.beneficiary || "—"}</span></TD>
                  <TD>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(p)} className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => del(p.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Notes column if any policy has notes */}
      {filteredPolicies.some(p => p.notes) && (
        <div className="mt-3 space-y-1.5">
          {filteredPolicies.filter(p => p.notes).map(p => (
            <div key={p.id} className="flex gap-2 text-xs text-gray-500 bg-slate-50 rounded-lg px-3 py-2">
              <span className="font-semibold text-gray-600">{p.provider || p.type}:</span>
              <span>{p.notes}</span>
            </div>
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex justify-between items-center px-6 pt-6 pb-4 border-b border-slate-100">
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
                    <select value={draft.premiumFrequency} onChange={e => u("premiumFrequency", e.target.value)} className="border border-slate-200 rounded-lg px-2 py-2 text-sm w-32">
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
                className="flex items-center gap-2 px-6 py-2.5 bg-brand-gradient hover:bg-brand-gradient-hover disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
                <Save className="w-4 h-4" /> {saving ? "Saving…" : editId ? "Save Changes" : "Add Policy"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
