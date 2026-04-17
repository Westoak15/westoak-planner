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
  { id: "one-page",             label: "One Page Plan",          description: "Executive summary of entire financial picture",         category: "Summary",      route: "one-page" },
  { id: "comprehensive",        label: "Comprehensive Plan",     description: "Full plan — generates all sections automatically",     category: "Summary",      route: "comprehensive" },
  { id: "net-worth",            label: "Net Worth Statement",    description: "Balance sheet of assets and liabilities",              category: "Net Worth",    route: "net-worth" },
  { id: "asset-allocation",     label: "Asset Allocation",       description: "Breakdown of asset types and diversification",         category: "Net Worth",    route: "asset-allocation" },
  { id: "retirement",           label: "Retirement Projection",  description: "Income projection with Monte Carlo simulation",        category: "Retirement",   route: "retirement" },
  { id: "retirement-readiness", label: "Retirement Readiness",   description: "Retirement score based on savings and expenses",       category: "Retirement",   route: "retirement-readiness" },
  { id: "fna",                  label: "Family Needs Analysis",  description: "Life insurance needs worksheet and gap analysis",      category: "Insurance",    route: "fna" },
  { id: "insurance",            label: "Insurance Summary",      description: "Coverage overview and recommendations",                category: "Insurance",    route: "insurance" },
  { id: "insurance-audit",      label: "Insurance Audit",        description: "Full coverage gap audit against net worth",            category: "Insurance",    route: "insurance-audit" },
  { id: "cash-flow",            label: "Cash Flow Statement",    description: "Monthly income vs expenses with retirement projection", category: "Cash Flow",    route: "cash-flow" },
  { id: "goal-status",          label: "Goal Status Report",     description: "Progress toward financial goals",                     category: "Goals",        route: "goal-status" },
  { id: "tax-strategy",         label: "Tax Strategy",           description: "Tax planning notes and optimization strategies",       category: "Tax & Estate", route: "tax-strategy" },
  { id: "estate-summary",       label: "Estate Summary",         description: "Estate planning notes, readiness score, probate fees", category: "Tax & Estate", route: "estate-summary" },
];

// When comprehensive is selected, these are generated instead of one-page
const COMPREHENSIVE_ROUTES = [
  "net-worth", "asset-allocation", "retirement", "retirement-readiness",
  "insurance", "insurance-audit", "cash-flow", "goal-status", "tax-strategy", "estate-summary"
];

const CATEGORIES = ["Summary", "Net Worth", "Retirement", "Insurance", "Cash Flow", "Goals", "Tax & Estate"];

const CATEGORY_COLORS: Record<string, string> = {
  "Summary":      "bg-[#0c1e3a] text-white",
  "Net Worth":    "bg-blue-600 text-white",
  "Retirement":   "bg-teal-600 text-white",
  "Insurance":    "bg-purple-600 text-white",
  "Cash Flow":    "bg-amber-600 text-white",
  "Goals":        "bg-green-600 text-white",
  "Tax & Estate": "bg-indigo-600 text-white",
};

