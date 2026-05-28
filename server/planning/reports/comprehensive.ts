// server/planning/reports/comprehensive.ts
import type { ComprehensiveReportInputs, RetirementProjection, TaxProjection, RrspAnalysis, TfsaAnalysis, CapitalGainsAnalysis, IncomeSplittingAnalysis, InsuranceAnalysis, EducationAnalysis, EstateAnalysis, DebtAnalysis } from "../types.js";
import { REPORT_CSS } from "./styles.js";
import { coverPage, pageHeader, pageFooter, sectionHeader, metricGrid, dataTable, recommendationList, callout, progressBar, twoCol, divider, badge, barChart, lineChart, donutChart, fmt } from "./components.js";
import { PROVINCE_NAMES } from "../data/taxData2024.js";

function retirementSection(inputs: ComprehensiveReportInputs, r: RetirementProjection): string {
  const ri = inputs.retirement!;
  const income = [{label:"CPP",value:r.incomeFromCpp},{label:"OAS",value:r.incomeFromOas},{label:"Pension",value:r.incomeFromPension},{label:"RRSP/RRIF",value:r.incomeFromRrsp},{label:"TFSA",value:r.incomeFromTfsa}].filter(d=>d.value>0);
  const sc = r.successProbability>=90?"green":r.successProbability>=75?"blue":r.successProbability>=60?"amber":"red";
  const rows = r.yearByYear.filter((_,i)=>i%5===0).slice(0,14).map(row=>[fmt.age(row.age),fmt.year(row.year),fmt.dollar(row.rrspBalance),fmt.dollar(row.tfsaBalance),fmt.dollar(row.nonRegBalance),fmt.dollar(row.totalBalance),row.withdrawalAmount>0?fmt.dollar(row.withdrawalAmount):"—",fmt.dollar(row.totalIncome)]);
  const ld = r.yearByYear.filter((_,i)=>i%2===0);
  return `<div class="page">${pageHeader(inputs.meta,"Retirement Planning")}${sectionHeader("Section 1","Retirement Planning",`Projection to age ${ri.planToAge} \u2014 ${PROVINCE_NAMES[ri.province]}`)}
  ${metricGrid([{label:"Retirement Age",value:`Age ${ri.retirementAge}`,sub:`${r.yearsToRetirement} years away`},{label:"Savings at Retirement",value:fmt.dollar(r.retirementSavingsAtRetirement),variant:"navy"},{label:"Income Goal",value:fmt.dollar(ri.desiredRetirementIncome)+"/yr",sub:"Today's dollars"},{label:"Success Probability",value:`${r.successProbability}%`,variant:sc,sub:r.portfolioDepletionAge?`<span class="text-red">Depletes at age ${r.portfolioDepletionAge}</span>`:`<span class="text-green">Survives to age ${ri.planToAge}</span>`}])}
  <div class="two-col mb-20"><div>
  ${metricGrid([{label:"RRSP at Retirement",value:fmt.dollar(r.rrspAtRetirement),variant:"blue"},{label:"TFSA at Retirement",value:fmt.dollar(r.tfsaAtRetirement),variant:"blue"},{label:"Non-Reg at Retirement",value:fmt.dollar(r.nonRegAtRetirement),variant:"blue"}],3)}
  ${metricGrid([{label:"CPP Benefit",value:fmt.dollar(r.cppMonthlyBenefit)+"/mo",sub:`Starting age ${ri.cppStartAge}`},{label:"OAS Benefit",value:fmt.dollar(r.oasMonthlyBenefit)+"/mo",sub:`Starting age ${ri.oasStartAge}`},{label:"DB Pension",value:fmt.dollar(ri.pensionMonthly)+"/mo",sub:"Defined benefit"}],3)}
  </div><div>${donutChart("Retirement Income Sources",income)}</div></div>
  ${lineChart("Portfolio Balance Over Time",[{label:"RRSP/RRIF",data:ld.map(row=>({x:row.age,y:row.rrspBalance})),color:"#1E5FA8"},{label:"TFSA",data:ld.map(row=>({x:row.age,y:row.tfsaBalance})),color:"#C9A84C"},{label:"Non-Reg",data:ld.map(row=>({x:row.age,y:row.nonRegBalance})),color:"#1A7A4A"}])}
  ${callout(`<strong>CPP Timing:</strong> Starting CPP at age ${ri.cppStartAge} gives ${fmt.dollar(r.cppMonthlyBenefit)}/month. Break-even vs. starting at 65 is approximately age ${r.cppBreakevenAge}. &nbsp;<strong>OAS Timing:</strong> Break-even vs. starting at 65 is approximately age ${r.oasBreakevenAge}.`,"info")}
  ${callout(`<strong>RRSP vs. TFSA Strategy:</strong> ${r.rrspVsTfsaRationale}`,r.rrspVsTfsaRecommendation==="rrsp"?"info":r.rrspVsTfsaRecommendation==="tfsa"?"success":"info")}
  ${dataTable("Year-by-Year Projection (Every 5 Years)",[{label:"Age"},{label:"Year"},{label:"RRSP/RRIF",right:true},{label:"TFSA",right:true},{label:"Non-Reg",right:true},{label:"Total Portfolio",right:true},{label:"Withdrawal",right:true},{label:"Gross Income",right:true}],rows)}
  ${r.shortfallOrSurplus<0?callout(`<strong>Action Required:</strong> Projected annual retirement income shortfall of ${fmt.dollar(Math.abs(r.shortfallOrSurplus))}. Consider increasing annual savings or adjusting the retirement age.`,"warning"):callout(`<strong>On Track:</strong> Current savings trajectory projects a surplus of ${fmt.dollar(r.shortfallOrSurplus)} annually in retirement.`,"success")}
  ${pageFooter(1,10,inputs.meta.advisor.companyName)}</div>`;
}

