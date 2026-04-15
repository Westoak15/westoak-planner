
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { Sidebar, type Tab } from "../components/Sidebar";
import { FinancialPlanningContent } from "./FinancialPlanning";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../lib/queryClient";
import { MonteCarloResults } from "../components/MonteCarloResults";
import { NetWorthTab as NetWorthTabNew, RetirementTab as RetirementTabNew, RespTab as RespTabNew, DebtTab as DebtTabNew, InsuranceTab as InsuranceTabNew } from "./MultiEntryTabs";         
import { InsuranceTab as FnaTabNew } from "./FinancialPlanning";
import { AdminPanel } from "./AdminPanel"
import { AgentsTab } from "./AgentsTab";
import { fmt$, fmtPct, initials, avatarBg, cn } from "../lib/utils";
import {
  Plus, Pencil, Trash2, X, Check, ChevronRight, Search,
  User, Users, Home, Calendar, Briefcase, LogOut, Save, KeyRound, Eye, EyeOff
 } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface Client { id: number; firstName: string; lastName: string; email: string | null; phone: string | null; dateOfBirth: string | null; province: string | null; occupation: string | null; employmentStatus: string | null; annualIncome: string | null; spouseFirstName: string | null; spouseLastName: string | null; spouseDateOfBirth: string | null; spouseOccupation: string | null; spouseAnnualIncome: string | null; spouseRetirementAge: number | null; spouseDesiredRetirementIncome: string | null; dependants: any; retirementAge: number | null; desiredRetirementIncome: string | null; notes: string | null; updatedAt: string; }
interface Plan { id: number; name: string; status: string; createdAt: string; }
interface NWEntry { id: number; type: string; category: string; name: string; value: string; notes: string | null; }
interface RetirementProj { id: number; label: string; currentAge: number | null; retirementAge: number | null; currentRrsp: string | null; currentTfsa: string | null; currentNonReg: string | null; annualContribution: string | null; expectedReturn: string | null; desiredIncome: string | null; cppStartAge: number | null; oasStartAge: number | null; cppMonthly: string | null; oasMonthly: string | null; projectedBalance: string | null; successRate: string | null; notes: string | null; }
interface InsuranceRec { id: number; method: string; annualIncome: string | null; yearsToReplace: number | null; existingLifeCoverage: string | null; existingDisability: string | null; existingCriticalIllness: string | null; recommendedLife: string | null; recommendedDisability: string | null; recommendedCriticalIllness: string | null; lifeGap: string | null; disabilityGap: string | null; criticalIllnessGap: string | null; notes: string | null; }
interface EduPlan { id: number; childName: string; childDob: string | null; currentRespBalance: string | null; annualContribution: string | null; targetAmount: string | null; projectedBalance: string | null; cespGrant: string | null; notes: string | null; }
interface DebtEntry { id: number; name: string; type: string; balance: string; interestRate: string | null; minimumPayment: string | null; payoffStrategy: string | null; notes: string | null; }
interface AiRec { id: number; category: string; priority: string; title: string; description: string | null; status: string; }
interface Overview { netWorth: number; totalAssets: number; totalLiabilities: number; totalDebt: number; retirementProjections: number; insuranceAnalyses: number; educationPlans: number; taxNotes: number; estateNotes: number; aiRecommendations: number; pendingAi: number; plans: number; }

const PROVINCES = ["AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT"];
const NW_ASSET_CATS = ["RRSP","TFSA","Non-Registered","Real Estate","Business","Pension","Cash/Bank","Other Asset"];
const NW_LIAB_CATS  = ["Mortgage","HELOC","Car Loan","Credit Card","Student Loan","Line of Credit","Other Liability"];
const DEBT_TYPES    = ["mortgage","heloc","car_loan","credit_card","student_loan","line_of_credit","other"];

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI components
// ─────────────────────────────────────────────────────────────────────────────
function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <p className="text-[11px] text-gray-400 uppercase tracking-wide font-medium mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value ?? "—"}</p>
    </div>
  );
}

