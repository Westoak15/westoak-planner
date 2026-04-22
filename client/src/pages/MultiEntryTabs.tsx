/**
 * MultiEntryTabs.tsx
 * Net Worth, Retirement, Insurance, RESP, Debt tabs
 * — all support adding multiple rows before saving
 */
import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { fmt$, fmtPct, cn } from "../lib/utils";
import { Plus, Trash2, Save, X, Pencil } from "lucide-react";
import { DrawdownTab } from "./DrawdownTab";
import { MonteCarloResults } from "../components/MonteCarloResults";

// ── Shared mini components ────────────────────────────────────────────────────
const TH = ({ children }: { children?: React.ReactNode }) =>(
  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">{children}</th>
);
const TD = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <td className={cn("px-3 py-2.5 text-sm", right && "text-right")}>{children}</td>
);
function Card({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <div className={cn("bg-white rounded-xl border border-gray-200 shadow-sm", className)}>{children}</div>;
}
function SummaryBar({ items }: { items: { label: string; value: string; color: string; bg: string }[] }) {
  return (
    <div className="grid gap-4 mb-5" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
      {items.map(i => (
        <div key={i.label} className={`${i.bg} rounded-xl p-4`}>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{i.label}</p>
          <p className={`text-xl font-bold ${i.color}`}>{i.value}</p>
        </div>
      ))}
    </div>
  );
}
function InlineInput({ value, onChange, type = "text", placeholder, className, maxLength }: { value: string; onChange: (v: string) => void; type?: string; placeholder?: string; className?: string; maxLength?: number }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength}
      className={cn("border border-gray-200 rounded-lg px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500", className)} />
  );
}
function InlineSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 bg-white">
      {options.map(o => <option key={o}>{o}</option>)}
    </select>
  );
}

const PROVINCES = ["AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT"];
const NW_ASSET_CATS = ["RRSP","TFSA","Non-Registered", "RESP", "Real Estate","Business","Pension","Cash/Bank","ESU","RSU","Other Asset"];
const NW_LIAB_CATS  = ["Mortgage","HELOC","Car Loan","Credit Card","Student Loan","Line of Credit","Other Liability"];
const DEBT_TYPES    = ["mortgage","heloc","car_loan","credit_card","student_loan","line_of_credit","other"];
const PENSION_TYPES = ["DBPP","DCPP","Self-Directed","Matching Contributions"];

// ── NET WORTH ─────────────────────────────────────────────────────────────────
interface NWEntry { id: number; type: string; category: string; name: string; owner: string; value: string; notes: string | null; metadata: any; }
type NWDraft = {
  type: "asset"|"liability"; category: string; name: string; owner: string; value: string; notes: string;
  // RRSP extras
  isSpousal: boolean; rrspContributor: string;
  // Pension extras
  pensionType: string; matchPct: string;
   // Liability extras
  monthlyPayment: string;
  // RESP extras
  respBeneficiary: string;
};

function emptyDraft(type: "asset"|"liability"): NWDraft {
  return { type, category: type === "asset" ? "RRSP" : "Mortgage", name: "", owner: "primary", value: "", notes: "", isSpousal: false, rrspContributor: "", pensionType: "DBPP", matchPct: "", monthlyPayment: "", respBeneficiary: "" };
}

// Conditional extra fields based on category
function ExtraFields({ draft, onChange, spouseName, dependants }: { draft: NWDraft; onChange: (k: keyof NWDraft, v: any) => void; spouseName: string; dependants?: any[] }) {
  if (draft.category === "RESP") {
    const deps = Array.isArray(dependants) ? dependants : [];
    const options = [{ value: "all", label: "All Children" }, ...deps.map((d: any) => ({ value: d.name ?? "", label: d.name ?? "" }))];
    return (
      <div className="flex items-center gap-3 mt-1">
        <span className="text-xs text-gray-500">Beneficiary:</span>
        <select value={draft.respBeneficiary} onChange={e => onChange("respBeneficiary", e.target.value)}
          className="border border-gray-200 rounded px-2 py-1 text-xs">
          <option value="">Select beneficiary</option>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <span className="text-[10px] text-gray-400">(Owner = subscriber/parent; Beneficiary = child)</span>
      </div>
    );
  }
  if (draft.category === "RRSP") {
    return (
      <div className="flex items-center gap-3 mt-1">
        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
          <input type="checkbox" checked={draft.isSpousal} onChange={e => onChange("isSpousal", e.target.checked)}
            className="w-3.5 h-3.5 rounded border-gray-300" />
          Spousal RRSP
        </label>
        {draft.isSpousal && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">Contributor:</span>
            <select value={draft.rrspContributor} onChange={e => onChange("rrspContributor", e.target.value)}
              className="border border-gray-200 rounded px-2 py-1 text-xs w-full">
              <option value="">Select contributor</option>
              <option value="client">Client</option>
              <option value="spouse">Spouse</option>
            </select>
          </div>
        )}
      </div>
    );
  }
  if (draft.category === "Pension") {
    return (
      <div className="flex items-center gap-3 mt-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">Type:</span>
          <InlineSelect value={draft.pensionType} onChange={v => onChange("pensionType", v)} options={PENSION_TYPES} />
        </div>
        {draft.pensionType === "Matching Contributions" && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">Match up to:</span>
            <InlineInput value={draft.matchPct} onChange={v => onChange("matchPct", v)} placeholder="e.g. 4%" className="w-20" />
          </div>
        )}
      </div>
    );
  }
  return null;
}