function taxSection(inputs: ComprehensiveReportInputs, r: TaxProjection): string {
  return `<div class="page">${pageHeader(inputs.meta,"Tax Planning")}${sectionHeader("Section 2","Tax Projection",`${inputs.tax?.taxYear??new Date().getFullYear()} Tax Year \u2014 ${PROVINCE_NAMES[inputs.tax?.province??inputs.meta.client.province]}`)}
  ${metricGrid([{label:"Gross Income",value:fmt.dollar(r.grossIncome)},{label:"Taxable Income",value:fmt.dollar(r.taxableIncome)},{label:"Total Tax",value:fmt.dollar(r.totalTax),variant:"red"},{label:"After-Tax Income",value:fmt.dollar(r.afterTaxIncome),variant:"green"}])}
  ${metricGrid([{label:"Effective Rate",value:fmt.pct(r.effectiveRate),sub:"Total tax / gross income"},{label:"Marginal Rate",value:fmt.pct(r.marginalRate),variant:"amber",sub:"Federal + provincial"},{label:"Federal Tax",value:fmt.dollar(r.federalTax)},{label:"Provincial Tax",value:fmt.dollar(r.provincialTax)}])}
  ${barChart("Tax Breakdown",[{label:"Federal Tax",value:r.federalTax},{label:"Provincial Tax",value:r.provincialTax},{label:"CPP",value:r.cpp},{label:"EI",value:r.ei}])}
  ${dataTable("Federal Tax Bracket Breakdown",[{label:"Bracket"},{label:"Rate",right:true},{label:"Income in Bracket",right:true},{label:"Tax in Bracket",right:true},{label:"Cumulative Tax",right:true}],r.bracketBreakdown.map(b=>[b.bracket,fmt.pct(b.rate),fmt.dollar(b.incomeInBracket),fmt.dollar(b.taxInBracket),fmt.dollar(b.cumulative)]))}
  ${dataTable("5-Year Tax Projection (2% Annual Income Growth)",[{label:"Year"},{label:"Projected Income",right:true},{label:"Projected Tax",right:true},{label:"Effective Rate",right:true},{label:"Marginal Rate",right:true}],r.fiveYearProjection.map(row=>[row.year.toString(),fmt.dollar(row.projectedIncome),fmt.dollar(row.projectedTax),fmt.pct(row.effectiveRate),fmt.pct(row.marginalRate)]))}
  ${r.recommendations.length>0?sectionHeader("","Tax Planning Recommendations")+recommendationList(r.recommendations.map(rec=>({priority:rec.priority,category:rec.category,text:rec.recommendation,saving:rec.estimatedSaving}))):""}
  ${pageFooter(2,10,inputs.meta.advisor.companyName)}</div>`;
}

function rrspSection(inputs: ComprehensiveReportInputs, r: RrspAnalysis): string {
  const rows = r.yearByYear.filter((_,i)=>i%3===0).slice(0,12).map(row=>[fmt.age(row.age),row.year.toString(),fmt.dollar(row.openingBalance),fmt.dollar(row.contribution),fmt.dollar(row.growth),fmt.dollar(row.closingBalance),fmt.dollar(row.taxRefund)]);
  return `<div class="page">${pageHeader(inputs.meta,"RRSP Analysis")}${sectionHeader("Section 3","RRSP Room & Optimization",`Tax Year ${new Date().getFullYear()}`)}
  ${metricGrid([{label:"Available Room",value:fmt.dollar(r.totalAvailableRoom),variant:"navy"},{label:"New Room This Year",value:fmt.dollar(r.newRoomThisYear)},{label:"Tax Refund @ Marginal",value:fmt.dollar(r.taxRefundAtMarginalRate),variant:"green"},{label:"Effective Cost",value:fmt.dollar(r.effectiveCostAfterRefund),sub:"After tax refund"}])}
  ${metricGrid([{label:"Projected at Retirement",value:fmt.dollar(r.projectedBalanceAtRetirement),variant:"blue"},{label:"Annual Withdrawal (4%)",value:fmt.dollar(r.projectedAnnualWithdrawal)},{label:"Years of Growth",value:r.yearsOfGrowth.toString()},{label:"Maximize Room by",value:`Age ${r.maximizeByAge}`}])}
  ${callout(r.catchUpStrategy,r.currentRoom>r.projectedAnnualWithdrawal?"warning":"success")}
  ${lineChart("RRSP Balance Projection",[{label:"RRSP Balance",data:r.yearByYear.map(row=>({x:row.age,y:row.closingBalance})),color:"#1E5FA8"},{label:"Cumulative Contributions",data:r.yearByYear.map(row=>({x:row.age,y:row.cumulativeContributions})),color:"#C9A84C"}])}
  ${dataTable("RRSP Growth Projection",[{label:"Age"},{label:"Year"},{label:"Opening Balance",right:true},{label:"Contribution",right:true},{label:"Growth",right:true},{label:"Closing Balance",right:true},{label:"Tax Refund",right:true}],rows)}
  ${callout(`<strong>Home Buyers Plan (HBP):</strong> First-time homebuyers may withdraw up to ${fmt.dollar(r.homeByersAmount)} from their RRSP tax-free, repayable over 15 years. &nbsp;<strong>Lifelong Learning Plan (LLP):</strong> Up to ${fmt.dollar(r.lifelongLearningAmount)} for full-time education, repayable over 10 years.`,"info")}
  ${pageFooter(3,10,inputs.meta.advisor.companyName)}</div>`;
}

