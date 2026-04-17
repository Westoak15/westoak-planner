import { useState } from "react";
import { FileText, Download, CheckSquare, Square, Loader2, ChevronDown, ChevronUp } from "lucide-react";

interface ReportSection {
  id: string;
  label: string;
  description: string;
  category: string;
  route: string;
}

const REPORT_SECTIONS: ReportSection[] = [
  // Summary
  { id: "one-page",              label: "One Page Plan",           description: "Executive summary of entire financial picture",         category: "Summary",    route: "one-page" },
  { id: "comprehensive",         label: "Comprehensive Plan",      description: "Full financial plan covering all modules",              category: "Summary",    route: "comprehensive" },
  // Net Worth & Assets
  { id: "net-worth",             label: "Net Worth Statement",     description: "Balance sheet of assets and liabilities",               category: "Net Worth",  route: "net-worth" },
  { id: "asset-allocation",      label: "Asset Allocation",        description: "Breakdown of asset types and diversification",          category: "Net Worth",  route: "asset-allocation" },
  // Retirement
  { id: "retirement",            label: "Retirement Projection",   description: "Income projection with Monte Carlo simulation",         category: "Retirement", route: "retirement" },
  { id: "retirement-readiness",  label: "Retirement Readiness",    description: "Retirement score based on savings and expenses",        category: "Retirement", route: "retirement-readiness" },
  // Insurance
  { id: "fna",                   label: "Family Needs Analysis",   description: "Life insurance needs worksheet and gap analysis",       category: "Insurance",  route: "fna" },
  { id: "insurance",             label: "Insurance Summary",       description: "Coverage overview and recommendations",                 category: "Insurance",  route: "insurance" },
  { id: "insurance-audit",       label: "Insurance Audit",         description: "Full coverage gap audit against net worth",             category: "Insurance",  route: "insurance-audit" },
  // Cash Flow
  { id: "cash-flow",             label: "Cash Flow Statement",     description: "Monthly income vs expenses with retirement projection", category: "Cash Flow",  route: "cash-flow" },
  // Goals
  { id: "goal-status",           label: "Goal Status Report",      description: "Progress toward financial goals",                      category: "Goals",      route: "goal-status" },
  // Tax & Estate
  { id: "tax-strategy",          label: "Tax Strategy",            description: "Tax planning notes and optimization strategies",        category: "Tax & Estate", route: "tax-strategy" },
  { id: "estate-summary",        label: "Estate Summary",          description: "Estate planning notes, readiness score, probate fees", category: "Tax & Estate", route: "estate-summary" },
];

const CATEGORIES = ["Summary", "Net Worth", "Retirement", "Insurance", "Cash Flow", "Goals", "Tax & Estate"];

const CATEGORY_COLORS: Record<string, string> = {
  "Summary":     "bg-[#0c1e3a] text-white",
  "Net Worth":   "bg-blue-600 text-white",
  "Retirement":  "bg-teal-600 text-white",
  "Insurance":   "bg-purple-600 text-white",
  "Cash Flow":   "bg-amber-600 text-white",
  "Goals":       "bg-green-600 text-white",
  "Tax & Estate":"bg-indigo-600 text-white",
};

