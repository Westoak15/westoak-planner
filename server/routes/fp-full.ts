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
import { safe, ownsClient, ownsPlan } from "../fpUtils.js";   // Item 3: shared utils
import { eq, and } from "drizzle-orm";

const r = Router();
r.use(isAuthenticated);

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

// ── Net Worth — REMOVED (Item 1) ──────────────────────────────────────────────
// All net worth CRUD is now canonical in fp.ts:
//   GET/POST  /api/clients/:id/net-worth
//   PUT/DELETE /api/net-worth/:id

// ── Retirement — REMOVED (Item 2) ────────────────────────────────────────────
// /retirement-projections paths were unused by the frontend.
// Canonical retirement CRUD is in fp.ts at /clients/:id/retirement.

// ── Insurance Worksheet (unique to fp-full) ───────────────────────────────────
// insurance-analyses GET / POST / DELETE are handled by fpAliasesRouter (mounted first)
r.post("/clients/:clientId/insurance-worksheet", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  try {
    const formData = req.body.data ?? req.body;
    const [row] = await (db.insert(insuranceAnalyses) as any).values({
      clientId: cid,
      primaryName:        formData.primaryName    ?? null,
      primaryAge:         formData.primaryAge     ? parseInt(formData.primaryAge)  : null,
      spouseName:         formData.spouseName     ?? null,
      spouseAge:          formData.spouseAge      ? parseInt(formData.spouseAge)   : null,
      spouseAnnualIncome: formData.spouseAnnualIncome ?? "0",
      annualIncome:       formData.primaryAnnualIncome ?? "0",
      worksheetData:      formData,
    }).returning();
    res.status(201).json(row);
  } catch (err) {
    console.error("[insurance-worksheet]", err);
    res.status(500).json({ message: "Failed to save" });
  }
});

// education-savings, debt-entries, ai-recommendations GET/POST/PUT/DELETE
// are handled by fpAliasesRouter (mounted first) — removed from here to avoid dead code

