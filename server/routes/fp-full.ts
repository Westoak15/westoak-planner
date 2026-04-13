/**
 * fp-full.ts — All endpoints required by BrokersEdge FinancialPlanning module
 * Mirrors the exact API surface that use-plans.ts calls.
 */
import { Router, Response } from "express";
import { db } from "../db/index.js";
import {
  clients, plans, netWorthEntries, retirementProjections,
  insuranceAnalyses, educationPlans, debtEntries,
  taxNotes, estateNotes, aiRecommendations,
} from "../../shared/schema.js";
import { isAuthenticated, type AuthRequest } from "../auth/index.js";
import { eq, and, desc } from "drizzle-orm";

const r = Router();
r.use(isAuthenticated);

function safe(body: any) {
  const { id, createdAt, updatedAt, userId, ...rest } = body;
  return rest;
}

async function ownsClient(cid: number, uid: number) {
  const [c] = await db.select({ id: clients.id }).from(clients).where(and(eq(clients.id, cid), eq(clients.userId, uid)));
  return !!c;
}
async function ownsPlan(pid: number, uid: number) {
  const [p] = await db.select({ id: plans.id, clientId: plans.clientId }).from(plans).where(and(eq(plans.id, pid), eq(plans.userId, uid)));
  return p ?? null;
}

// ── Plans ─────────────────────────────────────────────────────────────────────
r.get("/clients/:clientId/plans", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(plans).where(eq(plans.clientId, cid)).orderBy(desc(plans.createdAt)));
});

r.post("/clients/:clientId/plans", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [p] = await db.insert(plans).values({ clientId: cid, userId: req.userId!, ...safe(req.body) }).returning();
  res.status(201).json(p);
});

r.get("/plans/:id", async (req: AuthRequest, res: Response) => {
  const p = await ownsPlan(+req.params.id, req.userId!);
  if (!p) return res.status(404).json({ message: "Not found" });
  const [plan] = await db.select().from(plans).where(eq(plans.id, +req.params.id));
  res.json(plan);
});

r.put("/plans/:id", async (req: AuthRequest, res: Response) => {
  if (!await ownsPlan(+req.params.id, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [u] = await db.update(plans).set(safe(req.body)).where(eq(plans.id, +req.params.id)).returning();
  res.json(u);
});

r.delete("/plans/:id", async (req: AuthRequest, res: Response) => {
  if (!await ownsPlan(+req.params.id, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(plans).where(eq(plans.id, +req.params.id));
  res.json({ ok: true });
});

// ── Net Worth ─────────────────────────────────────────────────────────────────
r.get("/clients/:clientId/net-worth", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(netWorthEntries).where(eq(netWorthEntries.clientId, cid)).orderBy(netWorthEntries.type, netWorthEntries.category));
});
r.post("/clients/:clientId/net-worth", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const { data } = req.body;
  const [row] = await db.insert(netWorthEntries).values({ clientId: cid, ...safe(data ?? req.body) }).returning();
  res.status(201).json(row);
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

// ── Retirement Projections ────────────────────────────────────────────────────
r.get("/clients/:clientId/retirement-projections", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(retirementProjections).where(eq(retirementProjections.clientId, cid)).orderBy(desc(retirementProjections.createdAt)));
});
r.post("/clients/:clientId/retirement-projections", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const { data } = req.body;
  const [row] = await db.insert(retirementProjections).values({ clientId: cid, ...safe(data ?? req.body) }).returning();
  res.status(201).json(row);
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
  res.json(await db.select().from(insuranceAnalyses).where(eq(insuranceAnalyses.clientId, cid)).orderBy(desc(insuranceAnalyses.createdAt)));
});
r.post("/clients/:clientId/insurance-analyses", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const { data } = req.body;
  const [row] = await db.insert(insuranceAnalyses).values({ clientId: cid, ...safe(data ?? req.body) }).returning();
  res.status(201).json(row);
});
r.post("/clients/:clientId/insurance-worksheet", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  try {
    // @ts-ignore
    const { analyzeInsurance } = await import("../engine/insurance/index.js");
    const { data, calc } = req.body;
    const result = analyzeInsurance ? analyzeInsurance({ ...calc }) : null;
    const [row] = await db.insert(insuranceAnalyses).values({ clientId: cid, ...safe(data ?? req.body), worksheetData: result }).returning();
    res.status(201).json(row);
  } catch {
    const { data } = req.body;
    const [row] = await db.insert(insuranceAnalyses).values({ clientId: cid, ...safe(data ?? req.body) }).returning();
    res.status(201).json(row);
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
  res.json(await db.select().from(educationPlans).where(eq(educationPlans.clientId, cid)).orderBy(desc(educationPlans.createdAt)));
});
r.post("/clients/:clientId/education-savings", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const { data } = req.body;
  const [row] = await db.insert(educationPlans).values({ clientId: cid, ...safe(data ?? req.body) }).returning();
  res.status(201).json(row);
});
r.put("/education-savings/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: educationPlans.id, clientId: educationPlans.clientId }).from(educationPlans).where(eq(educationPlans.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [u] = await db.update(educationPlans).set(safe(req.body)).where(eq(educationPlans.id, ex.id)).returning();
  res.json(u);
});
r.delete("/education-savings/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: educationPlans.id, clientId: educationPlans.clientId }).from(educationPlans).where(eq(educationPlans.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(educationPlans).where(eq(educationPlans.id, ex.id));
  res.json({ ok: true });
});