function tfsaSection(inputs: ComprehensiveReportInputs, r: TfsaAnalysis): string {
  const rows = r.yearByYear.filter((_,i)=>i%3===0).slice(0,12).map(row=>[fmt.age(row.age),row.year.toString(),fmt.dollar(row.annualLimit),fmt.dollar(row.cumulativeRoom),fmt.dollar(row.openingBalance),fmt.dollar(row.contribution),fmt.dollar(row.growth),fmt.dollar(row.closingBalance)]);
  return `<div class="page">${pageHeader(inputs.meta,"TFSA Analysis")}${sectionHeader("Section 4","TFSA Room & Strategy","Lifetime room since 2009")}
  ${metricGrid([{label:"Lifetime Room to Date",value:fmt.dollar(r.lifetimeRoomToDate),variant:"navy"},{label:"Available Room Now",value:fmt.dollar(r.currentAvailableRoom),variant:r.currentAvailableRoom>0?"green":"amber"},{label:"2024 Annual Limit",value:fmt.dollar(r.new2024Room)},{label:"Withdrawal Room Recovered",value:fmt.dollar(r.withdrawalRoomRecovered)}])}
  ${metricGrid([{label:"Balance in 10 Years",value:fmt.dollar(r.projectedBalance10Years),variant:"blue"},{label:"Balance in 20 Years",value:fmt.dollar(r.projectedBalance20Years),variant:"blue"},{label:"Balance at Retirement",value:fmt.dollar(r.projectedBalanceAtRetirement),variant:"blue"},{label:"Optimal Withdrawal Age",value:`Age ${r.optimalWithdrawalAge}`}])}
  ${lineChart("TFSA vs. Taxable Account \u2014 Tax-Free Advantage",[{label:"TFSA Balance",data:r.taxFreeSavingsVsTaxable.map(row=>({x:row.year,y:row.tfsaBalance})),color:"#1E5FA8"},{label:"Taxable Account",data:r.taxFreeSavingsVsTaxable.map(row=>({x:row.year,y:row.taxableBalance})),color:"#C9A84C"},{label:"TFSA Advantage",data:r.taxFreeSavingsVsTaxable.map(row=>({x:row.year,y:row.tfsaAdvantage})),color:"#1A7A4A"}])}
  ${callout(r.withdrawalStrategy,"info")}
  ${dataTable("TFSA Growth Projection",[{label:"Age"},{label:"Year"},{label:"Annual Limit",right:true},{label:"Cumulative Room",right:true},{label:"Opening Balance",right:true},{label:"Contribution",right:true},{label:"Growth",right:true},{label:"Closing Balance",right:true}],rows)}
  ${pageFooter(4,10,inputs.meta.advisor.companyName)}</div>`;
}

function capitalGainsSection(inputs: ComprehensiveReportInputs, r: CapitalGainsAnalysis): string {
  return `<div class="page">${pageHeader(inputs.meta,"Capital Gains")}${sectionHeader("Section 5","Capital Gains Analysis",`Tax Year ${inputs.capitalGains?.taxYear??new Date().getFullYear()}`)}
  ${metricGrid([{label:"Total Gain",value:fmt.dollar(r.totalGain),variant:r.totalGain>0?"amber":""},{label:"Taxable Gain",value:fmt.dollar(r.netTaxableGain),variant:"red"},{label:"Total Tax on Gains",value:fmt.dollar(r.totalTaxOnGains),variant:"red"},{label:"Effective Rate on Gains",value:fmt.pct(r.effectiveRateOnGains)}])}
  ${metricGrid([{label:"Inclusion Rate (under $250k)",value:fmt.pct(r.inclusionRateUnder250k)},{label:"Inclusion Rate (over $250k)",value:fmt.pct(r.inclusionRateOver250k)},{label:"LCGE Remaining",value:fmt.dollar(r.lcgeRemaining),variant:"green"},{label:"Losses Applied",value:fmt.dollar(r.lossesApplied)}])}
  ${r.disposalBreakdown.length>0?dataTable("Disposal Breakdown",[{label:"Asset"},{label:"Proceeds",right:true},{label:"ACB",right:true},{label:"Gain",right:true},{label:"Tax",right:true}],r.disposalBreakdown.map(d=>[d.description,d.proceeds,d.acb,d.gain,d.estimatedTax])):""}
  ${r.timingRecommendations.length>0?callout(`<strong>Timing Strategies:</strong> ${r.timingRecommendations.join(" &nbsp;|&nbsp; ")}`,"info"):""}
  ${r.harvestingOpportunities.length>0?callout(`<strong>Harvesting Opportunities:</strong> ${r.harvestingOpportunities.join(" &nbsp;|&nbsp; ")}`,"success"):""}
  ${pageFooter(5,10,inputs.meta.advisor.companyName)}</div>`;
}

