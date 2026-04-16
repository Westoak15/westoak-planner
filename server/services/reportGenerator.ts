/**
 * server/services/reportGenerator.ts
 * fp-standalone — HTML reports with inline SVG charts
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
  .cover { background:var(--navy); color:white; padding:60px 48px 48px; page-break-after:always; }
  .cover h1 { font-size:32pt; font-weight:700; margin-bottom:8px; }
  .cover h2 { font-size:16pt; font-weight:300; opacity:0.85; margin-bottom:40px; }
  .cover-meta { display:grid; grid-template-columns:1fr 1fr; gap:8px 24px; margin-top:32px; font-size:10pt; }
  .cover-meta .label { opacity:0.7; } .cover-meta .value { font-weight:600; }
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
    .cover { page-break-after:always; }
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
</head>
<body>${body}</body>
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
<div class="cover">
  <div style="font-size:10pt;letter-spacing:0.1em;text-transform:uppercase;opacity:0.7;margin-bottom:12px;">Knights of Columbus - Financial Planning Suite</div>
  <h1>Family Needs Analysis</h1>
  <h2>Life Insurance Needs Worksheet - ${dateStr}</h2>
  <div style="height:2px;background:rgba(255,255,255,0.3);margin:24px 0;"></div>
  <div class="cover-meta">
    <div class="label">Prepared for</div>
    <div class="value">${esc(name)}${spouseName ? ` &amp; ${esc(spouseName)}` : ""}</div>
    <div class="label">Advisor</div><div class="value">${esc(advisorName)}</div>
    <div class="label">Date</div><div class="value">${esc(dateStr)}</div>
    <div class="label">Province</div><div class="value">${esc(client.province ?? "Canada")}</div>
  </div>
  <div style="margin-top:40px;font-size:8.5pt;opacity:0.6;">
    This analysis is prepared for discussion purposes only. Life insurance needs are estimates based on information provided. This does not constitute financial, legal, or tax advice.
  </div>
</div>`;

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
<div class="section">
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
        ${[["Liquid Savings",pAssets.liquidSavings],["RRSP",pAssets.rrsps],["Non-Registered",pAssets.nonRegistered],["TFSA",pAssets.tfsa],["Other",pAssets.other]].filter(([,val])=>v(val)>0).map(([label,val])=>`<tr><td style="font-size:9pt;color:#64748B">${esc(label)}</td><td style="text-align:right">${fmtCad(v(val))}</td></tr>`).join("")}
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
        ${[["Liquid Savings",sAssets.liquidSavings],["RRSP",sAssets.rrsps],["Non-Registered",sAssets.nonRegistered],["TFSA",sAssets.tfsa],["Other",sAssets.other]].filter(([,val])=>v(val)>0).map(([label,val])=>`<tr><td style="font-size:9pt;color:#64748B">${esc(label)}</td><td style="text-align:right">${fmtCad(v(val))}</td></tr>`).join("")}
        <tr class="total"><td>Subtotal F</td><td style="text-align:right">${fmtCad(subtotalF)}</td></tr>
      </tbody></table>
    </div>` : "<div></div>"}
  </div>
</div>`;

  const totalSection = `
<div class="section">
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
    `<div style="padding:32px 48px;color:#94A3B8;font-size:8.5pt;border-top:1px solid #E2E8F0;margin-top:40px">
      Report generated ${dateStr} - Knights of Columbus Financial Planning Suite - Confidential - prepared solely for ${esc(name)}.
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
  const body = `
<div class="cover">
  <div style="font-size:10pt;letter-spacing:0.1em;text-transform:uppercase;opacity:0.7;margin-bottom:12px;">Knights of Columbus - Financial Planning Suite</div>
  <h1>Net Worth Statement</h1>
  <h2>${esc(name)} - As at ${dateStr}</h2>
</div>
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
  const body = `
<div class="cover">
  <div style="font-size:10pt;letter-spacing:0.1em;text-transform:uppercase;opacity:0.7;margin-bottom:12px;">Knights of Columbus - Financial Planning Suite</div>
  <h1>Financial Plan</h1>
  <h2>Comprehensive Review - ${dateStr}</h2>
  <div style="height:2px;background:rgba(255,255,255,0.3);margin:24px 0;"></div>
  <div class="cover-meta">
    <div class="label">Prepared for</div><div class="value">${esc(name)}${client.spouseFirstName?` &amp; ${esc(client.spouseFirstName+" "+(client.spouseLastName??""))}`:""}</div>
    <div class="label">Advisor</div><div class="value">${esc(advisorName)}</div>
    <div class="label">Date</div><div class="value">${esc(dateStr)}</div>
    <div class="label">Province</div><div class="value">${esc(client.province??"Canada")}</div>
  </div>
</div>
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
  Report generated ${dateStr} - Knights of Columbus Financial Planning Suite - Confidential - prepared solely for ${esc(name)}.
</div>`;
  return htmlShell(`Financial Plan - ${name}`, body);
}