// ── Debt Entries ──────────────────────────────────────────────────────────────
r.get("/clients/:clientId/debt-entries", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(debtEntries).where(eq(debtEntries.clientId, cid)).orderBy(desc(debtEntries.createdAt)));
});
r.post("/clients/:clientId/debt-entries", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const { data } = req.body;
  const [row] = await db.insert(debtEntries).values({ clientId: cid, ...safe(data ?? req.body) }).returning();
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
  res.json(await db.select().from(taxNotes).where(eq(taxNotes.clientId, cid)).orderBy(desc(taxNotes.createdAt)));
});
r.post("/clients/:clientId/tax-planning-notes", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const { data } = req.body;
  const [row] = await db.insert(taxNotes).values({ clientId: cid, ...safe(data ?? req.body) }).returning();
  res.status(201).json(row);
});
r.put("/tax-planning-notes/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: taxNotes.id, clientId: taxNotes.clientId }).from(taxNotes).where(eq(taxNotes.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [u] = await db.update(taxNotes).set(safe(req.body)).where(eq(taxNotes.id, ex.id)).returning();
  res.json(u);
});
r.delete("/tax-planning-notes/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: taxNotes.id, clientId: taxNotes.clientId }).from(taxNotes).where(eq(taxNotes.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(taxNotes).where(eq(taxNotes.id, ex.id));
  res.json({ ok: true });
});

// ── Estate Planning Notes ─────────────────────────────────────────────────────
r.get("/clients/:clientId/estate-planning-notes", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(estateNotes).where(eq(estateNotes.clientId, cid)).orderBy(desc(estateNotes.createdAt)));
});
r.post("/clients/:clientId/estate-planning-notes", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const { data } = req.body;
  const [row] = await db.insert(estateNotes).values({ clientId: cid, ...safe(data ?? req.body) }).returning();
  res.status(201).json(row);
});
r.put("/estate-planning-notes/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: estateNotes.id, clientId: estateNotes.clientId }).from(estateNotes).where(eq(estateNotes.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [u] = await db.update(estateNotes).set(safe(req.body)).where(eq(estateNotes.id, ex.id)).returning();
  res.json(u);
});
r.delete("/estate-planning-notes/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: estateNotes.id, clientId: estateNotes.clientId }).from(estateNotes).where(eq(estateNotes.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(estateNotes).where(eq(estateNotes.id, ex.id));
  res.json({ ok: true });
});

