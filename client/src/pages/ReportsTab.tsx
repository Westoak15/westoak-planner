import { useState } from "react";
import { FileText, Download, CheckSquare, Square, Loader2, BookOpen } from "lucide-react";

interface ReportSection {
  id: string;
  label: string;
  description: string;
  category: string;
  route: string;
}

const REPORT_SECTIONS: ReportSection[] = [
  { id: "one-page",             label: "One Page Plan",          description: "Executive summary",                                   category: "Summary",      route: "one-page" },
  { id: "comprehensive",        label: "Comprehensive Plan",     description: "Full plan - generates all sections",                  category: "Summary",      route: "comprehensive" },
  { id: "net-worth",            label: "Net Worth Statement",    description: "Balance sheet",                                       category: "Net Worth",    route: "net-worth" },
  { id: "asset-allocation",     label: "Asset Allocation",       description: "Asset breakdown",                                     category: "Net Worth",    route: "asset-allocation" },
  { id: "retirement",           label: "Retirement Projection",  description: "Income projection",                                   category: "Retirement",   route: "retirement" },
  { id: "retirement-readiness", label: "Retirement Readiness",   description: "Retirement score",                                    category: "Retirement",   route: "retirement-readiness" },
  { id: "fna",                  label: "Family Needs Analysis",  description: "Life insurance needs",                                category: "Insurance",    route: "fna" },
  { id: "insurance",            label: "Insurance Summary",      description: "Coverage overview",                                   category: "Insurance",    route: "insurance" },
  { id: "insurance-audit",      label: "Insurance Audit",        description: "Coverage gap audit",                                  category: "Insurance",    route: "insurance-audit" },
  { id: "cash-flow",            label: "Cash Flow",              description: "Income vs expenses",                                  category: "Cash Flow",    route: "cash-flow" },
  { id: "goal-status",          label: "Goal Status",            description: "Progress to goals",                                   category: "Goals",        route: "goal-status" },
  { id: "tax-strategy",         label: "Tax Strategy",           description: "Tax planning notes",                                  category: "Tax & Estate", route: "tax-strategy" },
  { id: "estate-summary",       label: "Estate Summary",         description: "Estate readiness",                                    category: "Tax & Estate", route: "estate-summary" },
];

const COMPREHENSIVE_ROUTES = [
  "net-worth", "asset-allocation", "retirement", "retirement-readiness",
  "insurance", "insurance-audit", "cash-flow", "goal-status", "tax-strategy", "estate-summary"
];

const CATEGORIES = ["Summary", "Net Worth", "Retirement", "Insurance", "Cash Flow", "Goals", "Tax & Estate"];

const CATEGORY_COLORS: Record<string, string> = {
  "Summary":      "bg-[#0c1e3a]",
  "Net Worth":    "bg-blue-600",
  "Retirement":   "bg-teal-600",
  "Insurance":    "bg-purple-600",
  "Cash Flow":    "bg-amber-500",
  "Goals":        "bg-green-600",
  "Tax & Estate": "bg-indigo-600",
};