function incomeSplittingSection(inputs: ComprehensiveReportInputs, r: IncomeSplittingAnalysis): string {
  const strats = r.strategies ?? [];
  return `<div class="page">${pageHeader(inputs.meta,"Income Splitting")}${sectionHeader("Section 6","Income Splitting Strategies","T1032 Pension Splitting & Spousal RRSP")}
  ${metricGrid([{label:"Current Combined Tax",value:fmt.dollar(r.currentCombinedTax),variant:"red"},{label:"After Splitting Tax",value:fmt.dollar(r.combinedAfterSplitTax),variant:"green"},{label:"Annual Tax Saving",value:fmt.dollar(r.totalAnnualSaving),variant:"navy"},{label:"Lifetime Tax Saving",value:fmt.dollar(r.totalLifetimeSaving),variant:"navy"}])}
  ${dataTable("Before vs. After Income Splitting",[{label:"Taxpayer"},{label:"Before: Tax",right:true},{label:"Before: Eff. Rate",right:true},{label:"After: Tax",right:true},{label:"After: Eff. Rate",right:true},{label:"Saving",right:true}],[
    [inputs.meta.client.fullName+" (Primary)",fmt.dollar(r.primaryCurrentTax),fmt.pct(r.comparison?.beforeSplitting?.effectivePrimary??0),fmt.dollar(r.primaryAfterSplitTax),fmt.pct(r.comparison?.afterSplitting?.effectivePrimary??0),fmt.dollar(r.primaryCurrentTax-r.primaryAfterSplitTax)],
    [(inputs.meta.client.spouseFirstName??"Spouse"),fmt.dollar(r.spouseCurrentTax),fmt.pct(r.comparison?.beforeSplitting?.effectiveSpouse??0),fmt.dollar(r.spouseAfterSplitTax),fmt.pct(r.comparison?.afterSplitting?.effectiveSpouse??0),fmt.dollar(r.spouseCurrentTax-r.spouseAfterSplitTax)],
  ],["Combined",fmt.dollar(r.currentCombinedTax),"—",fmt.dollar(r.combinedAfterSplitTax),"—",fmt.dollar(r.totalAnnualSaving)])}
  ${strats.length>0?`<div class="section-title mb-12">Available Strategies</div><div class="rec-list">${strats.map(s=>`<div class="rec-item ${s.eligible?"medium":"low"}"><div class="rec-icon">${s.eligible?"&#9873;":"&#8212;"}</div><div class="rec-body"><div class="rec-category">${s.name.toUpperCase()} ${s.eligible?badge("ELIGIBLE","green"):badge("NOT ELIGIBLE","red")}</div><div class="rec-text">${s.description}</div>${s.eligible&&s.annualSaving>0?`<div class="rec-saving">Annual saving: ${fmt.dollar(s.annualSaving)} \u2014 ${s.actionRequired}</div>`:s.actionRequired?`<div class="rec-text" style="color:var(--gray-400);font-size:11px">${s.actionRequired}</div>`:""}</div></div>`).join("")}</div>`:""}
  ${r.spousalRrspRecommended?callout(`Contributing to a spousal RRSP saves ${fmt.pct(r.comparison?.beforeSplitting?.effectivePrimary??0 - (r.comparison?.afterSplitting?.effectivePrimary??0))} on withdrawals. ${r.spousalRrspRationale}`,"success"):""}
  ${pageFooter(6,10,inputs.meta.advisor.companyName)}</div>`;
}

function insuranceSection(inputs: ComprehensiveReportInputs, r: InsuranceAnalysis): string {
  return `<div class="page">${pageHeader(inputs.meta,"Insurance Needs")}${sectionHeader("Section 7","Insurance Needs Analysis","Life, Disability & Critical Illness")}
  ${metricGrid([{label:"Life Insurance Gap",value:fmt.dollar(r.dimeGap),variant:r.dimeGap>0?"red":"green"},{label:"Recommended Coverage",value:fmt.dollar(r.recommendedLifeCoverage),variant:"navy"},{label:"Disability Gap (Monthly)",value:fmt.dollar(r.disabilityGap)+"/mo",variant:r.disabilityGap>0?"amber":"green"},{label:"Critical Illness Gap",value:fmt.dollar(r.ciGap),variant:r.ciGap>0?"amber":"green"}])}
  ${dataTable("Life Insurance Needs \u2014 DIME Method",[{label:"Component"},{label:"Amount",right:true},{label:"Notes"}],[["Debt (D)",fmt.dollar(r.dimeDebt),"Total liabilities + final expenses"],["Income Replacement (I)",fmt.dollar(r.dimeIncome),`${Math.round(r.dimeIncome/(inputs.insurance?.annualIncome||1))} years income replacement`],["Mortgage (M)",fmt.dollar(r.dimeMortgage),"Outstanding mortgage balance"],["Education (E)",fmt.dollar(r.dimeEducation),"Children's education costs"],["Total DIME Need",fmt.dollar(r.dimeTotalNeed),""],["Less: Existing Coverage",`(${fmt.dollar(r.dimeExistingCoverage)})`,"Life insurance + liquid assets"]],["Coverage Gap",fmt.dollar(r.dimeGap),`${r.recommendedCoverageType.replace(/_/g," ")} recommended`])}
  ${metricGrid([{label:"Human Life Value",value:fmt.dollar(r.hlvValue)},{label:"HLV Gap",value:fmt.dollar(r.hlvGap),variant:r.hlvGap>0?"amber":""},{label:"Needs-Based Requirement",value:fmt.dollar(r.needsBasedCapitalNeeded)},{label:"Needs-Based Gap",value:fmt.dollar(r.needsBasedGap),variant:r.needsBasedGap>0?"amber":"green"}])}
  ${dataTable("Disability & Critical Illness",[{label:"Coverage Type"},{label:"Monthly Need",right:true},{label:"Existing",right:true},{label:"Gap",right:true},{label:"Est. Premium",right:true}],[["Long-term Disability",fmt.dollar(r.monthlyDisabilityNeed)+"/mo",fmt.dollar(r.existingDisabilityCoverage)+"/mo",fmt.dollar(r.disabilityGap)+"/mo",fmt.dollar(r.estimatedDisabilityPremium)+"/mo"],["Critical Illness (Lump Sum)",fmt.dollar(r.recommendedCICoverage),fmt.dollar(inputs.insurance?.existingCriticalIllness??0),fmt.dollar(r.ciGap),fmt.dollar(r.estimatedCIPremium)+"/mo"]])}
  ${r.recommendations.length>0?recommendationList(r.recommendations.map(rec=>({priority:rec.priority,category:rec.type,text:rec.rationale,saving:rec.coverageAmount}))):""}
  ${pageFooter(7,10,inputs.meta.advisor.companyName)}</div>`;
}