// ── AI Recommendations ────────────────────────────────────────────────────────
r.get("/clients/:clientId/ai-recommendations", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(aiRecommendations).where(eq(aiRecommendations.clientId, cid)).orderBy(desc(aiRecommendations.createdAt)));
});
r.post("/clients/:clientId/ai-recommendations/generate", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [client] = await db.select().from(clients).where(eq(clients.id, cid));
  const recs = [
    { clientId: cid, category: "retirement",  priority: "high",   title: "Review Retirement Projections",  description: "Ensure CPP/OAS timing and RRSP/TFSA drawdown strategy are optimized." },
    { clientId: cid, category: "tax",          priority: "medium", title: "Annual RRSP/TFSA Review",        description: "Review contribution room and optimize between RRSP and TFSA based on marginal rates." },
    { clientId: cid, category: "insurance",    priority: "medium", title: "Insurance Needs Analysis",       description: "Conduct annual review of life, disability, and critical illness coverage gaps." },
    { clientId: cid, category: "estate",       priority: "low",    title: "Estate Document Review",         description: "Verify will, POA, and healthcare directive are current." },
  ];
  const inserted = await Promise.all(recs.map(rec => db.insert(aiRecommendations).values(rec).returning().then(([x]) => x)));
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
  const [nw, ret, ins, edu, debt, tax, estate, ai, clientPlans] = await Promise.all([
    db.select().from(netWorthEntries).where(eq(netWorthEntries.clientId, cid)),
    db.select().from(retirementProjections).where(eq(retirementProjections.clientId, cid)),
    db.select().from(insuranceAnalyses).where(eq(insuranceAnalyses.clientId, cid)),
    db.select().from(educationPlans).where(eq(educationPlans.clientId, cid)),
    db.select().from(debtEntries).where(eq(debtEntries.clientId, cid)),
    db.select().from(taxNotes).where(eq(taxNotes.clientId, cid)),
    db.select().from(estateNotes).where(eq(estateNotes.clientId, cid)),
    db.select().from(aiRecommendations).where(eq(aiRecommendations.clientId, cid)),
    db.select().from(plans).where(eq(plans.clientId, cid)),
  ]);
  const assets = nw.filter(e => e.type === "asset").reduce((s, e) => s + Number(e.value), 0);
  const liabilities = nw.filter(e => e.type === "liability").reduce((s, e) => s + Number(e.value), 0);
  res.json({
    netWorth: assets - liabilities, totalAssets: assets, totalLiabilities: liabilities,
    totalDebt: debt.reduce((s, d) => s + Number(d.balance), 0),
    goals: clientPlans.length,
    retirementProjections: ret.length, insuranceAnalyses: ins.length,
    educationPlans: edu.length, taxNotes: tax.length, estateNotes: estate.length,
    aiRecommendations: ai.length, pendingRecommendations: ai.filter(a => a.status === "pending").length,
  });
});