export function NetWorthTab({ clientId, client }: { clientId: number; client?: { firstName: string; lastName: string; spouseFirstName?: string | null; spouseLastName?: string | null } }) {
  const [entries, setEntries] = useState<NWEntry[]>([]);
  const [drafts, setDrafts]   = useState<NWDraft[]>([]);
  const [saving, setSaving]   = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [simResult, setSimResult] = useState<any>(null);
  const [editForm, setEditForm]   = useState<Partial<NWEntry & { isSpousal: boolean; rrspContributor: string; pensionType: string; matchPct: string; monthlyPayment: string; respBeneficiary: string }>>({});

  const spouseName = client?.spouseFirstName ? `${client.spouseFirstName} ${client.spouseLastName ?? ""}`.trim() : "";
  const primaryName = client ? `${client.firstName} ${client.lastName}` : "Primary";
  const ownerOptions = spouseName ? [primaryName, spouseName, "Joint"] : [primaryName];

  const load = () => api.get<NWEntry[]>(`/api/clients/${clientId}/net-worth`).then(setEntries);
  useEffect(() => { load(); }, [clientId]);

  const assets = entries.filter(e => e.type === "asset");
  const liabs  = entries.filter(e => e.type === "liability");
  const totalA = assets.reduce((s, e) => s + Number(e.value), 0);
  const totalL = liabs.reduce((s, e) => s + Number(e.value), 0);

  function addDraft(type: "asset"|"liability") { setDrafts(d => [...d, emptyDraft(type)]); }
  function updateDraft(i: number, k: keyof NWDraft, v: any) { setDrafts(d => d.map((x, idx) => idx === i ? { ...x, [k]: v } : x)); }
  function removeDraft(i: number) { setDrafts(d => d.filter((_, idx) => idx !== i)); }

  function startEdit(e: NWEntry) {
    const m = (e.metadata ?? {}) as any;
   setEditForm({
      ...e,
      notes: e.notes ?? "",
      isSpousal: !!m.spousal,
      rrspContributor: m.contributor ?? "",
      pensionType: m.pensionType ?? "DBPP",
      matchPct: m.matchPct ?? "",
      monthlyPayment: m.monthlyPayment ?? "",
      respBeneficiary: m.respBeneficiary ?? "",
    });
  }

  async function saveEdit() {
    if (!editingId || !editForm.value) return;
    setSaving(true);
    try {
      const m: any = {};
      if (editForm.category === "RRSP" && editForm.isSpousal) { m.spousal = true; m.contributor = editForm.rrspContributor; }
      if (editForm.category === "Pension") { m.pensionType = editForm.pensionType; if (editForm.matchPct) m.matchPct = editForm.matchPct; }
      if ((editForm as any).monthlyPayment) m.monthlyPayment = (editForm as any).monthlyPayment;
      if ((editForm as any).respBeneficiary) m.respBeneficiary = (editForm as any).respBeneficiary;
      await api.put(`/api/net-worth/${editingId}`, {
        category: editForm.category, name: editForm.name || editForm.category,
        owner: editForm.owner, value: editForm.value, notes: editForm.notes || null,
        metadata: Object.keys(m).length ? m : null,
      });
      setEditingId(null); setEditForm({});
      await load();
    } finally { setSaving(false); }
  }

async function saveAll() {
  const valid = drafts.filter(d => d.value);
  if (!valid.length) return;
  setSaving(true);
  try {
    await Promise.all(valid.map(d => {
      const m: any = {};
      if (d.category === "RRSP" && d.isSpousal) { m.spousal = true; m.contributor = d.rrspContributor; }
      if (d.category === "Pension") { m.pensionType = d.pensionType; if (d.matchPct) m.matchPct = d.matchPct; }
      if (d.category === "RESP" && d.respBeneficiary) m.respBeneficiary = d.respBeneficiary;
      return api.post(`/api/clients/${clientId}/net-worth`, {
        type: d.type, category: d.category,
        name: d.name || d.category, owner: d.owner,
        value: d.value, notes: d.notes || null,
        metadata: Object.keys(m).length ? m : null,
      });
    }));
    setDrafts([]);
    await load();
  } finally { setSaving(false); }
}

  async function del(id: number) {
    if (!confirm("Delete this entry?")) return;
    await api.delete(`/api/net-worth/${id}`); await load();
  }

  function ownerLabel(entry: NWEntry) {
    return entry.owner === "spouse" ? (spouseName || "Spouse") : entry.owner === "joint" ? "Joint" : primaryName;
  }

  function metaBadge(entry: NWEntry) {
    const m = entry.metadata as any;
    if (!m) return null;
    if (entry.category === "RRSP" && m.spousal) return <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">Spousal · {m.contributor}</span>;
    if (entry.category === "Pension" && m.pensionType) return <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{m.pensionType}{m.matchPct ? ` · ${m.matchPct}` : ""}</span>;
    return null;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <SummaryBar items={[
        { label: "Total Assets",      value: fmt$(totalA),          color: "text-emerald-600", bg: "bg-emerald-50" },
        { label: "Total Liabilities", value: fmt$(totalL),          color: "text-red-500",     bg: "bg-red-50" },
        { label: "Net Worth",         value: fmt$(totalA - totalL), color: totalA - totalL >= 0 ? "text-blue-600" : "text-red-500", bg: totalA - totalL >= 0 ? "bg-blue-50" : "bg-red-50" },
      ]} />

      {/* Assets */}
      {(["asset","liability"] as const).map(type => {
        const rows = type === "asset" ? assets : liabs;
        const total = type === "asset" ? totalA : totalL;
        const cats = type === "asset" ? NW_ASSET_CATS : NW_LIAB_CATS;
        const draftRows = drafts.filter(d => d.type === type);
        return (
          <Card key={type} className="mb-5">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-800">{type === "asset" ? "Assets" : "Liabilities"}</h3>
                <p className={`text-lg font-bold ${type === "asset" ? "text-emerald-600" : "text-red-500"}`}>{fmt$(total)}</p>
              </div>
              <button onClick={() => addDraft(type)} className="flex items-center gap-1.5 text-sm font-semibold text-white bg-[#0c1e3a] hover:bg-[#0e2a4a] px-3 py-1.5 rounded-lg">
                <Plus className="w-3.5 h-3.5" /> Add {type === "asset" ? "Asset" : "Liability"}
              </button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <TH>Owner</TH><TH>Category</TH><TH>Name / Description</TH>
                  <TH>{type === "asset" ? "Value" : "Balance Owing"}</TH>
                 {type === "liability" && <TH>Monthly Pmt</TH>}
                  <TH>Notes</TH><TH></TH>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map(e => editingId === e.id ? (
                  // ── Edit mode ──────────────────────────────────────────
                  <tr key={e.id} className="bg-amber-50/50 border-b border-amber-100">
                    <td colSpan={type === "liability" ? 7 : 6} className="px-3 py-2">
                      <div className="grid grid-cols-5 gap-2 mb-1">
                        <div>
                          <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-0.5">Owner</label>
                          <select value={editForm.owner ?? "primary"} onChange={e => setEditForm(f => ({...f, owner: e.target.value}))}
                            className="border border-amber-300 rounded-lg px-2 py-1.5 text-sm w-full bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/30">
                            <option value="primary">{primaryName}</option>
                            {spouseName && <option value="spouse">{spouseName}</option>}
                            {spouseName && <option value="joint">Joint</option>}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-0.5">Category</label>
                          <InlineSelect value={editForm.category ?? ""} onChange={v => setEditForm(f => ({...f, category: v}))} options={cats} />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-0.5">Name</label>
                          <InlineInput value={editForm.name ?? ""} onChange={v => setEditForm(f => ({...f, name: v}))} />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-0.5">{type === "asset" ? "Value ($)" : "Balance ($)"}</label>
                          <InlineInput value={String(editForm.value ?? "")} onChange={v => setEditForm(f => ({...f, value: v}))} type="number" />
                        </div>
                        {type === "liability" && (
                          <div>
                            <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-0.5">Monthly Pmt ($)</label>
                            <InlineInput value={String((editForm as any).monthlyPayment ?? "")} onChange={v => setEditForm(f => ({...f, monthlyPayment: v}))} type="number" />
                          </div>
                        )}
                        <div className="flex gap-1 items-end">
                          <div className="flex-1">
                            <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-0.5">Notes</label>
                            <InlineInput value={editForm.notes ?? ""} onChange={v => setEditForm(f => ({...f, notes: v}))} />
                          </div>
                       
                          <div className="flex gap-1 mb-1.5">
                            <button onClick={saveEdit} disabled={saving} title="Save" className="text-emerald-500 hover:text-emerald-700"><Save className="w-4 h-4" /></button>
                            <button onClick={() => { setEditingId(null); setEditForm({}); }} title="Cancel" className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                          </div>
                        </div>
                      </div>
                      {/* Conditional extras in edit mode */}
                      {editForm.category === "RRSP" && (
                        <div className="flex items-center gap-3 mt-1">
                          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                            <input type="checkbox" checked={!!editForm.isSpousal} onChange={ev => setEditForm(f => ({...f, isSpousal: ev.target.checked}))} className="w-3.5 h-3.5 rounded" />
                            Spousal RRSP
                          </label>
                          {editForm.isSpousal && (
                            <select value={editForm.rrspContributor ?? ""} onChange={e => setEditForm(f => ({ ...f, rrspContributor: e.target.value }))}
                              className="border border-gray-200 rounded px-2 py-1 text-xs w-full">
                              <option value="">Select contributor</option>
                              <option value="client">Client</option>
                              <option value="spouse">Spouse</option>
                            </select>
                          )}
                        </div>
                      )}
                      {editForm.category === "Pension" && (
                        <div className="flex items-center gap-3 mt-1">
                          <InlineSelect value={editForm.pensionType ?? "DBPP"} onChange={v => setEditForm(f => ({...f, pensionType: v}))} options={PENSION_TYPES} />
                          {editForm.pensionType === "Matching Contributions" && (
                            <InlineInput value={editForm.matchPct ?? ""} onChange={v => setEditForm(f => ({...f, matchPct: v}))} placeholder="Match %" className="w-20" />
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  // ── View mode ──────────────────────────────────────────
                  <tr key={e.id} className="hover:bg-gray-50 cursor-pointer group" onClick={() => startEdit(e)}>
                    <TD><span className="text-xs text-gray-500">{ownerLabel(e)}</span></TD>
                    <TD>
                      <div className="flex flex-col gap-1">
                        <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full w-fit">{e.category}</span>
                        {metaBadge(e)}
                      </div>
                    </TD>
                    <TD><span className="font-medium text-gray-800">{e.name}</span></TD>
                    <TD right><span className="font-semibold">{fmt$(e.value)}</span></TD>
                    {type === "liability" && <TD><span className="text-gray-400 text-xs">{e.metadata?.monthlyPayment ? fmt$(e.metadata.monthlyPayment) : ""}</span></TD>}
                    <TD><span className="text-gray-400 text-xs">{e.notes ?? ""}</span></TD>
                    <TD>
                      <div className="flex items-center gap-2">
                        <Pencil className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-400 transition-colors" />
                        <button onClick={ev => { ev.stopPropagation(); del(e.id); }} className="text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </TD>
                  </tr>
                ))}

                {/* Draft rows */}
                {draftRows.map(d => {
                  const ri = drafts.indexOf(d);
                  return (
                    <tr key={ri} className="bg-blue-50/50 border-b border-blue-100">
                      <td colSpan={type === "liability" ? 7 : 6} className="px-3 py-2">
                        <div className="grid grid-cols-5 gap-2 mb-1">
                          {/* Owner */}
                          <div>
                            <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-0.5">Owner</label>
                            <select value={d.owner} onChange={e => updateDraft(ri, "owner", e.target.value)}
                              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-cyan-500/20 bg-white">
                              <option value="primary">{primaryName}</option>
                              {spouseName && <option value="spouse">{spouseName}</option>}
                              {spouseName && <option value="joint">Joint</option>}
                            </select>
                          </div>
                          {/* Category */}
                          <div>
                            <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-0.5">Category</label>
                            <InlineSelect value={d.category} onChange={v => updateDraft(ri, "category", v)} options={cats} />
                          </div>
                          {/* Name */}
                          <div>
                            <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-0.5">Name / Description</label>
                            <InlineInput value={d.name} onChange={v => updateDraft(ri, "name", v)} placeholder={d.category} />
                          </div>
                          {/* Value */}
                          <div>
                             {d.type === "liability" && (
                            <div>
                              <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-0.5">Monthly Pmt ($)</label>
                              <InlineInput value={d.monthlyPayment} onChange={v => updateDraft(ri, "monthlyPayment", v)} type="number" placeholder="0" />
                            </div>
                          )}
                            <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-0.5">{type === "asset" ? "Value ($)" : "Balance Owing ($)"}</label>
                            <InlineInput value={d.value} onChange={v => updateDraft(ri, "value", v)} type="number" placeholder="0" />
                          </div>
                          {/* Notes + remove */}
                          <div className="flex gap-1 items-end">
                            <div className="flex-1">
                              <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-0.5">Notes</label>
                              <InlineInput value={d.notes} onChange={v => updateDraft(ri, "notes", v)} placeholder="optional" />
                            </div>
                            <button onClick={() => removeDraft(ri)} className="text-gray-300 hover:text-red-500 mb-1.5"><X className="w-4 h-4" /></button>
                          </div>
                        </div>
                        {/* Conditional extra fields */}
                        <ExtraFields draft={d} onChange={(k, v) => updateDraft(ri, k, v)} spouseName={spouseName} dependants={Array.isArray((client as any)?.dependants) ? (client as any).dependants : []} />
                      </td>
                    </tr>
                  );
                })}

                {rows.length === 0 && draftRows.length === 0 && (
                  <tr><td colSpan={type === "liability" ? 7 : 6} className="px-4 py-6 text-center text-gray-400 text-sm">No {type}s yet — click Add to add one</td></tr>
                )}
              </tbody>
            </table>
          </Card>
        );
      })}

      {drafts.length > 0 && (
        <div className="flex justify-end gap-2 mt-2">
          <button onClick={() => setDrafts([])} className="text-sm text-gray-500 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">Discard All</button>
          <button onClick={saveAll} disabled={saving}
            className="flex items-center gap-1.5 bg-[#0c1e3a] hover:bg-[#0e2a4a] disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg">
            <Save className="w-3.5 h-3.5" /> {saving ? "Saving…" : `Save ${drafts.filter(d=>d.value).length} Entries`}
          </button>
        </div>
      )}
    </div>
  );
}

// ── RETIREMENT TAB ─────────────────────────────────────────────────────────────
interface RetirementProj { 
  id: number; label: string | null; currentAge: number|null; retirementAge: number|null; 
  rrspBalance: string|null; tfsaBalance: string|null; nonRegBalance: string|null; 
  annualContribution: string|null; expectedReturn: string|null; inflationRate: string|null; 
  desiredRetirementIncome: string|null; cppStartAge: number|null; oasStartAge: number|null; 
  cppMonthly: string|null; oasMonthly: string|null; projectedBalance: string|null; 
  successRate: string|null; notes: string|null; createdAt?: string; 
}
type RetDraft = { 
  label: string; currentAge: string; retirementAge: string; 
  rrspBalance: string; tfsaBalance: string; nonRegBalance: string; 
  annualContribution: string; expectedReturn: string; inflationRate: string; 
  desiredRetirementIncome: string; cppStartAge: string; oasStartAge: string; 
  cppMonthly: string; oasMonthly: string; notes: string; 
};

export function RetirementTab({ clientId, client }: { clientId: number; client?: any }) {
  const calcAge = (dob: string | null) => dob ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;
  const clientAge = calcAge(client?.dateOfBirth);
  const spouseAge = calcAge(client?.spouseDateOfBirth);
  const clientName = client ? client.firstName : "Primary";
  const spouseName = client?.spouseFirstName ?? "Spouse";

  const emptyDraft = (label: string, age?: string): RetDraft => ({
    label,
    currentAge: age ?? (clientAge ? String(clientAge) : ""),
    retirementAge: String(client?.retirementAge ?? 65),
    rrspBalance: "0", tfsaBalance: "0", nonRegBalance: "0",
    annualContribution: "0", expectedReturn: "6.5", inflationRate: "2.5",
    desiredRetirementIncome: client?.desiredRetirementIncome ? String(client.desiredRetirementIncome) : "0",
    cppStartAge: "65", oasStartAge: "65", cppMonthly: "900", oasMonthly: "700",
    notes: "",
  });

  const [rows, setRows]         = useState<RetirementProj[]>([]);
  const [drafts, setDrafts]     = useState<RetDraft[]>([]);
  const [saving, setSaving]     = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [netWorth, setNetWorth] = useState<any[]>([]);
  const [simResult, setSimResult] = useState<any>(null);
  const [simulating, setSimulating] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<"projections"|"drawdown">("projections");

  const load = () => api.get<RetirementProj[]>(`/api/clients/${clientId}/retirement`).then(setRows);
  useEffect(() => {
    load();
    api.get<any[]>(`/api/clients/${clientId}/net-worth`).then(setNetWorth);
  }, [clientId]);

  const fmt$ = (v: any) => { const n = parseFloat(v ?? "0"); if (!n) return "-"; return "$" + n.toLocaleString("en-CA", { maximumFractionDigits: 0 }); };
  const fmtPct = (v: any) => { const n = parseFloat(v ?? "0"); if (!n) return "-"; return n + "%"; };

  function addDraft() {
    const primary = netWorth.filter(e => e.type === "asset" && e.owner !== "spouse" && e.owner !== "joint");
    const spouse  = netWorth.filter(e => e.type === "asset" && e.owner === "spouse");
    const joint   = netWorth.filter(e => e.type === "asset" && e.owner === "joint");
    const hasSpouse = spouse.length > 0 || !!client?.spouseFirstName;
    const sum = (arr: any[], cat: string) => arr.filter(e => e.category === cat).reduce((s: number, e: any) => s + Number(e.value), 0);
    const pRrsp   = sum(primary, "RRSP")   + sum(joint, "RRSP")   / 2;
    const pTfsa   = sum(primary, "TFSA")   + sum(joint, "TFSA")   / 2;
    const pNonReg = sum(primary, "Non-Registered") + sum(joint, "Non-Registered") / 2;
    const sRrsp   = sum(spouse,  "RRSP")   + sum(joint, "RRSP")   / 2;
    const sTfsa   = sum(spouse,  "TFSA")   + sum(joint, "TFSA")   / 2;
    const sNonReg = sum(spouse,  "Non-Registered") + sum(joint, "Non-Registered") / 2;

    const newDrafts: RetDraft[] = [];
    newDrafts.push({ 
      ...emptyDraft(hasSpouse ? `${clientName} & ${spouseName}` : clientName), 
      rrspBalance: String(Math.round(pRrsp + sRrsp)), 
      tfsaBalance: String(Math.round(pTfsa + sTfsa)), 
      nonRegBalance: String(Math.round(pNonReg + sNonReg)) 
    });
    newDrafts.push({ 
      ...emptyDraft(clientName, clientAge ? String(clientAge) : ""), 
      rrspBalance: String(Math.round(pRrsp)), 
      tfsaBalance: String(Math.round(pTfsa)), 
      nonRegBalance: String(Math.round(pNonReg)) 
    });
    if (hasSpouse) {
      newDrafts.push({ 
        ...emptyDraft(spouseName, spouseAge ? String(spouseAge) : ""), 
        rrspBalance: String(Math.round(sRrsp)), 
        tfsaBalance: String(Math.round(sTfsa)), 
        nonRegBalance: String(Math.round(sNonReg)) 
      });
    }
    setDrafts(prev => [...prev, ...newDrafts]);
  }

  function startEdit(p: RetirementProj) {
    setEditingId(p.id);
    setDrafts([{
      label: p.label ?? clientName,
      currentAge: p.currentAge ? String(p.currentAge) : "",
      retirementAge: p.retirementAge ? String(p.retirementAge) : "65",
      rrspBalance: p.rrspBalance ?? "0",
      tfsaBalance: p.tfsaBalance ?? "0",
      nonRegBalance: p.nonRegBalance ?? "0",
      annualContribution: p.annualContribution ?? "0",
      expectedReturn: p.expectedReturn ?? "6.5",
      inflationRate: p.inflationRate ?? "2.5",
      desiredRetirementIncome: p.desiredRetirementIncome ?? "0",
      cppStartAge: p.cppStartAge ? String(p.cppStartAge) : "65",
      oasStartAge: p.oasStartAge ? String(p.oasStartAge) : "65",
      cppMonthly: p.cppMonthly ?? "900",
      oasMonthly: p.oasMonthly ?? "700",
      notes: p.notes ?? "",
    }]);
  }

  async function saveAll() {
    const valid = drafts.filter(d => d.currentAge && d.retirementAge);
    if (!valid.length) return;
    setSaving(true);
    try {
      if (editingId) {
        await api.patch(`/api/retirement/${editingId}`, valid[0]);
        setEditingId(null);
      } else {
        await Promise.all(valid.map(d => api.post(`/api/clients/${clientId}/retirement`, d)));
      }
      setDrafts([]);
      await load();
    } finally { setSaving(false); }
  }

  async function del(id: number) {
    if (!confirm("Delete projection?")) return;
    await api.delete(`/api/retirement/${id}`);
    await load();
  }

  async function runSim() {
    setSimulating(true);
    try {
      const r = await api.post<any>(`/api/clients/${clientId}/simulate`, { simulations: 1000, equityAllocation: 60, equityReturn: 7.0, equityStdDev: 12.0, bondReturn: 4.0, bondStdDev: 5.0, inflationRate: 2.5, lifeExpectancy: 90 });
      setSimResult(r);
      await load();
    } catch (e: any) { alert(e.message); }
    finally { setSimulating(false); }
  }

  // Group by retirementAge + desiredRetirementIncome
  const groups: RetirementProj[][] = [];
  const used = new Set<number>();
  for (const p of rows) {
    if (used.has(p.id)) continue;
    const siblings = rows.filter(r => !used.has(r.id) && r.retirementAge === p.retirementAge && r.desiredRetirementIncome === p.desiredRetirementIncome && r.id !== p.id);
    const group = [p, ...siblings];
    group.forEach(r => used.add(r.id));
    groups.push(group);
  }

  const labelColor = (label: string | null) => {
    if (!label) return "text-blue-600";
    if (label.includes("&")) return "text-indigo-600";
    if (label === spouseName || label === "Spouse") return "text-pink-600";
    return "text-blue-600";
  };

 return (
    <div className="p-6 max-w-5xl mx-auto">
      {simResult && <MonteCarloResults result={simResult} onClose={() => setSimResult(null)} onPrint={() => window.print()} />}
      <div className="flex gap-1 mb-5 border-b border-gray-200">
        {(["projections","drawdown"] as const).map(key => (
          <button key={key} onClick={() => setActiveSubTab(key)}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors ${activeSubTab === key ? "bg-white border border-b-white border-gray-200 text-[#0c1e3a] -mb-px" : "text-gray-500 hover:text-gray-700"}`}>
            {key === "projections" ? "Retirement Projections" : "Drawdown Strategies"}
          </button>
        ))}
      </div>
      {activeSubTab === "drawdown" && <DrawdownTab clientId={clientId} client={client} />}
      {activeSubTab === "projections" && (
      <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-gray-900">Retirement Projections</h2>
        <div className="flex gap-2">
          <button onClick={runSim} disabled={simulating}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-1.5 rounded-lg">
            {simulating ? "Running..." : "Retirement Checkup"}
          </button>
          <button onClick={addDraft}
            className="flex items-center gap-1.5 text-sm font-semibold text-white bg-[#0c1e3a] hover:bg-[#0e2a4a] px-3 py-1.5 rounded-lg">
            <Plus className="w-3.5 h-3.5" /> Add Projection
          </button>
        </div>
      </div>
      {drafts.length > 0 && (
        <div className="space-y-4 mb-5">
          {drafts.map((d, i) => (
            <Card key={i} className="p-5 border-blue-200 bg-blue-50/20">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800">{editingId ? `Editing: ${d.label}` : d.label}</h3>
                <button onClick={() => setDrafts(x => x.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {([
                  ["Client","label","text"],["Current Age","currentAge","number"],["Retirement Age","retirementAge","number"],
                  ["RRSP Balance","rrspBalance","number"],["TFSA Balance","tfsaBalance","number"],["Non-Reg Balance","nonRegBalance","number"],
                  ["Annual Contribution","annualContribution","number"],["Expected Return %","expectedReturn","number"],["Desired Income","desiredRetirementIncome","number"],
                  ["CPP Monthly","cppMonthly","number"],["CPP Start Age","cppStartAge","number"],["OAS Monthly","oasMonthly","number"],
                ] as [string,string,string][]).map(([l, k, t]) => (
                  <div key={k}>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">{l}</label>
                    <input type={t} step="any" value={(d as any)[k]}
                      onChange={e => setDrafts(x => x.map((x2, idx) => idx === i ? { ...x2, [k]: e.target.value } : x2))}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
                  </div>
                ))}
              </div>
            </Card>
          ))}
          <div className="flex justify-end gap-2">
            <button onClick={() => { setDrafts([]); setEditingId(null); }} className="text-sm text-gray-500 px-4 py-2 border border-gray-200 rounded-lg">Cancel</button>
            <button onClick={saveAll} disabled={saving}
              className="flex items-center gap-1.5 bg-[#0c1e3a] hover:bg-[#0e2a4a] disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg">
              <Save className="w-3.5 h-3.5" /> {saving ? "Saving..." : editingId ? "Save Changes" : `Save ${drafts.length} Projection${drafts.length > 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      )}
      {rows.length === 0 && drafts.length === 0 && (
        <Card className="p-8 text-center text-gray-400">No projections yet. Click Add Projection to create one.</Card>
      )}
      <div className="space-y-4">
        {groups.map((group, gi) => {
          const main = group.find(p => p.label?.includes("&")) ?? group[0];
          return (
            <Card key={gi} className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-900">Retirement Plan - Target Age {main.retirementAge}</h3>
                <span className="text-xs text-gray-400">{main.createdAt ? new Date(main.createdAt).toLocaleDateString() : ""}</span>
              </div>
              <div className="divide-y divide-gray-100">
                {group.map(p => (
                  <div key={p.id} className="flex items-center gap-4 py-2">
                    <span className={`text-xs font-bold w-36 flex-shrink-0 ${labelColor(p.label)}`}>{p.label ?? clientName}</span>
                    <span className="text-xs text-gray-500">Age {p.currentAge} - {p.retirementAge}</span>
                    <span className="text-xs text-gray-500">RRSP {fmt$(p.rrspBalance)}</span>
                    <span className="text-xs text-gray-500">TFSA {fmt$(p.tfsaBalance)}</span>
                    <span className="text-xs text-gray-500">Income {fmt$(p.desiredRetirementIncome)}</span>
                    {p.successRate && <span className={`text-xs font-bold ml-auto ${Number(p.successRate) >= 85 ? "text-emerald-600" : Number(p.successRate) >= 70 ? "text-amber-600" : "text-red-600"}`}>{p.successRate}%</span>}
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => startEdit(p)} className="p-1 text-gray-300 hover:text-[#0c1e3a]"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => del(p.id)} className="p-1 text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
      </div>
      )}
    </div>
  );
}
// ── INSURANCE ─────────────────────────────────────────────────────────────────
interface InsuranceRec { id: number; method: string; annualIncome: string|null; yearsToReplace: number|null; existingLifeCoverage: string|null; existingDisability: string|null; existingCriticalIllness: string|null; recommendedLife: string|null; recommendedDisability: string|null; recommendedCriticalIllness: string|null; lifeGap: string|null; disabilityGap: string|null; criticalIllnessGap: string|null; notes: string|null; }
type InsDraft = { method: string; annualIncome: string; yearsToReplace: string; existingLifeCoverage: string; existingDisability: string; existingCriticalIllness: string; notes: string; };
const emptyIns = (): InsDraft => ({ method:"dime", annualIncome:"", yearsToReplace:"20", existingLifeCoverage:"", existingDisability:"", existingCriticalIllness:"", notes:"" });

export function InsuranceTab({ clientId }: { clientId: number }) {
  const [rows, setRows]     = useState<InsuranceRec[]>([]);
  const [drafts, setDrafts] = useState<InsDraft[]>([]);
  const [saving, setSaving] = useState(false);

  const load = () => api.get<InsuranceRec[]>(`/api/clients/${clientId}/insurance`).then(setRows);
  useEffect(() => { load(); }, [clientId]);

  function updateDraft(i: number, k: keyof InsDraft, v: string) { setDrafts(d => d.map((x, idx) => idx === i ? { ...x, [k]: v } : x)); }

    async function saveAll() {
    const valid = drafts.filter(d => d.annualIncome);
    if (!valid.length) return;
    setSaving(true);
    try {
      await Promise.all(valid.map(d => api.post(`/api/clients/${clientId}/insurance`, d)));
      setDrafts([]);
      await load();
    } finally { setSaving(false); }
  }
 

  async function del(id: number) {
    if (!confirm("Delete?")) return;
    await api.delete(`/api/insurance/${id}`); await load();
  }

  const GapCell = ({ val }: { val: string|null }) => (
    <span className={`font-bold ${Number(val ?? 0) > 0 ? "text-red-500" : "text-emerald-600"}`}>{fmt$(val)}</span>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-gray-900">Insurance Analyses</h2>
        <button onClick={() => setDrafts(d => [...d, emptyIns()])}
          className="flex items-center gap-1.5 text-sm font-semibold text-white bg-[#0c1e3a] hover:bg-[#0e2a4a] px-3 py-1.5 rounded-lg">
          <Plus className="w-3.5 h-3.5" /> Add Analysis
        </button>
      </div>

      {drafts.map((d, i) => (
        <Card key={i} className="mb-4 p-5 border-blue-200 bg-blue-50/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800">New Insurance Analysis {drafts.length > 1 ? `#${i+1}` : ""}</h3>
            <button onClick={() => setDrafts(x => x.filter((_,idx)=>idx!==i))} className="text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div><label className="text-xs font-semibold text-gray-500 mb-1 block">Method</label>
              <InlineSelect value={d.method} onChange={v => updateDraft(i,"method",v)} options={["dime","hlv","needs"]} /></div>
            <div><label className="text-xs font-semibold text-gray-500 mb-1 block">Annual Income ($)</label>
              <InlineInput value={d.annualIncome} onChange={v => updateDraft(i,"annualIncome",v)} type="number" /></div>
            <div><label className="text-xs font-semibold text-gray-500 mb-1 block">Years to Replace</label>
              <InlineInput value={d.yearsToReplace} onChange={v => updateDraft(i,"yearsToReplace",v)} type="number" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs font-semibold text-gray-500 mb-1 block">Existing Life ($)</label>
              <InlineInput value={d.existingLifeCoverage} onChange={v => updateDraft(i,"existingLifeCoverage",v)} type="number" /></div>
            <div><label className="text-xs font-semibold text-gray-500 mb-1 block">Existing Disability ($)</label>
              <InlineInput value={d.existingDisability} onChange={v => updateDraft(i,"existingDisability",v)} type="number" /></div>
            <div><label className="text-xs font-semibold text-gray-500 mb-1 block">Existing CI ($)</label>
              <InlineInput value={d.existingCriticalIllness} onChange={v => updateDraft(i,"existingCriticalIllness",v)} type="number" /></div>
          </div>
        </Card>
      ))}

      {drafts.length > 0 && (
        <div className="flex justify-end gap-2 mb-5">
          <button onClick={() => setDrafts([])} className="text-sm text-gray-500 px-4 py-2 border border-gray-200 rounded-lg">Discard</button>
          <button onClick={saveAll} disabled={saving}
            className="flex items-center gap-1.5 bg-[#0c1e3a] hover:bg-[#0e2a4a] disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg">
            <Save className="w-3.5 h-3.5" /> {saving ? "Saving…" : `Save ${drafts.length} Analysis`}
          </button>
        </div>
      )}

      {rows.length === 0 && drafts.length === 0 && (
        <Card className="p-8 text-center text-gray-400">No insurance analyses yet.</Card>
      )}
      <div className="space-y-4">
        {rows.map(a => (
          <Card key={a.id} className="p-5">
            <div className="flex items-start justify-between mb-3">
              <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full uppercase">{a.method}</span>
              <button onClick={() => del(a.id)} className="text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[["Life Insurance","existingLifeCoverage","recommendedLife","lifeGap"],
                ["Disability","existingDisability","recommendedDisability","disabilityGap"],
                ["Critical Illness","existingCriticalIllness","recommendedCriticalIllness","criticalIllnessGap"]].map(([title,ex,rec,gap]) => (
                <div key={title} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-bold text-gray-400 uppercase mb-2">{title}</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-gray-500">Existing</span><span className="font-medium">{fmt$((a as any)[ex])}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Recommended</span><span className="font-medium">{fmt$((a as any)[rec])}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Gap</span><GapCell val={(a as any)[gap]} /></div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── RESP ──────────────────────────────────────────────────────────────────────
interface EduPlan { id: number; childName: string; childDob: string|null; currentRespBalance: string|null; annualContribution: string|null; targetAmount: string|null; projectedBalance: string|null; cespGrant: string|null; notes: string|null; }
type EduDraft = { childName: string; childDob: string; currentRespBalance: string; annualContribution: string; targetAmount: string; notes: string; };
const emptyEdu = (): EduDraft => ({ childName:"", childDob:"", currentRespBalance:"", annualContribution:"2500", targetAmount:"", notes:"" });

export function RespTab({ clientId, client }: { clientId: number; client?: any }) {
  const [rows, setRows]     = useState<EduPlan[]>([]);
  const [drafts, setDrafts] = useState<EduDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [netWorth, setNetWorth] = useState<any[]>([]);
  const load = () => api.get<EduPlan[]>(`/api/clients/${clientId}/education`).then(setRows);
  useEffect(() => {
    load();
    api.get<any[]>(`/api/clients/${clientId}/net-worth`).then(setNetWorth);
  }, [clientId]);

  function addDraft() {
    const deps: any[] = Array.isArray(client?.dependants) ? client.dependants : [];
    const respEntries = netWorth.filter(e => e.category === "RESP");
    const totalResp = respEntries.reduce((s: number, e: any) => s + Number(e.value || 0), 0);
    if (deps.length === 0) {
      setDrafts(d => [...d, { ...emptyEdu(), currentRespBalance: String(totalResp || "") }]);
    } else if (deps.length === 1) {
      const dep = deps[0];
      setDrafts(d => [...d, { ...emptyEdu(), childName: dep.name ?? "", childDob: dep.dob ?? "", currentRespBalance: String(totalResp || "") }]);
    } else {
      const perChild = deps.length > 0 ? Math.round(totalResp / deps.length) : 0;
      const newDrafts = deps.map((dep: any) => ({ ...emptyEdu(), childName: dep.name ?? "", childDob: dep.dob ?? "", currentRespBalance: String(perChild || "") }));
      setDrafts(d => [...d, ...newDrafts]);
    }
  }

  function updateDraft(i: number, k: keyof EduDraft, v: string) { setDrafts(d => d.map((x, idx) => idx === i ? { ...x, [k]: v } : x)); }

  async function saveAll() {
    const valid = drafts.filter(d => d.childName);
    if (!valid.length) return;
    setSaving(true);
    try {
      await Promise.all(valid.map(d => api.post(`/api/clients/${clientId}/education`, d)));
      setDrafts([]);
      await load();
    } finally { setSaving(false); }
  }

  async function del(id: number) {
    if (!confirm("Delete?")) return;
    await api.delete(`/api/education/${id}`); await load();
  }

  function handleDob(i: number, raw: string) {
    const digits = raw.replace(/\D/g,"").slice(0,8);
    let f = digits;
    if (digits.length > 4) f = digits.slice(0,4)+"-"+digits.slice(4);
    if (digits.length > 6) f = digits.slice(0,4)+"-"+digits.slice(4,6)+"-"+digits.slice(6);
    updateDraft(i,"childDob",f);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-gray-900">RESP / Education Savings</h2>
        <button onClick={addDraft}
          className="flex items-center gap-1.5 text-sm font-semibold text-white bg-[#0c1e3a] hover:bg-[#0e2a4a] px-3 py-1.5 rounded-lg">
          <Plus className="w-3.5 h-3.5" /> Add Child
        </button>
      </div>

      {drafts.map((d, i) => (
        <Card key={i} className="mb-4 p-5 border-blue-200 bg-blue-50/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800">New RESP {drafts.length > 1 ? `#${i+1}` : ""}</h3>
            <button onClick={() => setDrafts(x => x.filter((_,idx)=>idx!==i))} className="text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs font-semibold text-gray-500 mb-1 block">Child's Name</label>
              <InlineInput value={d.childName} onChange={v => updateDraft(i,"childName",v)} /></div>
            <div><label className="text-xs font-semibold text-gray-500 mb-1 block">Date of Birth</label>
              <InlineInput value={d.childDob} onChange={v => handleDob(i,v)} placeholder="YYYY-MM-DD" maxLength={10} /></div>
            <div><label className="text-xs font-semibold text-gray-500 mb-1 block">Current Balance ($)</label>
              <InlineInput value={d.currentRespBalance} onChange={v => updateDraft(i,"currentRespBalance",v)} type="number" /></div>
            <div><label className="text-xs font-semibold text-gray-500 mb-1 block">Annual Contribution ($)</label>
              <InlineInput value={d.annualContribution} onChange={v => updateDraft(i,"annualContribution",v)} type="number" /></div>
            <div><label className="text-xs font-semibold text-gray-500 mb-1 block">Target Amount ($)</label>
              <InlineInput value={d.targetAmount} onChange={v => updateDraft(i,"targetAmount",v)} type="number" /></div>
            <div><label className="text-xs font-semibold text-gray-500 mb-1 block">Notes</label>
              <InlineInput value={d.notes} onChange={v => updateDraft(i,"notes",v)} /></div>
          </div>
        </Card>
      ))}

      {drafts.length > 0 && (
        <div className="flex justify-end gap-2 mb-5">
          <button onClick={() => setDrafts([])} className="text-sm text-gray-500 px-4 py-2 border border-gray-200 rounded-lg">Discard</button>
          <button onClick={saveAll} disabled={saving || !drafts.some(d => d.childName)}
            className="flex items-center gap-1.5 bg-[#0c1e3a] hover:bg-[#0e2a4a] disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg">
            <Save className="w-3.5 h-3.5" /> {saving ? "Saving…" : `Save ${drafts.filter(d=>d.childName).length} Child${drafts.filter(d=>d.childName).length !== 1 ? "ren" : ""}`}
          </button>
        </div>
      )}

      {rows.length === 0 && drafts.length === 0 && (
        <Card className="p-8 text-center text-gray-400">No RESP plans yet. Add a child to get started.</Card>
      )}
      <div className="grid grid-cols-2 gap-4">
        {rows.map(e => (
          <Card key={e.id} className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-900">{e.childName}</h3>
              <button onClick={() => del(e.id)} className="text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[["DOB",e.childDob],["Balance",fmt$(e.currentRespBalance)],["Annual Contrib",fmt$(e.annualContribution)],["Target",fmt$(e.targetAmount)],["Projected",fmt$(e.projectedBalance)],["CESG",fmt$(e.cespGrant)]].map(([l,v]) => (
                <div key={l}><p className="text-[10px] text-gray-400 uppercase font-semibold">{l}</p><p className="font-semibold text-gray-800">{v ?? "—"}</p></div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── DEBT ──────────────────────────────────────────────────────────────────────
interface DebtEntry { id: number; name: string; type: string; balance: string; interestRate: string|null; minimumPayment: string|null; payoffStrategy: string|null; notes: string|null; }
type DebtDraft = { name: string; type: string; balance: string; interestRate: string; minimumPayment: string; payoffStrategy: string; notes: string; };
const emptyDebt = (): DebtDraft => ({ name:"", type:"credit_card", balance:"", interestRate:"", minimumPayment:"", payoffStrategy:"avalanche", notes:"" });

export function DebtTab({ clientId }: { clientId: number }) {
  const [rows, setRows]     = useState<DebtEntry[]>([]);
  const [drafts, setDrafts] = useState<DebtDraft[]>([]);
  const [saving, setSaving] = useState(false);

  const load = () => api.get<DebtEntry[]>(`/api/clients/${clientId}/debt`).then(setRows);
  useEffect(() => { load(); }, [clientId]);

  const totalDebt = rows.reduce((s, d) => s + Number(d.balance), 0);
  function updateDraft(i: number, k: keyof DebtDraft, v: string) { setDrafts(d => d.map((x, idx) => idx === i ? { ...x, [k]: v } : x)); }

  async function saveAll() {
    const valid = drafts.filter(d => d.name && d.balance);
    if (!valid.length) return;
    setSaving(true);
    try {
      await Promise.all(valid.map(d => api.post(`/api/clients/${clientId}/debt`, d)));
      setDrafts([]);
      await load();
    } finally { setSaving(false); }
  }

  async function del(id: number) {
    if (!confirm("Delete?")) return;
    await api.delete(`/api/debt/${id}`); await load();
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Debt &amp; Cash Flow</h2>
          {rows.length > 0 && <p className="text-sm font-bold text-red-500">Total: {fmt$(totalDebt)}</p>}
        </div>
        <button onClick={() => setDrafts(d => [...d, emptyDebt()])}
          className="flex items-center gap-1.5 text-sm font-semibold text-white bg-[#0c1e3a] hover:bg-[#0e2a4a] px-3 py-1.5 rounded-lg">
          <Plus className="w-3.5 h-3.5" /> Add Debt
        </button>
      </div>

      {/* Draft debt rows */}
      {drafts.length > 0 && (
        <Card className="mb-5 border-blue-200 bg-blue-50/20">
          <div className="p-3 border-b border-blue-100">
            <h3 className="font-bold text-gray-800 text-sm">New Debts — add as many as needed, then save all at once</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-blue-50 border-b border-blue-100">
              <tr><TH>Name</TH><TH>Type</TH><TH>Balance ($)</TH><TH>Rate (%)</TH><TH>Min Payment ($)</TH><TH>Strategy</TH><TH></TH></tr>
            </thead>
            <tbody className="divide-y divide-blue-100">
              {drafts.map((d, i) => (
                <tr key={i}>
                  <TD><InlineInput value={d.name} onChange={v => updateDraft(i,"name",v)} placeholder="e.g. TD Visa" /></TD>
                  <TD><InlineSelect value={d.type} onChange={v => updateDraft(i,"type",v)} options={DEBT_TYPES} /></TD>
                  <TD><InlineInput value={d.balance} onChange={v => updateDraft(i,"balance",v)} type="number" /></TD>
                  <TD><InlineInput value={d.interestRate} onChange={v => updateDraft(i,"interestRate",v)} type="number" /></TD>
                  <TD><InlineInput value={d.minimumPayment} onChange={v => updateDraft(i,"minimumPayment",v)} type="number" /></TD>
                  <TD><InlineSelect value={d.payoffStrategy} onChange={v => updateDraft(i,"payoffStrategy",v)} options={["avalanche","snowball"]} /></TD>
                  <TD><button onClick={() => setDrafts(x => x.filter((_,idx)=>idx!==i))} className="text-gray-300 hover:text-red-500"><X className="w-3.5 h-3.5" /></button></TD>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-end gap-2 p-3">
            <button onClick={() => setDrafts([])} className="text-sm text-gray-500 px-4 py-2 border border-gray-200 rounded-lg">Discard</button>
            <button onClick={saveAll} disabled={saving || !drafts.some(d => d.name && d.balance)}
              className="flex items-center gap-1.5 bg-[#0c1e3a] hover:bg-[#0e2a4a] disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg">
              <Save className="w-3.5 h-3.5" /> {saving ? "Saving…" : `Save ${drafts.filter(d=>d.name&&d.balance).length} Debts`}
            </button>
          </div>
        </Card>
      )}

      {rows.length === 0 && drafts.length === 0 && (
        <Card className="p-8 text-center text-gray-400">No debts recorded yet.</Card>
      )}
      {rows.length > 0 && (
        <Card>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr><TH>Name</TH><TH>Type</TH><TH>Balance</TH><TH>Rate</TH><TH>Min Payment</TH><TH>Strategy</TH><TH></TH></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(d => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <TD><span className="font-medium text-gray-800">{d.name}</span></TD>
                  <TD><span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">{d.type.replace("_"," ")}</span></TD>
                  <TD right><span className="font-bold text-red-500">{fmt$(d.balance)}</span></TD>
                  <TD right>{fmtPct(d.interestRate)}</TD>
                  <TD right>{fmt$(d.minimumPayment)}</TD>
                  <TD><span className={`text-xs px-2 py-0.5 rounded-full ${d.payoffStrategy === "avalanche" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>{d.payoffStrategy}</span></TD>
                  <TD><button onClick={() => del(d.id)} className="text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button></TD>
                </tr>
              ))}
              <tr className="border-t-2 border-gray-300 bg-gray-50">
                <td colSpan={2} className="px-3 py-3 font-bold text-gray-900 text-sm">Total</td>
                <td className="px-3 py-3 text-right font-bold text-red-500 text-sm">{fmt$(totalDebt)}</td>
                <td colSpan={4}></td>
              </tr>
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}



















