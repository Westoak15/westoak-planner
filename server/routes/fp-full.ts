import { Router, Response } from "express";
import { db } from "../db/index.js";
import {
  clients, financialPlans,
  netWorthEntries, retirementProjections, insuranceAnalyses,
  educationSavings, debtEntries, taxPlanningNotes, estatePlanningNotes,
  aiRecommendations, planAssumptions, simulationResults,
  planSnapshots, planStaleFlags, planActionItems,
} from "../../shared/schema.js";
import { isAuthenticated, type AuthRequest } from "../auth/index.js";
import { eq, and } from "drizzle-orm";

const r = Router();
r.use(isAuthenticated);

function safe(body: any) {
  const { id, createdAt, updatedAt, userId, clientId, planId, calculatedAt, ...rest } = body;
  const textFields = new Set(["label","name","notes","description","type","category","status","owner","province","occupation","phone","email","method","frequency","premiumFrequency","accountType","beneficiary","policyNumber","provider","insured","inforceDate","renewalDate","relationship","title","content","priority"]);
  for (const key of Object.keys(rest)) { if (rest[key] === "" && !textFields.has(key)) rest[key] = null; }
  return rest;
}

async function ownsClient(cid: number, uid: number) {
  const [c] = await db.select({ id: clients.id }).from(clients).where(and(eq(clients.id, cid), eq(clients.userId, uid)));
  return !!c;
}
async function ownsPlan(pid: number, uid: number) {
  const [p] = await db.select({ id: financialPlans.id, clientId: financialPlans.clientId }).from(financialPlans).where(and(eq(financialPlans.id, pid), eq(financialPlans.userId, uid)));
  return p ?? null;
}

// ── Plans ─────────────────────────────────────────────────────────────────────
r.get("/clients/:clientId/plans", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(financialPlans).where(eq(financialPlans.clientId, cid)));
});
r.post("/clients/:clientId/plans", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [p] = await (db.insert(financialPlans) as any).values({ clientId: cid, userId: req.userId!, title: req.body.name ?? req.body.title ?? "Financial Plan", ...safe(req.body) }).returning();
  res.status(201).json(p);
});
r.get("/plans/:id", async (req: AuthRequest, res: Response) => {
  const p = await ownsPlan(+req.params.id, req.userId!);
  if (!p) return res.status(404).json({ message: "Not found" });
  const [plan] = await db.select().from(financialPlans).where(eq(financialPlans.id, +req.params.id));
  res.json(plan);
});
r.put("/plans/:id", async (req: AuthRequest, res: Response) => {
  if (!await ownsPlan(+req.params.id, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [u] = await db.update(financialPlans).set(safe(req.body)).where(eq(financialPlans.id, +req.params.id)).returning();
  res.json(u);
});
r.delete("/plans/:id", async (req: AuthRequest, res: Response) => {
  if (!await ownsPlan(+req.params.id, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(financialPlans).where(eq(financialPlans.id, +req.params.id));
  res.json({ ok: true });
});

// ── Net Worth ─────────────────────────────────────────────────────────────────
r.get("/clients/:clientId/net-worth", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(netWorthEntries).where(eq(netWorthEntries.clientId, cid)));
});
r.post("/clients/:clientId/net-worth", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  try {
    const [row] = await (db.insert(netWorthEntries) as any).values({ clientId: cid, ...safe(req.body.data ?? req.body) }).returning();
    res.status(201).json(row);
  } catch(e: any) { console.error("[nw post]", e.message); res.status(500).json({ message: e.message }); }
});
r.put("/net-worth/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: netWorthEntries.id, clientId: netWorthEntries.clientId }).from(netWorthEntries).where(eq(netWorthEntries.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [u] = await db.update(netWorthEntries).set(safe(req.body)).where(eq(netWorthEntries.id, ex.id)).returning();
  res.json(u);
});
r.delete("/net-worth/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: netWorthEntries.id, clientId: netWorthEntries.clientId }).from(netWorthEntries).where(eq(netWorthEntries.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(netWorthEntries).where(eq(netWorthEntries.id, ex.id));
  res.json({ ok: true });
});