export function ReportsTab({ clientId }: { clientId: number }) {
  const [selected, setSelected]           = useState<Set<string>>(new Set());
  const [generating, setGenerating]       = useState(false);
  const [includeCover, setIncludeCover]   = useState(false);
  const [fnaAnalysisId, setFnaAnalysisId] = useState<number | null>(null);
  const [fnaAnalyses, setFnaAnalyses]     = useState<any[]>([]);
  const [loadingFna, setLoadingFna]       = useState(false);

  const token = () => localStorage.getItem("fp_token") ?? "";

  async function fetchHtml(route: string, withCover = false): Promise<string> {
    // Comprehensive report uses the planning engine endpoint (POST)
    if (route === "comprehensive") {
      const res = await fetch(`/api/planning/report/${clientId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({ sections: "all" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return `<p style="color:red;padding:20px;font-family:sans-serif;">
          <strong>Report generation failed:</strong> ${(err as any).error ?? res.statusText}<br/>
          <small>Make sure the client has retirement projections, debt entries, and insurance data entered.</small>
        </p>`;
      }
      return res.text();
    }
 
    // All other reports use the existing GET endpoint
    let url = `/api/reports/${clientId}/${route}`;
    if (route === "fna") {
      if (!fnaAnalysisId) return "<p>No FNA analysis selected</p>";
      url = `/api/reports/${clientId}/fna/${fnaAnalysisId}`;
    }
    if (withCover && route !== "one-page") {
      url += "?cover=true";
    }
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token()}` } });
    if (!res.ok) return `<p style="color:red">Failed to load ${route}</p>`;
    return res.text();
  }

  function stripBody(html: string) {
    const m = html.match(/<body>([\s\S]*)<\/body>/i);
    return m ? m[1] : html;
  }

  function extractCss(html: string) {
    const m = html.match(/<style>([\s\S]*?)<\/style>/i);
    return m ? m[1] : "";
  }

  async function openCombined(routes: string[]) {
    setGenerating(true);
    try {
      const parts = await Promise.all(routes.map(r => fetchHtml(r, includeCover)));
      const css = extractCss(parts[0]);
      const combined = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Financial Report</title>
<style>${css}.report-divider{page-break-before:always;}</style></head><body>
${parts.map(h => stripBody(h)).join('\n<div class="report-divider"></div>\n')}
</body></html>`;
      const blob = new Blob([combined], { type: "text/html" });
      window.open(URL.createObjectURL(blob), "_blank");
    } finally { setGenerating(false); }
  }

  async function generateSelected() {
    const ids = Array.from(selected);
    let routes: string[];
    if (ids.includes("comprehensive")) {
      const fnaRoutes = ids.includes("fna") && fnaAnalysisId ? ["fna"] : [];
      routes = [...fnaRoutes, ...COMPREHENSIVE_ROUTES];
    } else {
      routes = REPORT_SECTIONS.filter(s => ids.includes(s.id)).map(s => s.route);
    }
    if (routes.length) await openCombined(routes);
  }

  async function loadFnaAnalyses() {
    if (fnaAnalyses.length > 0) return;
    setLoadingFna(true);
    const res = await fetch(`/api/clients/${clientId}/insurance-analyses`, { headers: { Authorization: `Bearer ${token()}` } });
    const data = await res.json();
    setFnaAnalyses(data);
    if (data.length > 0) setFnaAnalysisId(data[0].id);
    setLoadingFna(false);
  }

  function toggle(id: string) {
    if (id === "fna" && fnaAnalyses.length === 0) loadFnaAnalyses();
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function toggleCat(cat: string) {
    const ids = REPORT_SECTIONS.filter(s => s.category === cat).map(s => s.id);
    const all = ids.every(id => selected.has(id));
    setSelected(prev => { const n = new Set(prev); all ? ids.forEach(id => n.delete(id)) : ids.forEach(id => n.add(id)); return n; });
  }

  const selectedCount = selected.size;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Report Builder</h1>
          <p className="text-sm text-gray-400">Select reports and generate combined in one tab</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setSelected(new Set(REPORT_SECTIONS.map(s => s.id)))} className="text-sm text-[#0c1e3a] font-semibold hover:underline">All</button>
          <button onClick={() => setSelected(new Set())} className="text-sm text-gray-400 hover:underline">None</button>

          {/* Cover page toggle */}
          <button
            onClick={() => setIncludeCover(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
              includeCover
                ? "bg-[#0c1e3a] text-white border-[#0c1e3a]"
                : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
            }`}
            title="Prepend a cover page to each selected report"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Cover page {includeCover ? "on" : "off"}
          </button>

          <button onClick={generateSelected} disabled={selectedCount === 0 || generating}
            className="flex items-center gap-2 bg-[#0c1e3a] hover:bg-[#0e2a4a] disabled:opacity-40 text-white font-semibold px-5 py-2.5 rounded-xl text-sm">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {generating ? "Generating..." : `Generate${selectedCount > 0 ? ` (${selectedCount})` : ""}`}
          </button>
        </div>
      </div>

      {/* Grid of categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {CATEGORIES.map(cat => {
          const sections = REPORT_SECTIONS.filter(s => s.category === cat);
          const catSelected = sections.filter(s => selected.has(s.id)).length;
          const allCatSelected = catSelected === sections.length;
          const colorDot = CATEGORY_COLORS[cat];
          const singleReport = sections.length === 1;

          return (
            <div key={cat} className="border border-gray-200 rounded-xl overflow-hidden flex flex-col">
              {/* Category bar */}
              <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${colorDot}`} />
                  <span className="text-sm font-bold text-gray-800">{cat}</span>
                  {catSelected > 0 && !allCatSelected && (
                    <span className="text-xs text-gray-400">{catSelected}/{sections.length}</span>
                  )}
                </div>
                {!singleReport && (
                  <button onClick={() => toggleCat(cat)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#0c1e3a]">
                    {allCatSelected
                      ? <><CheckSquare className="w-3.5 h-3.5 text-[#0c1e3a]" /> All</>
                      : <><Square className="w-3.5 h-3.5" /> Select all</>}
                  </button>
                )}
              </div>

              {/* Report rows */}
              <div className="flex-1 divide-y divide-gray-50">
                {sections.map(section => {
                  const isSelected = selected.has(section.id);
                  return (
                    <div key={section.id}
                      onClick={() => toggle(section.id)}
                      className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors ${isSelected ? "bg-blue-50/40" : ""}`}>
                      <div className="flex-shrink-0">
                        {isSelected
                          ? <CheckSquare className="w-4 h-4 text-[#0c1e3a]" />
                          : <Square className="w-4 h-4 text-gray-300" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">{section.label}</span>
                          <span className="text-xs text-gray-400 truncate">{section.description}</span>
                        </div>
                        {section.id === "fna" && isSelected && (
                          <div className="mt-1" onClick={e => e.stopPropagation()}>
                            {loadingFna ? <span className="text-xs text-gray-400">Loading...</span>
                              : fnaAnalyses.length === 0 ? <span className="text-xs text-red-500">No FNA analyses</span>
                              : (
                                <select value={fnaAnalysisId ?? ""} onChange={e => setFnaAnalysisId(Number(e.target.value))}
                                  className="border border-gray-200 rounded px-2 py-0.5 text-xs w-full">
                                  {fnaAnalyses.map((a: any) => (
                                    <option key={a.id} value={a.id}>
                                      {a.primaryName || "FNA"} - {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : ""}
                                    </option>
                                  ))}
                                </select>
                              )}
                          </div>
                        )}
                      </div>
                      <button onClick={async e => { e.stopPropagation(); const h = await fetchHtml(section.route, includeCover); const b = new Blob([h], { type: "text/html" }); window.open(URL.createObjectURL(b), "_blank"); }}
                        className="flex-shrink-0 p-1 text-gray-300 hover:text-gray-600 transition-colors" title="Preview">
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sticky footer */}
      {selectedCount > 0 && (
        <div className="fixed bottom-6 right-6 flex items-center gap-3 bg-[#0c1e3a] text-white px-5 py-3 rounded-2xl shadow-2xl">
          <span className="text-sm font-semibold">{selectedCount} selected</span>
          <button onClick={generateSelected} disabled={generating}
            className="flex items-center gap-2 bg-white text-[#0c1e3a] font-bold px-4 py-1.5 rounded-xl text-sm hover:bg-gray-100 disabled:opacity-50">
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
            Generate in One Tab
          </button>
        </div>
      )}
    </div>
  );
}