function educationSection(inputs: ComprehensiveReportInputs, r: EducationAnalysis): string {
  return `<div class="page">${pageHeader(inputs.meta,"Education Planning")}${sectionHeader("Section 8","Education Planning (RESP)","CESG, CLB & Projection")}
  ${metricGrid([{label:"Total CESG Received",value:fmt.dollar(r.totalCesgReceived),variant:"green"},{label:"Projected RESP Value",value:fmt.dollar(r.totalProjectedRespValue),variant:"navy"},{label:"Estimated Education Cost",value:fmt.dollar(r.totalEstimatedEducationCost)},{label:"Surplus / Shortfall",value:fmt.dollar(r.shortfallOrSurplus),variant:r.shortfallOrSurplus>=0?"green":"red"}])}
  ${r.children.map(child=>`<div class="section-title mb-8">${child.name} (Age ${child.age})</div>${metricGrid([{label:"Projected RESP",value:fmt.dollar(child.projectedRespBalance),variant:"blue"},{label:"Education Cost",value:fmt.dollar(child.estimatedEducationCost)},{label:"Total CESG",value:fmt.dollar(child.totalCesgForChild),variant:"green"},{label:"Surplus/Shortfall",value:fmt.dollar(child.shortfallOrSurplus),variant:child.shortfallOrSurplus>=0?"green":"red"}],4)}${dataTable(`${child.name} — RESP Growth`,[{label:"Year"},{label:"Age"},{label:"Contribution",right:true},{label:"CESG",right:true},{label:"Growth",right:true},{label:"Balance",right:true}],child.yearByYear.filter((_,i)=>i%2===0).slice(0,10).map(row=>[row.year.toString(),row.childAge.toString(),fmt.dollar(row.contribution),fmt.dollar(row.cesg+row.additionalCesg),fmt.dollar(row.growth),fmt.dollar(row.closingBalance)]))}`).join("")}
  ${pageFooter(8,10,inputs.meta.advisor.companyName)}</div>`;
}

function estateSection(inputs: ComprehensiveReportInputs, r: EstateAnalysis): string {
  const ds = r.documentStatus;
  const docItems = [
    { name:"Will",                has: ds.will.hasDocument,                rec: ds.will.recommendation },
    { name:"POA",                 has: ds.poa.hasDocument,                 rec: ds.poa.recommendation },
    { name:"HC Directive",        has: ds.hcDirective.hasDocument,         rec: ds.hcDirective.recommendation },
    { name:"RRSP Beneficiary",    has: ds.rrspBeneficiary.hasDocument,     rec: ds.rrspBeneficiary.recommendation },
    { name:"TFSA Beneficiary",    has: ds.tfsaBeneficiary.hasDocument,     rec: ds.tfsaBeneficiary.recommendation },
    { name:"Insurance Beneficiary",has:ds.insuranceBeneficiary.hasDocument,rec: ds.insuranceBeneficiary.recommendation },
  ];
  return `<div class="page">${pageHeader(inputs.meta,"Estate Planning")}${sectionHeader("Section 9","Estate Planning",`Province: ${PROVINCE_NAMES[inputs.estate?.province??inputs.meta.client.province]}`)}
  ${metricGrid([{label:"Gross Estate",value:fmt.dollar(r.grossEstate)},{label:"Net Estate",value:fmt.dollar(r.netEstate),variant:"navy"},{label:"Estimated Tax on Death",value:fmt.dollar(r.totalTaxOnDeath),variant:"red"},{label:"Estate After Tax & Probate",value:fmt.dollar(r.estateAfterTaxAndProbate),variant:"green"}])}
  ${metricGrid([{label:"Probate Fees",value:fmt.dollar(r.probateFees),variant:r.probateFees>10000?"amber":""},{label:"Assets Bypassing Probate",value:fmt.dollar(r.assetsBypassingProbate),variant:"green"},{label:"RRSP/RRIF Tax on Death",value:fmt.dollar(r.taxOnRrsp),variant:r.taxOnRrsp>0?"red":""},{label:"Capital Gains Tax on Death",value:fmt.dollar(r.taxOnCapitalGains),variant:r.taxOnCapitalGains>0?"amber":""}])}
  ${barChart("Estate Distribution Overview",[{label:"To Spouse",value:r.toSpouse,color:"#1A7A4A"},{label:"Estate (Net)",value:r.estateAfterTaxAndProbate,color:"#1E5FA8"},{label:"Tax on Death",value:r.totalTaxOnDeath,color:"#C0392B"},{label:"Probate Fees",value:r.probateFees,color:"#D4860A"}])}
  <div class="table-title mb-12">Document Status Checklist</div>
  <div class="rec-list">${docItems.map(d=>`<div class="rec-item ${d.has?"low":"immediate"}"><div class="rec-icon">${d.has?"&#9745;":"&#9888;"}</div><div class="rec-body"><div class="rec-category">${d.name} ${d.has?badge("IN PLACE","green"):badge("MISSING","red")}</div><div class="rec-text">${d.rec}</div></div></div>`).join("")}</div>
  ${r.recommendations.length>0?recommendationList(r.recommendations.map(rec=>({priority:rec.priority,category:rec.category,text:rec.recommendation,saving:rec.estimatedSaving}))):""}
  ${callout(`<strong>Estate Liquidity Needed:</strong> ${fmt.dollar(r.estimatedLiquidityNeeded)} required to cover taxes and probate fees on death.${r.lifeInsuranceSuggested>0?` A life insurance policy of ${fmt.dollar(r.lifeInsuranceSuggested)} is recommended to provide tax-free liquidity.`:" Current assets provide sufficient liquidity."}`,r.lifeInsuranceSuggested>0?"warning":"success")}
  ${pageFooter(9,10,inputs.meta.advisor.companyName)}</div>`;
}