// ── Retirement ────────────────────────────────────────────────────────────────
r.get("/clients/:clientId/retirement-projections", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const rows = await db.select().from(retirementProjections).where(eq(retirementProjections.clientId, cid));
  res.json(rows.map(r => ({ ...r,
    currentSavings: r.currentSavings ?? String((Number(r.rrspBalance??0)+Number(r.tfsaBalance??0)+Number(r.nonRegBalance??0))||0),
    annualContribution: r.annualContribution ?? "0",
    expectedReturn: r.expectedReturn ?? "7",
    inflationRate: r.inflationRate ?? "2",
    desiredRetirementIncome: r.desiredRetirementIncome ?? "0",
    projectedBalance: r.projectedBalance ?? "0",
    shortfallSurplus: r.shortfallSurplus ?? "0",
  })));
});
r.post("/clients/:clientId/retirement-projections", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  try {
    const data = safe(req.body.data ?? req.body);
    // Map currentSavings → rrspBalance for storage
    if (data.currentSavings && !data.rrspBalance) data.rrspBalance = data.currentSavings;
    const [row] = await (db.insert(retirementProjections) as any).values({ clientId: cid, currentAge: data.currentAge || 35, retirementAge: data.retirementAge || 65, ...data }).returning();
    res.status(201).json(row);
  } catch(e: any) { console.error("[ret post]", e.message); res.status(500).json({ message: e.message }); }
});
r.delete("/retirement-projections/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: retirementProjections.id, clientId: retirementProjections.clientId }).from(retirementProjections).where(eq(retirementProjections.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(retirementProjections).where(eq(retirementProjections.id, ex.id));
  res.json({ ok: true });
});

// ── Insurance ─────────────────────────────────────────────────────────────────
r.get("/clients/:clientId/insurance-analyses", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(insuranceAnalyses).where(eq(insuranceAnalyses.clientId, cid)));
});
r.post("/clients/:clientId/insurance-analyses", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [row] = await (db.insert(insuranceAnalyses) as any).values({ clientId: cid, ...safe(req.body.data ?? req.body) }).returning();
  res.status(201).json(row);
});
r.post("/clients/:clientId/insurance-worksheet", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  try {
    const formData = req.body.data ?? req.body;
    const [row] = await (db.insert(insuranceAnalyses) as any).values({
      clientId: cid,
      primaryName: formData.primaryName ?? null,
      primaryAge: formData.primaryAge ? parseInt(formData.primaryAge) : null,
      spouseName: formData.spouseName ?? null,
      spouseAge: formData.spouseAge ? parseInt(formData.spouseAge) : null,
      spouseAnnualIncome: formData.spouseAnnualIncome ?? "0",
      annualIncome: formData.primaryAnnualIncome ?? "0",
      worksheetData: formData,
    }).returning();
    res.status(201).json(row);
  } catch (err) {
    console.error("[insurance-worksheet]", err);
    res.status(500).json({ message: "Failed to save" });
  }
});
r.delete("/insurance-analyses/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: insuranceAnalyses.id, clientId: insuranceAnalyses.clientId }).from(insuranceAnalyses).where(eq(insuranceAnalyses.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(insuranceAnalyses).where(eq(insuranceAnalyses.id, ex.id));
  res.json({ ok: true });
});

// ── Education Savings ─────────────────────────────────────────────────────────
r.get("/clients/:clientId/education-savings", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(educationSavings).where(eq(educationSavings.clientId, cid)));
});
r.post("/clients/:clientId/education-savings", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const data = safe(req.body.data ?? req.body);
  const [row] = await (db.insert(educationSavings) as any).values({ clientId: cid, childAge: data.childAge || 0, ...data }).returning();
  res.status(201).json(row);
});
r.put("/education-savings/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: educationSavings.id, clientId: educationSavings.clientId }).from(educationSavings).where(eq(educationSavings.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [u] = await db.update(educationSavings).set(safe(req.body)).where(eq(educationSavings.id, ex.id)).returning();
  res.json(u);
});
r.delete("/education-savings/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: educationSavings.id, clientId: educationSavings.clientId }).from(educationSavings).where(eq(educationSavings.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(educationSavings).where(eq(educationSavings.id, ex.id));
  res.json({ ok: true });
});

