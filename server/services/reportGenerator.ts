/**
 * server/services/reportGenerator.ts
 *
 * Generates fully-formed HTML documents for each report type.
 * All charts are inline SVG — no canvas, no JS required, prints cleanly.
 * Reports are returned as HTML strings; the client opens them in a new window.
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(s: unknown): string {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmt(n: number, decimals = 0): string {
  return Number(n).toLocaleString("en-CA", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function pct(n: number, decimals = 1): string {
  return `${(n * 100).toFixed(decimals)}%`;
}

function fmtCad(n: number): string {
  return `$${fmt(n)}`;
}

// ── Base HTML shell ───────────────────────────────────────────────────────────

function htmlShell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  :root {
    --navy:  #1B3A5C;
    --teal:  #0F766E;
    --blue:  #2563EB;
    --amber: #D97706;
    --red:   #DC2626;
    --green: #16A34A;
    --gray:  #475569;
    --lgray: #F1F5F9;
    --mgray: #CBD5E1;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Segoe UI", Arial, sans-serif;
    font-size: 11pt;
    color: #0F172A;
    background: white;
    padding: 0 0 40px;
  }
  .cover {
    background: var(--navy);
    color: white;
    padding: 60px 48px 48px;
    page-break-after: always;
  }
  .cover h1 { font-size: 32pt; font-weight: 700; margin-bottom: 8px; }
  .cover h2 { font-size: 16pt; font-weight: 300; opacity: 0.85; margin-bottom: 40px; }
  .cover-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin-top: 32px; font-size: 10pt; }
  .cover-meta .label { opacity: 0.7; }
  .cover-meta .value { font-weight: 600; }
  .section {
    padding: 32px 48px 0;
    page-break-inside: avoid;
  }
  h2.section-title {
    font-size: 15pt;
    font-weight: 700;
    color: var(--navy);
    border-bottom: 3px solid var(--teal);
    padding-bottom: 8px;
    margin-bottom: 20px;
    margin-top: 32px;
  }
  h3 { font-size: 11pt; font-weight: 600; color: var(--navy); margin: 16px 0 8px; }
  p  { margin-bottom: 8px; line-height: 1.5; }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9.5pt;
    margin-bottom: 16px;
  }
  th {
    background: var(--navy);
    color: white;
    padding: 6px 10px;
    text-align: left;
    font-weight: 600;
  }
  td { padding: 5px 10px; border-bottom: 1px solid var(--mgray); }
  tr:nth-child(even) td { background: var(--lgray); }
  tr.total td { font-weight: 700; background: #EFF6FF; }
  .summary-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 24px;
  }
  .summary-card {
    background: var(--lgray);
    border-radius: 8px;
    padding: 14px 16px;
    border-left: 4px solid var(--teal);
  }
  .summary-card .label { font-size: 8.5pt; color: var(--gray); text-transform: uppercase; letter-spacing: 0.05em; }
  .summary-card .value { font-size: 15pt; font-weight: 700; color: var(--navy); margin-top: 4px; }
  .summary-card .value.positive { color: var(--green); }
  .summary-card .value.negative { color: var(--red); }
  .summary-card .value.warn     { color: var(--amber); }
  .callout {
    background: #EFF6FF;
    border-left: 4px solid var(--blue);
    border-radius: 4px;
    padding: 12px 16px;
    margin: 12px 0;
    font-size: 10pt;
  }
  .callout.warn  { background: #FFFBEB; border-color: var(--amber); }
  .callout.alert { background: #FEF2F2; border-color: var(--red);   }
  .callout.good  { background: #F0FDF4; border-color: var(--green);  }
  .callout strong { font-weight: 700; }
  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 8.5pt;
    font-weight: 600;
  }
  .badge-green  { background: #DCFCE7; color: #15803D; }
  .badge-red    { background: #FEE2E2; color: #B91C1C; }
  .badge-amber  { background: #FEF3C7; color: #92400E; }
  .badge-blue   { background: #DBEAFE; color: #1D4ED8; }
  .chart-container { margin: 16px 0; }
  .footer {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    background: white;
    border-top: 1px solid var(--mgray);
    padding: 6px 48px;
    font-size: 8pt;
    color: var(--gray);
    display: flex;
    justify-content: space-between;
  }
  @media print {
    .section { page-break-inside: avoid; }
    .no-print { display: none !important; }
    body { padding-bottom: 0; }
    .footer { position: fixed; }
  }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

// ── SVG Monte Carlo fan chart ─────────────────────────────────────────────────

interface PercentileBands {
  p10: number[];
  p25: number[];
  p50: number[];
  p75: number[];
  p90: number[];
}

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
    <text x="14"  y="-2" font-size="8" fill="#64748B">p10–p90 range</text>
    <rect x="100" y="-6" width="10" height="4" fill="#93C5FD"/>
    <text x="114" y="-2" font-size="8" fill="#64748B">p25–p75 range</text>
    <line x1="210" y1="-4" x2="220" y2="-4" stroke="#1D4ED8" stroke-width="2.5"/>
    <text x="224" y="-2" font-size="8" fill="#64748B">Median path</text>
  </g>
</svg>`;
}

// ── Comprehensive Report ──────────────────────────────────────────────────────

export function generateComprehensiveReport(data: {
  client:      any;
  generatedAt: string;
  advisor?:    any;
  plans:       any[];
  netWorth:    any[];
  retirement:  any | null;
  insurance:   any | null;
  debts:       any[];
  education:   any[];
  taxNotes:    any[];
  estateNotes: any[];
  aiRecs:      any[];
  simulationResult?: {
    successRate:     number;
    percentileBands: PercentileBands;
    finalBalancePercentiles: any;
    yearsProjected:  number;
  };
}): string {
  const { client, generatedAt } = data;
  const name     = `${client.firstName} ${client.lastName}`;
  const dateStr  = new Date(generatedAt).toLocaleDateString("en-CA", {
    year: "numeric", month: "long", day: "numeric",
  });
  const advisorName = data.advisor
    ? `${data.advisor.firstName} ${data.advisor.lastName}`
    : "Your Financial Advisor";

  const totalAssets      = data.netWorth.filter(e => e.type === "asset")
    .reduce((s, e) => s + parseFloat(String(e.value) || "0"), 0);
  const totalLiabilities = data.netWorth.filter(e => e.type === "liability")
    .reduce((s, e) => s + parseFloat(String(e.value) || "0"), 0);
  const netWorthVal      = totalAssets - totalLiabilities;
  const totalDebt        = data.debts.reduce((s, d) => s + parseFloat(String(d.balance) || "0"), 0);

  // Cover
  const cover = `
<div class="cover">
  <div style="font-size:10pt;letter-spacing:0.1em;text-transform:uppercase;opacity:0.7;margin-bottom:12px;">BrokersEdge</div>
  <h1>Financial Plan</h1>
  <h2>Comprehensive Review — ${dateStr}</h2>
  <div style="height:2px;background:rgba(255,255,255,0.3);margin:24px 0;"></div>
  <div class="cover-meta">
    <div class="label">Prepared for</div>
    <div class="value">${esc(name)}</div>
    <div class="label">Advisor</div>
    <div class="value">${esc(advisorName)}</div>
    <div class="label">Date</div>
    <div class="value">${esc(dateStr)}</div>
    <div class="label">Jurisdiction</div>
    <div class="value">Canada</div>
  </div>
  <div style="margin-top:40px;font-size:8.5pt;opacity:0.6;">
    This document is prepared for discussion purposes only. It does not constitute financial, tax, or legal advice.
    All projections are estimates based on assumptions that may not be realised.
  </div>
</div>`;

  // Net Worth
  const assetRows = data.netWorth.filter(e => e.type === "asset").map(e => `
    <tr><td>${esc(e.name || e.category)}</td><td>${esc(e.category)}</td>
    <td style="text-align:right">${fmtCad(parseFloat(e.value || "0"))}</td></tr>`).join("");
  const liabRows  = data.netWorth.filter(e => e.type === "liability").map(e => `
    <tr><td>${esc(e.name || e.category)}</td><td>${esc(e.category)}</td>
    <td style="text-align:right">${fmtCad(parseFloat(e.value || "0"))}</td></tr>`).join("");

  const netWorthSection = `
<div class="section">
  <h2 class="section-title">Net Worth Statement</h2>
  <div class="summary-grid">
    <div class="summary-card">
      <div class="label">Total Assets</div>
      <div class="value positive">${fmtCad(totalAssets)}</div>
    </div>
    <div class="summary-card">
      <div class="label">Total Liabilities</div>
      <div class="value negative">${fmtCad(totalLiabilities)}</div>
    </div>
    <div class="summary-card">
      <div class="label">Net Worth</div>
      <div class="value ${netWorthVal >= 0 ? "positive" : "negative"}">${fmtCad(netWorthVal)}</div>
    </div>
  </div>
  ${assetRows || liabRows ? `
  <table>
    <thead><tr><th>Item</th><th>Category</th><th style="text-align:right">Value</th></tr></thead>
    <tbody>
      ${assetRows}
      ${liabRows ? `<tr style="background:#FEF2F2"><td colspan="2" style="font-weight:600">Total Liabilities</td><td style="text-align:right;font-weight:600">(${fmtCad(totalLiabilities)})</td></tr>` : ""}
      <tr class="total"><td colspan="2">Net Worth</td><td style="text-align:right">${fmtCad(netWorthVal)}</td></tr>
    </tbody>
  </table>` : `<p style="color:#64748B">No net worth entries recorded.</p>`}
</div>`;

  // Monte Carlo / Retirement
  const sim = data.simulationResult;
  const mcChart = sim
    ? svgMonteCarloChart(sim.percentileBands, sim.successRate)
    : "";

  const retSection = `
<div class="section">
  <h2 class="section-title">Retirement Projection</h2>
  ${data.retirement ? `
  <div class="summary-grid">
    <div class="summary-card">
      <div class="label">Current Age / Retirement Age</div>
      <div class="value">${esc(data.retirement.currentAge)} → ${esc(data.retirement.retirementAge)}</div>
    </div>
    <div class="summary-card">
      <div class="label">Projected Portfolio at Retirement</div>
      <div class="value positive">${fmtCad(parseFloat(data.retirement.projectedBalance || "0"))}</div>
    </div>
    <div class="summary-card">
      <div class="label">Monte Carlo Success Rate</div>
      <div class="value ${sim ? (sim.successRate >= 0.80 ? "positive" : sim.successRate >= 0.60 ? "warn" : "negative") : ""}">
        ${sim ? `${(sim.successRate * 100).toFixed(0)}%` : "Not run"}
      </div>
    </div>
  </div>
  ${sim ? `
  <h3>Portfolio Projection (${sim.yearsProjected}-Year Monte Carlo — ${sim.simulations?.toLocaleString() ?? sim.simulationCount?.toLocaleString() ?? "N/A"} simulations)</h3>
  <div class="chart-container">${mcChart}</div>
  <table>
    <thead><tr><th>Scenario</th><th style="text-align:right">Final Portfolio Balance</th></tr></thead>
    <tbody>
      <tr><td>Best case (90th percentile)</td><td style="text-align:right">${fmtCad(sim.finalBalancePercentiles.p90)}</td></tr>
      <tr><td>Optimistic (75th percentile)</td><td style="text-align:right">${fmtCad(sim.finalBalancePercentiles.p75)}</td></tr>
      <tr><td>Median (50th percentile)</td><td style="text-align:right">${fmtCad(sim.finalBalancePercentiles.p50)}</td></tr>
      <tr><td>Pessimistic (25th percentile)</td><td style="text-align:right">${fmtCad(sim.finalBalancePercentiles.p25)}</td></tr>
      <tr><td>Worst case (10th percentile)</td><td style="text-align:right">${fmtCad(sim.finalBalancePercentiles.p10)}</td></tr>
    </tbody>
  </table>
  <div class="callout ${sim.successRate >= 0.80 ? "good" : sim.successRate >= 0.60 ? "warn" : "alert"}">
    <strong>${sim.successRate >= 0.80 ? "✓ On Track" : sim.successRate >= 0.60 ? "⚠ Moderate Risk" : "✗ Action Required"}:</strong>
    ${(sim.successRate * 100).toFixed(0)}% probability of not outliving assets.
    ${sim.successRate < 0.80 ? " Consider increasing contributions, adjusting spending, or delaying retirement by 1–2 years." : ""}
  </div>` : ""}
  ` : `<p style="color:#64748B">No retirement projection on file. Complete the Retirement tab to generate a projection.</p>`}
</div>`;

  // Insurance
  const ins = data.insurance;
  const insSection = `
<div class="section">
  <h2 class="section-title">Insurance Needs Analysis</h2>
  ${ins ? `
  <div class="summary-grid">
    <div class="summary-card">
      <div class="label">Life Insurance Need</div>
      <div class="value">${fmtCad(parseFloat(ins.recommendedLifeCoverage || "0"))}</div>
    </div>
    <div class="summary-card">
      <div class="label">Coverage Gap</div>
      <div class="value ${parseFloat(ins.lifeCoverageGap || "0") > 0 ? "negative" : "positive"}">
        ${fmtCad(parseFloat(ins.lifeCoverageGap || "0"))}
      </div>
    </div>
    <div class="summary-card">
      <div class="label">Disability Gap</div>
      <div class="value ${parseFloat(ins.disabilityCoverageGap || "0") > 0 ? "negative" : "positive"}">
        ${fmtCad(parseFloat(ins.disabilityCoverageGap || "0"))}
      </div>
    </div>
  </div>
  <table>
    <thead><tr><th>Method</th><th style="text-align:right">Recommended Coverage</th><th style="text-align:right">Existing Coverage</th><th style="text-align:right">Gap</th></tr></thead>
    <tbody>
      <tr>
        <td>DIME Method</td>
        <td style="text-align:right">${fmtCad(parseFloat(ins.dimeCoverage || "0"))}</td>
        <td style="text-align:right">${fmtCad(parseFloat(ins.existingLifeCoverage || "0"))}</td>
        <td style="text-align:right;color:${parseFloat(ins.dimeCoverage || "0") > parseFloat(ins.existingLifeCoverage || "0") ? "var(--red)" : "var(--green)"}">
          ${fmtCad(Math.max(0, parseFloat(ins.dimeCoverage || "0") - parseFloat(ins.existingLifeCoverage || "0")))}
        </td>
      </tr>
      <tr>
        <td>Human Life Value</td>
        <td style="text-align:right">${fmtCad(parseFloat(ins.hlvCoverage || "0"))}</td>
        <td style="text-align:right">${fmtCad(parseFloat(ins.existingLifeCoverage || "0"))}</td>
        <td style="text-align:right;color:${parseFloat(ins.hlvCoverage || "0") > parseFloat(ins.existingLifeCoverage || "0") ? "var(--red)" : "var(--green)"}">
          ${fmtCad(Math.max(0, parseFloat(ins.hlvCoverage || "0") - parseFloat(ins.existingLifeCoverage || "0")))}
        </td>
      </tr>
    </tbody>
  </table>
  ${parseFloat(ins.lifeCoverageGap || "0") > 50_000 ? `
  <div class="callout alert">
    <strong>Coverage Gap Identified:</strong> A life insurance gap of ${fmtCad(parseFloat(ins.lifeCoverageGap || "0"))} exists.
    Review your current policies and consider increasing coverage.
  </div>` : `
  <div class="callout good"><strong>✓ Adequate Coverage:</strong> Life insurance appears sufficient based on current analysis.</div>`}
  ` : `<p style="color:#64748B">No insurance analysis on file.</p>`}
</div>`;

  // Debt
  const debtSection = data.debts.length > 0 ? `
<div class="section">
  <h2 class="section-title">Debt Summary</h2>
  <div class="summary-grid">
    <div class="summary-card">
      <div class="label">Total Debt</div>
      <div class="value negative">${fmtCad(totalDebt)}</div>
    </div>
    <div class="summary-card">
      <div class="label">Accounts</div>
      <div class="value">${data.debts.length}</div>
    </div>
    <div class="summary-card">
      <div class="label">Highest Rate</div>
      <div class="value negative">
        ${pct(Math.max(...data.debts.map(d => parseFloat(d.interestRate || "0"))) / 100)}
      </div>
    </div>
  </div>
  <table>
    <thead><tr><th>Account</th><th>Category</th><th style="text-align:right">Balance</th><th style="text-align:right">Rate</th><th style="text-align:right">Min Payment</th></tr></thead>
    <tbody>
      ${data.debts.map(d => `
      <tr>
        <td>${esc(d.name)}</td>
        <td>${esc(d.category)}</td>
        <td style="text-align:right">${fmtCad(parseFloat(d.balance || "0"))}</td>
        <td style="text-align:right">${parseFloat(d.interestRate || "0").toFixed(2)}%</td>
        <td style="text-align:right">${fmtCad(parseFloat(d.minimumPayment || "0"))}</td>
      </tr>`).join("")}
      <tr class="total">
        <td colspan="2">Total</td>
        <td style="text-align:right">${fmtCad(totalDebt)}</td>
        <td></td>
        <td style="text-align:right">${fmtCad(data.debts.reduce((s, d) => s + parseFloat(d.minimumPayment || "0"), 0))}</td>
      </tr>
    </tbody>
  </table>
</div>` : "";

  // Education / RESP
  const eduSection = data.education.length > 0 ? `
<div class="section">
  <h2 class="section-title">Education Savings (RESP)</h2>
  <table>
    <thead><tr><th>Child</th><th>Birth Year</th><th style="text-align:right">Current Balance</th><th style="text-align:right">Annual Contribution</th><th style="text-align:right">CESG Received</th></tr></thead>
    <tbody>
      ${data.education.map(e => `
      <tr>
        <td>${esc(e.childName)}</td>
        <td>${esc(e.childBirthYear)}</td>
        <td style="text-align:right">${fmtCad(parseFloat(e.currentBalance || "0"))}</td>
        <td style="text-align:right">${fmtCad(parseFloat(e.annualContribution || "0"))}</td>
        <td style="text-align:right">${fmtCad(parseFloat(e.cesgReceived || "0"))}</td>
      </tr>`).join("")}
    </tbody>
  </table>
</div>` : "";

  // Tax Notes
  const taxSection = data.taxNotes.length > 0 ? `
<div class="section">
  <h2 class="section-title">Tax Planning Notes</h2>
  ${data.taxNotes.map(n => `
  <div class="callout ${n.actionRequired ? "warn" : ""}">
    <strong>${esc(n.title)}</strong> (${esc(n.category)}, ${esc(n.taxYear)})
    ${n.actionRequired ? " <span class='badge badge-amber'>Action Required</span>" : ""}
    <p style="margin-top:6px">${esc(n.content)}</p>
  </div>`).join("")}
</div>` : "";

  // Estate Notes
  const estateSection = data.estateNotes.length > 0 ? `
<div class="section">
  <h2 class="section-title">Estate Planning Notes</h2>
  ${data.estateNotes.map(n => `
  <div class="callout">
    <strong>${esc(n.title)}</strong> (${esc(n.category)})
    <p style="margin-top:6px">${esc(n.content)}</p>
    ${n.documentReference ? `<p style="margin-top:4px;font-size:9pt;color:#64748B">Document: ${esc(n.documentReference)}</p>` : ""}
  </div>`).join("")}
</div>` : "";

  // AI Recommendations
  const recsSection = data.aiRecs.length > 0 ? `
<div class="section">
  <h2 class="section-title">Advisor Recommendations</h2>
  ${data.aiRecs.map((r, i) => `
  <div style="margin-bottom:14px;padding:14px;border-radius:6px;border:1px solid #E2E8F0;background:${i % 2 === 0 ? "white" : "#F8FAFC"}">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
      <span class="badge ${r.priority === "high" ? "badge-red" : r.priority === "medium" ? "badge-amber" : "badge-blue"}">${esc(r.priority?.toUpperCase())}</span>
      <strong>${esc(r.title)}</strong>
      <span style="font-size:9pt;color:#64748B;text-transform:uppercase">${esc(r.category)}</span>
    </div>
    <p>${esc(r.content)}</p>
  </div>`).join("")}
</div>` : "";

  const body = [
    cover,
    netWorthSection,
    retSection,
    insSection,
    debtSection,
    eduSection,
    taxSection,
    estateSection,
    recsSection,
    `<div style="padding:32px 48px;color:#94A3B8;font-size:8.5pt;border-top:1px solid #E2E8F0;margin-top:40px">
      Report generated ${dateStr} by BrokersEdge · www.brokersedge.app ·
      This document is confidential and prepared solely for ${esc(name)}.
    </div>`,
  ].join("\n");

  return htmlShell(`Financial Plan — ${name}`, body);
}

// ── Retirement-focused report ─────────────────────────────────────────────────

export function generateRetirementReport(data: {
  client:     any;
  retirement: any;
  taxYears?:  any[];
  sim?:       { successRate: number; percentileBands: PercentileBands; finalBalancePercentiles: any; yearsProjected: number; simulationCount?: number };
}): string {
  const { client, retirement, sim } = data;
  const name    = `${client.firstName} ${client.lastName}`;
  const dateStr = new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });

  const mcChart = sim ? svgMonteCarloChart(sim.percentileBands, sim.successRate) : "";

  // Year-by-year income table (first 20 years of retirement if available)
  const taxRows = data.taxYears?.slice(0, 25).map(y => `
  <tr>
    <td>${y.year}</td><td>${y.age}</td>
    <td style="text-align:right">${fmtCad(y.employmentIncome + y.pensionIncome)}</td>
    <td style="text-align:right">${fmtCad(y.cppBenefit + y.oasBenefit)}</td>
    <td style="text-align:right">${fmtCad(y.rrifWithdrawal)}</td>
    <td style="text-align:right">${fmtCad(y.totalTaxableIncome)}</td>
    <td style="text-align:right">${fmtCad(y.totalTax)}</td>
    <td style="text-align:right">${pct(y.effectiveRate)}</td>
    <td style="text-align:right">${fmtCad(y.totalWealth)}</td>
  </tr>`).join("") ?? "";

  const body = `
<div class="cover">
  <div style="font-size:10pt;letter-spacing:0.1em;text-transform:uppercase;opacity:0.7;margin-bottom:12px;">BrokersEdge</div>
  <h1>Retirement Income Projection</h1>
  <h2>${esc(name)} · ${dateStr}</h2>
</div>

<div class="section">
  <h2 class="section-title">Retirement Overview</h2>
  ${retirement ? `
  <div class="summary-grid">
    <div class="summary-card"><div class="label">Retirement Age</div><div class="value">${esc(retirement.retirementAge)}</div></div>
    <div class="summary-card"><div class="label">Projected Balance</div><div class="value positive">${fmtCad(parseFloat(retirement.projectedBalance || "0"))}</div></div>
    <div class="summary-card"><div class="label">Success Rate</div>
      <div class="value ${sim ? (sim.successRate >= 0.80 ? "positive" : sim.successRate >= 0.60 ? "warn" : "negative") : ""}">${sim ? `${(sim.successRate * 100).toFixed(0)}%` : "—"}</div>
    </div>
  </div>` : ""}

  ${sim ? `
  <h3>Monte Carlo Projection (${sim.yearsProjected} Years · ${sim.simulationCount?.toLocaleString() ?? ""} Simulations)</h3>
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

  return htmlShell(`Retirement Report — ${name}`, body);
}

// ── Insurance report ──────────────────────────────────────────────────────────

export function generateInsuranceReport(data: {
  client:     any;
  insurance:  any;
  products:   any[];
}): string {
  const { client, insurance, products } = data;
  const name    = `${client.firstName} ${client.lastName}`;
  const dateStr = new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });

  const insProducts = products.filter(p =>
    p.type === "insurance" || p.type === "segregated_fund"
  );

  const body = `
<div class="cover">
  <div style="font-size:10pt;letter-spacing:0.1em;text-transform:uppercase;opacity:0.7;margin-bottom:12px;">BrokersEdge</div>
  <h1>Insurance Needs Analysis</h1>
  <h2>${esc(name)} · ${dateStr}</h2>
</div>

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

  <h3>Needs Analysis — Life Insurance</h3>
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
          <td style="text-align:right;color:${gap > 0 ? "var(--red)" : "var(--green)"}">${gap > 0 ? `-${fmtCad(gap)}` : "✓ Covered"}</td>
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

  return htmlShell(`Insurance Report — ${name}`, body);
}

// ── Net Worth Statement ───────────────────────────────────────────────────────

export function generateNetWorthReport(data: {
  client:   any;
  netWorth: any[];
  products: any[];
}): string {
  const { client, netWorth, products } = data;
  const name    = `${client.firstName} ${client.lastName}`;
  const dateStr = new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });

  const assets = netWorth.filter(e => e.type === "asset");
  const liabs  = netWorth.filter(e => e.type === "liability");
  const totalA = assets.reduce((s, e) => s + parseFloat(e.value || "0"), 0);
  const totalL = liabs.reduce((s,  e) => s + parseFloat(e.value || "0"), 0);

  const aum = products
    .filter(p => p.status === "active")
    .reduce((s, p) => s + parseFloat(p.value || "0"), 0);

  const body = `
<div class="cover">
  <div style="font-size:10pt;letter-spacing:0.1em;text-transform:uppercase;opacity:0.7;margin-bottom:12px;">BrokersEdge</div>
  <h1>Net Worth Statement</h1>
  <h2>${esc(name)} · As at ${dateStr}</h2>
</div>

<div class="section">
  <h2 class="section-title">Balance Sheet</h2>
  <div class="summary-grid">
    <div class="summary-card"><div class="label">Total Assets</div><div class="value positive">${fmtCad(totalA)}</div></div>
    <div class="summary-card"><div class="label">Total Liabilities</div><div class="value negative">${fmtCad(totalL)}</div></div>
    <div class="summary-card"><div class="label">Net Worth</div><div class="value ${totalA - totalL >= 0 ? "positive" : "negative"}">${fmtCad(totalA - totalL)}</div></div>
  </div>

  <h3>Assets</h3>
  <table>
    <thead><tr><th>Description</th><th>Category</th><th style="text-align:right">Value</th></tr></thead>
    <tbody>
      ${assets.map(e => `<tr><td>${esc(e.name || e.category)}</td><td>${esc(e.category)}</td><td style="text-align:right">${fmtCad(parseFloat(e.value || "0"))}</td></tr>`).join("")}
      ${aum > 0 ? `<tr><td>Managed Products (AUM)</td><td>Investments</td><td style="text-align:right">${fmtCad(aum)}</td></tr>` : ""}
      <tr class="total"><td colspan="2">Total Assets</td><td style="text-align:right">${fmtCad(totalA + (aum > 0 && !assets.some(a => a.category === "investments") ? aum : 0))}</td></tr>
    </tbody>
  </table>

  ${liabs.length > 0 ? `
  <h3>Liabilities</h3>
  <table>
    <thead><tr><th>Description</th><th>Category</th><th style="text-align:right">Value</th></tr></thead>
    <tbody>
      ${liabs.map(e => `<tr><td>${esc(e.name || e.category)}</td><td>${esc(e.category)}</td><td style="text-align:right">${fmtCad(parseFloat(e.value || "0"))}</td></tr>`).join("")}
      <tr class="total"><td colspan="2">Total Liabilities</td><td style="text-align:right">${fmtCad(totalL)}</td></tr>
    </tbody>
  </table>` : ""}

  <div style="margin-top:20px;padding:16px;background:var(--lgray);border-radius:8px;display:flex;justify-content:space-between;align-items:center">
    <span style="font-size:14pt;font-weight:700;color:var(--navy)">Net Worth</span>
    <span style="font-size:18pt;font-weight:700;color:${totalA - totalL >= 0 ? "var(--green)" : "var(--red)"}">${fmtCad(totalA - totalL)}</span>
  </div>
</div>`;

  return htmlShell(`Net Worth Statement — ${name}`, body);
}