function debtSection(inputs: ComprehensiveReportInputs, r: DebtAnalysis): string {
  return `<div class="page">${pageHeader(inputs.meta,"Debt & Cash Flow")}${sectionHeader("Section 10","Debt & Cash Flow Analysis","Debt Payoff Strategy & Monthly Budget")}
  ${metricGrid([{label:"Total Debt",value:fmt.dollar(r.totalDebt),variant:r.totalDebt>0?"amber":"green"},{label:"Monthly Surplus/Deficit",value:fmt.dollar(r.monthlySurplusOrDeficit),variant:r.monthlySurplusOrDeficit>=0?"green":"red"},{label:"Savings Rate",value:fmt.pct(r.savingsRate),variant:r.savingsRate>=0.15?"green":"amber"},{label:"Debt-Free Date",value:r.debtFreeDate,variant:"navy"}])}
  <div class="two-col mb-20"><div>
  <div class="table-title mb-8">Debt Service Ratios</div>
  ${progressBar("GDSR (max 32%)",r.grossDebtServiceRatio,0.44,r.grossDebtServiceRatio>0.32?"red":"green")}
  ${progressBar("TDSR (max 44%)",r.totalDebtServiceRatio,0.44,r.totalDebtServiceRatio>0.44?"red":r.totalDebtServiceRatio>0.36?"amber":"green")}
  ${metricGrid([{label:"GDSR",value:fmt.pct(r.grossDebtServiceRatio),variant:r.grossDebtServiceRatio>0.32?"red":"green",sub:"Max 32% recommended"},{label:"TDSR",value:fmt.pct(r.totalDebtServiceRatio),variant:r.totalDebtServiceRatio>0.44?"red":r.totalDebtServiceRatio>0.36?"amber":"green",sub:"Max 44% (lender limit)"}],2)}
  </div><div>${metricGrid([{label:"Emergency Fund",value:`${r.emergencyFundMonthsCovered.toFixed(1)} months`,variant:r.emergencyFundStatus==="adequate"?"green":r.emergencyFundStatus==="building"?"amber":"red"},{label:"Status",value:r.emergencyFundStatus.toUpperCase(),sub:r.emergencyFundStatus==="adequate"?"3-6 months covered":"Below 3-month target"}],2)}</div></div>
  ${dataTable("Monthly Cash Flow Budget",[{label:"Category"},{label:"Monthly Amount",right:true},{label:"Annual",right:true},{label:"% of Net Income",right:true}],[["Gross Income",fmt.dollar(r.monthlyBudget.grossIncome),fmt.dollar(r.monthlyBudget.grossIncome*12),"100%"],["Less: Taxes",`(${fmt.dollar(r.monthlyBudget.taxes)})`,`(${fmt.dollar(r.monthlyBudget.taxes*12)})`,""],[`Net Income`,fmt.dollar(r.monthlyBudget.netIncome),fmt.dollar(r.monthlyBudget.netIncome*12),"100%"],["Housing",fmt.dollar(r.monthlyBudget.housing),fmt.dollar(r.monthlyBudget.housing*12),fmt.pct(r.monthlyBudget.housing/Math.max(r.monthlyBudget.netIncome,1))],["Transportation",fmt.dollar(r.monthlyBudget.transportation),fmt.dollar(r.monthlyBudget.transportation*12),fmt.pct(r.monthlyBudget.transportation/Math.max(r.monthlyBudget.netIncome,1))],["Food",fmt.dollar(r.monthlyBudget.food),fmt.dollar(r.monthlyBudget.food*12),fmt.pct(r.monthlyBudget.food/Math.max(r.monthlyBudget.netIncome,1))],["Debt Payments",fmt.dollar(r.monthlyBudget.debtPayments),fmt.dollar(r.monthlyBudget.debtPayments*12),fmt.pct(r.monthlyBudget.debtPayments/Math.max(r.monthlyBudget.netIncome,1))],["Savings",fmt.dollar(r.monthlyBudget.savings),fmt.dollar(r.monthlyBudget.savings*12),fmt.pct(r.monthlyBudget.savings/Math.max(r.monthlyBudget.netIncome,1))],["Discretionary",fmt.dollar(r.monthlyBudget.discretionary),fmt.dollar(r.monthlyBudget.discretionary*12),fmt.pct(r.monthlyBudget.discretionary/Math.max(r.monthlyBudget.netIncome,1))]],["Monthly Surplus",fmt.dollar(r.monthlyBudget.surplus),fmt.dollar(r.monthlyBudget.surplus*12),fmt.pct(r.monthlyBudget.surplus/Math.max(r.monthlyBudget.netIncome,1))])}
  ${r.avalancheOrder.length>0?dataTable(`Debt Payoff \u2014 Avalanche Method (Saves ${fmt.dollar(r.avalancheInterestSaved)} vs Snowball)`,[{label:"Priority"},{label:"Debt"},{label:"Balance",right:true},{label:"Rate",right:true},{label:"Min Payment",right:true},{label:"Payoff Date"},{label:"Total Interest",right:true}],r.avalancheOrder.map(d=>[`#${d.payoffOrder}`,d.name,fmt.dollar(d.balance),fmt.pct(d.interestRate),fmt.dollar(d.minimumPayment),d.payoffDate,fmt.dollar(d.totalInterestPaid)])):""}
  ${r.recommendations.length>0?recommendationList(r.recommendations.map(rec=>({priority:rec.priority,category:rec.category,text:rec.recommendation,saving:rec.monthlyImpact*12}))):""}
  ${pageFooter(10,10,inputs.meta.advisor.companyName)}</div>`;
}

// ── Display-only sections (no engine calculation, just raw DB data) ──────────

function networthSection(inputs: ComprehensiveReportInputs): string {
  const rows = inputs.rawNetWorth ?? [];
  const assets = rows.filter(e => e.type === "asset");
  const liabs  = rows.filter(e => e.type === "liability");
  const totalA = assets.reduce((s, e) => s + Number(e.value), 0);
  const totalL = liabs.reduce((s, e) => s + Number(e.value), 0);
  const netWorth = totalA - totalL;

  // Group assets by category for allocation
  const catGroups: Record<string, number> = {};
  assets.forEach(e => { catGroups[e.category] = (catGroups[e.category] ?? 0) + Number(e.value); });
  const allocationData = Object.entries(catGroups).map(([label, value]) => ({ label, value }));

  return `<div class="page">${pageHeader(inputs.meta,"Net Worth Statement")}${sectionHeader("Net Worth","Net Worth & Asset Allocation",`As of ${inputs.meta.reportDate}`)}
  ${metricGrid([{label:"Total Assets",value:fmt.dollar(totalA),variant:"green"},{label:"Total Liabilities",value:fmt.dollar(totalL),variant:"red"},{label:"Net Worth",value:fmt.dollar(netWorth),variant:netWorth>=0?"navy":"red"},{label:"Asset Count",value:`${assets.length} assets`}])}
  ${assets.length>0?dataTable("Assets",[{label:"Category"},{label:"Description"},{label:"Owner"},{label:"Value",right:true}],assets.map(e=>[e.category,e.name||e.category,e.owner==="spouse"?"Spouse":e.owner==="joint"?"Joint":"Primary",Number(e.value)])):""}
  ${liabs.length>0?dataTable("Liabilities",[{label:"Category"},{label:"Description"},{label:"Balance",right:true}],liabs.map(e=>[e.category,e.name||e.category,Number(e.value)])):""}
  ${allocationData.length>0?barChart("Asset Allocation by Category",allocationData):""}
  ${pageFooter(0,0,inputs.meta.advisor.companyName)}</div>`;
}

function cashflowSection(inputs: ComprehensiveReportInputs): string {
  const rows = inputs.rawExpenses ?? [];
  const totalMonthly = rows.reduce((s, e) => s + Number(e.monthlyAmount ?? 0), 0);
  const annualIncome = inputs.annualIncome ?? 0;
  const monthlySurplus = annualIncome / 12 - totalMonthly;

  const catGroups: Record<string, number> = {};
  rows.forEach(e => { catGroups[e.category] = (catGroups[e.category] ?? 0) + Number(e.monthlyAmount ?? 0); });

  return `<div class="page">${pageHeader(inputs.meta,"Cash Flow")}${sectionHeader("Cash Flow","Monthly Cash Flow & Budget",`As of ${inputs.meta.reportDate}`)}
  ${metricGrid([{label:"Monthly Income",value:fmt.dollar(annualIncome/12)+"/mo",variant:"green"},{label:"Monthly Expenses",value:fmt.dollar(totalMonthly)+"/mo"},{label:"Annual Expenses",value:fmt.dollar(totalMonthly*12)+"/yr"},{label:"Monthly Surplus",value:fmt.dollar(monthlySurplus)+"/mo",variant:monthlySurplus>=0?"green":"red"}])}
  ${rows.length>0?dataTable("Monthly Expenses",[{label:"Category"},{label:"Description"},{label:"Monthly",right:true},{label:"Annual",right:true}],rows.map(e=>[e.category,e.description||e.category,Number(e.monthlyAmount??0),Number(e.monthlyAmount??0)*12])):callout("No expense entries found. Add expenses in the Cash Flow tab.","info")}
  ${Object.keys(catGroups).length>0?barChart("Spending by Category",Object.entries(catGroups).map(([label,value])=>({label,value}))):""}
  ${pageFooter(0,0,inputs.meta.advisor.companyName)}</div>`;
}

function goalsSection(inputs: ComprehensiveReportInputs): string {
  const goals = inputs.rawGoals ?? [];
  const active    = goals.filter(g => g.status !== "completed");
  const completed = goals.filter(g => g.status === "completed");
  const totalTarget = goals.reduce((s, g) => s + Math.abs(Number(g.targetAmount ?? 0)), 0);
  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const sorted = [...goals].sort((a, b) => (priorityOrder[a.priority ?? "low"] ?? 2) - (priorityOrder[b.priority ?? "low"] ?? 2));

  return `<div class="page">${pageHeader(inputs.meta,"Financial Goals")}${sectionHeader("Goals","Financial Goals Status",`${goals.length} goals \u2014 as of ${inputs.meta.reportDate}`)}
  ${metricGrid([{label:"Total Goals",value:goals.length.toString()},{label:"Active",value:active.length.toString(),variant:"navy"},{label:"Completed",value:completed.length.toString(),variant:"green"},{label:"Total Target",value:fmt.dollar(totalTarget)}])}
  ${goals.length>0?dataTable("Goals Summary",[{label:"Goal"},{label:"Type"},{label:"Target Amount",right:true},{label:"Target Year"},{label:"Priority"},{label:"Status"}],sorted.map(g=>[g.title,String(g.goalType??"—").replace(/_/g," "),Math.abs(Number(g.targetAmount??0)),g.targetYear?g.targetYear.toString():"—",String(g.priority??"medium").toUpperCase(),(g.status??"active").replace(/_/g," ").toUpperCase()])):callout("No financial goals found. Add goals in the Goals tab.","info")}
  ${pageFooter(0,0,inputs.meta.advisor.companyName)}</div>`;
}

export function generateComprehensiveReport(
  inputs: ComprehensiveReportInputs,
  results: { retirement?: RetirementProjection; tax?: TaxProjection; rrsp?: RrspAnalysis; tfsa?: TfsaAnalysis; capitalGains?: CapitalGainsAnalysis; incomeSplitting?: IncomeSplittingAnalysis; insurance?: InsuranceAnalysis; education?: EducationAnalysis; estate?: EstateAnalysis; debt?: DebtAnalysis; }
): string {
  const tocItems: string[] = [], sections: string[] = [];

  // Engine-calculated sections
  if (results.retirement)     { tocItems.push("Retirement Planning (RRSP/RRIF/CPP/OAS)"); sections.push(retirementSection(inputs, results.retirement)); }
  if (results.tax)            { tocItems.push("Tax Projection & Planning");                sections.push(taxSection(inputs, results.tax)); }
  if (results.rrsp)           { tocItems.push("RRSP Room & Optimization");                 sections.push(rrspSection(inputs, results.rrsp)); }
  if (results.tfsa)           { tocItems.push("TFSA Room & Strategy");                     sections.push(tfsaSection(inputs, results.tfsa)); }
  if (results.capitalGains)   { tocItems.push("Capital Gains Analysis");                   sections.push(capitalGainsSection(inputs, results.capitalGains)); }
  if (results.incomeSplitting){ tocItems.push("Income Splitting (T1032)");                 sections.push(incomeSplittingSection(inputs, results.incomeSplitting)); }
  if (results.insurance)      { tocItems.push("Insurance Needs Analysis");                 sections.push(insuranceSection(inputs, results.insurance)); }
  if (results.education)      { tocItems.push("Education Planning (RESP)");                sections.push(educationSection(inputs, results.education)); }
  if (results.estate)         { tocItems.push("Estate Planning");                          sections.push(estateSection(inputs, results.estate)); }
  if (results.debt)           { tocItems.push("Debt & Cash Flow");                         sections.push(debtSection(inputs, results.debt)); }

  // Display-only sections (raw data, no engine)
  if (inputs.rawNetWorth && inputs.rawNetWorth.length > 0) { tocItems.push("Net Worth & Asset Allocation"); sections.push(networthSection(inputs)); }
  if (inputs.rawExpenses && inputs.rawExpenses.length > 0) { tocItems.push("Cash Flow & Budget");           sections.push(cashflowSection(inputs)); }
  if (inputs.rawGoals    && inputs.rawGoals.length    > 0) { tocItems.push("Financial Goals");              sections.push(goalsSection(inputs)); }

  const lang = inputs.meta.locale === "fr" ? "fr" : "en";
  const printLabel = inputs.meta.locale === "fr" ? "Imprimer / Enregistrer PDF" : "Print / Save as PDF";
  const printBtn = `<button class="print-btn" onclick="window.print()">
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
    ${printLabel}
  </button>`;
  return `<!DOCTYPE html>\n<html lang="${lang}">\n<head>\n<meta charset="UTF-8">\n<title>${inputs.meta.reportTitle} \u2014 ${inputs.meta.client.fullName}</title>\n<style>${REPORT_CSS}</style>\n</head>\n<body>\n${printBtn}\n${coverPage(inputs.meta, tocItems)}\n${sections.join("\n")}\n</body>\n</html>`;
}