// ── Debt Entries ──────────────────────────────────────────────────────────────
r.get("/clients/:clientId/debt-entries", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(debtEntries).where(eq(debtEntries.clientId, cid)));
});
r.post("/clients/:clientId/debt-entries", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [row] = await (db.insert(debtEntries) as any).values({ clientId: cid, ...safe(req.body.data ?? req.body) }).returning();
  res.status(201).json(row);
});
r.put("/debt-entries/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: debtEntries.id, clientId: debtEntries.clientId }).from(debtEntries).where(eq(debtEntries.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [u] = await db.update(debtEntries).set(safe(req.body)).where(eq(debtEntries.id, ex.id)).returning();
  res.json(u);
});
r.delete("/debt-entries/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: debtEntries.id, clientId: debtEntries.clientId }).from(debtEntries).where(eq(debtEntries.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(debtEntries).where(eq(debtEntries.id, ex.id));
  res.json({ ok: true });
});

// ── Tax Planning Notes ────────────────────────────────────────────────────────
r.get("/clients/:clientId/tax-planning-notes", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(taxPlanningNotes).where(eq(taxPlanningNotes.clientId, cid)));
});
r.post("/clients/:clientId/tax-planning-notes", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const data = safe(req.body.data ?? req.body);
  const [row] = await (db.insert(taxPlanningNotes) as any).values({ clientId: cid, title: data.title || "Note", content: data.content || "", taxYear: data.taxYear || new Date().getFullYear(), category: data.category || "general", ...data }).returning();
  res.status(201).json(row);
});
r.put("/tax-planning-notes/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: taxPlanningNotes.id, clientId: taxPlanningNotes.clientId }).from(taxPlanningNotes).where(eq(taxPlanningNotes.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [u] = await db.update(taxPlanningNotes).set(safe(req.body)).where(eq(taxPlanningNotes.id, ex.id)).returning();
  res.json(u);
});
r.delete("/tax-planning-notes/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: taxPlanningNotes.id, clientId: taxPlanningNotes.clientId }).from(taxPlanningNotes).where(eq(taxPlanningNotes.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(taxPlanningNotes).where(eq(taxPlanningNotes.id, ex.id));
  res.json({ ok: true });
});

// ── Estate Planning Notes ─────────────────────────────────────────────────────
r.get("/clients/:clientId/estate-planning-notes", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(estatePlanningNotes).where(eq(estatePlanningNotes.clientId, cid)));
});
r.post("/clients/:clientId/estate-planning-notes", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const data = safe(req.body.data ?? req.body);
  const [row] = await (db.insert(estatePlanningNotes) as any).values({ clientId: cid, title: data.title || "Note", content: data.content || "", category: data.category || "general", ...data }).returning();
  res.status(201).json(row);
});
r.put("/estate-planning-notes/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: estatePlanningNotes.id, clientId: estatePlanningNotes.clientId }).from(estatePlanningNotes).where(eq(estatePlanningNotes.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [u] = await db.update(estatePlanningNotes).set(safe(req.body)).where(eq(estatePlanningNotes.id, ex.id)).returning();
  res.json(u);
});
r.delete("/estate-planning-notes/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: estatePlanningNotes.id, clientId: estatePlanningNotes.clientId }).from(estatePlanningNotes).where(eq(estatePlanningNotes.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(estatePlanningNotes).where(eq(estatePlanningNotes.id, ex.id));
  res.json({ ok: true });
});

// ── AI Recommendations ────────────────────────────────────────────────────────
r.get("/clients/:clientId/ai-recommendations", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(aiRecommendations).where(eq(aiRecommendations.clientId, cid)));
});
r.post("/clients/:clientId/ai-recommendations/generate", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const recs = [
    { clientId: cid, category: "retirement",  priority: "high",   title: "Review Retirement Projections",  content: "Ensure CPP/OAS timing and RRSP/TFSA drawdown strategy are optimized for your province." },
    { clientId: cid, category: "tax",          priority: "medium", title: "Annual RRSP/TFSA Review",        content: "Review contribution room and optimize between RRSP and TFSA based on marginal rates." },
    { clientId: cid, category: "insurance",    priority: "medium", title: "Insurance Needs Analysis",       content: "Conduct annual review of life, disability, and critical illness coverage gaps." },
    { clientId: cid, category: "estate",       priority: "low",    title: "Estate Document Review",         content: "Verify will, POA, and healthcare directive are current and reflect your wishes." },
  ];
  const inserted = await Promise.all(recs.map(rec => (db.insert(aiRecommendations) as any).values(rec).returning().then(([x]: any) => x)));
  res.json(inserted);
});
r.put("/ai-recommendations/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: aiRecommendations.id, clientId: aiRecommendations.clientId }).from(aiRecommendations).where(eq(aiRecommendations.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [u] = await db.update(aiRecommendations).set(safe(req.body)).where(eq(aiRecommendations.id, ex.id)).returning();
  res.json(u);
});
r.delete("/ai-recommendations/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: aiRecommendations.id, clientId: aiRecommendations.clientId }).from(aiRecommendations).where(eq(aiRecommendations.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(aiRecommendations).where(eq(aiRecommendations.id, ex.id));
  res.json({ ok: true });
});

