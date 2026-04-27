/**
 * server/services/reportGenerator.ts
 * fp-standalone - -  HTML reports with inline SVG charts
 */

function esc(s: unknown): string {
  if (s === null || s === undefined) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function fmt(n: number, d = 0): string {
  return Number(n).toLocaleString("en-CA", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtCad(n: number): string { return `$${fmt(n)}`; }
function v(s: any): number { return parseFloat(String(s ?? "0")) || 0; }

const DEFAULT_FIRM = "Knights of Columbus";

function htmlShell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  :root { --navy:#1B3A5C; --teal:#0F766E; --blue:#2563EB; --amber:#D97706; --red:#DC2626; --green:#16A34A; --gray:#475569; --lgray:#F1F5F9; --mgray:#CBD5E1; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:"Segoe UI",Arial,sans-serif; font-size:11pt; color:#0F172A; background:white; padding:0 0 40px; }
  .cover { background:white; color:var(--navy); padding:32px 48px 24px; border-bottom:4px solid var(--teal); }
  .cover h1 { font-size:26pt; font-weight:700; margin-bottom:6px; color:var(--navy); }
  .cover h2 { font-size:13pt; font-weight:400; color:var(--gray); margin-bottom:16px; }
  .cover-meta { display:grid; grid-template-columns:1fr 1fr; gap:6px 24px; margin-top:16px; font-size:10pt; color:white; }
  .cover-meta .label { color:var(--gray); font-size:9pt; } .cover-meta .value { font-weight:600; color:var(--navy); }
  .section { padding:32px 48px 0; page-break-inside:avoid; }
  h2.section-title { font-size:15pt; font-weight:700; color:var(--navy); border-bottom:3px solid var(--teal); padding-bottom:8px; margin-bottom:20px; margin-top:32px; }
  h3 { font-size:11pt; font-weight:600; color:var(--navy); margin:16px 0 8px; }
  p { margin-bottom:8px; line-height:1.5; }
  table { width:100%; border-collapse:collapse; font-size:9.5pt; margin-bottom:16px; }
  th { background:var(--navy); color:white; padding:6px 10px; text-align:left; font-weight:600; }
  td { padding:5px 10px; border-bottom:1px solid var(--mgray); }
  tr:nth-child(even) td { background:var(--lgray); }
  tr.total td { font-weight:700; background:#EFF6FF; }
  .summary-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:24px; }
  .summary-card { background:var(--lgray); border-radius:8px; padding:14px 16px; border-left:4px solid var(--teal); }
  .summary-card .label { font-size:8.5pt; color:var(--gray); text-transform:uppercase; letter-spacing:0.05em; }
  .summary-card .value { font-size:15pt; font-weight:700; color:var(--navy); margin-top:4px; }
  .summary-card .value.positive { color:var(--green); } .summary-card .value.negative { color:var(--red); } .summary-card .value.warn { color:var(--amber); }
  .callout { background:#EFF6FF; border-left:4px solid var(--blue); border-radius:4px; padding:12px 16px; margin:12px 0; font-size:10pt; }
  .callout.warn { background:#FFFBEB; border-color:var(--amber); } .callout.alert { background:#FEF2F2; border-color:var(--red); } .callout.good { background:#F0FDF4; border-color:var(--green); }
  .two-col { display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-bottom:16px; }
  .person-card { border:1px solid var(--mgray); border-radius:8px; padding:16px; }
  .person-card.primary { border-top:4px solid var(--teal); } .person-card.spouse { border-top:4px solid #7C3AED; }
  .person-label { font-size:9pt; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:12px; }
  .primary .person-label { color:var(--teal); } .spouse .person-label { color:#7C3AED; }
  .sig-line { border-bottom:1px solid #94A3B8; height:28px; margin-bottom:4px; }
  @media print {
    .section { page-break-inside:avoid; }
    body { padding-bottom:0; }
    .cover { }
    h2.section-title { margin-top:16px; }
    .section { padding:16px 48px 0; }
    .two-col { gap:16px; }
    .summary-grid { gap:8px; margin-bottom:12px; }
    table { font-size:8.5pt; }
    td, th { padding:3px 8px; }
    .summary-card { padding:8px 12px; }
    .summary-card .value { font-size:12pt; }
    p { margin-bottom:4px; }
  }
</style>
<style>
  @media print { .print-btn { display:none !important; } }
  .print-btn {
    position:fixed; bottom:24px; right:24px; z-index:999;
    background:#1B3A5C; color:white; border:none; border-radius:8px;
    padding:10px 20px; font-size:11pt; font-weight:600; cursor:pointer;
    box-shadow:0 4px 12px rgba(0,0,0,0.25); display:flex; align-items:center; gap:8px;
  }
  .print-btn:hover { background:#0F766E; }
  .print-btn svg { width:16px; height:16px; }
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
    <rect x="6" y="14" width="12" height="8"/>
  </svg>
  Print / Save PDF
</button>
${body}</body>
</html>`;
}

function svgGapChart(items: { label: string; need: number; have: number; color: string }[], width = 640, height = 220): string {
  if (!items.length) return "";
  const pad = { top: 20, right: 20, bottom: 60, left: 80 };
  const W = width - pad.left - pad.right;
  const H = height - pad.top - pad.bottom;
  const maxVal = Math.max(...items.flatMap(i => [i.need, i.have]), 1);
  const barW = Math.min(60, (W / items.length) * 0.35);
  const gap = (W / items.length) * 0.15;
  const xScale = (i: number) => (i / items.length) * W + (W / items.length) * 0.1;
  const yScale = (val: number) => H - (val / maxVal) * H;
  const yTick = (val: number) => val >= 1_000_000 ? `$${(val/1_000_000).toFixed(1)}M` : `$${(val/1_000).toFixed(0)}k`;
  const bars = items.map((item, i) => {
    const x = xScale(i);
    const needH = (item.need / maxVal) * H;
    const haveH = (item.have / maxVal) * H;
    const hasGap = item.need > item.have;
    return `<rect x="${x.toFixed(1)}" y="${(H-needH).toFixed(1)}" width="${barW}" height="${needH.toFixed(1)}" fill="${item.color}" opacity="0.25" rx="2"/>
      <rect x="${(x+barW+gap).toFixed(1)}" y="${(H-haveH).toFixed(1)}" width="${barW}" height="${haveH.toFixed(1)}" fill="${hasGap?"#DC2626":"#16A34A"}" opacity="0.85" rx="2"/>
      <text x="${(x+barW).toFixed(1)}" y="${H+18}" text-anchor="middle" font-size="8" fill="#64748B">${esc(item.label)}</text>
      <text x="${(x+barW).toFixed(1)}" y="${(H-Math.max(needH,haveH)-4).toFixed(1)}" text-anchor="middle" font-size="8" font-weight="600" fill="${hasGap?"#DC2626":"#16A34A"}">${hasGap?`-${fmtCad(item.need-item.have)}`:"OK"}</text>`;
  }).join("");
  const yLabels = [0,0.25,0.5,0.75,1].map(f => {
    const val = maxVal*f; const y = H-f*H;
    return `<line x1="0" y1="${y.toFixed(1)}" x2="${W}" y2="${y.toFixed(1)}" stroke="#E2E8F0" stroke-width="1"/><text x="-6" y="${(y+4).toFixed(1)}" text-anchor="end" font-size="9" fill="#64748B">${yTick(val)}</text>`;
  }).join("");
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="font-family:Arial,sans-serif">
  <g transform="translate(${pad.left},${pad.top})">${yLabels}<line x1="0" y1="0" x2="0" y2="${H}" stroke="#94A3B8" stroke-width="1.5"/><line x1="0" y1="${H}" x2="${W}" y2="${H}" stroke="#94A3B8" stroke-width="1.5"/>${bars}
    <g transform="translate(0,${H+40})"><rect x="0" y="-6" width="10" height="8" fill="#64748B" opacity="0.25" rx="1"/><text x="14" y="2" font-size="8" fill="#64748B">Life Insurance Need</text><rect x="130" y="-6" width="10" height="8" fill="#DC2626" opacity="0.85" rx="1"/><text x="144" y="2" font-size="8" fill="#64748B">Existing Coverage (red = gap)</text><rect x="310" y="-6" width="10" height="8" fill="#16A34A" opacity="0.85" rx="1"/><text x="324" y="2" font-size="8" fill="#64748B">Existing Coverage (adequate)</text></g>
  </g></svg>`;
}

function svgNeedBreakdown(sections: { label: string; value: number; color: string }[], title: string, total: number, existing: number, width = 300, height = 200): string {
  const filtered = sections.filter(s => s.value > 0);
  if (!filtered.length) return "";
  const sum = filtered.reduce((s, i) => s + i.value, 0);
  const barH = 140; const barX = 80; const barW = 60;
  let y = 20;
  const rects = filtered.map(s => {
    const h = (s.value / sum) * barH;
    const rect = `<rect x="${barX}" y="${y.toFixed(1)}" width="${barW}" height="${h.toFixed(1)}" fill="${s.color}" rx="2"/>
    <line x1="${barX+barW+4}" y1="${(y+h/2).toFixed(1)}" x2="${barX+barW+24}" y2="${(y+h/2).toFixed(1)}" stroke="#94A3B8" stroke-width="1"/>
    <text x="${barX+barW+28}" y="${(y+h/2+4).toFixed(1)}" font-size="8" fill="#475569">${esc(s.label)} ${fmtCad(s.value)}</text>`;
    y += h; return rect;
  }).join("");
  const netNeed = Math.max(0, total - existing);
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="font-family:Arial,sans-serif">
  <text x="${barX+barW/2}" y="14" text-anchor="middle" font-size="9" font-weight="600" fill="#1B3A5C">${esc(title)}</text>
  ${rects}
  <rect x="${barX}" y="${(20+barH).toFixed(1)}" width="${barW}" height="8" fill="${netNeed>0?"#DC2626":"#16A34A"}" opacity="0.3" rx="2"/>
  <text x="${barX+barW/2}" y="${(20+barH+20).toFixed(1)}" text-anchor="middle" font-size="8" font-weight="700" fill="${netNeed>0?"#DC2626":"#16A34A"}">Net Need: ${fmtCad(netNeed)}</text>
</svg>`;
}

function buildCoverSheet(opts: {
  reportTitle:   string;
  reportSubtitle?: string;
  clientName:    string;
  spouseName?:   string;
  advisorName:   string;
  advisorEmail?: string;
  advisorPhone?: string;
  firmName?:     string;
  province?:     string;
  dateStr:       string;
}): string {
  const firm = opts.firmName ?? DEFAULT_FIRM;
  return `
<div style="min-height:100vh;display:flex;flex-direction:column;justify-content:space-between;background:white;page-break-after:always;">

  <!-- Top band -->
  <div style="background:var(--navy);padding:28px 56px 24px;color:white;">
    <div style="font-size:9pt;letter-spacing:0.15em;text-transform:uppercase;opacity:0.7;margin-bottom:10px;">${esc(firm)} · Financial Planning</div>
    <div style="font-size:28pt;font-weight:700;line-height:1.1;margin-bottom:6px;">${esc(opts.reportTitle)}</div>
    ${opts.reportSubtitle?`<div style="font-size:13pt;opacity:0.8;margin-top:4px;">${esc(opts.reportSubtitle)}</div>`:""}
    <div style="height:3px;background:var(--teal);border-radius:2px;margin-top:20px;"></div>
  </div>

  <!-- Main cover body -->
  <div style="flex:1;padding:48px 56px;display:flex;flex-direction:column;justify-content:center;gap:40px;">

    <!-- Prepared for -->
    <div>
      <div style="font-size:9pt;letter-spacing:0.1em;text-transform:uppercase;color:var(--gray);margin-bottom:8px;">Prepared for</div>
      <div style="font-size:22pt;font-weight:700;color:var(--navy);">${esc(opts.clientName)}</div>
      ${opts.spouseName?`<div style="font-size:15pt;color:var(--gray);margin-top:4px;">& ${esc(opts.spouseName)}</div>`:""}
    </div>

    <!-- Divider -->
    <div style="height:1px;background:var(--mgray);"></div>

    <!-- Two-column: advisor + report details -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;">
      <div>
        <div style="font-size:9pt;letter-spacing:0.1em;text-transform:uppercase;color:var(--gray);margin-bottom:10px;">Your Advisor</div>
        <div style="font-size:14pt;font-weight:700;color:var(--navy);margin-bottom:4px;">${esc(opts.advisorName)}</div>
        ${opts.advisorEmail?`<div style="font-size:10pt;color:var(--gray);margin-bottom:2px;">✉ ${esc(opts.advisorEmail)}</div>`:""}
        ${opts.advisorPhone?`<div style="font-size:10pt;color:var(--gray);">✆ ${esc(opts.advisorPhone)}</div>`:""}
      </div>
      <div>
        <div style="font-size:9pt;letter-spacing:0.1em;text-transform:uppercase;color:var(--gray);margin-bottom:10px;">Report Details</div>
        <div style="font-size:10pt;color:var(--navy);margin-bottom:4px;"><span style="color:var(--gray);">Date prepared:</span> <strong>${esc(opts.dateStr)}</strong></div>
        ${opts.province?`<div style="font-size:10pt;color:var(--navy);margin-bottom:4px;"><span style="color:var(--gray);">Province:</span> <strong>${esc(opts.province)}</strong></div>`:""}
        <div style="font-size:10pt;color:var(--navy);"><span style="color:var(--gray);">Prepared by:</span> <strong>${esc(firm)}</strong></div>
      </div>
    </div>
  </div>

  <!-- Footer disclaimer -->
  <div style="background:var(--lgray);padding:16px 56px;border-top:1px solid var(--mgray);">
    <p style="font-size:8pt;color:var(--gray);line-height:1.5;margin:0;">
      <strong>Confidential:</strong> This report has been prepared solely for ${esc(opts.clientName)} and is intended for personal use only.
      The information contained herein is based on data provided and is subject to change.
      This document does not constitute financial, legal, or tax advice.
      Please consult qualified professionals before making financial decisions.
    </p>
  </div>

</div>`;
}

function buildCoverLetter(opts: {
  clientFirstName:  string;
  spouseFirstName?: string;
  clientName:       string;
  advisorName:      string;
  advisorTitle?:    string;
  firmName?:        string;
  reportTitle:      string;
  reportSubtitle?:  string;
  dateStr:          string;
  nextMeetingDate?: string;
}): string {
  const firm       = opts.firmName ?? DEFAULT_FIRM;
  const greeting   = opts.spouseFirstName
    ? `${opts.clientFirstName} and ${opts.spouseFirstName}`
    : opts.clientFirstName;
  const nextMeeting = opts.nextMeetingDate
    ? `Please review the enclosed report carefully and don't hesitate to reach out with any questions before our next meeting on ${opts.nextMeetingDate}.`
    : `Please review the enclosed report carefully and feel free to reach out with any questions at any time.`;
  const initials = opts.advisorName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  return `
<div class="section" style="min-height:900px;display:flex;flex-direction:column;">
  <div style="width:40px;height:3px;background:var(--navy);border-radius:2px;margin-bottom:28px;"></div>

  <div style="margin-bottom:28px;">
    <div style="font-family:Georgia,serif;font-size:28px;font-weight:normal;color:var(--navy);margin-bottom:6px;">${esc(opts.clientName)}</div>
    <div style="font-size:14px;color:var(--gray-400);">${esc(opts.reportTitle)}${opts.reportSubtitle ? ` &middot; ${esc(opts.reportSubtitle)}` : ""}</div>
  </div>

  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:32px;">
    <div style="padding:12px 16px;background:var(--gray-100);border-radius:8px;">
      <div style="font-size:10px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:var(--gray-400);margin-bottom:5px;">Advisor</div>
      <div style="font-size:14px;font-weight:500;color:var(--gray-800);">${esc(opts.advisorName)}${opts.advisorTitle ? `, ${esc(opts.advisorTitle)}` : ""}</div>
    </div>
    <div style="padding:12px 16px;background:var(--gray-100);border-radius:8px;">
      <div style="font-size:10px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:var(--gray-400);margin-bottom:5px;">Plan Date</div>
      <div style="font-size:14px;font-weight:500;color:var(--gray-800);">${esc(opts.dateStr)}</div>
    </div>
    <div style="padding:12px 16px;background:var(--gray-100);border-radius:8px;">
      <div style="font-size:10px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:var(--gray-400);margin-bottom:5px;">Review Date</div>
      <div style="font-size:14px;font-weight:500;color:var(--gray-800);">${new Date().getFullYear() + 1}</div>
    </div>
  </div>

  <div style="border-top:1px solid var(--border);padding-top:28px;flex:1;">
    <p style="margin-bottom:16px;">Dear ${esc(greeting)},</p>
    <p style="margin-bottom:16px;">It has been a pleasure working with you to develop this financial plan. The recommendations in this report reflect the goals and priorities you shared with us — including the strategies most relevant to your current stage of life and the objectives we discussed together.</p>
    <p style="margin-bottom:16px;">This plan is based on the information provided as of the date above. We recommend reviewing it annually or whenever a significant life event occurs. All projections involve assumptions about future market returns and inflation, and actual outcomes will vary.</p>
    <p style="margin-bottom:28px;">${nextMeeting}</p>

    <div style="display:flex;align-items:center;gap:12px;margin-top:auto;">
      <div style="width:40px;height:40px;border-radius:50%;background:var(--light-blue);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;color:var(--blue);flex-shrink:0;">${esc(initials)}</div>
      <div>
        <div style="font-size:13px;font-weight:600;color:var(--navy);">${esc(opts.advisorName)}${opts.advisorTitle ? `, ${esc(opts.advisorTitle)}` : ""}</div>
        <div style="font-size:11px;color:var(--gray-400);">${esc(firm)}</div>
      </div>
    </div>

    <div style="margin-top:28px;padding:12px 16px;background:var(--gray-100);border-radius:8px;border-left:3px solid var(--border);">
      <p style="font-size:10px;color:var(--gray-400);line-height:1.6;margin:0;">This report is based on information and assumptions provided by you. It is intended as a guide only and does not constitute legal, tax, or investment advice. Projections are hypothetical and not a guarantee of future results. Please consult your tax advisor before implementing any strategies contained herein.</p>
    </div>
  </div>
</div>`;
}

function reportOpener(opts: {
  reportTitle:      string;
  reportSubtitle?:  string;
  clientName:       string;
  clientFirstName?: string;
  spouseName?:      string;
  spouseFirstName?: string;
  advisorName:      string;
  advisorTitle?:    string;
  advisorEmail?:    string;
  advisorPhone?:    string;
  firmName?:        string;
  province?:        string;
  dateStr:          string;
}): string {
  const firstName = opts.clientFirstName ?? opts.clientName.split(" ")[0];
  return buildCoverSheet(opts) + buildCoverLetter({
    clientFirstName:  firstName,
    spouseFirstName:  opts.spouseFirstName,
    clientName:       opts.clientName,
    advisorName:      opts.advisorName,
    advisorTitle:     opts.advisorTitle,
    firmName:         opts.firmName,
    reportTitle:      opts.reportTitle,
    reportSubtitle:   opts.reportSubtitle,
    dateStr:          opts.dateStr,
  });
}

export function generateFnaReport(data: { client: any; analysis: any; advisor?: any; }): string {
  const { client, analysis } = data;
  const ws = analysis.worksheetData ?? {};
  const name = `${client.firstName} ${client.lastName}`;
  const dateStr = new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
  const advisorName = data.advisor ? `${data.advisor.firstName} ${data.advisor.lastName}` : "Your Advisor";

  const primaryName = ws.primaryName || analysis.primaryName || name;
  const spouseName  = ws.spouseName  || analysis.spouseName  || (client.spouseFirstName ? `${client.spouseFirstName} ${client.spouseLastName ?? ""}`.trim() : "");
  const primaryAge  = ws.primaryAge  || analysis.primaryAge  || "";
  const spouseAge   = ws.spouseAge   || analysis.spouseAge   || "";
  const primaryIncome = v(ws.primaryAnnualIncome || analysis.annualIncome);
  const spouseIncome  = v(ws.spouseAnnualIncome  || analysis.spouseAnnualIncome);

  const liab = ws.liabilities ?? {};
  const subtotalA = ["mortgageBalance","carLoans","linesOfCredit","creditCards","finalExpenses","emergencyFund"].reduce((s, k) => s + v(liab[k]), 0);
  const legacy = ws.legacy ?? {};
  const subtotalB = ["educationFund","legacyFundForChildren","charitableBequest","other"].reduce((s, k) => s + v(legacy[k]), 0);

  const primaryInc = ws.primaryIncome ?? { replacementPct: "70", cppSurvivorBenefit: "700", targetAge: "65" };
  const spouseInc  = ws.spouseIncome  ?? { replacementPct: "70", cppSurvivorBenefit: "700", targetAge: "65" };
  const primaryYears = primaryAge ? Math.max(0, v(primaryInc.targetAge) - v(primaryAge)) : 0;
  const spouseYears  = spouseAge  ? Math.max(0, v(spouseInc.targetAge)  - v(spouseAge))  : 0;
  const annReplace = (inc: number, pct: number, cpp: number) => (inc * pct / 100) - (cpp * 12);
  const subtotalC = annReplace(primaryIncome, v(primaryInc.replacementPct), v(primaryInc.cppSurvivorBenefit)) * primaryYears;
  const subtotalD = annReplace(spouseIncome,  v(spouseInc.replacementPct),  v(spouseInc.cppSurvivorBenefit))  * spouseYears;

  const pAssets = ws.primaryAssets ?? {};
  const sAssets = ws.spouseAssets  ?? {};
  const calcAssets = (a: any) => v(a.liquidSavings) + (a.rrspsUse !== false ? v(a.rrsps) : 0) + (a.nonRegisteredUse !== false ? v(a.nonRegistered) : 0) + (a.tfsaUse !== false ? v(a.tfsa) : 0) + v(a.other);
  const subtotalE = calcAssets(pAssets);
  const subtotalF = calcAssets(sAssets);

  const primaryNeed = Math.max(0, subtotalA + subtotalB + subtotalC - subtotalE);
  const spouseNeed  = Math.max(0, subtotalA + subtotalB + subtotalD - subtotalF);
  const primaryExisting = v(ws.primaryExistingCoverage || analysis.existingLifeCoverage);
  const spouseExisting  = v(ws.spouseExistingCoverage  || 0);
  const primaryNet = Math.max(0, primaryNeed - primaryExisting);
  const spouseNet  = Math.max(0, spouseNeed  - spouseExisting);
  const primaryPurchased = v(ws.primaryCoveragePurchased);
  const spousePurchased  = v(ws.spouseCoveragePurchased);
  const primaryShortfall = Math.max(0, primaryNet - primaryPurchased);
  const spouseShortfall  = Math.max(0, spouseNet  - spousePurchased);

  const hasSpouse = !!(spouseName || spouseIncome);

  const gapItems = [
    { label: `${primaryName} Life`, need: primaryNeed, have: primaryExisting, color: "#0F766E" },
    ...(hasSpouse ? [{ label: `${spouseName} Life`, need: spouseNeed, have: spouseExisting, color: "#7C3AED" }] : []),
  ];

  const primarySections = [
    { label: "Liabilities (A)", value: subtotalA, color: "#DC2626" },
    { label: "Legacy (B)",      value: subtotalB, color: "#D97706" },
    { label: "Income (C)",      value: Math.max(0, subtotalC), color: "#2563EB" },
  ].filter(s => s.value > 0);

  const spouseSections = [
    { label: "Liabilities (A)", value: subtotalA, color: "#DC2626" },
    { label: "Legacy (B)",      value: subtotalB, color: "#D97706" },
    { label: "Income (D)",      value: Math.max(0, subtotalD), color: "#7C3AED" },
  ].filter(s => s.value > 0);

  const cover = `
${reportOpener({ reportTitle: "Family Needs Analysis", reportSubtitle: "Life Insurance Needs Worksheet", clientName: name, clientFirstName: name.split(" ")[0], advisorName, dateStr })}`;

  const summarySection = `
<div class="section">
  <h2 class="section-title">Coverage Summary</h2>
  <div class="summary-grid">
    <div class="summary-card" style="border-left-color:var(--teal)">
      <div class="label">${esc(primaryName)} - Life Insurance Need</div>
      <div class="value">${fmtCad(primaryNeed)}</div>
      <div class="label" style="margin-top:4px">Net Need</div>
      <div class="value ${primaryNet > 0 ? "negative" : "positive"}" style="font-size:12pt">${fmtCad(primaryNet)}</div>
    </div>
    ${hasSpouse ? `
    <div class="summary-card" style="border-left-color:#7C3AED">
      <div class="label">${esc(spouseName)} - Life Insurance Need</div>
      <div class="value">${fmtCad(spouseNeed)}</div>
      <div class="label" style="margin-top:4px">Net Need</div>
      <div class="value ${spouseNet > 0 ? "negative" : "positive"}" style="font-size:12pt">${fmtCad(spouseNet)}</div>
    </div>` : `<div></div>`}
    <div class="summary-card">
      <div class="label">Analysis Date</div>
      <div class="value" style="font-size:11pt">${dateStr}</div>
    </div>
  </div>
  <h3>Coverage Gap Analysis</h3>
  <div style="margin:16px 0">${svgGapChart(gapItems)}</div>
  ${primaryNet > 0 ? `<div class="callout alert"><strong>Coverage Gap:</strong> ${esc(primaryName)} has an unmet life insurance need of <strong>${fmtCad(primaryNet)}</strong>.</div>` : `<div class="callout good"><strong>Coverage Adequate:</strong> Existing coverage meets the calculated need for ${esc(primaryName)}.</div>`}
  ${hasSpouse && spouseNet > 0 ? `<div class="callout alert"><strong>Spouse Coverage Gap:</strong> ${esc(spouseName)} has an unmet need of <strong>${fmtCad(spouseNet)}</strong>.</div>` : ""}
</div>`;

  const clientSection = `
<div class="section" style="page-break-before:always">
  <h2 class="section-title">Client Information</h2>
  <div class="two-col">
    <div class="person-card primary">
      <div class="person-label">Primary Insured</div>
      <table style="margin:0"><tbody>
        <tr><td style="color:#64748B;font-size:9pt">Name</td><td><strong>${esc(primaryName)}</strong></td></tr>
        <tr><td style="color:#64748B;font-size:9pt">Age</td><td>${esc(primaryAge) || "-"}</td></tr>
        <tr><td style="color:#64748B;font-size:9pt">Annual Income</td><td>${fmtCad(primaryIncome)}</td></tr>
        <tr><td style="color:#64748B;font-size:9pt">Income Replacement %</td><td>${v(primaryInc.replacementPct)}%</td></tr>
        <tr><td style="color:#64748B;font-size:9pt">CPP/QPP Survivor ($/mo)</td><td>${fmtCad(v(primaryInc.cppSurvivorBenefit))}</td></tr>
        <tr><td style="color:#64748B;font-size:9pt">Income Needed To Age</td><td>${esc(primaryInc.targetAge)} (${primaryYears} yrs)</td></tr>
      </tbody></table>
    </div>
    ${hasSpouse ? `
    <div class="person-card spouse">
      <div class="person-label">Spouse</div>
      <table style="margin:0"><tbody>
        <tr><td style="color:#64748B;font-size:9pt">Name</td><td><strong>${esc(spouseName)}</strong></td></tr>
        <tr><td style="color:#64748B;font-size:9pt">Age</td><td>${esc(spouseAge) || "-"}</td></tr>
        <tr><td style="color:#64748B;font-size:9pt">Annual Income</td><td>${fmtCad(spouseIncome)}</td></tr>
        <tr><td style="color:#64748B;font-size:9pt">Income Replacement %</td><td>${v(spouseInc.replacementPct)}%</td></tr>
        <tr><td style="color:#64748B;font-size:9pt">CPP/QPP Survivor ($/mo)</td><td>${fmtCad(v(spouseInc.cppSurvivorBenefit))}</td></tr>
        <tr><td style="color:#64748B;font-size:9pt">Income Needed To Age</td><td>${esc(spouseInc.targetAge)} (${spouseYears} yrs)</td></tr>
      </tbody></table>
    </div>` : "<div></div>"}
  </div>
</div>`;

  const needSection = `
<div class="section">
  <h2 class="section-title">Needs Calculation Detail</h2>
  <h3>A - Household Liabilities</h3>
  <table><thead><tr><th>Item</th><th style="text-align:right">Amount</th></tr></thead><tbody>
    ${[["Mortgage Balance",liab.mortgageBalance],["Car Loans",liab.carLoans],["Lines of Credit",liab.linesOfCredit],["Credit Cards",liab.creditCards],["Final Expenses",liab.finalExpenses],["Emergency Fund",liab.emergencyFund]].filter(([,val])=>v(val)>0).map(([label,val])=>`<tr><td>${esc(label)}</td><td style="text-align:right">${fmtCad(v(val))}</td></tr>`).join("")}
    <tr class="total"><td>Subtotal A</td><td style="text-align:right">${fmtCad(subtotalA)}</td></tr>
  </tbody></table>
  ${subtotalB > 0 ? `
  <h3>B - Legacy Needs &amp; Wants</h3>
  <table><thead><tr><th>Item</th><th style="text-align:right">Amount</th></tr></thead><tbody>
    ${[["Education Fund",legacy.educationFund],["Legacy Fund for Children",legacy.legacyFundForChildren],["Charitable Bequest",legacy.charitableBequest],["Other",legacy.other]].filter(([,val])=>v(val)>0).map(([label,val])=>`<tr><td>${esc(label)}</td><td style="text-align:right">${fmtCad(v(val))}</td></tr>`).join("")}
    <tr class="total"><td>Subtotal B</td><td style="text-align:right">${fmtCad(subtotalB)}</td></tr>
  </tbody></table>` : ""}
  <h3>Income Replacement &amp; Financial Assets</h3>
  <div class="two-col">
    <div>
      <p style="font-size:9pt;font-weight:600;color:var(--teal);margin-bottom:8px">Primary (C) - Income Replacement Need</p>
      <table style="margin:0"><tbody>
        <tr><td style="font-size:9pt;color:#64748B">Annual replacement need</td><td style="text-align:right">${fmtCad(Math.max(0,annReplace(primaryIncome,v(primaryInc.replacementPct),v(primaryInc.cppSurvivorBenefit))))}/yr</td></tr>
        <tr><td style="font-size:9pt;color:#64748B">Years of income</td><td style="text-align:right">${primaryYears}</td></tr>
        <tr class="total"><td>Subtotal C</td><td style="text-align:right">${fmtCad(Math.max(0,subtotalC))}</td></tr>
      </tbody></table>
      <p style="font-size:9pt;font-weight:600;color:var(--teal);margin:12px 0 8px">Primary (E) - Financial Assets Available</p>
      <table style="margin:0"><tbody>
        ${[["Liquid Savings",pAssets.liquidSavings,true],["RRSP",pAssets.rrsps,pAssets.rrspsUse],["Non-Registered",pAssets.nonRegistered,pAssets.nonRegisteredUse],["TFSA",pAssets.tfsa,pAssets.tfsaUse],["Other",pAssets.other,true]].filter(([,val,use])=>v(val)>0&&use!==false).map(([label,val])=>`<tr><td style="font-size:9pt;color:#64748B">${esc(label)}</td><td style="text-align:right">${fmtCad(v(val))}</td></tr>`).join("")}
        <tr class="total"><td>Subtotal E</td><td style="text-align:right">${fmtCad(subtotalE)}</td></tr>
      </tbody></table>
    </div>
    ${hasSpouse ? `
    <div>
      <p style="font-size:9pt;font-weight:600;color:#7C3AED;margin-bottom:8px">Spouse (D) - Income Replacement Need</p>
      <table style="margin:0"><tbody>
        <tr><td style="font-size:9pt;color:#64748B">Annual replacement need</td><td style="text-align:right">${fmtCad(Math.max(0,annReplace(spouseIncome,v(spouseInc.replacementPct),v(spouseInc.cppSurvivorBenefit))))}/yr</td></tr>
        <tr><td style="font-size:9pt;color:#64748B">Years of income</td><td style="text-align:right">${spouseYears}</td></tr>
        <tr class="total"><td>Subtotal D</td><td style="text-align:right">${fmtCad(Math.max(0,subtotalD))}</td></tr>
      </tbody></table>
      <p style="font-size:9pt;font-weight:600;color:#7C3AED;margin:12px 0 8px">Spouse (F) - Financial Assets Available</p>
      <table style="margin:0"><tbody>
        ${[["Liquid Savings",sAssets.liquidSavings,true],["RRSP",sAssets.rrsps,sAssets.rrspsUse],["Non-Registered",sAssets.nonRegistered,sAssets.nonRegisteredUse],["TFSA",sAssets.tfsa,sAssets.tfsaUse],["Other",sAssets.other,true]].filter(([,val,use])=>v(val)>0&&use!==false).map(([label,val])=>`<tr><td style="font-size:9pt;color:#64748B">${esc(label)}</td><td style="text-align:right">${fmtCad(v(val))}</td></tr>`).join("")}
        <tr class="total"><td>Subtotal F</td><td style="text-align:right">${fmtCad(subtotalF)}</td></tr>
      </tbody></table>
    </div>` : "<div></div>"}
  </div>
</div>`;

  const totalSection = `
<div class="section" style="page-break-before:always">
  <h2 class="section-title">Total Life Insurance Need</h2>
  <div class="two-col">
    <div>
      <div style="background:var(--lgray);border-radius:8px;padding:16px;border-top:4px solid var(--teal)">
        <p style="font-size:9pt;color:#64748B;font-weight:600;margin-bottom:8px">PRIMARY: A + B + C - E</p>
        <p style="font-size:9pt;color:#64748B">${fmtCad(subtotalA)} + ${fmtCad(subtotalB)} + ${fmtCad(Math.max(0,subtotalC))} - ${fmtCad(subtotalE)}</p>
        <p style="font-size:18pt;font-weight:700;color:var(--navy);margin:8px 0">${fmtCad(primaryNeed)}</p>
        <hr style="border:none;border-top:1px solid var(--mgray);margin:8px 0"/>
        <p style="font-size:9pt;color:#64748B">Existing Coverage: ${fmtCad(primaryExisting)}</p>
        <p style="font-size:14pt;font-weight:700;color:${primaryNet>0?"var(--red)":"var(--green)"}">Net Need: ${fmtCad(primaryNet)}</p>
        ${primaryPurchased > 0 ? `<hr style="border:none;border-top:1px solid var(--mgray);margin:8px 0"/>
        <p style="font-size:9pt;color:#64748B">Coverage Purchased: ${fmtCad(primaryPurchased)}</p>
        <p style="font-size:11pt;font-weight:700;color:${primaryShortfall>0?"var(--red)":"var(--green)"}">Acknowledged Shortfall: ${fmtCad(primaryShortfall)}</p>` : ""}
      </div>
      <div style="margin-top:12px">${svgNeedBreakdown(primarySections, "Primary Breakdown", primaryNeed, primaryExisting, 260, 200)}</div>
    </div>
    ${hasSpouse ? `
    <div>
      <div style="background:var(--lgray);border-radius:8px;padding:16px;border-top:4px solid #7C3AED">
        <p style="font-size:9pt;color:#64748B;font-weight:600;margin-bottom:8px">SPOUSE: A + B + D - F</p>
        <p style="font-size:9pt;color:#64748B">${fmtCad(subtotalA)} + ${fmtCad(subtotalB)} + ${fmtCad(Math.max(0,subtotalD))} - ${fmtCad(subtotalF)}</p>
        <p style="font-size:18pt;font-weight:700;color:var(--navy);margin:8px 0">${fmtCad(spouseNeed)}</p>
        <hr style="border:none;border-top:1px solid var(--mgray);margin:8px 0"/>
        <p style="font-size:9pt;color:#64748B">Existing Coverage: ${fmtCad(spouseExisting)}</p>
        <p style="font-size:14pt;font-weight:700;color:${spouseNet>0?"var(--red)":"var(--green)"}">Net Need: ${fmtCad(spouseNet)}</p>
        ${spousePurchased > 0 ? `<hr style="border:none;border-top:1px solid var(--mgray);margin:8px 0"/>
        <p style="font-size:9pt;color:#64748B">Coverage Purchased: ${fmtCad(spousePurchased)}</p>
        <p style="font-size:11pt;font-weight:700;color:${spouseShortfall>0?"var(--red)":"var(--green)"}">Acknowledged Shortfall: ${fmtCad(spouseShortfall)}</p>` : ""}
      </div>
      <div style="margin-top:12px">${svgNeedBreakdown(spouseSections, "Spouse Breakdown", spouseNeed, spouseExisting, 260, 200)}</div>
    </div>` : "<div></div>"}
  </div>
</div>`;

  const decisionSection = `
<div class="section">
  <h2 class="section-title">Decision &amp; Acknowledgement</h2>
  <div class="two-col">
    <div class="person-card primary">
      <div class="person-label">${esc(primaryName)}</div>
      <table style="margin:0"><tbody>
        <tr><td style="font-size:9pt;color:#64748B">Coverage Purchased</td><td style="font-weight:700">${fmtCad(primaryPurchased)}</td></tr>
        <tr><td style="font-size:9pt;color:#64748B">Acknowledged Shortfall</td><td style="font-weight:700;color:var(--red)">${fmtCad(primaryShortfall)}</td></tr>
      </tbody></table>
    </div>
    ${hasSpouse ? `
    <div class="person-card spouse">
      <div class="person-label">${esc(spouseName)}</div>
      <table style="margin:0"><tbody>
        <tr><td style="font-size:9pt;color:#64748B">Coverage Purchased</td><td style="font-weight:700">${fmtCad(spousePurchased)}</td></tr>
        <tr><td style="font-size:9pt;color:#64748B">Acknowledged Shortfall</td><td style="font-weight:700;color:var(--red)">${fmtCad(spouseShortfall)}</td></tr>
      </tbody></table>
    </div>` : "<div></div>"}
  </div>

  <div style="margin-top:24px;border:1px solid var(--mgray);border-radius:8px;padding:20px">
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px">
      <div>
        <p style="font-size:9pt;font-weight:600;color:var(--teal);margin-bottom:12px">${esc(primaryName)}</p>
        <div class="sig-line"></div>
        <p style="font-size:8pt;color:#64748B">Client Signature</p>
      </div>
      ${hasSpouse ? `
      <div>
        <p style="font-size:9pt;font-weight:600;color:#7C3AED;margin-bottom:12px">${esc(spouseName)}</p>
        <div class="sig-line"></div>
        <p style="font-size:8pt;color:#64748B">Spouse Signature</p>
      </div>` : "<div></div>"}
      <div>
        <p style="font-size:9pt;font-weight:600;color:var(--navy);margin-bottom:12px">${esc(advisorName)}</p>
        <div class="sig-line"></div>
        <p style="font-size:8pt;color:#64748B">Advisor Signature</p>
      </div>
    </div>
    <div style="margin-top:16px;display:grid;grid-template-columns:200px 1fr;gap:24px;align-items:end">
      <div>
        <div class="sig-line">${esc(ws.signatureDate) || ""}</div>
        <p style="font-size:8pt;color:#64748B">Date</p>
      </div>
    </div>
  </div>

  ${ws.meetingNotes ? `<h3>Meeting Notes</h3><div class="callout"><p>${esc(ws.meetingNotes)}</p></div>` : ""}
</div>`;

  const body = [cover, summarySection, clientSection, needSection, totalSection, decisionSection,
    `<div style="padding:16px 48px;color:#94A3B8;font-size:8.5pt;border-top:1px solid #E2E8F0;margin-top:16px;page-break-before:avoid">
      Report generated ${dateStr} - ${DEFAULT_FIRM} - Confidential - prepared solely for ${esc(name)}.
    </div>`].join("\n");

  return htmlShell(`Family Needs Analysis - ${name}`, body);
}

export function generateNetWorthReport(data: { client: any; netWorth: any[] }): string {
  const { client, netWorth } = data;
  const name = `${client.firstName} ${client.lastName}`;
  const dateStr = new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
  const assets = netWorth.filter(e => e.type === "asset");
  const liabs  = netWorth.filter(e => e.type === "liability");
  const totalA = assets.reduce((s, e) => s + v(e.value), 0);
  const totalL = liabs.reduce((s, e)  => s + v(e.value), 0);
  const nw = totalA - totalL;
  const cover = reportOpener({ reportTitle: "Net Worth Statement", reportSubtitle: `As at ${dateStr}`, clientName: name, clientFirstName: client.firstName, advisorName: "Your Advisor", dateStr });
  const body = cover + `
<div class="section">
  <h2 class="section-title">Balance Sheet</h2>
  <div class="summary-grid">
    <div class="summary-card"><div class="label">Total Assets</div><div class="value positive">${fmtCad(totalA)}</div></div>
    <div class="summary-card"><div class="label">Total Liabilities</div><div class="value negative">${fmtCad(totalL)}</div></div>
    <div class="summary-card"><div class="label">Net Worth</div><div class="value ${nw>=0?"positive":"negative"}">${fmtCad(nw)}</div></div>
  </div>
  <h3>Assets</h3>
  <table><thead><tr><th>Description</th><th>Category</th><th>Owner</th><th style="text-align:right">Value</th></tr></thead><tbody>
    ${assets.map(e=>`<tr><td>${esc(e.name||e.category)}</td><td>${esc(e.category)}</td><td>${esc(e.owner==="spouse"?"Spouse":"Primary")}</td><td style="text-align:right">${fmtCad(v(e.value))}</td></tr>`).join("")}
    <tr class="total"><td colspan="3">Total Assets</td><td style="text-align:right">${fmtCad(totalA)}</td></tr>
  </tbody></table>
  ${liabs.length>0?`
  <h3>Liabilities</h3>
  <table><thead><tr><th>Description</th><th>Category</th><th>Owner</th><th style="text-align:right">Value</th></tr></thead><tbody>
    ${liabs.map(e=>`<tr><td>${esc(e.name||e.category)}</td><td>${esc(e.category)}</td><td>${esc(e.owner==="spouse"?"Spouse":"Primary")}</td><td style="text-align:right">${fmtCad(v(e.value))}</td></tr>`).join("")}
    <tr class="total"><td colspan="3">Total Liabilities</td><td style="text-align:right">${fmtCad(totalL)}</td></tr>
  </tbody></table>`:""}
  <div style="margin-top:20px;padding:16px;background:var(--lgray);border-radius:8px;display:flex;justify-content:space-between;align-items:center">
    <span style="font-size:14pt;font-weight:700;color:var(--navy)">Net Worth</span>
    <span style="font-size:18pt;font-weight:700;color:${nw>=0?"var(--green)":"var(--red)"}">${fmtCad(nw)}</span>
  </div>
</div>`;
  return htmlShell(`Net Worth Statement - ${name}`, body);
}

export function generateComprehensiveReport(data: { client: any; advisor?: any; netWorth: any[]; insurance: any | null; debts: any[]; education: any[]; }): string {
  const { client } = data;
  const name = `${client.firstName} ${client.lastName}`;
  const dateStr = new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
  const advisorName = data.advisor ? `${data.advisor.firstName} ${data.advisor.lastName}` : "Your Advisor";
  const assets = data.netWorth.filter(e => e.type === "asset");
  const liabs  = data.netWorth.filter(e => e.type === "liability");
  const totalA = assets.reduce((s, e) => s + v(e.value), 0);
  const totalL = liabs.reduce((s, e)  => s + v(e.value), 0);
  const ins = data.insurance;
  const spouseName = client.spouseFirstName ? `${client.spouseFirstName} ${client.spouseLastName ?? ""}`.trim() : undefined;
  const cover = reportOpener({ reportTitle: "Financial Plan", reportSubtitle: "Comprehensive Review", clientName: name, clientFirstName: client.firstName, spouseName, spouseFirstName: client.spouseFirstName ?? undefined, advisorName, advisorEmail: data.advisor?.email, advisorPhone: data.advisor?.phone, province: client.province ?? undefined, dateStr });
  const body = cover + `
<div class="section">
  <h2 class="section-title">Net Worth</h2>
  <div class="summary-grid">
    <div class="summary-card"><div class="label">Total Assets</div><div class="value positive">${fmtCad(totalA)}</div></div>
    <div class="summary-card"><div class="label">Total Liabilities</div><div class="value negative">${fmtCad(totalL)}</div></div>
    <div class="summary-card"><div class="label">Net Worth</div><div class="value ${totalA-totalL>=0?"positive":"negative"}">${fmtCad(totalA-totalL)}</div></div>
  </div>
  ${assets.length>0?`<table><thead><tr><th>Item</th><th>Category</th><th style="text-align:right">Value</th></tr></thead><tbody>
    ${assets.map(e=>`<tr><td>${esc(e.name||e.category)}</td><td>${esc(e.category)}</td><td style="text-align:right">${fmtCad(v(e.value))}</td></tr>`).join("")}
    ${liabs.map(e=>`<tr><td>${esc(e.name||e.category)}</td><td>${esc(e.category)}</td><td style="text-align:right;color:var(--red)">(${fmtCad(v(e.value))})</td></tr>`).join("")}
    <tr class="total"><td colspan="2">Net Worth</td><td style="text-align:right">${fmtCad(totalA-totalL)}</td></tr>
  </tbody></table>`:`<p style="color:#64748B">No net worth entries recorded.</p>`}
</div>
${ins?`<div class="section"><h2 class="section-title">Insurance Needs Analysis</h2>
  <div class="summary-grid">
    <div class="summary-card"><div class="label">Life Insurance Need</div><div class="value">${fmtCad(v(ins.recommendedLifeCoverage))}</div></div>
    <div class="summary-card"><div class="label">Coverage Gap</div><div class="value ${v(ins.lifeCoverageGap)>0?"negative":"positive"}">${fmtCad(v(ins.lifeCoverageGap))}</div></div>
    <div class="summary-card"><div class="label">Primary</div><div class="value" style="font-size:11pt">${esc(ins.primaryName||name)}</div></div>
  </div></div>`:""}
${data.debts.length>0?`<div class="section"><h2 class="section-title">Debt Summary</h2>
  <table><thead><tr><th>Account</th><th>Type</th><th style="text-align:right">Balance</th><th style="text-align:right">Rate</th></tr></thead><tbody>
    ${data.debts.map(d=>`<tr><td>${esc(d.name)}</td><td>${esc(d.type)}</td><td style="text-align:right">${fmtCad(v(d.balance))}</td><td style="text-align:right">${v(d.interestRate).toFixed(2)}%</td></tr>`).join("")}
    <tr class="total"><td colspan="2">Total</td><td style="text-align:right">${fmtCad(data.debts.reduce((s,d)=>s+v(d.balance),0))}</td><td></td></tr>
  </tbody></table></div>`:""}
${data.education.length>0?`<div class="section"><h2 class="section-title">Education Savings (RESP)</h2>
  <table><thead><tr><th>Child</th><th>Birth Year</th><th style="text-align:right">Balance</th><th style="text-align:right">Annual Contribution</th></tr></thead><tbody>
    ${data.education.map(e=>`<tr><td>${esc(e.childName)}</td><td>${esc(e.childBirthYear)}</td><td style="text-align:right">${fmtCad(v(e.currentBalance))}</td><td style="text-align:right">${fmtCad(v(e.annualContribution))}</td></tr>`).join("")}
  </tbody></table></div>`:""}
<div style="padding:32px 48px;color:#94A3B8;font-size:8.5pt;border-top:1px solid #E2E8F0;margin-top:40px">
  Report generated ${dateStr} - ${DEFAULT_FIRM} - Confidential - prepared solely for ${esc(name)}.
</div>`;
  return htmlShell(`Financial Plan - ${name}`, body);
}













// -- Knights of Columbus Report Types -------------------------------------------------
interface ReportClient { id: number; firstName: string; lastName: string; email?: string; phone?: string; dateOfBirth?: string; province?: string; spouseFirstName?: string; spouseLastName?: string; spouseDateOfBirth?: string; annualIncome?: string | number; spouseAnnualIncome?: string | number; [key: string]: any; }
interface ReportSimulation { successRate: number; p10: number; p25: number; p50: number; p75: number; p90: number; simulationCount?: number; yearsProjected?: number; percentileBands: PercentileBands; medianPath?: number[]; finalBalancePercentiles?: { p10: number; p25: number; p50: number; p75: number; p90: number }; }
interface ReportNetWorthEntry { id: number; type: string; category: string; name?: string; value: string | number; owner?: string; }
interface ReportProduct { id: number; type?: string; carrier?: string; coverageAmount?: string | number; premium?: string | number; status?: string; [key: string]: any; }
function pct(n: number, decimals = 1): string { return `${(n * 100).toFixed(decimals)}%`; }

// -- Monte Carlo Chart (from Knights of Columbus) -------------------------------------
interface PercentileBands { p10: number[]; p25: number[]; p50: number[]; p75: number[]; p90: number[]; }
function svgMonteCarloChart(
  bands:        PercentileBands,
  successRate:  number,
  width  = 680,
  height = 260,
): string {
  const pad = { top: 20, right: 20, bottom: 40, left: 70 };
  const W   = width  - pad.left - pad.right;
  const H   = height - pad.top  - pad.bottom;
  const N   = bands.p50.length;

  const allValues = [...bands.p10, ...bands.p90].filter(v => v >= 0);
  const maxVal    = Math.max(...allValues) * 1.05;
  const minVal    = Math.min(0, ...bands.p10);

  const xScale = (i: number) => (i / Math.max(1, N - 1)) * W;
  const yScale = (v: number) => H - ((v - minVal) / (maxVal - minVal)) * H;

  const pointsStr = (arr: number[]) =>
    arr.map((v, i) => `${xScale(i).toFixed(1)},${yScale(v).toFixed(1)}`).join(" ");

  const p10pts  = pointsStr(bands.p10);
  const p90pts  = pointsStr(bands.p90);
  const p25pts  = pointsStr(bands.p25);
  const p75pts  = pointsStr(bands.p75);
  const p50pts  = pointsStr(bands.p50);

  // Shaded band p10-p90 (closed polygon)
  const p90rev  = [...bands.p90].reverse();
  const band90  = [...bands.p10.map((v, i) => [xScale(i), yScale(v)]),
                    ...p90rev.map((v, i) => [xScale(N - 1 - i), yScale(v)])];
  const band90d = band90.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  const p75rev  = [...bands.p75].reverse();
  const band50  = [...bands.p25.map((v, i) => [xScale(i), yScale(v)]),
                    ...p75rev.map((v, i) => [xScale(N - 1 - i), yScale(v)])];
  const band50d = band50.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  // Y-axis labels
  const yTicks = 5;
  const yLabels = Array.from({ length: yTicks + 1 }, (_, i) => {
    const val = minVal + (maxVal - minVal) * (i / yTicks);
    return { y: yScale(val), label: val >= 1_000_000 ? `$${(val / 1_000_000).toFixed(1)}M` : `$${(val / 1_000).toFixed(0)}k` };
  });

  // X-axis labels (every 5 years)
  const xLabels: { x: number; label: string }[] = [];
  for (let i = 0; i < N; i += 5) {
    xLabels.push({ x: xScale(i), label: `Yr ${i}` });
  }

  const color = successRate >= 0.80 ? "#16A34A" : successRate >= 0.60 ? "#D97706" : "#DC2626";

  return `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="font-family:Arial,sans-serif">
  <defs>
    <clipPath id="chart-clip">
      <rect x="0" y="0" width="${W}" height="${H}" />
    </clipPath>
  </defs>
  <g transform="translate(${pad.left},${pad.top})">
    <!-- Y gridlines -->
    ${yLabels.map(({ y, label }) => `
      <line x1="0" y1="${y.toFixed(1)}" x2="${W}" y2="${y.toFixed(1)}" stroke="#E2E8F0" stroke-width="1"/>
      <text x="-6" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="9" fill="#64748B">${esc(label)}</text>
    `).join("")}

    <!-- X labels -->
    ${xLabels.map(({ x, label }) => `
      <line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${H}" stroke="#F1F5F9" stroke-width="1"/>
      <text x="${x.toFixed(1)}" y="${H + 14}" text-anchor="middle" font-size="9" fill="#64748B">${esc(label)}</text>
    `).join("")}

    <!-- Clip group -->
    <g clip-path="url(#chart-clip)">
      <!-- p10-p90 band -->
      <polygon points="${band90d}" fill="#DBEAFE" fill-opacity="0.6"/>
      <!-- p25-p75 band -->
      <polygon points="${band50d}" fill="#93C5FD" fill-opacity="0.5"/>
      <!-- p10 / p90 lines -->
      <polyline points="${p10pts}" fill="none" stroke="#93C5FD" stroke-width="1" stroke-dasharray="4,2"/>
      <polyline points="${p90pts}" fill="none" stroke="#93C5FD" stroke-width="1" stroke-dasharray="4,2"/>
      <!-- p25 / p75 lines -->
      <polyline points="${p25pts}" fill="none" stroke="#3B82F6" stroke-width="1.2"/>
      <polyline points="${p75pts}" fill="none" stroke="#3B82F6" stroke-width="1.2"/>
      <!-- Median (p50) -->
      <polyline points="${p50pts}" fill="none" stroke="#1D4ED8" stroke-width="2.5"/>
    </g>

    <!-- Axes -->
    <line x1="0" y1="0" x2="0" y2="${H}" stroke="#94A3B8" stroke-width="1.5"/>
    <line x1="0" y1="${H}" x2="${W}" y2="${H}" stroke="#94A3B8" stroke-width="1.5"/>

    <!-- Success rate badge -->
    <rect x="${W - 120}" y="4" width="116" height="28" rx="4" fill="${color}" fill-opacity="0.12"/>
    <text x="${W - 62}" y="17" text-anchor="middle" font-size="9" font-weight="600" fill="${color}">SUCCESS RATE</text>
    <text x="${W - 62}" y="27" text-anchor="middle" font-size="11" font-weight="700" fill="${color}">${(successRate * 100).toFixed(0)}%</text>
  </g>

  <!-- Legend -->
  <g transform="translate(${pad.left}, ${height - 10})">
    <rect x="0"   y="-6" width="10" height="4" fill="#DBEAFE"/>
    <text x="14"  y="-2" font-size="8" fill="#64748B">p10G - p90 range</text>
    <rect x="100" y="-6" width="10" height="4" fill="#93C5FD"/>
    <text x="114" y="-2" font-size="8" fill="#64748B">p25G - p75 range</text>
    <line x1="210" y1="-4" x2="220" y2="-4" stroke="#1D4ED8" stroke-width="2.5"/>
    <text x="224" y="-2" font-size="8" fill="#64748B">Median path</text>
  </g>
</svg>`;
}

// G - G -  Comprehensive Report G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - 


// -- Additional Reports (from Knights of Columbus) ------------------------------------
export function generateRetirementReport(data: {
  client:     ReportClient;
  retirement: Record<string, unknown> | null;
  taxYears?:  Record<string, unknown>[];
  sim?:       ReportSimulation;
}): string {
  const client = data.client as any; const retirement = data.retirement as any; const sim = data.sim as any;
  const name    = `${client.firstName} ${client.lastName}`;
  const dateStr = new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });

  const mcChart = sim ? svgMonteCarloChart(sim.percentileBands, sim.successRate) : "";

  // Year-by-year income table (first 20 years of retirement if available)
  const taxRows = (data.taxYears as any[])?.slice(0, 25).map((y: any) => `
  <tr>
    <td>${y.year}</td><td>${y.age}</td>
    <td style="text-align:right">${fmtCad(Number(y.employmentIncome) + Number(y.pensionIncome))}</td>
    <td style="text-align:right">${fmtCad(Number(y.cppBenefit) + Number(y.oasBenefit))}</td>
    <td style="text-align:right">${fmtCad(Number(y.rrifWithdrawal))}</td>
    <td style="text-align:right">${fmtCad(Number(y.totalTaxableIncome))}</td>
    <td style="text-align:right">${fmtCad(Number(y.totalTax))}</td>
    <td style="text-align:right">${pct(Number(y.effectiveRate))}</td>
    <td style="text-align:right">${fmtCad(Number(y.totalWealth))}</td>
  </tr>`).join("") ?? "";

  const cover = reportOpener({ reportTitle: "Retirement Income Projection", clientName: name, clientFirstName: client.firstName, advisorName: "Your Advisor", dateStr });
  const body = cover + `

<div class="section">
  <h2 class="section-title">Retirement Overview</h2>
  ${retirement ? `
  <div class="summary-grid">
    <div class="summary-card"><div class="label">Retirement Age</div><div class="value">${esc(retirement.retirementAge)}</div></div>
    <div class="summary-card"><div class="label">Projected Balance</div><div class="value positive">${fmtCad(parseFloat(retirement.projectedBalance || "0"))}</div></div>
    <div class="summary-card"><div class="label">Success Rate</div>
      <div class="value ${sim ? (sim.successRate >= 0.80 ? "positive" : sim.successRate >= 0.60 ? "warn" : "negative") : ""}">${sim ? `${(sim.successRate * 100).toFixed(0)}%` : " - "}</div>
    </div>
  </div>` : ""}

  ${sim ? `
  <h3>Monte Carlo Projection (${sim.yearsProjected} Years - ${sim.simulationCount?.toLocaleString() ?? ""} Simulations)</h3>
  <div class="chart-container">${mcChart}</div>
  <table>
    <thead><tr><th>Scenario</th><th style="text-align:right">Portfolio at End of Plan</th></tr></thead>
    <tbody>
      <tr><td>90th percentile (best case)</td><td style="text-align:right">${fmtCad(sim.finalBalancePercentiles.p90)}</td></tr>
      <tr><td>75th percentile</td><td style="text-align:right">${fmtCad(sim.finalBalancePercentiles.p75)}</td></tr>
      <tr><td>Median</td><td style="text-align:right">${fmtCad(sim.finalBalancePercentiles.p50)}</td></tr>
      <tr><td>25th percentile</td><td style="text-align:right">${fmtCad(sim.finalBalancePercentiles.p25)}</td></tr>
      <tr><td>10th percentile (worst case)</td><td style="text-align:right">${fmtCad(sim.finalBalancePercentiles.p10)}</td></tr>
    </tbody>
  </table>` : ""}

  ${taxRows ? `
  <h3>Year-by-Year Income & Tax Projection</h3>
  <table>
    <thead><tr>
      <th>Year</th><th>Age</th><th style="text-align:right">Employment / Pension</th>
      <th style="text-align:right">CPP / OAS</th><th style="text-align:right">RRIF</th>
      <th style="text-align:right">Taxable Income</th><th style="text-align:right">Total Tax</th>
      <th style="text-align:right">Eff. Rate</th><th style="text-align:right">Total Wealth</th>
    </tr></thead>
    <tbody>${taxRows}</tbody>
  </table>` : ""}
</div>`;

  return htmlShell(`Retirement Report  -  ${name}`, body);
}

// G - G -  Insurance report G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - 

export function generateInsuranceReport(data: {
  client:     ReportClient;
  insurance:  Record<string, unknown> | null;
  products:   ReportProduct[];
}): string {
  const client = data.client as any; const insurance = data.insurance as any; const products = (data.products ?? []) as any[];
  const name    = `${client.firstName} ${client.lastName}`;
  const dateStr = new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });

  const insProducts = products.filter(p =>
    p.type === "insurance" || p.type === "segregated_fund"
  );

  const cover = reportOpener({ reportTitle: "Insurance Needs Analysis", clientName: name, clientFirstName: client.firstName, advisorName: "Your Advisor", dateStr });
  const body = cover + `

<div class="section">
  <h2 class="section-title">Coverage Summary</h2>
  ${insurance ? `
  <div class="summary-grid">
    <div class="summary-card"><div class="label">Recommended Life Coverage</div><div class="value">${fmtCad(parseFloat(insurance.recommendedLifeCoverage || "0"))}</div></div>
    <div class="summary-card"><div class="label">Life Coverage Gap</div>
      <div class="value ${parseFloat(insurance.lifeCoverageGap || "0") > 0 ? "negative" : "positive"}">
        ${parseFloat(insurance.lifeCoverageGap || "0") > 0 ? "-" : ""}${fmtCad(Math.abs(parseFloat(insurance.lifeCoverageGap || "0")))}
      </div>
    </div>
    <div class="summary-card"><div class="label">Disability Gap</div>
      <div class="value ${parseFloat(insurance.disabilityCoverageGap || "0") > 0 ? "negative" : "positive"}">
        ${parseFloat(insurance.disabilityCoverageGap || "0") > 0 ? "-" : ""}${fmtCad(Math.abs(parseFloat(insurance.disabilityCoverageGap || "0")))}
      </div>
    </div>
  </div>

  <h3>Needs Analysis  -  Life Insurance</h3>
  <table>
    <thead><tr><th>Method</th><th style="text-align:right">Required Coverage</th><th style="text-align:right">Current Coverage</th><th style="text-align:right">Gap</th><th>Status</th></tr></thead>
    <tbody>
      ${[
        ["DIME Method",          insurance.dimeCoverage],
        ["Human Life Value",     insurance.hlvCoverage],
        ["Capital Retention",    insurance.capitalRetentionCoverage],
      ].map(([method, coverage]) => {
        const rec  = parseFloat(String(coverage) || "0");
        const curr = parseFloat(insurance.existingLifeCoverage || "0");
        const gap  = Math.max(0, rec - curr);
        return `<tr>
          <td>${esc(method)}</td>
          <td style="text-align:right">${fmtCad(rec)}</td>
          <td style="text-align:right">${fmtCad(curr)}</td>
          <td style="text-align:right;color:${gap > 0 ? "var(--red)" : "var(--green)"}">${gap > 0 ? `-${fmtCad(gap)}` : "G -  Covered"}</td>
          <td><span class="badge ${gap > 0 ? "badge-red" : "badge-green"}">${gap > 0 ? "Gap" : "Adequate"}</span></td>
        </tr>`;
      }).join("")}
    </tbody>
  </table>` : `<p style="color:#64748B">No insurance analysis on file.</p>`}

  ${insProducts.length > 0 ? `
  <h3>Current Policies on File</h3>
  <table>
    <thead><tr><th>Provider</th><th>Policy #</th><th>Type</th><th style="text-align:right">Coverage / Value</th><th>Status</th></tr></thead>
    <tbody>
      ${insProducts.map(p => `
      <tr>
        <td>${esc(p.provider)}</td>
        <td>${esc(p.policyNumber)}</td>
        <td>${esc(p.type)}</td>
        <td style="text-align:right">${fmtCad(parseFloat(p.value || "0"))}</td>
        <td><span class="badge ${p.status === "active" ? "badge-green" : "badge-amber"}">${esc(p.status)}</span></td>
      </tr>`).join("")}
    </tbody>
  </table>` : ""}
</div>`;

  return htmlShell(`Insurance Report  -  ${name}`, body);
}

// G - G -  Net Worth Statement G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - 

export function generateCashFlowReport(data: {
  client: ReportClient;
  generatedAt: string;
  advisor?: { firstName?: string; lastName?: string } | null;
  expenses: Array<{ category: string; description?: string | null; monthlyAmount: string; isEssential: boolean; includeInRetirement: boolean; retirementAdjustmentPct?: number | null }>;
  retirement: Record<string, unknown> | null;
}): string {
  const name = `${data.client.firstName} ${data.client.lastName}`;
  const dateStr = new Date(data.generatedAt).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
  const advisorName = data.advisor ? `${data.advisor.firstName} ${data.advisor.lastName}` : "Your Financial Advisor";

  const totalMonthly = data.expenses.reduce((s, e) => s + parseFloat(e.monthlyAmount || "0"), 0);
  const totalAnnual = totalMonthly * 12;
  const essentialMonthly = data.expenses.filter(e => e.isEssential).reduce((s, e) => s + parseFloat(e.monthlyAmount || "0"), 0);
  const discretionaryMonthly = totalMonthly - essentialMonthly;
  const retirementMonthly = data.expenses.filter(e => e.includeInRetirement)
    .reduce((s, e) => s + parseFloat(e.monthlyAmount || "0") * (e.retirementAdjustmentPct || 100) / 100, 0);

  // Group by category
  const byCat: Record<string, typeof data.expenses> = {};
  for (const e of data.expenses) {
    if (!byCat[e.category]) byCat[e.category] = [];
    byCat[e.category].push(e);
  }

  const catRows = Object.entries(byCat).map(([cat, items]) => {
    const catTotal = items.reduce((s, e) => s + parseFloat(e.monthlyAmount || "0"), 0);
    const itemRows = items.map(e => `
      <tr>
        <td style="padding-left:24px">${esc(e.description || e.category)}</td>
        <td><span class="badge ${e.isEssential ? "badge-blue" : "badge-amber"}">${e.isEssential ? "Essential" : "Discretionary"}</span></td>
        <td style="text-align:right">${fmtCad(parseFloat(e.monthlyAmount || "0"))}</td>
        <td style="text-align:right">${fmtCad(parseFloat(e.monthlyAmount || "0") * 12)}</td>
        <td style="text-align:right">${e.includeInRetirement ? fmtCad(parseFloat(e.monthlyAmount || "0") * (e.retirementAdjustmentPct || 100) / 100) : "<em style='color:#94a3b8'>excluded</em>"}</td>
      </tr>`).join("");
    return `
      <tr style="background:#EFF6FF">
        <td><strong>${esc(cat)}</strong></td>
        <td></td>
        <td style="text-align:right"><strong>${fmtCad(catTotal)}/mo</strong></td>
        <td style="text-align:right"><strong>${fmtCad(catTotal * 12)}/yr</strong></td>
        <td></td>
      </tr>${itemRows}`;
  }).join("");

  const retDesiredIncome = data.retirement ? parseFloat(String((data.retirement as any).desiredRetirementIncome || "0")) : 0;
  const retirementGap = retDesiredIncome - retirementMonthly * 12;

  const body = `
${reportOpener({ reportTitle: "Cash Flow Statement", reportSubtitle: "Detailed Household Budget", clientName: name, clientFirstName: name.split(" ")[0], advisorName, dateStr })}
<div class="section">
  <h2 class="section-title">Summary</h2>
  <div class="summary-grid" style="grid-template-columns:repeat(4,1fr)">
    <div class="summary-card"><div class="label">Total Monthly</div><div class="value">${fmtCad(totalMonthly)}</div></div>
    <div class="summary-card"><div class="label">Total Annual</div><div class="value">${fmtCad(totalAnnual)}</div></div>
    <div class="summary-card"><div class="label">Essential</div><div class="value">${fmtCad(essentialMonthly)}/mo</div></div>
    <div class="summary-card"><div class="label">Discretionary</div><div class="value warn">${fmtCad(discretionaryMonthly)}/mo</div></div>
  </div>
  ${retDesiredIncome > 0 ? `<div class="callout ${retirementGap >= 0 ? "good" : "warn"}">
    <strong>Retirement Income Check:</strong> Projected retirement expenses ${fmtCad(retirementMonthly * 12)}/yr vs. desired retirement income ${fmtCad(retDesiredIncome)}/yr.
    ${retirementGap >= 0 ? `Surplus of ${fmtCad(retirementGap)}.` : `<strong>Shortfall of ${fmtCad(Math.abs(retirementGap))}</strong>  -  review savings rate.`}
    Based on the 4% rule, sustaining these expenses requires a portfolio of <strong>${fmtCad(retirementMonthly * 12 / 0.04)}</strong>.
  </div>` : ""}
</div>
<div class="section">
  <h2 class="section-title">Expense Detail</h2>
  ${data.expenses.length === 0 ? "<p>No expenses recorded. Add expenses in the Expenses tab.</p>" : `
  <table>
    <thead><tr><th>Description</th><th>Type</th><th style="text-align:right">Monthly</th><th style="text-align:right">Annual</th><th style="text-align:right">In Retirement</th></tr></thead>
    <tbody>
      ${catRows}
      <tr class="total"><td>Total</td><td></td><td style="text-align:right">${fmtCad(totalMonthly)}/mo</td><td style="text-align:right">${fmtCad(totalAnnual)}/yr</td><td style="text-align:right">${fmtCad(retirementMonthly)}/mo</td></tr>
    </tbody>
  </table>`}
</div>
<div class="footer"><span>${DEFAULT_FIRM}  -  Confidential</span><span>${esc(name)}  -  Cash Flow Statement  -  ${esc(dateStr)}</span></div>`;

  return htmlShell(`Cash Flow Statement  -  ${name}`, body);
}

// G - G -  Asset Allocation & Mix Report G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - 
export function generateAssetAllocationReport(data: {
  client: ReportClient;
  generatedAt: string;
  advisor?: { firstName?: string; lastName?: string } | null;
  netWorth: ReportNetWorthEntry[];
}): string {
  const name = `${data.client.firstName} ${data.client.lastName}`;
  const dateStr = new Date(data.generatedAt).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
  const advisorName = data.advisor ? `${data.advisor.firstName} ${data.advisor.lastName}` : "Your Financial Advisor";

  const investments = data.netWorth.filter(e => e.type === "asset" && e.category === "Investments");
  const totalInvested = investments.reduce((s, e) => s + parseFloat(String(e.value) || "0"), 0);

  // By account type
  const byAccount: Record<string, number> = {};
  for (const e of investments) {
    const key = (e as any).accountType || "Other";
    byAccount[key] = (byAccount[key] || 0) + parseFloat(String(e.value) || "0");
  }

  // By investment type
  const byType: Record<string, number> = {};
  for (const e of investments) {
    const key = (e as any).investmentType || "Unclassified";
    byType[key] = (byType[key] || 0) + parseFloat(String(e.value) || "0");
  }

  const accountRows = Object.entries(byAccount).map(([k, v]) => `
    <tr><td>${esc(k)}</td><td style="text-align:right">${fmtCad(v)}</td>
    <td style="text-align:right">${totalInvested > 0 ? pct(v / totalInvested * 100) : "0.0%"}</td>
    <td><div style="background:#e2e8f0;border-radius:4px;height:8px;width:100%;max-width:200px"><div style="background:var(--teal);border-radius:4px;height:8px;width:${totalInvested > 0 ? Math.round(v / totalInvested * 100) : 0}%"></div></div></td>
    </tr>`).join("");

  const typeRows = Object.entries(byType).map(([k, v]) => `
    <tr><td>${esc(k)}</td><td style="text-align:right">${fmtCad(v)}</td>
    <td style="text-align:right">${totalInvested > 0 ? pct(v / totalInvested * 100) : "0.0%"}</td></tr>`).join("");

  const holdingRows = investments.map(e => `
    <tr><td>${esc(e.name || e.category)}</td>
    <td>${esc((e as any).accountType || " - ")}</td>
    <td>${esc((e as any).investmentType || " - ")}</td>
    <td style="text-align:right">${fmtCad(parseFloat(String(e.value) || "0"))}</td>
    <td style="text-align:right">${totalInvested > 0 ? pct(parseFloat(String(e.value) || "0") / totalInvested * 100) : "0.0%"}</td></tr>`).join("");

  // Concentration warnings
  const warnings = Object.entries(byAccount)
    .filter(([, v]) => totalInvested > 0 && v / totalInvested > 0.5)
    .map(([k]) => `<div class="callout warn"><strong>Concentration Risk:</strong> Over 50% of investments are in ${esc(k)} accounts. Consider diversifying across account types.</div>`).join("");

  const body = `
${reportOpener({ reportTitle: "Asset Allocation & Mix", reportSubtitle: "Investment Portfolio Review", clientName: name, clientFirstName: name.split(" ")[0], advisorName, dateStr })}
<div class="section">
  <h2 class="section-title">Allocation by Account Type</h2>
  ${warnings}
  ${investments.length === 0 ? "<p>No investment holdings recorded. Add investments in the Net Worth tab.</p>" : `
  <table>
    <thead><tr><th>Account Type</th><th style="text-align:right">Value</th><th style="text-align:right">Weight</th><th>Distribution</th></tr></thead>
    <tbody>${accountRows}<tr class="total"><td>Total</td><td style="text-align:right">${fmtCad(totalInvested)}</td><td style="text-align:right">100.0%</td><td></td></tr></tbody>
  </table>`}
</div>
<div class="section">
  <h2 class="section-title">Allocation by Investment Type</h2>
  <table>
    <thead><tr><th>Investment Type</th><th style="text-align:right">Value</th><th style="text-align:right">Weight</th></tr></thead>
    <tbody>${typeRows}<tr class="total"><td>Total</td><td style="text-align:right">${fmtCad(totalInvested)}</td><td style="text-align:right">100.0%</td></tr></tbody>
  </table>
</div>
<div class="section">
  <h2 class="section-title">Holdings Detail</h2>
  <table>
    <thead><tr><th>Holding</th><th>Account</th><th>Type</th><th style="text-align:right">Value</th><th style="text-align:right">Weight</th></tr></thead>
    <tbody>${holdingRows}</tbody>
  </table>
</div>
<div class="footer"><span>${DEFAULT_FIRM}  -  Confidential</span><span>${esc(name)}  -  Asset Allocation  -  ${esc(dateStr)}</span></div>`;

  return htmlShell(`Asset Allocation  -  ${name}`, body);
}

// G - G -  Retirement Readiness / Decumulation G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - 
export function generateRetirementReadinessReport(data: {
  client: ReportClient;
  generatedAt: string;
  advisor?: { firstName?: string; lastName?: string } | null;
  retirement: Record<string, unknown> | null;
  expenses: Array<{ monthlyAmount: string; includeInRetirement: boolean; retirementAdjustmentPct?: number | null }>;
  simulationResult?: ReportSimulation;
  netWorth: ReportNetWorthEntry[];
}): string {
  const name = `${data.client.firstName} ${data.client.lastName}`;
  const dateStr = new Date(data.generatedAt).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
  const advisorName = data.advisor ? `${data.advisor.firstName} ${data.advisor.lastName}` : "Your Financial Advisor";
  const r = data.retirement as any;

  const retirementExpenses = data.expenses
    .filter(e => e.includeInRetirement)
    .reduce((s, e) => s + parseFloat(e.monthlyAmount || "0") * (e.retirementAdjustmentPct || 100) / 100, 0) * 12;

  const projBalance = r ? parseFloat(String(r.projectedBalance || "0")) : 0;
  const desiredIncome = r ? parseFloat(String(r.desiredRetirementIncome || "0")) : 0;
  const actualIncome = retirementExpenses > 0 ? retirementExpenses : desiredIncome;
  const incomeGap = desiredIncome - actualIncome;
  const fourPctNeeded = actualIncome / 0.04;
  const readinessScore = projBalance > 0 && fourPctNeeded > 0 ? Math.min(100, Math.round(projBalance / fourPctNeeded * 100)) : 0;

  // CPP/OAS rough estimates (Canadian)
  const currentAge = r ? parseInt(String(r.currentAge || "45")) : 45;
  const retirementAge = r ? parseInt(String(r.retirementAge || "65")) : 65;
  const yearsToRetirement = Math.max(0, retirementAge - currentAge);
  const cppEstimate = 8500; // Avg CPP annual (simplified)
  const oasEstimate = retirementAge >= 65 ? 8700 : 0;
  const govBenefits = cppEstimate + oasEstimate;

  const scoreColor = readinessScore >= 80 ? "var(--green)" : readinessScore >= 50 ? "var(--amber)" : "var(--red)";
  const scoreLabel = readinessScore >= 80 ? "On Track" : readinessScore >= 50 ? "Needs Attention" : "At Risk";

  const simSection = data.simulationResult ? `
<div class="section">
  <h2 class="section-title">Monte Carlo Probability of Success</h2>
  <div class="summary-grid" style="grid-template-columns:repeat(3,1fr)">
    <div class="summary-card"><div class="label">Success Rate</div><div class="value ${data.simulationResult.successRate >= 80 ? "positive" : "negative"}">${pct(data.simulationResult.successRate)}</div></div>
    <div class="summary-card"><div class="label">Median Outcome (p50)</div><div class="value">${fmtCad(data.simulationResult.p50)}</div></div>
    <div class="summary-card"><div class="label">Worst 10% (p10)</div><div class="value ${data.simulationResult.p10 > 0 ? "positive" : "negative"}">${fmtCad(data.simulationResult.p10)}</div></div>
  </div>
  ${svgMonteCarloChart(data.simulationResult.percentileBands, data.simulationResult.successRate)}
</div>` : "";

  const body = `
${reportOpener({ reportTitle: "Retirement Readiness", reportSubtitle: "Decumulation Projection", clientName: name, clientFirstName: name.split(" ")[0], advisorName, dateStr })}
<div class="section">
  <h2 class="section-title">Readiness Score</h2>
  <div style="display:flex;align-items:center;gap:32px;margin-bottom:20px">
    <div style="text-align:center">
      <div style="width:100px;height:100px;border-radius:50%;border:8px solid ${scoreColor};display:flex;align-items:center;justify-content:center;font-size:22pt;font-weight:700;color:${scoreColor}">${readinessScore}%</div>
      <div style="font-size:9pt;font-weight:600;color:${scoreColor};margin-top:6px">${scoreLabel}</div>
    </div>
    <div style="flex:1">
      <div class="summary-grid" style="grid-template-columns:repeat(3,1fr)">
        <div class="summary-card"><div class="label">Projected Balance at Retirement</div><div class="value ${projBalance > 0 ? "positive" : "negative"}">${fmtCad(projBalance)}</div></div>
        <div class="summary-card"><div class="label">Portfolio Needed (4% Rule)</div><div class="value">${fmtCad(fourPctNeeded)}</div></div>
        <div class="summary-card"><div class="label">Shortfall / Surplus</div><div class="value ${projBalance >= fourPctNeeded ? "positive" : "negative"}">${fmtCad(projBalance - fourPctNeeded)}</div></div>
      </div>
    </div>
  </div>
  ${readinessScore < 80 ? `<div class="callout warn"><strong>Action Required:</strong> Current savings trajectory will fund ${readinessScore}% of the required retirement portfolio. Consider increasing contributions or adjusting retirement age.</div>` : `<div class="callout good"><strong>On Track:</strong> Based on current projections, this plan is expected to fully fund retirement income needs.</div>`}
</div>
<div class="section">
  <h2 class="section-title">Income in Retirement</h2>
  <div class="summary-grid" style="grid-template-columns:repeat(4,1fr)">
    <div class="summary-card"><div class="label">Portfolio Income (4%)</div><div class="value">${fmtCad(projBalance * 0.04)}/yr</div></div>
    <div class="summary-card"><div class="label">Estimated CPP</div><div class="value">${fmtCad(cppEstimate)}/yr</div></div>
    <div class="summary-card"><div class="label">Estimated OAS</div><div class="value">${fmtCad(oasEstimate)}/yr</div></div>
    <div class="summary-card"><div class="label">Total Est. Income</div><div class="value positive">${fmtCad(projBalance * 0.04 + govBenefits)}/yr</div></div>
  </div>
  <div class="callout"><strong>Note:</strong> CPP and OAS estimates are simplified averages for planning purposes. Actual amounts depend on contribution history and election age. Consult Service Canada for personalized estimates.</div>
</div>
${simSection}
<div class="footer"><span>${DEFAULT_FIRM}  -  Confidential</span><span>${esc(name)}  -  Retirement Readiness  -  ${esc(dateStr)}</span></div>`;

  return htmlShell(`Retirement Readiness  -  ${name}`, body);
}

// G - G -  Goal Status Report G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - 
export function generateGoalStatusReport(data: {
  client: ReportClient;
  generatedAt: string;
  advisor?: { firstName?: string; lastName?: string } | null;
  plans: Array<{ id: number; name?: string | null; status?: string | null; goalAmount?: string | null; targetDate?: string | null; riskTolerance?: string | null; createdAt?: string | Date | null }>;
  education: Array<{ childName?: string | null; targetAmount?: string | null; currentBalance?: string | null; targetAge?: number | null; childAge?: number | null }>;
  retirement: Record<string, unknown> | null;
  netWorth: ReportNetWorthEntry[];
}): string {
  const name = `${data.client.firstName} ${data.client.lastName}`;
  const dateStr = new Date(data.generatedAt).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
  const advisorName = data.advisor ? `${data.advisor.firstName} ${data.advisor.lastName}` : "Your Financial Advisor";

  const totalAssets = data.netWorth.filter(e => e.type === "asset").reduce((s, e) => s + parseFloat(String(e.value) || "0"), 0);
  const totalLiabilities = data.netWorth.filter(e => e.type === "liability").reduce((s, e) => s + parseFloat(String(e.value) || "0"), 0);
  const netWorthVal = totalAssets - totalLiabilities;

  const planRows = data.plans.map(p => {
    const goal = parseFloat(String(p.goalAmount || "0"));
    const progress = goal > 0 ? Math.min(100, Math.round(netWorthVal / goal * 100)) : 0;
    const statusBadge = p.status === "completed" ? "badge-green" : p.status === "active" ? "badge-blue" : "badge-amber";
    return `<tr>
      <td>${esc(p.name || "Financial Plan")}</td>
      <td><span class="badge ${statusBadge}">${esc(p.status || "active")}</span></td>
      <td style="text-align:right">${goal > 0 ? fmtCad(goal) : " - "}</td>
      <td style="text-align:right">${p.targetDate ? new Date(p.targetDate).toLocaleDateString("en-CA") : " - "}</td>
      <td style="text-align:right">${goal > 0 ? `${progress}%` : " - "}</td>
      <td><div style="background:#e2e8f0;border-radius:4px;height:8px"><div style="background:${progress >= 80 ? "var(--green)" : progress >= 50 ? "var(--amber)" : "var(--red)"};border-radius:4px;height:8px;width:${progress}%"></div></div></td>
    </tr>`;
  }).join("");

  const respRows = data.education.map(e => {
    const target = parseFloat(String(e.targetAmount || "0"));
    const current = parseFloat(String(e.currentBalance || "0"));
    const progress = target > 0 ? Math.min(100, Math.round(current / target * 100)) : 0;
    return `<tr>
      <td>${esc(e.childName || "Child")}</td>
      <td style="text-align:right">${e.childAge ? `Age ${e.childAge}` : " - "}</td>
      <td style="text-align:right">${e.targetAge ? `Age ${e.targetAge}` : " - "}</td>
      <td style="text-align:right">${fmtCad(current)}</td>
      <td style="text-align:right">${fmtCad(target)}</td>
      <td style="text-align:right">${progress}%</td>
      <td><div style="background:#e2e8f0;border-radius:4px;height:8px"><div style="background:${progress >= 80 ? "var(--green)" : progress >= 50 ? "var(--amber)" : "var(--red)"};border-radius:4px;height:8px;width:${progress}%"></div></div></td>
    </tr>`;
  }).join("");

  const r = data.retirement as any;
  const projBalance = r ? parseFloat(String(r.projectedBalance || "0")) : 0;
  const needed = r ? parseFloat(String(r.desiredRetirementIncome || "0")) / 0.04 : 0;
  const retirementProgress = needed > 0 ? Math.min(100, Math.round(projBalance / needed * 100)) : 0;

  const body = `
${reportOpener({ reportTitle: "Goal Status Report", reportSubtitle: "Progress Dashboard", clientName: name, clientFirstName: name.split(" ")[0], advisorName, dateStr })}
<div class="section">
  <h2 class="section-title">Retirement Goal</h2>
  ${r ? `<div class="summary-grid" style="grid-template-columns:repeat(3,1fr)">
    <div class="summary-card"><div class="label">Target Retirement Age</div><div class="value">${esc(String(r.retirementAge || " - "))}</div></div>
    <div class="summary-card"><div class="label">Projected Balance</div><div class="value ${projBalance >= needed ? "positive" : "negative"}">${fmtCad(projBalance)}</div></div>
    <div class="summary-card"><div class="label">Readiness</div><div class="value ${retirementProgress >= 80 ? "positive" : "negative"}">${retirementProgress}%</div></div>
  </div>
  <div style="background:#e2e8f0;border-radius:6px;height:12px;margin:8px 0"><div style="background:${retirementProgress >= 80 ? "var(--green)" : retirementProgress >= 50 ? "var(--amber)" : "var(--red)"};border-radius:6px;height:12px;width:${retirementProgress}%"></div></div>` : "<p>No retirement projection entered.</p>"}
</div>
${data.education.length > 0 ? `<div class="section">
  <h2 class="section-title">Education (RESP) Goals</h2>
  <table>
    <thead><tr><th>Child</th><th style="text-align:right">Current Age</th><th style="text-align:right">Target Age</th><th style="text-align:right">Current Balance</th><th style="text-align:right">Target</th><th style="text-align:right">Progress</th><th>Track</th></tr></thead>
    <tbody>${respRows}</tbody>
  </table>
</div>` : ""}
${data.plans.length > 0 ? `<div class="section">
  <h2 class="section-title">Financial Plans</h2>
  <table>
    <thead><tr><th>Plan Name</th><th>Status</th><th style="text-align:right">Goal</th><th style="text-align:right">Target Date</th><th style="text-align:right">Progress</th><th>Track</th></tr></thead>
    <tbody>${planRows}</tbody>
  </table>
</div>` : ""}
<div class="footer"><span>${DEFAULT_FIRM}  -  Confidential</span><span>${esc(name)}  -  Goal Status  -  ${esc(dateStr)}</span></div>`;

  return htmlShell(`Goal Status  -  ${name}`, body);
}

// G - G -  Risk Management & Insurance Audit G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - 
export function generateInsuranceAuditReport(data: {
  client: ReportClient;
  generatedAt: string;
  advisor?: { firstName?: string; lastName?: string } | null;
  insurance: Record<string, unknown> | null;
  products: Array<{ productType?: string | null; productName?: string | null; coverageAmount?: string | null; premium?: string | null; status?: string | null }>;
  netWorth: ReportNetWorthEntry[];
}): string {
  const name = `${data.client.firstName} ${data.client.lastName}`;
  const dateStr = new Date(data.generatedAt).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
  const advisorName = data.advisor ? `${data.advisor.firstName} ${data.advisor.lastName}` : "Your Financial Advisor";

  const ins = data.insurance as any;
  const totalCoverage = ins ? parseFloat(String(ins.primaryCoveragePurchased || "0")) + parseFloat(String(ins.spouseCoveragePurchased || "0")) : 0;
  const totalPremiums = data.products.filter(p => p.productType?.toLowerCase().includes("insurance")).reduce((s, p) => s + parseFloat(String(p.premium || "0")), 0);

  const lifeProducts = data.products.filter(p => p.productType?.toLowerCase().includes("life"));
  const disabilityProducts = data.products.filter(p => p.productType?.toLowerCase().includes("disability") || p.productType?.toLowerCase().includes("dis"));
  const criticalProducts = data.products.filter(p => p.productType?.toLowerCase().includes("critical") || p.productType?.toLowerCase().includes("ci"));

  const productRows = data.products.map(p => `
    <tr>
      <td>${esc(p.productName || " - ")}</td>
      <td>${esc(p.productType || " - ")}</td>
      <td style="text-align:right">${p.coverageAmount ? fmtCad(parseFloat(String(p.coverageAmount))) : " - "}</td>
      <td style="text-align:right">${p.premium ? fmtCad(parseFloat(String(p.premium))) + "/mo" : " - "}</td>
      <td><span class="badge ${p.status === "active" ? "badge-green" : "badge-amber"}">${esc(p.status || "unknown")}</span></td>
    </tr>`).join("");

  const body = `
${reportOpener({ reportTitle: "Risk Management & Insurance Audit", reportSubtitle: "Coverage Review", clientName: name, clientFirstName: name.split(" ")[0], advisorName, dateStr })}
<div class="section">
  <h2 class="section-title">Coverage Summary</h2>
  <div class="summary-grid" style="grid-template-columns:repeat(4,1fr)">
    <div class="summary-card"><div class="label">Life Insurance Policies</div><div class="value">${lifeProducts.length}</div></div>
    <div class="summary-card"><div class="label">Disability Policies</div><div class="value ${disabilityProducts.length === 0 ? "negative" : ""}">${disabilityProducts.length}</div></div>
    <div class="summary-card"><div class="label">Critical Illness</div><div class="value ${criticalProducts.length === 0 ? "warn" : ""}">${criticalProducts.length}</div></div>
    <div class="summary-card"><div class="label">Total Monthly Premium</div><div class="value">${fmtCad(totalPremiums)}/mo</div></div>
  </div>
  ${disabilityProducts.length === 0 ? '<div class="callout warn"><strong>Gap Identified:</strong> No disability insurance recorded. Disability is the leading cause of mortgage default in Canada. Review income replacement coverage.</div>' : ""}
  ${criticalProducts.length === 0 ? '<div class="callout warn"><strong>Gap Identified:</strong> No critical illness coverage recorded. Consider coverage for the 3 most common conditions: cancer, heart attack, and stroke.</div>' : ""}
</div>
${ins ? `<div class="section">
  <h2 class="section-title">Family Needs Analysis</h2>
  <div class="summary-grid" style="grid-template-columns:repeat(3,1fr)">
    <div class="summary-card"><div class="label">Primary Coverage Needed</div><div class="value">${fmtCad(parseFloat(String(ins.primaryInsuranceNeed || "0")))}</div></div>
    <div class="summary-card"><div class="label">Primary Coverage Purchased</div><div class="value">${fmtCad(parseFloat(String(ins.primaryCoveragePurchased || "0")))}</div></div>
    <div class="summary-card"><div class="label">Primary Shortfall</div><div class="value ${parseFloat(String(ins.primaryShortfallAcknowledged || "0")) > 0 ? "negative" : "positive"}">${fmtCad(parseFloat(String(ins.primaryShortfallAcknowledged || "0")))}</div></div>
  </div>
</div>` : ""}
${data.products.length > 0 ? `<div class="section">
  <h2 class="section-title">Active Policies</h2>
  <table>
    <thead><tr><th>Product</th><th>Type</th><th style="text-align:right">Coverage</th><th style="text-align:right">Premium</th><th>Status</th></tr></thead>
    <tbody>${productRows}</tbody>
  </table>
</div>` : ""}
<div class="footer"><span>${DEFAULT_FIRM}  -  Confidential</span><span>${esc(name)}  -  Insurance Audit  -  ${esc(dateStr)}</span></div>`;

  return htmlShell(`Insurance Audit  -  ${name}`, body);
}

// G - G -  Estate & Beneficiary Summary G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - 
export function generateEstateSummaryReport(data: {
  client: ReportClient;
  generatedAt: string;
  advisor?: { firstName?: string; lastName?: string } | null;
  estateNotes: Array<{ category?: string | null; title?: string | null; content?: string | null }>;
  netWorth: ReportNetWorthEntry[];
  products: Array<{ productType?: string | null; productName?: string | null; coverageAmount?: string | null; beneficiary?: string | null }>;
}): string {
  const name = `${data.client.firstName} ${data.client.lastName}`;
  const dateStr = new Date(data.generatedAt).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
  const advisorName = data.advisor ? `${data.advisor.firstName} ${data.advisor.lastName}` : "Your Financial Advisor";

  const totalAssets = data.netWorth.filter(e => e.type === "asset").reduce((s, e) => s + parseFloat(String(e.value) || "0"), 0);
  const totalLiabilities = data.netWorth.filter(e => e.type === "liability").reduce((s, e) => s + parseFloat(String(e.value) || "0"), 0);
  const estateValue = totalAssets - totalLiabilities;

  // Estate by category
  const estateCategories = ["Wills & Powers of Attorney", "Beneficiary Designations", "Tax Planning", "Charitable Giving", "Business Succession", "Other"];

  const notesByCategory: Record<string, typeof data.estateNotes> = {};
  for (const note of data.estateNotes) {
    const cat = note.category || "Other";
    if (!notesByCategory[cat]) notesByCategory[cat] = [];
    notesByCategory[cat].push(note);
  }

  const checklist = estateCategories.map(cat => {
    const hasNotes = (notesByCategory[cat] || []).length > 0;
    return `<tr>
      <td>${esc(cat)}</td>
      <td><span class="badge ${hasNotes ? "badge-green" : "badge-amber"}">${hasNotes ? "Documented" : "Needs Review"}</span></td>
      <td>${(notesByCategory[cat] || []).map(n => esc(n.title || n.content?.substring(0, 60) || "")).join("; ") || " - "}</td>
    </tr>`;
  }).join("");

  const assetDistributionRows = data.netWorth.filter(e => e.type === "asset").map(e => `
    <tr>
      <td>${esc(e.name || e.category)}</td>
      <td>${esc(e.category)}</td>
      <td style="text-align:right">${fmtCad(parseFloat(String(e.value) || "0"))}</td>
      <td>${(e as any).accountType || " - "}</td>
    </tr>`).join("");

  const body = `
${reportOpener({ reportTitle: "Estate & Beneficiary Summary", reportSubtitle: "Estate Distribution Review", clientName: name, clientFirstName: name.split(" ")[0], advisorName, dateStr })}
<div class="section">
  <h2 class="section-title">Estate Checklist</h2>
  <table>
    <thead><tr><th>Area</th><th>Status</th><th>Notes</th></tr></thead>
    <tbody>${checklist}</tbody>
  </table>
</div>
<div class="section">
  <h2 class="section-title">Assets for Distribution</h2>
  <div class="summary-grid">
    <div class="summary-card"><div class="label">Total Assets</div><div class="value positive">${fmtCad(totalAssets)}</div></div>
    <div class="summary-card"><div class="label">Total Liabilities</div><div class="value negative">${fmtCad(totalLiabilities)}</div></div>
    <div class="summary-card"><div class="label">Net Estate Value</div><div class="value ${estateValue >= 0 ? "positive" : "negative"}">${fmtCad(estateValue)}</div></div>
  </div>
  <table>
    <thead><tr><th>Asset</th><th>Category</th><th style="text-align:right">Value</th><th>Account Type</th></tr></thead>
    <tbody>${assetDistributionRows}</tbody>
  </table>
</div>
<div class="footer"><span>${DEFAULT_FIRM}  -  Confidential</span><span>${esc(name)}  -  Estate Summary  -  ${esc(dateStr)}</span></div>`;

  return htmlShell(`Estate Summary  -  ${name}`, body);
}

// G - G -  Tax Efficiency Strategy G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - 
export function generateTaxStrategyReport(data: {
  client: ReportClient;
  generatedAt: string;
  advisor?: { firstName?: string; lastName?: string } | null;
  taxNotes: Array<{ category?: string | null; title?: string | null; content?: string | null; taxYear?: number | string | null }>;
  netWorth: ReportNetWorthEntry[];
  retirement: Record<string, unknown> | null;
}): string {
  const name = `${data.client.firstName} ${data.client.lastName}`;
  const dateStr = new Date(data.generatedAt).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
  const advisorName = data.advisor ? `${data.advisor.firstName} ${data.advisor.lastName}` : "Your Financial Advisor";

  const rrspTotal = data.netWorth.filter(e => e.type === "asset" && ((e as any).accountType === "RRSP" || e.name?.toUpperCase().includes("RRSP"))).reduce((s, e) => s + parseFloat(String(e.value) || "0"), 0);
  const tfsaTotal = data.netWorth.filter(e => e.type === "asset" && ((e as any).accountType === "TFSA" || e.name?.toUpperCase().includes("TFSA"))).reduce((s, e) => s + parseFloat(String(e.value) || "0"), 0);
  const nonRegTotal = data.netWorth.filter(e => e.type === "asset" && ((e as any).accountType === "Non-Registered" || (e as any).accountType === "Non-Registered Account")).reduce((s, e) => s + parseFloat(String(e.value) || "0"), 0);

  const noteRows = data.taxNotes.map(n => `
    <tr>
      <td>${esc(n.taxYear ? String(n.taxYear) : " - ")}</td>
      <td>${esc(n.category || " - ")}</td>
      <td>${esc(n.title || " - ")}</td>
      <td style="font-size:9pt">${esc((n.content || "").substring(0, 120))}${(n.content || "").length > 120 ? "G - " : ""}</td>
    </tr>`).join("");

  const body = `
${reportOpener({ reportTitle: "Tax Efficiency Strategy", reportSubtitle: "Annual Tax Review", clientName: name, clientFirstName: name.split(" ")[0], advisorName, dateStr })}
<div class="section">
  <h2 class="section-title">Account Structure Overview</h2>
  <div class="summary-grid">
    <div class="summary-card"><div class="label">RRSP (Tax-Deferred)</div><div class="value">${fmtCad(rrspTotal)}</div></div>
    <div class="summary-card"><div class="label">TFSA (Tax-Free)</div><div class="value">${fmtCad(tfsaTotal)}</div></div>
    <div class="summary-card"><div class="label">Non-Registered</div><div class="value">${fmtCad(nonRegTotal)}</div></div>
  </div>
  <div class="callout"><strong>Optimal Withdrawal Order (Canadian):</strong> Generally: Non-Registered G -  RRSP/RRIF G -  TFSA last. However, crystallizing gains to fill lower tax brackets before OAS/CPP may favour early RRSP meltdown. Review annually.</div>
  ${tfsaTotal === 0 ? '<div class="callout warn"><strong>Opportunity:</strong> No TFSA balance recorded. Maximize TFSA contributions for tax-free growth  -  2025 room is $7,000 ($95,000 lifetime for those 18+ since 2009).</div>' : ""}
  ${nonRegTotal > 0 ? '<div class="callout"><strong>Non-Registered Account:</strong> Consider tax-loss harvesting opportunities, preferred dividend income over interest, and systematic RRSP contributions to reduce current taxable income.</div>' : ""}
</div>
${data.taxNotes.length > 0 ? `<div class="section">
  <h2 class="section-title">Tax Planning Notes</h2>
  <table>
    <thead><tr><th>Year</th><th>Category</th><th>Title</th><th>Summary</th></tr></thead>
    <tbody>${noteRows}</tbody>
  </table>
</div>` : ""}
<div class="section">
  <h2 class="section-title">Key Tax Strategies for Canadian Investors</h2>
  <h3>RRSP Optimization</h3>
  <p>Contribute to RRSP in high-income years to maximize the deduction. Consider spousal RRSP contributions to split income in retirement.</p>
  <h3>TFSA Maximization</h3>
  <p>Prioritize TFSA for investments with highest growth potential  -  all gains and withdrawals are completely tax-free.</p>
  <h3>Capital Gains Management</h3>
  <p>The 2024 federal budget increased the capital gains inclusion rate to 2/3 for annual gains above $250,000. Consider timing large dispositions carefully.</p>
  <h3>Income Splitting</h3>
  <p>Spousal RRSP, T1032 pension income splitting, and prescribed rate loans can significantly reduce household tax burden.</p>
</div>
<div class="footer"><span>${DEFAULT_FIRM}  -  Confidential</span><span>${esc(name)}  -  Tax Strategy  -  ${esc(dateStr)}</span></div>`;

  return htmlShell(`Tax Strategy  -  ${name}`, body);
}

// G - G -  One-Page Financial Plan G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - G - 
export function generateOnePagePlan(data: {
  client: ReportClient;
  generatedAt: string;
  advisor?: { firstName?: string; lastName?: string; email?: string } | null;
  netWorth: ReportNetWorthEntry[];
  retirement: Record<string, unknown> | null;
  insurance: Record<string, unknown> | null;
  plans: Array<{ name?: string | null; status?: string | null; goalAmount?: string | null; targetDate?: string | null }>;
  education: Array<{ childName?: string | null; currentBalance?: string | null; targetAmount?: string | null }>;
  aiRecs: Array<{ title?: string | null; priority?: string | null; status?: string | null }>;
  expenses: Array<{ monthlyAmount: string; includeInRetirement: boolean; retirementAdjustmentPct?: number | null }>;
  simulationResult?: ReportSimulation;
}): string {
  const name = `${data.client.firstName} ${data.client.lastName}`;
  const dateStr = new Date(data.generatedAt).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
  const advisorName = data.advisor ? `${data.advisor.firstName} ${data.advisor.lastName}` : "Your Financial Advisor";

  const totalAssets = data.netWorth.filter(e => e.type === "asset").reduce((s, e) => s + parseFloat(String(e.value) || "0"), 0);
  const totalLiabilities = data.netWorth.filter(e => e.type === "liability").reduce((s, e) => s + parseFloat(String(e.value) || "0"), 0);
  const netWorthVal = totalAssets - totalLiabilities;

  const r = data.retirement as any;
  const projBalance = r ? parseFloat(String(r.projectedBalance || "0")) : 0;
  const retDesiredIncome = r ? parseFloat(String(r.desiredRetirementIncome || "0")) : 0;
  const retirementExpenses = data.expenses.filter(e => e.includeInRetirement)
    .reduce((s, e) => s + parseFloat(e.monthlyAmount || "0") * (e.retirementAdjustmentPct || 100) / 100, 0) * 12;
  const incomeNeed = retirementExpenses > 0 ? retirementExpenses : retDesiredIncome;
  const fourPctNeeded = incomeNeed / 0.04;
  const retirementReadiness = fourPctNeeded > 0 ? Math.min(100, Math.round(projBalance / fourPctNeeded * 100)) : 0;

  const successRate = data.simulationResult?.successRate || null;
  const topActions = data.aiRecs.filter(r => r.status !== "dismissed").slice(0, 3);

  const statusDot = (score: number) => score >= 80 ? "var(--green)" : score >= 50 ? "var(--amber)" : "var(--red)";

  const body = `
<style>
  .one-page { padding: 32px 40px; max-width: 900px; margin: 0 auto; }
  .op-header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid var(--navy); padding-bottom:16px; margin-bottom:24px; }
  .op-logo { font-size:8pt; font-weight:700; color:var(--navy); letter-spacing:0.12em; text-transform:uppercase; }
  .op-title { font-size:20pt; font-weight:700; color:var(--navy); }
  .op-subtitle { font-size:10pt; color:var(--gray); }
  .op-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; margin-bottom:20px; }
  .op-card { border:1px solid var(--mgray); border-radius:8px; padding:12px 14px; }
  .op-card-title { font-size:7.5pt; text-transform:uppercase; letter-spacing:0.08em; color:var(--gray); margin-bottom:6px; }
  .op-card-value { font-size:17pt; font-weight:700; color:var(--navy); }
  .op-card-sub { font-size:8pt; color:var(--gray); margin-top:2px; }
  .op-section-title { font-size:10pt; font-weight:700; color:var(--navy); border-left:4px solid var(--teal); padding-left:8px; margin:16px 0 8px; }
  .op-goal { display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid var(--mgray); }
  .op-goal-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
  .op-goal-name { font-size:9.5pt; font-weight:600; flex:1; }
  .op-goal-value { font-size:9.5pt; color:var(--gray); }
  .op-action { padding:8px 12px; border-left:3px solid var(--teal); margin-bottom:6px; background:var(--lgray); border-radius:0 4px 4px 0; font-size:9pt; }
  .op-action.high { border-color:var(--red); }
  .op-action.medium { border-color:var(--amber); }
  .op-footer { margin-top:24px; padding-top:12px; border-top:1px solid var(--mgray); display:flex; justify-content:space-between; font-size:7.5pt; color:var(--gray); }
  .gauge { position:relative; display:inline-block; width:60px; height:60px; }
</style>
<div class="one-page">
  <div class="op-header">
    <div>
      <div class="op-logo">${DEFAULT_FIRM}</div>
      <div class="op-title">${esc(name)}</div>
      <div class="op-subtitle">One-Page Financial Plan - ${esc(dateStr)} - ${esc(advisorName)}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:8pt;color:var(--gray)">Retirement Readiness</div>
      <div style="font-size:28pt;font-weight:700;color:${statusDot(retirementReadiness)}">${retirementReadiness}%</div>
      ${successRate !== null ? `<div style="font-size:8pt;color:var(--gray)">Monte Carlo: ${pct(successRate)} success</div>` : ""}
    </div>
  </div>

  <div class="op-grid">
    <div class="op-card" style="border-top:3px solid ${netWorthVal >= 0 ? "var(--green)" : "var(--red)"}">
      <div class="op-card-title">Net Worth</div>
      <div class="op-card-value" style="color:${netWorthVal >= 0 ? "var(--green)" : "var(--red)"}">${fmtCad(netWorthVal)}</div>
      <div class="op-card-sub">${fmtCad(totalAssets)} assets - ${fmtCad(totalLiabilities)} liabilities</div>
    </div>
    <div class="op-card" style="border-top:3px solid var(--blue)">
      <div class="op-card-title">Retirement at Age ${r ? esc(String(r.retirementAge)) : " - "}</div>
      <div class="op-card-value">${fmtCad(projBalance)}</div>
      <div class="op-card-sub">Projected - Need ${fmtCad(fourPctNeeded)} (4% rule)</div>
    </div>
    <div class="op-card" style="border-top:3px solid var(--teal)">
      <div class="op-card-title">Monthly Expenses</div>
      <div class="op-card-value">${fmtCad(data.expenses.reduce((s, e) => s + parseFloat(e.monthlyAmount || "0"), 0))}</div>
      <div class="op-card-sub">${fmtCad(retirementExpenses / 12)}/mo estimated in retirement</div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
    <div>
      <div class="op-section-title">Top Goals</div>
      ${r ? `<div class="op-goal"><div class="op-goal-dot" style="background:${statusDot(retirementReadiness)}"></div><div class="op-goal-name">Retirement at ${r.retirementAge || " - "}</div><div class="op-goal-value">${retirementReadiness}% ready</div></div>` : ""}
      ${data.education.map(e => {
        const prog = parseFloat(String(e.targetAmount || "0")) > 0 ? Math.min(100, Math.round(parseFloat(String(e.currentBalance || "0")) / parseFloat(String(e.targetAmount || "1")) * 100)) : 0;
        return `<div class="op-goal"><div class="op-goal-dot" style="background:${statusDot(prog)}"></div><div class="op-goal-name">RESP G -  ${esc(e.childName || "Child")}</div><div class="op-goal-value">${prog}% of ${fmtCad(parseFloat(String(e.targetAmount || "0")))}</div></div>`;
      }).join("")}
      ${data.plans.slice(0, 3).map(p => `<div class="op-goal"><div class="op-goal-dot" style="background:var(--blue)"></div><div class="op-goal-name">${esc(p.name || "Plan")}</div><div class="op-goal-value">${esc(p.status || "active")}</div></div>`).join("")}
      ${!r && data.education.length === 0 && data.plans.length === 0 ? "<p style='font-size:9pt;color:var(--gray)'>No goals entered yet.</p>" : ""}
    </div>
    <div>
      <div class="op-section-title">Immediate Next Steps</div>
      ${topActions.length > 0 ? topActions.map(a => `<div class="op-action ${a.priority || "medium"}"><strong>${esc(a.title || "Action item")}</strong></div>`).join("") : "<p style='font-size:9pt;color:var(--gray)'>Run AI Insights to generate personalized recommendations.</p>"}
    </div>
  </div>

  <div class="op-footer">
    <span>This document is for discussion purposes only and does not constitute financial, tax, or legal advice.</span>
    <span>${DEFAULT_FIRM} - ${esc(advisorName)} - ${esc(dateStr)}</span>
  </div>
</div>`;

  return htmlShell(`One-Page Plan  -  ${name}`, body);
}