export function ReportsTab({ clientId }: { clientId: number }) {
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [generating, setGenerating]   = useState<string | null>(null);
  const [collapsed, setCollapsed]     = useState<Set<string>>(new Set());
  const [fnaAnalysisId, setFnaAnalysisId] = useState<number | null>(null);
  const [fnaAnalyses, setFnaAnalyses] = useState<any[]>([]);
  const [loadingFna, setLoadingFna]   = useState(false);

  async function fetchToken() {
    return localStorage.getItem("fp_token") ?? "";
  }

  async function openReport(route: string) {
    const token = await fetchToken();
    let url = `/api/reports/${clientId}/${route}`;
    if (route === "fna") {
      if (!fnaAnalysisId) return;
      url = `/api/reports/${clientId}/fna/${fnaAnalysisId}`;
    }
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const html = await res.text();
    const blob = new Blob([html], { type: "text/html" });
    window.open(URL.createObjectURL(blob), "_blank");
  }

  async function loadFnaAnalyses() {
    if (fnaAnalyses.length > 0) return;
    setLoadingFna(true);
    const token = await fetchToken();
    const res = await fetch(`/api/clients/${clientId}/insurance-analyses`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setFnaAnalyses(data);
    if (data.length > 0) setFnaAnalysisId(data[0].id);
    setLoadingFna(false);
  }

  function toggleSection(id: string) {
    if (id === "fna" && fnaAnalyses.length === 0) loadFnaAnalyses();
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleCategory(cat: string) {
    const catIds = REPORT_SECTIONS.filter(s => s.category === cat).map(s => s.id);
    const allSelected = catIds.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      if (allSelected) { catIds.forEach(id => next.delete(id)); }
      else { catIds.forEach(id => next.add(id)); }
      return next;
    });
  }

  function toggleCollapse(cat: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }

  function selectAll() { setSelected(new Set(REPORT_SECTIONS.map(s => s.id))); }
  function selectNone() { setSelected(new Set()); }

  async function generateSelected() {
    const toGenerate = REPORT_SECTIONS.filter(s => selected.has(s.id));
    for (const section of toGenerate) {
      setGenerating(section.id);
      await openReport(section.route);
      await new Promise(r => setTimeout(r, 300));
    }
    setGenerating(null);
  }

  const selectedCount = selected.size;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Report Builder</h1>
          <p className="text-sm text-gray-400 mt-0.5">Select the sections to include and generate individual reports</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={selectAll} className="text-sm text-[#0c1e3a] font-semibold hover:underline">Select All</button>
          <button onClick={selectNone} className="text-sm text-gray-400 hover:underline">Clear</button>
          <button
            onClick={generateSelected}
            disabled={selectedCount === 0 || generating !== null}
            className="flex items-center gap-2 bg-[#0c1e3a] hover:bg-[#0e2a4a] disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {generating ? "Generating..." : `Generate ${selectedCount > 0 ? `(${selectedCount})` : ""}`}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {CATEGORIES.map(cat => {
          const sections = REPORT_SECTIONS.filter(s => s.category === cat);
          const catSelected = sections.filter(s => selected.has(s.id)).length;
          const allCatSelected = catSelected === sections.length;
          const isCollapsed = collapsed.has(cat);

          return (
            <div key={cat} className="border border-gray-200 rounded-2xl overflow-hidden">
              {/* Category header */}
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <button onClick={() => toggleCategory(cat)} className="flex items-center gap-2">
                    {allCatSelected
                      ? <CheckSquare className="w-4 h-4 text-[#0c1e3a]" />
                      : <Square className={`w-4 h-4 ${catSelected > 0 ? "text-[#0c1e3a]" : "text-gray-300"}`} />}
                  </button>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${CATEGORY_COLORS[cat]}`}>{cat}</span>
                  <span className="text-sm text-gray-500">{catSelected}/{sections.length} selected</span>
                </div>
                <button onClick={() => toggleCollapse(cat)} className="text-gray-400 hover:text-gray-600 p-1">
                  {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </button>
              </div>

              {/* Section list */}
              {!isCollapsed && (
                <div className="divide-y divide-gray-100">
                  {sections.map(section => {
                    const isSelected = selected.has(section.id);
                    const isGenerating = generating === section.id;
                    return (
                      <div key={section.id}
                        className={`flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer ${isSelected ? "bg-blue-50/50" : ""}`}
                        onClick={() => toggleSection(section.id)}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex-shrink-0">
                            {isSelected
                              ? <CheckSquare className="w-4 h-4 text-[#0c1e3a]" />
                              : <Square className="w-4 h-4 text-gray-300" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900">{section.label}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{section.description}</p>
                            {section.id === "fna" && isSelected && (
                              <div className="mt-2" onClick={e => e.stopPropagation()}>
                                {loadingFna ? (
                                  <span className="text-xs text-gray-400">Loading analyses...</span>
                                ) : fnaAnalyses.length === 0 ? (
                                  <span className="text-xs text-red-500">No FNA analyses found</span>
                                ) : (
                                  <select
                                    value={fnaAnalysisId ?? ""}
                                    onChange={e => setFnaAnalysisId(Number(e.target.value))}
                                    className="border border-gray-200 rounded-lg px-2 py-1 text-xs">
                                    {fnaAnalyses.map((a: any) => (
                                      <option key={a.id} value={a.id}>
                                        {a.primaryName || "FNA"} — {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : ""}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); openReport(section.route); }}
                          disabled={isGenerating || (section.id === "fna" && !fnaAnalysisId)}
                          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-500 border border-gray-200 hover:bg-gray-100 rounded-lg disabled:opacity-40 transition-colors ml-3">
                          {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                          Preview
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedCount > 0 && (
        <div className="fixed bottom-6 right-6 flex items-center gap-3 bg-[#0c1e3a] text-white px-5 py-3 rounded-2xl shadow-2xl">
          <span className="text-sm font-semibold">{selectedCount} report{selectedCount !== 1 ? "s" : ""} selected</span>
          <button
            onClick={generateSelected}
            disabled={generating !== null}
            className="flex items-center gap-2 bg-white text-[#0c1e3a] font-bold px-4 py-1.5 rounded-xl text-sm hover:bg-gray-100 disabled:opacity-50">
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
            Generate All
          </button>
        </div>
      )}
    </div>
  );
}