// ── Financial Planning Overview ───────────────────────────────────────────────
r.get("/clients/:clientId/financial-planning-overview", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [nw, ret, ins, edu, debt, tax, estate, ai, fp] = await Promise.all([
    db.select().from(netWorthEntries).where(eq(netWorthEntries.clientId, cid)),
    db.select().from(retirementProjections).where(eq(retirementProjections.clientId, cid)),
    db.select().from(insuranceAnalyses).where(eq(insuranceAnalyses.clientId, cid)),
    db.select().from(educationSavings).where(eq(educationSavings.clientId, cid)),
    db.select().from(debtEntries).where(eq(debtEntries.clientId, cid)),
    db.select().from(taxPlanningNotes).where(eq(taxPlanningNotes.clientId, cid)),
    db.select().from(estatePlanningNotes).where(eq(estatePlanningNotes.clientId, cid)),
    db.select().from(aiRecommendations).where(eq(aiRecommendations.clientId, cid)),
    db.select().from(financialPlans).where(eq(financialPlans.clientId, cid)),
  ]);
  const assets = nw.filter(e => e.type === "asset").reduce((s, e) => s + Number(e.value), 0);
  const liabilities = nw.filter(e => e.type === "liability").reduce((s, e) => s + Number(e.value), 0);
  res.json({
    netWorth: assets - liabilities, totalAssets: assets, totalLiabilities: liabilities,
    totalDebt: debt.reduce((s, d) => s + Number(d.balance), 0),
    goals: fp.length,
    retirementProjections: ret.length, insuranceAnalyses: ins.length,
    educationPlans: edu.length, taxNotes: tax.length, estateNotes: estate.length,
    aiRecommendations: ai.length, pendingRecommendations: ai.filter(a => a.status === "pending").length,
  });
});

// ── Plan Assumptions ──────────────────────────────────────────────────────────
r.get("/plans/:planId/assumptions", async (req: AuthRequest, res: Response) => {
  const p = await ownsPlan(+req.params.planId, req.userId!);
  if (!p) return res.status(404).json({ message: "Not found" });
  const [row] = await db.select().from(planAssumptions).where(and(eq(planAssumptions.planId, +req.params.planId), eq(planAssumptions.scenario, "base")));
  res.json(row ?? null);
});
r.post("/plans/:planId/assumptions", async (req: AuthRequest, res: Response) => {
  const p = await ownsPlan(+req.params.planId, req.userId!);
  if (!p) return res.status(404).json({ message: "Not found" });
  const [ex] = await db.select({ id: planAssumptions.id }).from(planAssumptions).where(and(eq(planAssumptions.planId, +req.params.planId), eq(planAssumptions.scenario, req.body.scenario ?? "base")));
  if (ex) {
    const [u] = await db.update(planAssumptions).set(safe(req.body)).where(eq(planAssumptions.id, ex.id)).returning();
    return res.json(u);
  }
  const [row] = await (db.insert(planAssumptions) as any).values({ planId: +req.params.planId, ...safe(req.body) }).returning();
  res.status(201).json(row);
});
r.post("/plans/:planId/assumptions/seed-defaults", async (req: AuthRequest, res: Response) => {
  const p = await ownsPlan(+req.params.planId, req.userId!);
  if (!p) return res.status(404).json({ message: "Not found" });
  const pid = +req.params.planId;
  const defaults = [
    { planId: pid, scenario: "base",       equityReturn: "0.07", equityVolatility: "0.15", bondReturn: "0.04", bondVolatility: "0.05", inflationMean: "0.02", inflationVolatility: "0.01", corrEquityBond: "-0.15", corrEquityInflation: "0.10", corrBondInflation: "0.30", planToAge: 95, simulationCount: 1000 },
    { planId: pid, scenario: "optimistic", equityReturn: "0.09", equityVolatility: "0.12", bondReturn: "0.05", bondVolatility: "0.04", inflationMean: "0.015", inflationVolatility: "0.008", corrEquityBond: "-0.15", corrEquityInflation: "0.10", corrBondInflation: "0.30", planToAge: 95, simulationCount: 1000 },
    { planId: pid, scenario: "stress",     equityReturn: "0.05", equityVolatility: "0.20", bondReturn: "0.03", bondVolatility: "0.07", inflationMean: "0.03", inflationVolatility: "0.015", corrEquityBond: "-0.15", corrEquityInflation: "0.10", corrBondInflation: "0.30", planToAge: 95, simulationCount: 1000 },
  ];
  for (const d of defaults) {
    const [ex] = await db.select({ id: planAssumptions.id }).from(planAssumptions).where(and(eq(planAssumptions.planId, pid), eq(planAssumptions.scenario, d.scenario)));
    if (!ex) await (db.insert(planAssumptions) as any).values(d);
  }
  const rows = await db.select().from(planAssumptions).where(eq(planAssumptions.planId, pid));
  res.json(rows);
});