r.get("/clients/:clientId/financial-planning-report", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  try {
    const [plan] = await db.select().from(plans).where(eq(plans.clientId, cid)).limit(1);
    const [client] = await db.select().from(clients).where(eq(clients.id, cid));
    // @ts-ignore
    const { generateComprehensiveReport } = await import("../services/reportGenerator.js");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(generateComprehensiveReport({ plan, client } as any));
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// ── Reports available ─────────────────────────────────────────────────────────
r.get("/reports/:clientId/available", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [ret] = await db.select({ id: retirementProjections.id }).from(retirementProjections).where(eq(retirementProjections.clientId, cid)).limit(1);
  const [ins] = await db.select({ id: insuranceAnalyses.id }).from(insuranceAnalyses).where(eq(insuranceAnalyses.clientId, cid)).limit(1);
  res.json({ retirement: !!ret, insurance: !!ins, netWorth: true });
});

// ── Tax engine endpoints ──────────────────────────────────────────────────────
r.post("/tax/:clientId/projection", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  try {
    const [client] = await db.select().from(clients).where(eq(clients.id, cid));
    // @ts-ignore
    const { projectTax } = await import("../engine/tax/projector.js");
    const result = projectTax({ annualIncome: Number(client.annualIncome ?? 0), spouseIncome: Number(client.spouseAnnualIncome ?? 0), province: client.province ?? "ON", year: new Date().getFullYear(), ...req.body });
    res.json(result);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

r.post("/tax/:clientId/rrsp-room", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  try {
    const [client] = await db.select().from(clients).where(eq(clients.id, cid));
    // @ts-ignore
    const { calculateRrspRoom } = await import("../engine/tax/roomTracker.js");
    const result = calculateRrspRoom({ annualIncome: Number(client.annualIncome ?? 0), ...req.body });
    res.json(result);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

r.post("/tax/:clientId/tfsa-room", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  try {
    // @ts-ignore
    const { calculateTfsaRoom } = await import("../engine/tax/roomTracker.js");
    const result = calculateTfsaRoom({ ...req.body });
    res.json(result);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

r.post("/tax/:clientId/capital-gains", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  try {
    const [client] = await db.select().from(clients).where(eq(clients.id, cid));
    // @ts-ignore
    const { analyzeCapitalGains } = await import("../engine/tax/capitalGains.js");
    const result = analyzeCapitalGains(req.body.positions ?? [], Number(client.annualIncome ?? 0), client.province ?? "ON");
    res.json(result);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

r.post("/tax/:clientId/income-split", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  try {
    const [client] = await db.select().from(clients).where(eq(clients.id, cid));
    // @ts-ignore
    const { analyzeIncomeSplitting } = await import("../engine/tax/index.js");
    const result = (analyzeIncomeSplitting as any)({ primaryIncome: Number(client.annualIncome ?? 0), spouseIncome: Number(client.spouseAnnualIncome ?? 0), province: client.province ?? "ON", ...req.body });
    res.json(result);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// ── Plan simulation ───────────────────────────────────────────────────────────
r.post("/plans/:planId/run-simulation", async (req: AuthRequest, res: Response) => {
  const p = await ownsPlan(+req.params.planId, req.userId!);
  if (!p) return res.status(404).json({ message: "Not found" });
  try {
    const [client] = await db.select().from(clients).where(eq(clients.id, p.clientId));
    // @ts-ignore
    const mcEngine = await import("../engine/monteCarlo.js") as any;
    const runMC = mcEngine.runMonteCarlo ?? mcEngine.default?.runMonteCarlo;
    const result = runMC ? runMC({ client, simulations: 1000, ...req.body }) : { successRate: 0, percentileBands: {}, finalBalancePercentiles: {}, yearsProjected: 30 };
    res.json(result);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// ── Plan stubs (stale flags, assumptions, snapshots, scenario comparison) ─────
r.get("/plans/:planId/stale-flags",       async (_req, res) => res.json([]));
r.get("/plans/:planId/simulation-results", async (_req, res) => res.json([]));
r.get("/plans/:planId/scenario-comparison", async (_req, res) => res.json([]));
r.get("/plans/:planId/assumptions",        async (_req, res) => res.json(null));
r.post("/plans/:planId/assumptions",       async (_req, res) => res.json({}));
r.post("/plans/:planId/assumptions/seed-defaults", async (_req, res) => res.json({}));
r.get("/plans/:planId/action-items",       async (_req, res) => res.json([]));
r.post("/plans/:planId/action-items",      async (_req, res) => res.status(201).json({}));
r.put("/action-items/:id",                 async (_req, res) => res.json({}));
r.delete("/action-items/:id",              async (_req, res) => res.json({ ok: true }));
r.get("/plans/:planId/snapshots",          async (_req, res) => res.json([]));
r.post("/plans/:planId/snapshots",         async (_req, res) => res.status(201).json({}));
r.get("/plans/:planId/snapshot-comparison", async (_req, res) => res.json([]));

export { r as fpFullRouter };