// ── Tax Planning Notes ────────────────────────────────────────────────────────
r.get("/clients/:clientId/tax-planning-notes", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(taxPlanningNotes).where(eq(taxPlanningNotes.clientId, cid)));
});
r.post("/clients/:clientId/tax-planning-notes", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const data = safe(req.body.data ?? req.body) as any;
  const [row] = await (db.insert(taxPlanningNotes) as any).values({ clientId: cid, title: data.title || "Note", content: data.content || "", taxYear: data.taxYear || new Date().getFullYear(), category: data.category || "general", ...data }).returning();
  res.status(201).json(row);
});
r.put("/tax-planning-notes/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: taxPlanningNotes.id, clientId: taxPlanningNotes.clientId })
    .from(taxPlanningNotes).where(eq(taxPlanningNotes.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [u] = await db.update(taxPlanningNotes).set(safe(req.body)).where(eq(taxPlanningNotes.id, ex.id)).returning();
  res.json(u);
});
r.delete("/tax-planning-notes/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: taxPlanningNotes.id, clientId: taxPlanningNotes.clientId })
    .from(taxPlanningNotes).where(eq(taxPlanningNotes.id, +req.params.id));
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
  const data = safe(req.body.data ?? req.body) as any;
  const [row] = await (db.insert(estatePlanningNotes) as any).values({ clientId: cid, title: data.title || "Note", content: data.content || "", category: data.category || "general", ...data }).returning();
  res.status(201).json(row);
});
r.put("/estate-planning-notes/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: estatePlanningNotes.id, clientId: estatePlanningNotes.clientId })
    .from(estatePlanningNotes).where(eq(estatePlanningNotes.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [u] = await db.update(estatePlanningNotes).set(safe(req.body)).where(eq(estatePlanningNotes.id, ex.id)).returning();
  res.json(u);
});
r.delete("/estate-planning-notes/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: estatePlanningNotes.id, clientId: estatePlanningNotes.clientId })
    .from(estatePlanningNotes).where(eq(estatePlanningNotes.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(estatePlanningNotes).where(eq(estatePlanningNotes.id, ex.id));
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
  const assets      = nw.filter(e => e.type === "asset").reduce((s, e) => s + Number(e.value), 0);
  const liabilities = nw.filter(e => e.type === "liability").reduce((s, e) => s + Number(e.value), 0);
  res.json({
    netWorth: assets - liabilities, totalAssets: assets, totalLiabilities: liabilities,
    totalDebt: debt.reduce((s, d) => s + Number(d.balance), 0),
    goals: fp.length,
    retirementProjections: ret.length, insuranceAnalyses: ins.length,
    educationPlans: edu.length, taxNotes: tax.length, estateNotes: estate.length,
    aiRecommendations: ai.length,
    pendingRecommendations: ai.filter((a: any) => a.status === "pending").length,
  });
});

// ── Plan Assumptions ──────────────────────────────────────────────────────────
r.get("/plans/:planId/assumptions", async (req: AuthRequest, res: Response) => {
  const p = await ownsPlan(+req.params.planId, req.userId!);
  if (!p) return res.status(404).json({ message: "Not found" });
  const pid = +req.params.planId;
  const defaults = [
    { planId: pid, scenario: "base",      equityReturn: "0.07", equityVolatility: "0.15", bondReturn: "0.04", bondVolatility: "0.05", inflationMean: "0.02", inflationVolatility: "0.01", corrEquityBond: "-0.15", corrEquityInflation: "0.10", corrBondInflation: "0.30", planToAge: 95, simulationCount: 1000 },
    { planId: pid, scenario: "optimistic",equityReturn: "0.09", equityVolatility: "0.12", bondReturn: "0.05", bondVolatility: "0.04", inflationMean: "0.015",inflationVolatility: "0.008",corrEquityBond: "-0.15", corrEquityInflation: "0.10", corrBondInflation: "0.30", planToAge: 95, simulationCount: 1000 },
    { planId: pid, scenario: "stress",    equityReturn: "0.05", equityVolatility: "0.20", bondReturn: "0.03", bondVolatility: "0.07", inflationMean: "0.03", inflationVolatility: "0.015",corrEquityBond: "-0.15", corrEquityInflation: "0.10", corrBondInflation: "0.30", planToAge: 95, simulationCount: 1000 },
  ];
  for (const d of defaults) {
    const [ex] = await db.select({ id: planAssumptions.id }).from(planAssumptions)
      .where(and(eq(planAssumptions.planId, pid), eq(planAssumptions.scenario, d.scenario)));
    if (!ex) await (db.insert(planAssumptions) as any).values(d);
  }
  res.json(await db.select().from(planAssumptions).where(eq(planAssumptions.planId, pid)));
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
    const [projRow] = await db.select().from(retirementProjections)
      .where(eq(retirementProjections.clientId, p.clientId));
    if (!projRow) return res.status(404).json({ message: "No retirement projection found for this client" });

    const assumptions = await db.select().from(planAssumptions).where(eq(planAssumptions.planId, +req.params.planId));
    const baseAssum = assumptions.find(a => a.scenario === "base") ?? assumptions[0];

    const { runMonteCarloSimulation, PRESET_ALLOCATIONS } = await import("../engine/simulation/monteCarlo.js") as any;
    const params = {
      initialBalance:     Number(projRow.rrspBalance ?? 0) + Number(projRow.tfsaBalance ?? 0) + Number(projRow.nonRegBalance ?? 0),
      allocation:         PRESET_ALLOCATIONS["MODERATE"],
      annualContribution: Number(projRow.annualContribution ?? 0),
      yearsToSimulate:    Math.max(1, (projRow.lifeExpectancy ?? 90) - (projRow.currentAge ?? 35)),
      numberOfPaths:      baseAssum?.simulationCount ?? 1000,
      inflationRate:      Number(projRow.inflationRate ?? 2) / 100,
    };
    res.json(runMonteCarloSimulation(params));
  } catch (e: any) {
    console.error("[run-simulation]", e.message);
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
  const [ex] = await db.select({ id: planActionItems.id, planId: planActionItems.planId })
    .from(planActionItems).where(eq(planActionItems.id, +req.params.id));
  if (!ex) return res.status(404).json({ message: "Not found" });
  if (!await ownsPlan(ex.planId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(planActionItems).where(eq(planActionItems.id, ex.id));
  res.json({ ok: true });
});

// ── Reports ───────────────────────────────────────────────────────────────────
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
    const [plan]   = await db.select().from(financialPlans).where(eq(financialPlans.clientId, cid));
    const [client] = await db.select().from(clients).where(eq(clients.id, cid));
    const { generateComprehensiveReport } = await import("../services/reportGenerator.js") as any;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(generateComprehensiveReport({ plan, client } as any));
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

export { r as fpFullRouter };