// ── Simulation Results ────────────────────────────────────────────────────────
r.get("/plans/:planId/simulation-results", async (req: AuthRequest, res: Response) => {
  const p = await ownsPlan(+req.params.planId, req.userId!);
  if (!p) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(simulationResults).where(eq(simulationResults.planId, +req.params.planId)));
});

r.post("/plans/:planId/run-simulation", async (req: AuthRequest, res: Response) => {
  const p = await ownsPlan(+req.params.planId, req.userId!);
  if (!p) return res.status(404).json({ message: "Not found" });
  try {
    const [client] = await db.select().from(clients).where(eq(clients.id, p.clientId));
    const [projRow] = await db.select().from(retirementProjections).where(eq(retirementProjections.clientId, p.clientId));
    const assumptions = await db.select().from(planAssumptions).where(eq(planAssumptions.planId, +req.params.planId));
    const baseAssum = assumptions.find(a => a.scenario === "base") ?? assumptions[0];

    const { runMonteCarlo } = await import("../routes/simulate.js") as any;
    if (runMonteCarlo) {
      const result = await runMonteCarlo({ client, projection: projRow, assumptions: baseAssum, simulations: baseAssum?.simulationCount ?? 1000 });
      res.json(result);
    } else {
      res.json({ successRate: 0, percentileBands: { p10: [], p25: [], p50: [], p75: [], p90: [], labels: [] }, finalBalancePercentiles: { p10: 0, p25: 0, p50: 0, p75: 0, p90: 0 }, yearsProjected: 30, simulations: 1000 });
    }
  } catch (e: any) {
    console.error("[sim]", e.message);
    res.status(500).json({ message: e.message });
  }
});

// ── Stale Flags ───────────────────────────────────────────────────────────────
r.get("/plans/:planId/stale-flags", async (req: AuthRequest, res: Response) => {
  const p = await ownsPlan(+req.params.planId, req.userId!);
  if (!p) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(planStaleFlags).where(eq(planStaleFlags.planId, +req.params.planId)));
});

// ── Snapshots ─────────────────────────────────────────────────────────────────
r.get("/plans/:planId/snapshots", async (req: AuthRequest, res: Response) => {
  const p = await ownsPlan(+req.params.planId, req.userId!);
  if (!p) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(planSnapshots).where(eq(planSnapshots.planId, +req.params.planId)));
});
r.post("/plans/:planId/snapshots", async (req: AuthRequest, res: Response) => {
  const p = await ownsPlan(+req.params.planId, req.userId!);
  if (!p) return res.status(404).json({ message: "Not found" });
  const [row] = await (db.insert(planSnapshots) as any).values({ planId: +req.params.planId, snapshotData: req.body, trigger: req.body.trigger ?? "manual" }).returning();
  res.status(201).json(row);
});
r.get("/plans/:planId/snapshot-comparison", async (_req, res) => res.json([]));
r.get("/plans/:planId/scenario-comparison",  async (_req, res) => res.json([]));

