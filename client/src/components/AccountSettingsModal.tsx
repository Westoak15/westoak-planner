/**
 * AccountSettingsModal.tsx
 * Account settings modal — jurisdiction (CA/US) + firm name.
 * Place next to ChangePasswordModal in client/src/components/
 *
 * The jurisdiction setting drives:
 *   - Province vs State dropdowns on all client forms
 *   - CA vs US tax planning tabs
 *   - All new clients inherit the agent's jurisdiction automatically
 */

import { useState } from "react";
import { X, Globe, Save, Loader2, CheckCircle } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

// ── Jurisdiction config ───────────────────────────────────────────────────────

export type Jurisdiction = "CA" | "US";

export const JURISDICTION_OPTIONS = [
  {
    value: "CA" as Jurisdiction,
    label: "Canada",
    flag: "🇨🇦",
    description: "RRSP, TFSA, CPP/OAS, provincial tax brackets",
    accounts: ["RRSP", "TFSA", "RESP", "RRIF"],
    benefits: ["CPP", "OAS"],
    taxLabel: "Province",
  },
  {
    value: "US" as Jurisdiction,
    label: "United States",
    flag: "🇺🇸",
    description: "401(k), IRA/Roth, Social Security, state tax brackets",
    accounts: ["401(k)", "IRA", "Roth IRA", "HSA"],
    benefits: ["Social Security", "Medicare"],
    taxLabel: "State",
  },
];

export const CA_PROVINCES = [
  { code: "AB", name: "Alberta" },
  { code: "BC", name: "British Columbia" },
  { code: "MB", name: "Manitoba" },
  { code: "NB", name: "New Brunswick" },
  { code: "NL", name: "Newfoundland & Labrador" },
  { code: "NS", name: "Nova Scotia" },
  { code: "NT", name: "Northwest Territories" },
  { code: "NU", name: "Nunavut" },
  { code: "ON", name: "Ontario" },
  { code: "PE", name: "Prince Edward Island" },
  { code: "QC", name: "Quebec" },
  { code: "SK", name: "Saskatchewan" },
  { code: "YT", name: "Yukon" },
];

export const US_STATES = [
  { code: "AL", name: "Alabama" },        { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },        { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },     { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },    { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },        { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },         { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },       { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },           { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },       { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },          { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },      { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },       { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },       { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },     { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" }, { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },           { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },         { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },   { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },   { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },          { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },        { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },     { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },      { code: "WY", name: "Wyoming" },
];

export const US_FILING_STATUSES = [
  { value: "single", label: "Single" },
  { value: "mfj",    label: "Married Filing Jointly" },
  { value: "mfs",    label: "Married Filing Separately" },
  { value: "hoh",    label: "Head of Household" },
];

// ── Hook: get current agent jurisdiction ──────────────────────────────────────

export function useAgentJurisdiction(): Jurisdiction {
  const { user } = useAuth();
  return ((user as any)?.jurisdiction as Jurisdiction) ?? "CA";
}

/** Returns the correct province/state list for a given jurisdiction */
export function getRegionList(jurisdiction: Jurisdiction) {
  return jurisdiction === "US" ? US_STATES : CA_PROVINCES;
}

/** Returns the default region code for a given jurisdiction */
export function getDefaultRegion(jurisdiction: Jurisdiction): string {
  return jurisdiction === "US" ? "CA" : "ON";
}

/** Label for the region field */
export function getRegionLabel(jurisdiction: Jurisdiction): string {
  return jurisdiction === "US" ? "State" : "Province";
}

/** Returns jurisdiction-aware account labels */
export function getAccountLabels(jurisdiction: Jurisdiction) {
  if (jurisdiction === "US") {
    return {
      registeredLabel:   "Pre-Tax (401k/IRA)",
      taxFreeLabel:      "Roth IRA",
      educationLabel:    "529 Plan",
      governmentBenefit: "Social Security",
      mandatoryWithdraw: "RMD",
      roomCalc:          "401(k) Room",
      taxFreeCalc:       "IRA / Roth",
    };
  }
  return {
    registeredLabel:   "RRSP",
    taxFreeLabel:      "TFSA",
    educationLabel:    "RESP",
    governmentBenefit: "CPP / OAS",
    mandatoryWithdraw: "RRIF",
    roomCalc:          "RRSP Room",
    taxFreeCalc:       "TFSA Room",
  };
}

// ── AccountSettingsModal ──────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
}

export function AccountSettingsModal({ onClose }: Props) {
  const { user, refreshUser } = useAuth();
  const currentJurisdiction = ((user as any)?.jurisdiction as Jurisdiction) ?? "CA";

  const [jurisdiction, setJurisdiction] = useState<Jurisdiction>(currentJurisdiction);
  const [firmName, setFirmName]         = useState((user as any)?.firmName ?? "");
  const [loading, setLoading]           = useState(false);
  const [saved, setSaved]               = useState(false);
  const [error, setError]               = useState("");

  const isDirty = jurisdiction !== currentJurisdiction || firmName !== ((user as any)?.firmName ?? "");

  const save = async () => {
    setLoading(true); setError("");
    try {
      await api.patch("/api/auth/me", { jurisdiction, firmName: firmName || null });
      await refreshUser();
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 1200);
    } catch (e: any) {
      setError(e.message ?? "Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  const selected = JURISDICTION_OPTIONS.find(o => o.value === jurisdiction)!;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold text-slate-900">Account Settings</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* Firm name */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Firm Name
            </label>
            <input
              type="text"
              value={firmName}
              onChange={e => setFirmName(e.target.value)}
              placeholder="Your firm name"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Jurisdiction selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Planning Jurisdiction
            </label>
            <p className="text-xs text-slate-400 mb-3">
              All new clients will inherit this setting. Existing clients keep their current jurisdiction.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {JURISDICTION_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setJurisdiction(opt.value)}
                  className={`relative flex flex-col items-start p-4 rounded-xl border-2 text-left transition-all ${
                    jurisdiction === opt.value
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span className="text-2xl mb-2">{opt.flag}</span>
                  <span className="text-sm font-bold text-slate-900">{opt.label}</span>
                  <span className="text-xs text-slate-500 mt-1 leading-relaxed">{opt.description}</span>

                  {/* Account types */}
                  <div className="flex flex-wrap gap-1 mt-3">
                    {opt.accounts.map(a => (
                      <span key={a} className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                        jurisdiction === opt.value
                          ? "bg-primary/10 text-primary"
                          : "bg-slate-100 text-slate-500"
                      }`}>{a}</span>
                    ))}
                  </div>

                  {jurisdiction === opt.value && (
                    <div className="absolute top-2 right-2 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                      <CheckCircle className="w-3 h-3 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Impact summary */}
          {jurisdiction !== currentJurisdiction && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
              <p className="font-semibold">Switching to {selected.label} planning:</p>
              <ul className="space-y-0.5 list-disc list-inside">
                <li>New clients will default to {selected.taxLabel} selection</li>
                <li>Tax tabs will show {selected.accounts.join(", ")} planning tools</li>
                <li>Benefits shown as {selected.benefits.join(" & ")}</li>
                <li>Existing clients are not affected</li>
              </ul>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 transition"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={loading || !isDirty || saved}
            className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-50 transition"
          >
            {saved    ? <><CheckCircle className="w-4 h-4" /> Saved!</> :
             loading  ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> :
                        <><Save className="w-4 h-4" /> Save Settings</>}
          </button>
        </div>
      </div>
    </div>
  );
}