export function ReportsTab({ clientId }: { clientId: number }) {
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [collapsed, setCollapsed]   = useState<Set<string>>(new Set());
  const [fnaAnalysisId, setFnaAnalysisId] = useState<number | null>(null);
  const [fnaAnalyses, setFnaAnalyses]     = useState<any[]>([]);
  const [loadingFna, setLoadingFna]       = useState(false);

  const token = () => localStorage.getItem("fp_token") ?? "";

  async function fetchHtml(route: string): Promise<string> {
    let url = `/api/reports/${clientId}/${route}`;
    if (route === "fna") {
      if (!fnaAnalysisId) return "<p>No FNA analysis selected</p>";
      url = `/api/reports/${clientId}/fna/${fnaAnalysisId}`;
    }
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token()}` } });
    if (!res.ok) return `<p style="color:red">Failed to load ${route}</p>`;
    return res.text();
  }

  function stripHtmlShell(html: string): string {
    // Extract just the body content
    const bodyMatch = html.match(/<body>([\s\S]*)<\/body>/i);
    return bodyMatch ? bodyMatch[1] : html;
  }

  function extractCss(html: string): string {
    const cssMatch = html.match(/<style>([\s\S]*?)<\/style>/i);
    return cssMatch ? cssMatch[1] : "";
  }

  async function openCombinedReport(routes: string[]) {
    setGenerating(true);
    try {
      const htmlParts = await Promise.all(routes.map(r => fetchHtml(r)));

      // Use CSS from first report
      const css = extractCss(htmlParts[0]);
      const bodies = htmlParts.map(h => stripHtmlShell(h));

      const combined = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Financial Report</title>
<style>
${css}
.report-divider { page-break-before: always; border-top: 3px solid #1B3A5C; margin-top: 0; }
</style>
</head>
<body>
${bodies.join('\n<div class="report-divider"></div>\n')}
</body>
</html>`;

      const blob = new Blob([combined], { type: "text/html" });
      window.open(URL.createObjectURL(blob), "_blank");
    } finally {
      setGenerating(false);
    }
  }

  async function generateSelected() {
    const ids = Array.from(selected);
    const isComprehensive = ids.includes("comprehensive");
    const isOnePage = ids.includes("one-page");

    let routes: string[];

    if (isComprehensive) {
      // Comprehensive = all detail reports combined (no one-page)
      routes = COMPREHENSIVE_ROUTES;
      // Add FNA if selected
      if (ids.includes("fna") && fnaAnalysisId) routes = ["fna", ...routes];
    } else {
      routes = REPORT_SECTIONS.filter(s => ids.includes(s.id)).map(s => s.route);
    }

    if (routes.length === 0) return;
    await openCombinedReport(routes);
  }

  async function previewSingle(route: string) {
    const html = await fetchHtml(route);
    const blob = new Blob([html], { type: "text/html" });
    window.open(URL.createObjectURL(blob), "_blank");
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
      if (allSelected) catIds.forEach(id => next.delete(id));
      else catIds.forEach(id => next.add(id));
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

  const selectedCount = selected.size;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Report Builder</h1>
          <p className="text-sm text-gray-400 mt-0.5">Select sections and generate a combined report in one tab</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setSelected(new Set(REPORT_SECTIONS.map(s => s.id)))} className="text-sm text-[#0c1e3a] font-semibold hover:underline">Select All</button>
          <button onClick={() => setSelected(new Set())} className="text-sm text-gray-400 hover:underline">Clear</button>
          <button onClick={generateSelected} disabled={selectedCount === 0 || generating}
            className="flex items-center gap-2 bg-[#0c1e3a] hover:bg-[#0e2a4a] disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl text-sm">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {generating ? "Generating..." : `Generate${selectedCount > 0 ? ` (${selectedCount})` : ""}`}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {CATEGORIES.map(cat => {
          const sections = REPORT_SECTIONS.filter(s => s.category === cat);
          const catSelected = sections.filter(s => selected.has(s.id)).length;
          const allCatSelected = catSelected === sections.length;
          const isCollapsed = collapsed.has(cat);

          return (
            <div key={cat} className="border border-gray-200 rounded-xl overflow-hidden">
              {/* Category header */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50">
                <div className="flex items-center gap-3">
                  <button onClick={() => toggleCategory(cat)}>
                    {allCatSelected
                      ? <CheckSquare className="w-4 h-4 text-[#0c1e3a]" />
                      : <Square className={`w-4 h-4 ${catSelected > 0 ? "text-[#0c1e3a]" : "text-gray-300"}`} />}
                  </button>
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${CATEGORY_COLORS[cat]}`}>{cat}</span>
                  <span className="text-xs text-gray-400">{catSelected}/{sections.length} selected</span>
                </div>
                <button onClick={() => toggleCollapse(cat)} className="text-gray-400 hover:text-gray-600">
                  {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </button>
              </div>

              {!isCollapsed && (
                <div className="divide-y divide-gray-100">
                  {sections.map(section => {
                    const isSelected = selected.has(section.id);
                    return (
                      <div key={section.id}
                        onClick={() => toggleSection(section.id)}
                        className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors ${isSelected ? "bg-blue-50/40" : ""}`}>
                        <div className="flex-shrink-0">
                          {isSelected
                            ? <CheckSquare className="w-4 h-4 text-[#0c1e3a]" />
                            : <Square className="w-4 h-4 text-gray-300" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-semibold text-gray-900">{section.label}</span>
                          <span className="text-xs text-gray-400 ml-2">{section.description}</span>
                          {section.id === "fna" && isSelected && (
                            <div className="mt-1.5" onClick={e => e.stopPropagation()}>
                              {loadingFna ? <span className="text-xs text-gray-400">Loading...</span>
                                : fnaAnalyses.length === 0 ? <span className="text-xs text-red-500">No FNA analyses found</span>
                                : (
                                  <select value={fnaAnalysisId ?? ""} onChange={e => setFnaAnalysisId(Number(e.target.value))}
                                    className="border border-gray-200 rounded-lg px-2 py-1 text-xs">
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
                        <button onClick={e => { e.stopPropagation(); previewSingle(section.route); }}
                          className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 text-xs text-gray-400 border border-gray-200 hover:bg-gray-100 rounded-lg transition-colors">
                          <Download className="w-3 h-3" /> Preview
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
          <button onClick={generateSelected} disabled={generating}
            className="flex items-center gap-2 bg-white text-[#0c1e3a] font-bold px-4 py-1.5 rounded-xl text-sm hover:bg-gray-100 disabled:opacity-50">
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
            Generate All in One Tab
          </button>
        </div>
      )}
    </div>
  );
}