// ── Action Items ──────────────────────────────────────────────────────────────
r.get("/plans/:planId/action-items", async (req: AuthRequest, res: Response) => {
  const p = await ownsPlan(+req.params.planId, req.userId!);
  if (!p) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(planActionItems).where(eq(planActionItems.planId, +req.params.planId)));
});
r.post("/plans/:planId/action-items", async (req: AuthRequest, res: Response) => {
  const p = await ownsPlan(+req.params.planId, req.userId!);
  if (!p) return res.status(404).json({ message: "Not found" });
  const [row] = await (db.insert(planActionItems) as any).values({ planId: +req.params.planId, ...safe(req.body) }).returning();
  res.status(201).json(row);
});
r.put("/action-items/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select().from(planActionItems).where(eq(planActionItems.id, +req.params.id));
  if (!ex) return res.status(404).json({ message: "Not found" });
  const [u] = await db.update(planActionItems).set(safe(req.body)).where(eq(planActionItems.id, ex.id)).returning();
  res.json(u);
});
r.delete("/action-items/:id", async (req: AuthRequest, res: Response) => {
  await db.delete(planActionItems).where(eq(planActionItems.id, +req.params.id));
  res.json({ ok: true });
});

// ── Tax engine + reports ──────────────────────────────────────────────────────
r.post("/tax/:clientId/projection", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  try {
    const [client] = await db.select().from(clients).where(eq(clients.id, cid));
    const { projectTax } = await import("../engine/tax/projector.js") as any;
    res.json(projectTax({ annualIncome: Number(client.annualIncome ?? 0), spouseIncome: Number(client.spouseAnnualIncome ?? 0), province: client.province ?? "ON", year: new Date().getFullYear(), ...req.body }));
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});
r.post("/tax/:clientId/rrsp-room", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  try {
    const [client] = await db.select().from(clients).where(eq(clients.id, cid));
    const { calculateRrspRoom } = await import("../engine/tax/roomTracker.js") as any;
    res.json(calculateRrspRoom({ annualIncome: Number(client.annualIncome ?? 0), ...req.body }));
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});
r.post("/tax/:clientId/tfsa-room", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  try {
    const { calculateTfsaRoom } = await import("../engine/tax/roomTracker.js") as any;
    res.json(calculateTfsaRoom(req.body));
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});
r.post("/tax/:clientId/capital-gains", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  try {
    const [client] = await db.select().from(clients).where(eq(clients.id, cid));
    const { analyzeCapitalGains } = await import("../engine/tax/capitalGains.js") as any;
    res.json((analyzeCapitalGains as any)(req.body.positions ?? [], Number(client.annualIncome ?? 0), client.province ?? "ON"));
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});
r.post("/tax/:clientId/income-split", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  try {
    const [client] = await db.select().from(clients).where(eq(clients.id, cid));
    const { analyzeIncomeSplitting } = await import("../engine/tax/index.js") as any;
    res.json((analyzeIncomeSplitting as any)({ primaryIncome: Number(client.annualIncome ?? 0), spouseIncome: Number(client.spouseAnnualIncome ?? 0), province: client.province ?? "ON", ...req.body }));
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});
r.get("/reports/:clientId/available", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [ret] = await db.select({ id: retirementProjections.id }).from(retirementProjections).where(eq(retirementProjections.clientId, cid));
  const [ins] = await db.select({ id: insuranceAnalyses.id }).from(insuranceAnalyses).where(eq(insuranceAnalyses.clientId, cid));
  res.json({ retirement: !!ret, insurance: !!ins, netWorth: true });
});
r.get("/clients/:clientId/financial-planning-report", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  try {
    const [plan] = await db.select().from(financialPlans).where(eq(financialPlans.clientId, cid));
    const [client] = await db.select().from(clients).where(eq(clients.id, cid));
    const { generateComprehensiveReport } = await import("../services/reportGenerator.js") as any;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(generateComprehensiveReport({ plan, client } as any));
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

export { r as fpFullRouter };