function SectionHeader({ title, onAdd }: { title: string; onAdd?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-base font-bold text-gray-900">{title}</h2>
      {onAdd && (
        <button onClick={onAdd} className="flex items-center gap-1.5 text-sm font-semibold text-white bg-[#0c1e3a] hover:bg-[#0e2a4a] px-3 py-1.5 rounded-lg transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      )}
    </div>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("bg-white rounded-xl border border-gray-200 shadow-sm p-5", className)}>{children}</div>;
}

function Input({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500" />
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 bg-white">
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}


function DobInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  function handleChange(raw: string) {
    // Strip everything except digits
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    // Auto-insert dashes: YYYY-MM-DD
    let formatted = digits;
    if (digits.length > 4) formatted = digits.slice(0, 4) + "-" + digits.slice(4);
    if (digits.length > 6) formatted = digits.slice(0, 4) + "-" + digits.slice(4, 6) + "-" + digits.slice(6);
    onChange(formatted);
  }
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
      <input
        value={value}
        onChange={e => handleChange(e.target.value)}
        placeholder="YYYY-MM-DD"
        maxLength={10}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
      />
    </div>
  );
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={3}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 resize-none" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Clients Tab
// ─────────────────────────────────────────────────────────────────────────────
function ClientsTab({ onSelect }: { onSelect: (c: Client) => void }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch]   = useState("");
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm]       = useState({ firstName:"", lastName:"", email:"", phone:"", province:"ON" });
  const [busy, setBusy]       = useState(false);

  const load = useCallback(() => {
    const qs = search ? `?search=${encodeURIComponent(search)}` : "";
    api.get<Client[]>(`/api/clients${qs}`).then(setClients).finally(() => setLoading(false));
  }, [search]);

  useEffect(() => { load(); }, [load]);

  async function create() {
    setBusy(true);
    try { const c = await api.post<Client>("/api/clients", form); setClients(p => [c,...p]); setShowNew(false); setForm({ firstName:"",lastName:"",email:"",phone:"",province:"ON" }); }
    catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-400 mt-0.5">{clients.length} total</p>
        </div>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-1.5 bg-[#0c1e3a] hover:bg-[#0e2a4a] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add Client
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients…"
          className="w-full max-w-sm pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500" />
      </div>

      {showNew && (
        <Card className="mb-5">
          <h3 className="font-bold text-gray-800 mb-4">New Client</h3>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <Input label="First Name" value={form.firstName} onChange={v => setForm(f=>({...f,firstName:v}))} />
            <Input label="Last Name"  value={form.lastName}  onChange={v => setForm(f=>({...f,lastName:v}))} />
            <Input label="Phone"      value={form.phone}     onChange={v => setForm(f=>({...f,phone:v}))} />
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Input label="Email"    type="email" value={form.email} onChange={v => setForm(f=>({...f,email:v}))} />
            <Select label="Province" value={form.province} onChange={v => setForm(f=>({...f,province:v}))} options={PROVINCES} />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowNew(false)} className="text-sm text-gray-500 px-4 py-2">Cancel</button>
            <button onClick={create} disabled={busy||!form.firstName||!form.lastName} className="bg-[#0c1e3a] hover:bg-[#0e2a4a] disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg">
              {busy ? "Saving…" : "Add Client"}
            </button>
          </div>
        </Card>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Name</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Phone</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Email</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Province</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? <tr><td colSpan={5} className="text-center py-12 text-gray-400">Loading…</td></tr>
            : clients.length === 0 ? <tr><td colSpan={5} className="text-center py-16 text-gray-400">{search ? "No clients match" : "No clients yet — add your first client"}</td></tr>
            : clients.map(c => (
              <tr key={c.id} className="hover:bg-blue-50/30 cursor-pointer transition-colors" onClick={() => onSelect(c)}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full ${avatarBg(c.firstName+c.lastName)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                      {initials(c.firstName,c.lastName)}
                    </div>
                    <span className="font-semibold text-gray-900">{c.firstName} {c.lastName}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-gray-500">{c.phone ?? "—"}</td>
                <td className="px-5 py-3 text-blue-600">{c.email ?? "—"}</td>
                <td className="px-5 py-3 text-gray-500">{c.province ?? "—"}</td>
                <td className="px-3 py-3"><button onClick={e => { e.stopPropagation(); deletePlan(p.id); }} className="text-gray-300 hover:text-red-500 transition-colors p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                    <ChevronRight className="w-4 h-4 text-gray-300" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Client Detail — shown when a client is selected (name, family, plans)
// ─────────────────────────────────────────────────────────────────────────────
function ClientDetail({ client, onBack, onPlanSelect, onUpdate, level }: { client: Client; onBack: () => void; onPlanSelect: (p: Plan) => void; onUpdate: (c: Client) => void; level?: string }) {
  const [plans, setPlans]       = useState<Plan[]>([]);
  const [editing, setEditing]   = useState(false);
  const [form, setForm]         = useState<Partial<Client>>({ ...client });
  const [busy, setBusy]         = useState(false);
  const [newPlanName, setNewPlanName] = useState("Financial Plan");
  const u = (k: keyof Client, v: any) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    api.get<Plan[]>(`/api/clients/${client.id}/plans`).then(setPlans);
  }, [client.id]);

  async function save() {
  setBusy(true);
  try { const updated = await api.patch<Client>(`/api/clients/${client.id}`, form); setEditing(false); onUpdate(updated); }
  catch (e: any) { alert(e.message); }
  finally { setBusy(false); }
  }

  async function deletePlan(planId: number) {
    if (!confirm("Delete this plan? This cannot be undone.")) return;
    await api.delete(`/api/plans/${planId}`);
    setPlans(prev => prev.filter(p => p.id !== planId));
  }
   async function createPlan() {
     const p = await api.post<Plan>(`/api/clients/${client.id}/plans`, { name: level === "standard" ? "FNA" : newPlanName });
     setPlans(prev => [p, ...prev]);
     if (level === "standard") {
       onPlanSelect(p);
       // navigate to FNA tab after selecting plan
     } else {
       onPlanSelect(p);
     }
   }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Back + header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-700 transition-colors">
          <ChevronRight className="w-4 h-4 rotate-180" />
        </button>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full ${avatarBg(client.firstName+client.lastName)} flex items-center justify-center text-white font-bold`}>
            {initials(client.firstName, client.lastName)}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{client.firstName} {client.lastName}</h1>
            <p className="text-sm text-gray-400">{client.province} · {client.occupation ?? "Occupation not set"}</p>
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          {editing ? (
            <>
              <button onClick={() => { setEditing(false); setForm({...client}); }} className="text-sm text-gray-500 px-3 py-1.5 border border-gray-200 rounded-lg">Cancel</button>
              <button onClick={save} disabled={busy} className="flex items-center gap-1.5 text-sm text-white bg-[#0c1e3a] hover:bg-[#0e2a4a] px-3 py-1.5 rounded-lg disabled:opacity-50">
                <Save className="w-3.5 h-3.5" /> {busy ? "Saving…" : "Save"}
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg">
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5 mb-6">
        {/* Personal Info */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-[#0c1e3a]" />
            <h2 className="font-bold text-gray-900">Personal Information</h2>
          </div>
          {editing ? (
            <div className="grid grid-cols-2 gap-3">
              <Input label="First Name"  value={form.firstName ?? ""} onChange={v => u("firstName", v)} />
              <Input label="Last Name"   value={form.lastName ?? ""}  onChange={v => u("lastName", v)} />
              <Input label="Email" type="email" value={form.email ?? ""} onChange={v => u("email", v)} />
              <Input label="Phone"       value={form.phone ?? ""}     onChange={v => u("phone", v)} />
              <DobInput label="Date of Birth" value={form.dateOfBirth ?? ""} onChange={v => u("dateOfBirth", v)} />
              <Select label="Province"   value={form.province ?? "ON"} onChange={v => u("province", v)} options={PROVINCES} />
              <Input label="Occupation"  value={form.occupation ?? ""} onChange={v => u("occupation", v)} />
              <Input label="Annual Income" type="number" value={form.annualIncome ?? ""} onChange={v => u("annualIncome", v)} />
              <Input label="Retirement Age" type="number" value={String(form.retirementAge ?? "")} onChange={v => u("retirementAge", +v)} />
              <Input label="Desired Retirement Income" type="number" value={form.desiredRetirementIncome ?? ""} onChange={v => u("desiredRetirementIncome", v)} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-y-3 gap-x-5">
              <Field label="Email"     value={client.email} />
              <Field label="Phone"     value={client.phone} />
              <Field label="DOB"       value={client.dateOfBirth} />
              <Field label="Province"  value={client.province} />
              <Field label="Occupation" value={client.occupation} />
              <Field label="Annual Income" value={fmt$(client.annualIncome)} />
              <Field label="Retirement Age" value={client.retirementAge} />
              <Field label="Desired Income" value={fmt$(client.desiredRetirementIncome)} />
            </div>
          )}
        </Card>

        {/* Spouse / Family */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-[#0c1e3a]" />
            <h2 className="font-bold text-gray-900">Spouse / Family</h2>
          </div>
          {editing ? (
            <div className="grid grid-cols-2 gap-3">
              <Input label="Spouse First Name" value={form.spouseFirstName ?? ""} onChange={v => u("spouseFirstName", v)} />
              <Input label="Spouse Last Name"  value={form.spouseLastName ?? ""}  onChange={v => u("spouseLastName", v)} />
              <DobInput label="Spouse DOB" value={form.spouseDateOfBirth ?? ""} onChange={v => u("spouseDateOfBirth", v)} />
              <Input label="Spouse Occupation" value={form.spouseOccupation ?? ""} onChange={v => u("spouseOccupation", v)} />
              <Input label="Spouse Income" type="number" value={form.spouseAnnualIncome ?? ""} onChange={v => u("spouseAnnualIncome", v)} />
              <Input label="Spouse Retirement Age" type="number" value={String(form.spouseRetirementAge ?? "")} onChange={v => u("spouseRetirementAge", +v)} />
              <Input label="Spouse Desired Income" type="number" value={form.spouseDesiredRetirementIncome ?? ""} onChange={v => u("spouseDesiredRetirementIncome", v)} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-y-3 gap-x-5">
              <Field label="Name"       value={client.spouseFirstName ? `${client.spouseFirstName} ${client.spouseLastName}` : null} />
              <Field label="DOB"        value={client.spouseDateOfBirth} />
              <Field label="Occupation"        value={client.spouseOccupation} />
              <Field label="Income"            value={fmt$(client.spouseAnnualIncome)} />
              <Field label="Retirement Age"    value={client.spouseRetirementAge} />
              <Field label="Desired Income"    value={fmt$(client.spouseDesiredRetirementIncome)} />
            </div>
          )}
          {editing && (
            <div className="mt-4">
              <Textarea label="Notes" value={form.notes ?? ""} onChange={v => u("notes", v)} />
            </div>
          )}
        </Card>
      </div>

      {/* Plans */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-[#0c1e3a]" />
            <h2 className="font-bold text-gray-900">Financial Plans</h2>
          </div>
        </div>

        {plans.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400 text-sm mb-4">No plans yet — create one to start planning</p>
            {level === "standard" ? (
              <button onClick={createPlan}
                 className="bg-[#0c1e3a] hover:bg-[#0e2a4a] text-white text-sm font-semibold px-4 py-2 rounded-lg">
                 Create FNA
              </button>
            ) : (
              <div className="flex items-center gap-2 justify-center">
                 <input value={newPlanName} onChange={e => setNewPlanName(e.target.value)}
                   className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500" />
                 <button onClick={createPlan} className="bg-[#0c1e3a] hover:bg-[#0e2a4a] text-white text-sm font-semibold px-4 py-2 rounded-lg">
                   Create Plan
                 </button>
              </div>
             )}
            </div>
        ) : (
          <>
            <div className="divide-y divide-gray-100">
              {plans.map(p => (
                <div key={p.id} className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-5 px-5 cursor-pointer rounded-lg transition-colors" onClick={() => onPlanSelect(p)}>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{p.name}</p>
                    <p className="text-xs text-gray-400">{new Date(p.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{p.status}</span>
                    <button onClick={e => { e.stopPropagation(); deletePlan(p.id); }} className="text-gray-300 hover:text-red-500 transition-colors p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </div>
                </div>
              ))}
            </div>
              {level !== "standard" && (
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                  <input value={newPlanName} onChange={e => setNewPlanName(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500" />
                 <button onClick={createPlan} className="flex items-center gap-1 text-sm text-[#0c1e3a] border border-[#0c1e3a] hover:bg-[#0c1e3a] hover:text-white px-3 py-1.5 rounded-lg transition-colors font-semibold">
                   <Plus className="w-3.5 h-3.5" /> New Plan
                 </button>
                </div>
              )}
          </>
        )}
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Tab — summary for selected client + plan
// ─────────────────────────────────────────────────────────────────────────────
function DashboardTab({ clientId }: { clientId: number }) {
  const [ov, setOv] = useState<Overview | null>(null);
  useEffect(() => { api.get<Overview>(`/api/clients/${clientId}/overview`).then(setOv); }, [clientId]);
  if (!ov) return <div className="p-6 text-gray-400">Loading…</div>;

  const stats = [
    { label: "Net Worth",       value: fmt$(ov.netWorth),      color: ov.netWorth >= 0 ? "text-emerald-600" : "text-red-500", bg: ov.netWorth >= 0 ? "bg-emerald-50" : "bg-red-50" },
    { label: "Total Assets",    value: fmt$(ov.totalAssets),   color: "text-blue-600",   bg: "bg-blue-50" },
    { label: "Total Liabilities", value: fmt$(ov.totalLiabilities), color: "text-red-500", bg: "bg-red-50" },
    { label: "Total Debt",      value: fmt$(ov.totalDebt),     color: "text-orange-600", bg: "bg-orange-50" },
  ];

  const counts = [
    { label: "Retirement Plans",    value: ov.retirementProjections },
    { label: "Insurance Analyses",  value: ov.insuranceAnalyses },
    { label: "Education Plans",     value: ov.educationPlans },
    { label: "Tax Notes",           value: ov.taxNotes },
    { label: "Estate Notes",        value: ov.estateNotes },
    { label: "AI Recommendations",  value: ov.aiRecommendations },
    { label: "Pending AI Actions",  value: ov.pendingAi },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-xl font-bold text-gray-900 mb-5">Dashboard</h2>
      <div className="grid grid-cols-4 gap-4 mb-6">
        {stats.map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4 border border-white`}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-3">
        {counts.map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-2xl font-bold text-gray-900">{c.value}</p>
            <p className="text-xs text-gray-400 mt-1">{c.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Net Worth Tab — multiple assets AND liabilities
// ─────────────────────────────────────────────────────────────────────────────
function NetWorthTab({ clientId }: { clientId: number }) {
  const [entries, setEntries] = useState<NWEntry[]>([]);
  const [showForm, setShowForm] = useState<"asset"|"liability"|null>(null);
  const [form, setForm] = useState({ type:"asset", category:"RRSP", name:"", value:"", notes:"" });
  const [busy, setBusy] = useState(false);

  const load = () => api.get<NWEntry[]>(`/api/clients/${clientId}/net-worth`).then(setEntries);
  useEffect(() => { load(); }, [clientId]);

  const assets = entries.filter(e => e.type === "asset");
  const liabilities = entries.filter(e => e.type === "liability");
  const totalAssets = assets.reduce((s, e) => s + Number(e.value), 0);
  const totalLiab   = liabilities.reduce((s, e) => s + Number(e.value), 0);

  async function add() {
    setBusy(true);
    try { await api.post(`/api/clients/${clientId}/net-worth`, { ...form, type: showForm }); await load(); setShowForm(null); setForm({ type:"asset", category:"RRSP", name:"", value:"", notes:"" }); }
    catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  }

  async function del(id: number) {
    if (!confirm("Delete this entry?")) return;
    await api.delete(`/api/net-worth/${id}`); await load();
  }

  const EntryTable = ({ rows, type }: { rows: NWEntry[]; type: "asset"|"liability" }) => (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-bold text-gray-800">{type === "asset" ? "Assets" : "Liabilities"}</h3>
          <p className={`text-lg font-bold ${type === "asset" ? "text-emerald-600" : "text-red-500"}`}>{fmt$(type === "asset" ? totalAssets : totalLiab)}</p>
        </div>
        <button onClick={() => { setShowForm(type); setForm(f => ({...f, type, category: type === "asset" ? "RRSP" : "Mortgage"})); }}
          className="flex items-center gap-1.5 text-sm font-semibold text-white bg-[#0c1e3a] hover:bg-[#0e2a4a] px-3 py-1.5 rounded-lg">
          <Plus className="w-3.5 h-3.5" /> Add {type === "asset" ? "Asset" : "Liability"}
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="text-gray-400 text-sm py-4 text-center border border-dashed border-gray-200 rounded-xl">No {type}s added yet</p>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase">Category</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase">Name</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase">Value</th>
                <th className="w-8 px-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(e => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5"><span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full font-medium">{e.category}</span></td>
                  <td className="px-4 py-2.5 font-medium text-gray-800">{e.name}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{fmt$(e.value)}</td>
                  <td className="px-2 py-2.5">
                    <button onClick={() => del(e.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-emerald-50 rounded-xl p-4"><p className="text-xs text-gray-500 uppercase font-semibold">Total Assets</p><p className="text-2xl font-bold text-emerald-600 mt-1">{fmt$(totalAssets)}</p></div>
        <div className="bg-red-50 rounded-xl p-4"><p className="text-xs text-gray-500 uppercase font-semibold">Total Liabilities</p><p className="text-2xl font-bold text-red-500 mt-1">{fmt$(totalLiab)}</p></div>
        <div className={`${totalAssets - totalLiab >= 0 ? "bg-blue-50" : "bg-red-50"} rounded-xl p-4`}><p className="text-xs text-gray-500 uppercase font-semibold">Net Worth</p><p className={`text-2xl font-bold mt-1 ${totalAssets - totalLiab >= 0 ? "text-blue-600" : "text-red-500"}`}>{fmt$(totalAssets - totalLiab)}</p></div>
      </div>

      {showForm && (
        <Card className="mb-5">
          <h3 className="font-bold text-gray-800 mb-4">Add {showForm === "asset" ? "Asset" : "Liability"}</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Select label="Category" value={form.category} onChange={v => setForm(f=>({...f,category:v}))} options={showForm === "asset" ? NW_ASSET_CATS : NW_LIAB_CATS} />
            <Input label="Name / Description" value={form.name} onChange={v => setForm(f=>({...f,name:v}))} placeholder="e.g. TD Bank RRSP" />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Input label="Value ($)" type="number" value={form.value} onChange={v => setForm(f=>({...f,value:v}))} />
            <Input label="Notes (optional)" value={form.notes} onChange={v => setForm(f=>({...f,notes:v}))} />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(null)} className="text-sm text-gray-500 px-4 py-2">Cancel</button>
            <button onClick={add} disabled={busy||!form.name||!form.value} className="bg-[#0c1e3a] hover:bg-[#0e2a4a] disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg">
              {busy ? "Saving…" : "Add"}
            </button>
          </div>
        </Card>
      )}

      <div className="space-y-6">
        <Card><EntryTable rows={assets} type="asset" /></Card>
        <Card><EntryTable rows={liabilities} type="liability" /></Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Retirement Tab
// ─────────────────────────────────────────────────────────────────────────────
function RetirementTab({ clientId }: { clientId: number }) {
  const [rows, setRows]       = useState<RetirementProj[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);
  const [simulating, setSimulating] = useState(false);
  const [showSimSettings, setShowSimSettings] = useState(false);
  const [simSettings, setSimSettings] = useState({
    simulations: 1000,
    equityAllocation: 60,
    equityReturn: 7.0,
    equityStdDev: 12.0,
    bondReturn: 4.0,
    bondStdDev: 5.0,
    inflationRate: 2.5,
    lifeExpectancy: 90,
    guardrailFloor: 0.80,
    guardrailCeiling: 1.20,
    spendingFlexDown: 0.10,
    spendingFlexUp: 0.10,
  });
  const [form, setForm] = useState({
    label:"Base Case", currentAge:"", retirementAge:"", currentRrsp:"", currentTfsa:"",
    currentNonReg:"", annualContribution:"", expectedReturn:"6.5", inflationRate:"2.5",
    desiredIncome:"", cppStartAge:"65", oasStartAge:"65", cppMonthly:"900", oasMonthly:"700", notes:""
  });
  const [busy, setBusy] = useState(false);

  const load = () => api.get<RetirementProj[]>(`/api/clients/${clientId}/retirement`).then(setRows);
  useEffect(() => { load(); }, [clientId]);

  async function add() {
    setBusy(true);
    try { await api.post(`/api/clients/${clientId}/retirement`, form); await load(); setShowForm(false); }
    catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  }

  async function del(id: number) {
    if (!confirm("Delete this projection?")) return;
    await api.delete(`/api/retirement/${id}`); await load();
  }

  async function runSimulation() {
    setSimulating(true);
    try {
      const result = await api.post<any>(`/api/clients/${clientId}/simulate`, simSettings);
      setSimResult(result);
      await load(); // refresh to show updated success rate
    } catch (e: any) { alert(e.message); }
    finally { setSimulating(false); }
  }

  const ss = (k: string, v: any) => setSimSettings(s => ({ ...s, [k]: v }));

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {simResult && (
        <MonteCarloResults
          result={simResult}
          onClose={() => setSimResult(null)}
          onPrint={() => window.print()}
        />
      )}

      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-gray-900">Retirement Projections</h2>
        <div className="flex gap-2">
          <button onClick={() => setShowSimSettings(!showSimSettings)}
            className="text-sm font-semibold text-[#0c1e3a] border border-[#0c1e3a] hover:bg-[#0c1e3a] hover:text-white px-3 py-1.5 rounded-lg transition-colors">
            ⚙ Simulation Settings
          </button>
          <button onClick={runSimulation} disabled={simulating}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-1.5 rounded-lg">
            {simulating ? "Running…" : "▶ Run Monte Carlo"}
          </button>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 text-sm font-semibold text-white bg-[#0c1e3a] hover:bg-[#0e2a4a] px-3 py-1.5 rounded-lg">
            <Plus className="w-3.5 h-3.5" /> Add Projection
          </button>
        </div>
      </div>

      {showSimSettings && (
        <Card className="mb-5 border-indigo-200 bg-indigo-50/30">
          <h3 className="font-bold text-gray-800 mb-4">Monte Carlo Simulation Settings</h3>
          <div className="grid grid-cols-4 gap-3 mb-4">
            <Input label="Simulations" type="number" value={String(simSettings.simulations)} onChange={v => ss("simulations", +v)} />
            <Input label="Equity Allocation (%)" type="number" value={String(simSettings.equityAllocation)} onChange={v => ss("equityAllocation", +v)} />
            <Input label="Life Expectancy" type="number" value={String(simSettings.lifeExpectancy)} onChange={v => ss("lifeExpectancy", +v)} />
            <Input label="Inflation Rate (%)" type="number" value={String(simSettings.inflationRate)} onChange={v => ss("inflationRate", +v)} />
          </div>
          <div className="grid grid-cols-4 gap-3 mb-4">
            <Input label="Equity Return (%)" type="number" value={String(simSettings.equityReturn)} onChange={v => ss("equityReturn", +v)} />
            <Input label="Equity Std Dev (%)" type="number" value={String(simSettings.equityStdDev)} onChange={v => ss("equityStdDev", +v)} />
            <Input label="Bond Return (%)" type="number" value={String(simSettings.bondReturn)} onChange={v => ss("bondReturn", +v)} />
            <Input label="Bond Std Dev (%)" type="number" value={String(simSettings.bondStdDev)} onChange={v => ss("bondStdDev", +v)} />
          </div>
          <div className="border-t border-indigo-200 pt-4">
            <p className="text-xs font-bold text-indigo-700 uppercase tracking-wide mb-3">Guardrail Rules</p>
            <div className="grid grid-cols-4 gap-3">
              <Input label="Floor (% of target)" type="number" value={String(simSettings.guardrailFloor * 100)} onChange={v => ss("guardrailFloor", +v / 100)} />
              <Input label="Ceiling (% of target)" type="number" value={String(simSettings.guardrailCeiling * 100)} onChange={v => ss("guardrailCeiling", +v / 100)} />
              <Input label="Max Spending Cut (%)" type="number" value={String(simSettings.spendingFlexDown * 100)} onChange={v => ss("spendingFlexDown", +v / 100)} />
              <Input label="Max Spending Raise (%)" type="number" value={String(simSettings.spendingFlexUp * 100)} onChange={v => ss("spendingFlexUp", +v / 100)} />
            </div>
          </div>
        </Card>
      )}

      {showForm && (
        <Card className="mb-5">
          <h3 className="font-bold text-gray-800 mb-4">New Retirement Projection</h3>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <Input label="Scenario Label" value={form.label} onChange={v => setForm(f=>({...f,label:v}))} />
            <Input label="Current Age" type="number" value={form.currentAge} onChange={v => setForm(f=>({...f,currentAge:v}))} />
            <Input label="Target Retirement Age" type="number" value={form.retirementAge} onChange={v => setForm(f=>({...f,retirementAge:v}))} />
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <Input label="Current RRSP ($)" type="number" value={form.currentRrsp} onChange={v => setForm(f=>({...f,currentRrsp:v}))} />
            <Input label="Current TFSA ($)" type="number" value={form.currentTfsa} onChange={v => setForm(f=>({...f,currentTfsa:v}))} />
            <Input label="Non-Reg Balance ($)" type="number" value={form.currentNonReg} onChange={v => setForm(f=>({...f,currentNonReg:v}))} />
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <Input label="Annual Contribution ($)" type="number" value={form.annualContribution} onChange={v => setForm(f=>({...f,annualContribution:v}))} />
            <Input label="Expected Return (%)" type="number" value={form.expectedReturn} onChange={v => setForm(f=>({...f,expectedReturn:v}))} />
            <Input label="Inflation Rate (%)" type="number" value={form.inflationRate} onChange={v => setForm(f=>({...f,inflationRate:v}))} />
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <Input label="Desired Income ($)" type="number" value={form.desiredIncome} onChange={v => setForm(f=>({...f,desiredIncome:v}))} />
            <Input label="CPP Start Age" type="number" value={form.cppStartAge} onChange={v => setForm(f=>({...f,cppStartAge:v}))} />
            <Input label="CPP Monthly ($)" type="number" value={form.cppMonthly} onChange={v => setForm(f=>({...f,cppMonthly:v}))} />
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <Input label="OAS Start Age" type="number" value={form.oasStartAge} onChange={v => setForm(f=>({...f,oasStartAge:v}))} />
            <Input label="OAS Monthly ($)" type="number" value={form.oasMonthly} onChange={v => setForm(f=>({...f,oasMonthly:v}))} />
            <Input label="Notes" value={form.notes} onChange={v => setForm(f=>({...f,notes:v}))} />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 px-4 py-2">Cancel</button>
            <button onClick={add} disabled={busy} className="bg-[#0c1e3a] hover:bg-[#0e2a4a] disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg">{busy ? "Saving…" : "Add Projection"}</button>
          </div>
        </Card>
      )}

      {rows.length === 0 && !showForm ? (
        <Card>
          <p className="text-center text-gray-400 py-4">No projections yet — add one then click Run Monte Carlo.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {rows.map(p => (
            <Card key={p.id}>
              <div className="flex items-start justify-between mb-4">
                <h3 className="font-bold text-gray-900">{p.label}</h3>
                <div className="flex items-center gap-2">
                  {p.successRate && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${Number(p.successRate) >= 85 ? "bg-emerald-100 text-emerald-700" : Number(p.successRate) >= 70 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                      {p.successRate}% success
                    </span>
                  )}
                  <button onClick={() => del(p.id)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <Field label="Age → Retirement" value={p.currentAge && p.retirementAge ? `${p.currentAge} → ${p.retirementAge}` : null} />
                <Field label="RRSP"             value={fmt$(p.currentRrsp)} />
                <Field label="TFSA"             value={fmt$(p.currentTfsa)} />
                <Field label="Non-Reg"          value={fmt$(p.currentNonReg)} />
                <Field label="Annual Contribution" value={fmt$(p.annualContribution)} />
                <Field label="Expected Return"  value={fmtPct(p.expectedReturn)} />
                <Field label="Desired Income"   value={fmt$(p.desiredIncome)} />
                <Field label="Projected Balance (median)" value={fmt$(p.projectedBalance)} />
                <Field label="CPP" value={p.cppStartAge ? `${fmt$(p.cppMonthly)}/mo @ ${p.cppStartAge}` : null} />
                <Field label="OAS" value={p.oasStartAge ? `${fmt$(p.oasMonthly)}/mo @ ${p.oasStartAge}` : null} />
              </div>
              {p.notes && <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-100">{p.notes}</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Insurance Tab
// ─────────────────────────────────────────────────────────────────────────────
function InsuranceTab({ clientId }: { clientId: number }) {
  const [rows, setRows]     = useState<InsuranceRec[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]     = useState({ method:"dime", annualIncome:"", yearsToReplace:"20", existingLifeCoverage:"", existingDisability:"", existingCriticalIllness:"", notes:"" });
  const [busy, setBusy]     = useState(false);

  const load = () => api.get<InsuranceRec[]>(`/api/clients/${clientId}/insurance`).then(setRows);
  useEffect(() => { load(); }, [clientId]);

  async function add() {
    setBusy(true);
    try { await api.post(`/api/clients/${clientId}/insurance`, form); await load(); setShowForm(false); }
    catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  }

  async function del(id: number) {
    if (!confirm("Delete this analysis?")) return;
    await api.delete(`/api/insurance/${id}`); await load();
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <SectionHeader title="Insurance Analyses" onAdd={() => setShowForm(true)} />

      {showForm && (
        <Card className="mb-5">
          <h3 className="font-bold text-gray-800 mb-4">New Insurance Analysis</h3>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <Select label="Method" value={form.method} onChange={v => setForm(f=>({...f,method:v}))} options={["dime","hlv","needs"]} />
            <Input label="Annual Income ($)" type="number" value={form.annualIncome} onChange={v => setForm(f=>({...f,annualIncome:v}))} />
            <Input label="Years to Replace" type="number" value={form.yearsToReplace} onChange={v => setForm(f=>({...f,yearsToReplace:v}))} />
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <Input label="Existing Life Coverage ($)" type="number" value={form.existingLifeCoverage} onChange={v => setForm(f=>({...f,existingLifeCoverage:v}))} />
            <Input label="Existing Disability ($)" type="number" value={form.existingDisability} onChange={v => setForm(f=>({...f,existingDisability:v}))} />
            <Input label="Existing CI ($)" type="number" value={form.existingCriticalIllness} onChange={v => setForm(f=>({...f,existingCriticalIllness:v}))} />
          </div>
          <Textarea label="Notes" value={form.notes} onChange={v => setForm(f=>({...f,notes:v}))} />
          <div className="flex gap-2 justify-end mt-3">
            <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 px-4 py-2">Cancel</button>
            <button onClick={add} disabled={busy} className="bg-[#0c1e3a] hover:bg-[#0e2a4a] disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg">{busy ? "Saving…" : "Add Analysis"}</button>
          </div>
        </Card>
      )}

      {rows.length === 0 && !showForm ? (
        <Card><p className="text-center text-gray-400 py-8">No insurance analyses yet.</p></Card>
      ) : (
        <div className="space-y-4">
          {rows.map(a => (
            <Card key={a.id}>
              <div className="flex items-start justify-between mb-4">
                <div><span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full uppercase">{a.method}</span></div>
                <button onClick={() => del(a.id)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 font-semibold uppercase mb-2">Life Insurance</p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Existing</span><span className="font-medium">{fmt$(a.existingLifeCoverage)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Recommended</span><span className="font-medium">{fmt$(a.recommendedLife)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Gap</span><span className={`font-bold ${Number(a.lifeGap ?? 0) > 0 ? "text-red-500" : "text-emerald-600"}`}>{fmt$(a.lifeGap)}</span></div>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 font-semibold uppercase mb-2">Disability</p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Existing</span><span className="font-medium">{fmt$(a.existingDisability)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Recommended</span><span className="font-medium">{fmt$(a.recommendedDisability)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Gap</span><span className={`font-bold ${Number(a.disabilityGap ?? 0) > 0 ? "text-red-500" : "text-emerald-600"}`}>{fmt$(a.disabilityGap)}</span></div>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 font-semibold uppercase mb-2">Critical Illness</p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Existing</span><span className="font-medium">{fmt$(a.existingCriticalIllness)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Recommended</span><span className="font-medium">{fmt$(a.recommendedCriticalIllness)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Gap</span><span className={`font-bold ${Number(a.criticalIllnessGap ?? 0) > 0 ? "text-red-500" : "text-emerald-600"}`}>{fmt$(a.criticalIllnessGap)}</span></div>
                  </div>
                </div>
              </div>
              {a.notes && <p className="text-xs text-gray-500 pt-3 border-t border-gray-100">{a.notes}</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RESP Tab
// ─────────────────────────────────────────────────────────────────────────────
function RespTab({ clientId }: { clientId: number }) {
  const [rows, setRows]     = useState<EduPlan[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]     = useState({ childName:"", childDob:"", currentRespBalance:"", annualContribution:"", targetAmount:"", notes:"" });
  const [busy, setBusy]     = useState(false);

  const load = () => api.get<EduPlan[]>(`/api/clients/${clientId}/education`).then(setRows);
  useEffect(() => { load(); }, [clientId]);

  async function add() {
    setBusy(true);
    try { await api.post(`/api/clients/${clientId}/education`, form); await load(); setShowForm(false); }
    catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  }

  async function del(id: number) {
    if (!confirm("Delete?")) return;
    await api.delete(`/api/education/${id}`); await load();
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <SectionHeader title="RESP / Education Savings" onAdd={() => setShowForm(true)} />

      {showForm && (
        <Card className="mb-5">
          <h3 className="font-bold text-gray-800 mb-4">Add Child / RESP</h3>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <Input label="Child's Name"  value={form.childName}  onChange={v => setForm(f=>({...f,childName:v}))} />
            <DobInput label="Date of Birth" value={form.childDob} onChange={v => setForm(f=>({...f,childDob:v}))} />
            <Input label="Current RESP Balance ($)" type="number" value={form.currentRespBalance} onChange={v => setForm(f=>({...f,currentRespBalance:v}))} />
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <Input label="Annual Contribution ($)" type="number" value={form.annualContribution} onChange={v => setForm(f=>({...f,annualContribution:v}))} />
            <Input label="Target Amount ($)" type="number" value={form.targetAmount} onChange={v => setForm(f=>({...f,targetAmount:v}))} />
            <Input label="Notes" value={form.notes} onChange={v => setForm(f=>({...f,notes:v}))} />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 px-4 py-2">Cancel</button>
            <button onClick={add} disabled={busy||!form.childName} className="bg-[#0c1e3a] hover:bg-[#0e2a4a] disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg">{busy ? "Saving…" : "Add"}</button>
          </div>
        </Card>
      )}

      {rows.length === 0 && !showForm ? (
        <Card><p className="text-center text-gray-400 py-8">No RESP plans yet. Add a child to get started.</p></Card>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {rows.map(e => (
            <Card key={e.id}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-900">{e.childName}</h3>
                <button onClick={() => del(e.id)} className="text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date of Birth"       value={e.childDob} />
                <Field label="Current Balance"     value={fmt$(e.currentRespBalance)} />
                <Field label="Annual Contribution" value={fmt$(e.annualContribution)} />
                <Field label="Target"              value={fmt$(e.targetAmount)} />
                <Field label="Projected Balance"   value={fmt$(e.projectedBalance)} />
                <Field label="CESG Grant"           value={fmt$(e.cespGrant)} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Debt Tab
// ─────────────────────────────────────────────────────────────────────────────
function DebtTab({ clientId }: { clientId: number }) {
  const [rows, setRows]     = useState<DebtEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]     = useState({ name:"", type:"credit_card", balance:"", interestRate:"", minimumPayment:"", payoffStrategy:"avalanche", notes:"" });
  const [busy, setBusy]     = useState(false);

  const load = () => api.get<DebtEntry[]>(`/api/clients/${clientId}/debt`).then(setRows);
  useEffect(() => { load(); }, [clientId]);

  const totalDebt = rows.reduce((s, d) => s + Number(d.balance), 0);

  async function add() {
    setBusy(true);
    try { await api.post(`/api/clients/${clientId}/debt`, form); await load(); setShowForm(false); }
    catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  }

  async function del(id: number) {
    if (!confirm("Delete?")) return;
    await api.delete(`/api/debt/${id}`); await load();
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Debt &amp; Cash Flow</h2>
          {rows.length > 0 && <p className="text-sm text-red-500 font-semibold">Total: {fmt$(totalDebt)}</p>}
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 text-sm font-semibold text-white bg-[#0c1e3a] hover:bg-[#0e2a4a] px-3 py-1.5 rounded-lg">
          <Plus className="w-3.5 h-3.5" /> Add Debt
        </button>
      </div>

      {showForm && (
        <Card className="mb-5">
          <h3 className="font-bold text-gray-800 mb-4">Add Debt</h3>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <Input label="Name" value={form.name} onChange={v => setForm(f=>({...f,name:v}))} placeholder="e.g. TD Visa" />
            <Select label="Type" value={form.type} onChange={v => setForm(f=>({...f,type:v}))} options={DEBT_TYPES} />
            <Input label="Balance ($)" type="number" value={form.balance} onChange={v => setForm(f=>({...f,balance:v}))} />
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <Input label="Interest Rate (%)" type="number" value={form.interestRate} onChange={v => setForm(f=>({...f,interestRate:v}))} />
            <Input label="Minimum Payment ($)" type="number" value={form.minimumPayment} onChange={v => setForm(f=>({...f,minimumPayment:v}))} />
            <Select label="Strategy" value={form.payoffStrategy} onChange={v => setForm(f=>({...f,payoffStrategy:v}))} options={["avalanche","snowball"]} />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 px-4 py-2">Cancel</button>
            <button onClick={add} disabled={busy||!form.name||!form.balance} className="bg-[#0c1e3a] hover:bg-[#0e2a4a] disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg">{busy ? "Saving…" : "Add Debt"}</button>
          </div>
        </Card>
      )}

      {rows.length === 0 && !showForm ? (
        <Card><p className="text-center text-gray-400 py-8">No debts recorded yet.</p></Card>
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200">
              <tr>
                <th className="text-left py-2.5 text-xs font-semibold text-gray-400 uppercase">Name</th>
                <th className="text-left py-2.5 text-xs font-semibold text-gray-400 uppercase">Type</th>
                <th className="text-right py-2.5 text-xs font-semibold text-gray-400 uppercase">Balance</th>
                <th className="text-right py-2.5 text-xs font-semibold text-gray-400 uppercase">Rate</th>
                <th className="text-right py-2.5 text-xs font-semibold text-gray-400 uppercase">Min Payment</th>
                <th className="text-left py-2.5 text-xs font-semibold text-gray-400 uppercase pl-4">Strategy</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(d => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="py-3 font-medium text-gray-800">{d.name}</td>
                  <td className="py-3"><span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">{d.type.replace("_"," ")}</span></td>
                  <td className="py-3 text-right font-semibold text-red-500">{fmt$(d.balance)}</td>
                  <td className="py-3 text-right text-gray-600">{fmtPct(d.interestRate)}</td>
                  <td className="py-3 text-right text-gray-600">{fmt$(d.minimumPayment)}</td>
                  <td className="py-3 pl-4"><span className={`text-xs px-2 py-0.5 rounded-full ${d.payoffStrategy === "avalanche" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>{d.payoffStrategy}</span></td>
                  <td className="py-3 pl-2"><button onClick={() => del(d.id)} className="text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button></td>
                </tr>
              ))}
              <tr className="border-t-2 border-gray-300">
                <td colSpan={2} className="py-3 font-bold text-gray-900">Total</td>
                <td className="py-3 text-right font-bold text-red-500">{fmt$(totalDebt)}</td>
                <td colSpan={4}></td>
              </tr>
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tax Tab
// ─────────────────────────────────────────────────────────────────────────────
function TaxTab({ clientId }: { clientId: number }) {
  const [notes, setNotes] = useState<any[]>([]);
  const [form, setForm]   = useState({ subTab:"notes", content:"" });
  const [busy, setBusy]   = useState(false);

  const load = () => api.get<any[]>(`/api/clients/${clientId}/tax`).then(setNotes);
  useEffect(() => { load(); }, [clientId]);

  const TAX_SUBTABS = ["notes","rrsp_room","tfsa_room","tax_projection","capital_gains","income_splitting"];

  async function save() {
    setBusy(true);
    try { await api.post(`/api/clients/${clientId}/tax`, form); await load(); setForm(f=>({...f,content:""})); }
    catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  }

  async function del(id: number) {
    if (!confirm("Delete?")) return;
    await api.delete(`/api/tax/${id}`); await load();
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-xl font-bold text-gray-900 mb-5">Tax Planning</h2>

      <Card className="mb-5">
        <h3 className="font-bold text-gray-800 mb-4">Add Tax Note / Analysis</h3>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Select label="Section" value={form.subTab} onChange={v => setForm(f=>({...f,subTab:v}))} options={TAX_SUBTABS} />
        </div>
        <Textarea label="Notes / Content" value={form.content} onChange={v => setForm(f=>({...f,content:v}))} />
        <div className="flex justify-end mt-3">
          <button onClick={save} disabled={busy||!form.content} className="bg-[#0c1e3a] hover:bg-[#0e2a4a] disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg">{busy ? "Saving…" : "Save Note"}</button>
        </div>
      </Card>

      <div className="space-y-3">
        {notes.map(n => (
          <Card key={n.id}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full uppercase mb-2 inline-block">{n.subTab.replace("_"," ")}</span>
                <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{n.content}</p>
              </div>
              <button onClick={() => del(n.id)} className="text-gray-300 hover:text-red-500 ml-3"><Trash2 className="w-4 h-4" /></button>
            </div>
          </Card>
        ))}
        {notes.length === 0 && <p className="text-center text-gray-400 py-8">No tax notes yet.</p>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Estate Tab
// ─────────────────────────────────────────────────────────────────────────────
function EstateTab({ clientId }: { clientId: number }) {
  const [data, setData]   = useState<any | null>(null);
  const [form, setForm]   = useState({ content:"", hasWill:false, hasPoa:false, hasHcDirective:false });
  const [busy, setBusy]   = useState(false);

  useEffect(() => {
    api.get<any>(`/api/clients/${clientId}/estate`).then(d => {
      if (d) { setData(d); setForm({ content: d.content ?? "", hasWill: d.hasWill ?? false, hasPoa: d.hasPoa ?? false, hasHcDirective: d.hasHcDirective ?? false }); }
    });
  }, [clientId]);

  async function save() {
    setBusy(true);
    try { const r = await api.put<any>(`/api/clients/${clientId}/estate`, form); setData(r); }
    catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  }

  const Check = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500" />
      <span className="text-sm font-medium text-gray-700">{label}</span>
    </label>
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-xl font-bold text-gray-900 mb-5">Estate Planning</h2>
      <Card>
        <div className="grid grid-cols-3 gap-4 mb-5 p-4 bg-gray-50 rounded-xl">
          <Check label="Has Will"        checked={form.hasWill}        onChange={v => setForm(f=>({...f,hasWill:v}))} />
          <Check label="Has POA"         checked={form.hasPoa}         onChange={v => setForm(f=>({...f,hasPoa:v}))} />
          <Check label="HC Directive"    checked={form.hasHcDirective} onChange={v => setForm(f=>({...f,hasHcDirective:v}))} />
        </div>
        <Textarea label="Estate Planning Notes" value={form.content} onChange={v => setForm(f=>({...f,content:v}))} />
        <div className="flex justify-end mt-3">
          <button onClick={save} disabled={busy} className="bg-[#0c1e3a] hover:bg-[#0e2a4a] disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg">{busy ? "Saving…" : "Save"}</button>
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Tab
// ─────────────────────────────────────────────────────────────────────────────
function AiTab({ clientId }: { clientId: number }) {
  const [recs, setRecs]   = useState<AiRec[]>([]);
  const [busy, setBusy]   = useState(false);

  const load = () => api.get<AiRec[]>(`/api/clients/${clientId}/ai`).then(setRecs);
  useEffect(() => { load(); }, [clientId]);

  async function generate() {
    setBusy(true);
    try { await api.post(`/api/clients/${clientId}/ai/generate`); await load(); }
    catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  }

  async function updateStatus(id: number, status: string) {
    await api.patch(`/api/ai/${id}`, { status }); await load();
  }

  async function del(id: number) {
    await api.delete(`/api/ai/${id}`); await load();
  }

  const PRIORITY_COLORS: Record<string, string> = { high: "bg-red-100 text-red-700", medium: "bg-amber-100 text-amber-700", low: "bg-gray-100 text-gray-600" };
  const STATUS_COLORS: Record<string, string> = { pending: "bg-yellow-100 text-yellow-700", in_progress: "bg-blue-100 text-blue-700", completed: "bg-emerald-100 text-emerald-700", dismissed: "bg-gray-100 text-gray-400" };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-gray-900">AI Insights & Recommendations</h2>
        <button onClick={generate} disabled={busy} className="flex items-center gap-1.5 bg-[#0c1e3a] hover:bg-[#0e2a4a] disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg">
          {busy ? "Generating…" : "✦ Generate Insights"}
        </button>
      </div>

      {recs.length === 0 ? (
        <Card><p className="text-center text-gray-400 py-8">No recommendations yet. Click Generate Insights to analyse this client's plan.</p></Card>
      ) : (
        <div className="space-y-3">
          {recs.map(r => (
            <Card key={r.id}>
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PRIORITY_COLORS[r.priority] ?? "bg-gray-100 text-gray-600"}`}>{r.priority}</span>
                    <span className="bg-indigo-100 text-indigo-700 text-xs font-semibold px-2 py-0.5 rounded-full">{r.category}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status] ?? "bg-gray-100 text-gray-600"}`}>{r.status}</span>
                  </div>
                  <p className="font-semibold text-gray-900 text-sm mb-1">{r.title}</p>
                  {r.description && <p className="text-xs text-gray-500">{r.description}</p>}
                </div>
                <div className="flex items-center gap-1">
                  {r.status === "pending" && (
                    <>
                      <button onClick={() => updateStatus(r.id, "completed")} title="Mark complete" className="text-gray-300 hover:text-emerald-500 transition-colors"><Check className="w-4 h-4" /></button>
                      <button onClick={() => updateStatus(r.id, "dismissed")} title="Dismiss" className="text-gray-300 hover:text-gray-500 transition-colors"><X className="w-4 h-4" /></button>
                    </>
                  )}
                  <button onClick={() => del(r.id)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Overview Tab
// ─────────────────────────────────────────────────────────────────────────────
function OverviewTab({ clientId, onTabChange }: { clientId: number; onTabChange: (t: Tab) => void }) {
  const [ov, setOv] = useState<Overview | null>(null);
  useEffect(() => { api.get<Overview>(`/api/clients/${clientId}/overview`).then(setOv); }, [clientId]);
  if (!ov) return <div className="p-6 text-gray-400">Loading…</div>;

  const cards = [
    { label: "Net Worth",        value: fmt$(ov.netWorth),        color: ov.netWorth >= 0 ? "text-emerald-600":"text-red-500",  bg: ov.netWorth >= 0 ? "bg-emerald-50":"bg-red-50",   tab: "networth" as Tab },
    { label: "Total Assets",     value: fmt$(ov.totalAssets),     color: "text-blue-600",   bg: "bg-blue-50",    tab: "networth" as Tab },
    { label: "Total Liabilities",value: fmt$(ov.totalLiabilities),color: "text-red-500",    bg: "bg-red-50",     tab: "networth" as Tab },
    { label: "Total Debt",       value: fmt$(ov.totalDebt),       color: "text-orange-600", bg: "bg-orange-50",  tab: "debt" as Tab },
    { label: "Retirement Plans", value: String(ov.retirementProjections), color: "text-violet-600", bg: "bg-violet-50", tab: "retirement" as Tab },
    { label: "Insurance Analyses",value: String(ov.insuranceAnalyses), color: "text-purple-600", bg: "bg-purple-50", tab: "insurance" as Tab },
    { label: "Education Plans",  value: String(ov.educationPlans),color: "text-teal-600",   bg: "bg-teal-50",    tab: "resp" as Tab },
    { label: "AI Recommendations",value: String(ov.aiRecommendations),color: "text-pink-600",bg: "bg-pink-50",  tab: "ai" as Tab },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-xl font-bold text-gray-900 mb-5">Financial Overview</h2>
      <div className="grid grid-cols-4 gap-4">
        {cards.map(c => (
          <button key={c.label} onClick={() => onTabChange(c.tab)}
            className={`${c.bg} rounded-xl p-4 text-left hover:opacity-90 transition-opacity border border-white hover:shadow-sm`}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{c.label}</p>
            <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
            <p className="text-[10px] text-gray-400 mt-1">Click to view →</p>
          </button>
        ))}
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Change Password Modal
// ─────────────────────────────────────────────────────────────────────────────
function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [form, setForm]     = useState({ current:"", next:"", confirm:"" });
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState("");
  const [success, setSuccess] = useState(false);

  const rules = [
    { label: "At least 8 characters",          ok: form.next.length >= 8 },
    { label: "At least one uppercase letter",  ok: /[A-Z]/.test(form.next) },
    { label: "At least one lowercase letter",  ok: /[a-z]/.test(form.next) },
    { label: "At least one number",            ok: /\d/.test(form.next) },
    { label: "At least one special character", ok: /[^A-Za-z0-9]/.test(form.next) },
  ];
  const pwOk  = rules.every(r => r.ok);
  const match = form.next === form.confirm && form.confirm.length > 0;

  async function save() {
    if (!pwOk)  return setError("Password does not meet requirements.");
    if (!match) return setError("Passwords do not match.");
    setError(""); setBusy(true);
    try {
      await api.post("/api/auth/change-password", { currentPassword: form.current, newPassword: form.next });
      setSuccess(true);
      setTimeout(onClose, 1500);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  const INPUT = "w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm pr-11 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500";

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-7">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">Change Password</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {success ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Check className="w-6 h-6 text-emerald-600" />
            </div>
            <p className="font-semibold text-emerald-700">Password changed successfully!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Current password */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Current Password</label>
              <div className="relative">
                <input type={showCur ? "text" : "password"} value={form.current}
                  onChange={e => setForm(f=>({...f,current:e.target.value}))}
                  placeholder="Enter current password"
                  className={INPUT} />
                <button type="button" onClick={() => setShowCur(s=>!s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showCur ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New password */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">New Password</label>
              <div className="relative">
                <input type={showNew ? "text" : "password"} value={form.next}
                  onChange={e => setForm(f=>({...f,next:e.target.value}))}
                  placeholder="Enter new password"
                  className={INPUT} />
                <button type="button" onClick={() => setShowNew(s=>!s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* Requirements */}
              {form.next && (
                <div className="mt-2 grid grid-cols-1 gap-1">
                  {rules.map(r => (
                    <div key={r.label} className="flex items-center gap-1.5">
                      {r.ok
                        ? <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                        : <X className="w-3 h-3 text-gray-300 flex-shrink-0" />}
                      <span className={`text-xs ${r.ok ? "text-emerald-600" : "text-gray-400"}`}>{r.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Confirm */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Confirm New Password</label>
              <input type="password" value={form.confirm}
                onChange={e => setForm(f=>({...f,confirm:e.target.value}))}
                placeholder="Confirm new password"
                className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 ${form.confirm && !match ? "border-red-300" : "border-gray-200"}`} />
              {form.confirm && !match && <p className="text-xs text-red-500 mt-1">Passwords do not match</p>}
              {form.confirm && match  && <p className="text-xs text-emerald-600 mt-1">✓ Passwords match</p>}
            </div>

            {error && <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button onClick={onClose} className="flex-1 text-sm text-gray-500 border border-gray-200 py-2.5 rounded-xl hover:bg-gray-50">Cancel</button>
              <button onClick={save} disabled={busy || !pwOk || !match || !form.current}
                className="flex-1 bg-[#0c1e3a] hover:bg-[#0e2a4a] disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl">
                {busy ? "Saving…" : "Change Password"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const { user, logout } = useAuth();
  const role = user?.role ?? "fa";
  const level = user?.level ?? "standard";
  const [showChangePw, setShowChangePw] = useState(false);
  const [tab, setTab] = useState<Tab>(user?.role === "ga" ? "agents" : "clients");
  const [client, setClient]       = useState<Client | null>(null);
  const [plan, setPlan]           = useState<Plan | null>(null);
  const [showClientDetail, setShowClientDetail] = useState(false);

  function selectClient(c: Client) {
    setClient(c);
    setPlan(null);
    setShowClientDetail(true);
  }

  function selectPlan(p: Plan) {
    setPlan(p);
    setShowClientDetail(false);
    setTab(level === "standard" ? "fna" : "planning");
  }

  function backToClients() {
    setShowClientDetail(false);
    setTab("agents");
  }

  const clientName = client ? `${client.firstName} ${client.lastName}` : undefined;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar activeTab={tab} onTab={t => { if (t === "clients") { setShowClientDetail(false); } setTab(t as any); }} clientName={clientName} role={role} level={level} />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex-shrink-0 h-11 bg-white border-b border-gray-200 flex items-center px-5 justify-between">
          <div className="flex items-center gap-3">
            {client && (
              <>
                <div className={`w-6 h-6 rounded-full ${avatarBg(client.firstName+client.lastName)} flex items-center justify-center text-white text-[10px] font-bold`}>
                  {initials(client.firstName, client.lastName)}
                </div>
                <span className="text-sm font-semibold text-gray-800">{client.firstName} {client.lastName}</span>
                {plan && <><span className="text-gray-300">·</span><span className="text-sm text-gray-500">{plan.name}</span></>}
              </>
            )}
            {!client && <span className="text-sm font-semibold text-gray-500">Financial Planning</span>}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">{user?.firmName ?? `${user?.firstName} ${user?.lastName}`}</span>
            <button onClick={() => setShowChangePw(true)} title="Change password" className="text-gray-300 hover:text-gray-600 transition-colors">
              <KeyRound className="w-4 h-4" />
            </button>
            <button onClick={() => { setTab("agents"); logout(); }} title="Sign out" className="text-gray-300 hover:text-gray-600 transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {tab === "clients" && !showClientDetail && (
            <ClientsTab onSelect={selectClient} />
          )}
          {tab === "clients" && showClientDetail && client && (
            <ClientDetail client={client} onBack={backToClients} onPlanSelect={selectPlan} onUpdate={setClient} level={level} />
          )}
          {tab !== "admin" && tab !== "agents" && tab !== "clients" && !client && (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-gray-400" />
              </div>
              <h2 className="text-lg font-bold text-gray-700 mb-1">Select a Client</h2>
              <p className="text-sm text-gray-400 mb-4">Choose a client from the Clients tab to view their financial plan</p>
              <button onClick={() => setTab("agents")} className="text-sm font-semibold text-white bg-[#0c1e3a] hover:bg-[#0e2a4a] px-4 py-2 rounded-lg">
                Go to Clients
              </button>
            </div>
          )}
          {tab === "planning" && client && (
            <QueryClientProvider client={queryClient}>
              <FinancialPlanningContent initialClientId={client.id} />
            </QueryClientProvider>
          )}
          {tab === "networth"   && client && <NetWorthTabNew   clientId={client.id} client={client} />}
          {tab === "retirement" && client && <RetirementTabNew clientId={client.id} />}
          {tab === "insurance"  && client && <InsuranceTabNew  clientId={client.id} />}
          {tab === "fna"        && client && (
            <QueryClientProvider client={queryClient}>
            <FnaTabNew clientId={client.id} planId={null} client={client} />
            </QueryClientProvider>
          )}
          {tab === "admin" && <AdminPanel />}
          {tab === "agents" && <AgentsTab />}
          {tab === "resp"       && client && <RespTabNew       clientId={client.id} />}
          {tab === "debt"       && client && <DebtTabNew       clientId={client.id} />}
          {tab === "dashboard"  && client && <DashboardTab     clientId={client.id} />}
        </div>
      </div>
    </div>
  );
}
























