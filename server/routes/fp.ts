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

// ── Ownership checks ──────────────────────────────────────────────────────────
async function ownsClient(clientId: number, userId: number) {
  const [c] = await db.select({ id: clients.id }).from(clients).where(and(eq(clients.id, clientId), eq(clients.userId, userId)));
  return !!c;
}
async function ownsPlan(planId: number, userId: number) {
  const [p] = await db.select({ id: plans.id }).from(plans).where(and(eq(plans.id, planId), eq(plans.userId, userId)));
  return !!p;
}

// ── Overview ──────────────────────────────────────────────────────────────────
r.get("/clients/:id/overview", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
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
  const totalDebt = debt.reduce((s, d) => s + Number(d.balance), 0);

  res.json({
    netWorth: assets - liabilities,
    totalAssets: assets,
    totalLiabilities: liabilities,
    totalDebt,
    retirementProjections: ret.length,
    insuranceAnalyses: ins.length,
    educationPlans: edu.length,
    taxNotes: tax.length,
    estateNotes: estate.length,
    aiRecommendations: ai.length,
    pendingAi: ai.filter(a => a.status === "pending").length,
    plans: clientPlans.length,
  });
});

// ── Net Worth (multiple entries) ──────────────────────────────────────────────
r.get("/clients/:id/net-worth", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const rows = await db.select().from(netWorthEntries).where(eq(netWorthEntries.clientId, cid)).orderBy(netWorthEntries.type, netWorthEntries.category);
  res.json(rows);
});

r.post("/clients/:id/net-worth", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [row] = await db.insert(netWorthEntries).values({ clientId: cid, ...req.body }).returning();
  res.status(201).json(row);
});

r.patch("/net-worth/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: netWorthEntries.id, clientId: netWorthEntries.clientId }).from(netWorthEntries).where(eq(netWorthEntries.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [u] = await db.update(netWorthEntries).set({ ...req.body, updatedAt: new Date() }).where(eq(netWorthEntries.id, ex.id)).returning();
  res.json(u);
});

r.delete("/net-worth/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: netWorthEntries.id, clientId: netWorthEntries.clientId }).from(netWorthEntries).where(eq(netWorthEntries.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(netWorthEntries).where(eq(netWorthEntries.id, ex.id));
  res.json({ ok: true });
});

// ── Retirement (multiple projections) ────────────────────────────────────────
r.get("/clients/:id/retirement", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(retirementProjections).where(eq(retirementProjections.clientId, cid)).orderBy(desc(retirementProjections.updatedAt)));
});

r.post("/clients/:id/retirement", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [row] = await db.insert(retirementProjections).values({ clientId: cid, ...req.body }).returning();
  res.status(201).json(row);
});

r.patch("/retirement/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: retirementProjections.id, clientId: retirementProjections.clientId }).from(retirementProjections).where(eq(retirementProjections.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [u] = await db.update(retirementProjections).set({ ...req.body, updatedAt: new Date() }).where(eq(retirementProjections.id, ex.id)).returning();
  res.json(u);
});

r.delete("/retirement/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: retirementProjections.id, clientId: retirementProjections.clientId }).from(retirementProjections).where(eq(retirementProjections.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(retirementProjections).where(eq(retirementProjections.id, ex.id));
  res.json({ ok: true });
});

// ── Insurance (multiple worksheets) ──────────────────────────────────────────
r.get("/clients/:id/insurance", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(insuranceAnalyses).where(eq(insuranceAnalyses.clientId, cid)).orderBy(desc(insuranceAnalyses.updatedAt)));
});

r.post("/clients/:id/insurance", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [row] = await db.insert(insuranceAnalyses).values({ clientId: cid, ...req.body }).returning();
  res.status(201).json(row);
});

r.patch("/insurance/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: insuranceAnalyses.id, clientId: insuranceAnalyses.clientId }).from(insuranceAnalyses).where(eq(insuranceAnalyses.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [u] = await db.update(insuranceAnalyses).set({ ...req.body, updatedAt: new Date() }).where(eq(insuranceAnalyses.id, ex.id)).returning();
  res.json(u);
});

r.delete("/insurance/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: insuranceAnalyses.id, clientId: insuranceAnalyses.clientId }).from(insuranceAnalyses).where(eq(insuranceAnalyses.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(insuranceAnalyses).where(eq(insuranceAnalyses.id, ex.id));
  res.json({ ok: true });
});

// ── Education / RESP (one per child) ─────────────────────────────────────────
r.get("/clients/:id/education", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(educationPlans).where(eq(educationPlans.clientId, cid)).orderBy(desc(educationPlans.updatedAt)));
});

r.post("/clients/:id/education", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [row] = await db.insert(educationPlans).values({ clientId: cid, ...req.body }).returning();
  res.status(201).json(row);
});

r.patch("/education/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: educationPlans.id, clientId: educationPlans.clientId }).from(educationPlans).where(eq(educationPlans.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [u] = await db.update(educationPlans).set({ ...req.body, updatedAt: new Date() }).where(eq(educationPlans.id, ex.id)).returning();
  res.json(u);
});

r.delete("/education/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: educationPlans.id, clientId: educationPlans.clientId }).from(educationPlans).where(eq(educationPlans.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(educationPlans).where(eq(educationPlans.id, ex.id));
  res.json({ ok: true });
});

// ── Debt (multiple entries) ───────────────────────────────────────────────────
r.get("/clients/:id/debt", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(debtEntries).where(eq(debtEntries.clientId, cid)).orderBy(desc(debtEntries.updatedAt)));
});

r.post("/clients/:id/debt", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [row] = await db.insert(debtEntries).values({ clientId: cid, ...req.body }).returning();
  res.status(201).json(row);
});

r.patch("/debt/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: debtEntries.id, clientId: debtEntries.clientId }).from(debtEntries).where(eq(debtEntries.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [u] = await db.update(debtEntries).set({ ...req.body, updatedAt: new Date() }).where(eq(debtEntries.id, ex.id)).returning();
  res.json(u);
});

r.delete("/debt/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: debtEntries.id, clientId: debtEntries.clientId }).from(debtEntries).where(eq(debtEntries.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(debtEntries).where(eq(debtEntries.id, ex.id));
  res.json({ ok: true });
});

// ── Tax Notes ─────────────────────────────────────────────────────────────────
r.get("/clients/:id/tax", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(taxNotes).where(eq(taxNotes.clientId, cid)).orderBy(desc(taxNotes.updatedAt)));
});

r.post("/clients/:id/tax", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [row] = await db.insert(taxNotes).values({ clientId: cid, ...req.body }).returning();
  res.status(201).json(row);
});

r.patch("/tax/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: taxNotes.id, clientId: taxNotes.clientId }).from(taxNotes).where(eq(taxNotes.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [u] = await db.update(taxNotes).set({ ...req.body, updatedAt: new Date() }).where(eq(taxNotes.id, ex.id)).returning();
  res.json(u);
});

r.delete("/tax/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: taxNotes.id, clientId: taxNotes.clientId }).from(taxNotes).where(eq(taxNotes.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(taxNotes).where(eq(taxNotes.id, ex.id));
  res.json({ ok: true });
});

// ── Estate Notes ──────────────────────────────────────────────────────────────
r.get("/clients/:id/estate", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [row] = await db.select().from(estateNotes).where(eq(estateNotes.clientId, cid)).limit(1);
  res.json(row ?? null);
});

r.put("/clients/:id/estate", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [ex] = await db.select({ id: estateNotes.id }).from(estateNotes).where(eq(estateNotes.clientId, cid)).limit(1);
  if (ex) {
    const [u] = await db.update(estateNotes).set({ ...req.body, updatedAt: new Date() }).where(eq(estateNotes.id, ex.id)).returning();
    return res.json(u);
  }
  const [row] = await db.insert(estateNotes).values({ clientId: cid, ...req.body }).returning();
  res.status(201).json(row);
});

// ── AI Recommendations ────────────────────────────────────────────────────────
r.get("/clients/:id/ai", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(aiRecommendations).where(eq(aiRecommendations.clientId, cid)).orderBy(desc(aiRecommendations.createdAt)));
});

r.post("/clients/:id/ai/generate", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [client] = await db.select().from(clients).where(eq(clients.id, cid));
  const [nw, debt] = await Promise.all([
    db.select().from(netWorthEntries).where(eq(netWorthEntries.clientId, cid)),
    db.select().from(debtEntries).where(eq(debtEntries.clientId, cid)),
  ]);
  const recs = [];
  const assets = nw.filter(e => e.type === "asset").reduce((s, e) => s + Number(e.value), 0);
  const totalDebt = debt.reduce((s, d) => s + Number(d.balance), 0);

  if (!client.retirementAge) recs.push({ clientId: cid, category: "retirement", priority: "high", title: "Set Retirement Target Age", description: "Define a target retirement age to enable accurate projections and CPP/OAS timing optimization." });
  if (assets < 50000) recs.push({ clientId: cid, category: "savings", priority: "high", title: "Build Emergency Fund", description: "Recommend building 3-6 months of expenses in liquid savings before aggressive investing." });
  if (totalDebt > 50000) recs.push({ clientId: cid, category: "debt", priority: "high", title: "Debt Reduction Strategy", description: `Total debt of $${totalDebt.toLocaleString()} is significant. Review avalanche vs snowball strategy.` });
  recs.push({ clientId: cid, category: "tax", priority: "medium", title: "Annual RRSP/TFSA Review", description: "Review contribution room and optimize between RRSP and TFSA based on current and expected future marginal tax rates." });
  recs.push({ clientId: cid, category: "insurance", priority: "medium", title: "Insurance Needs Review", description: "Conduct annual review of life, disability, and critical illness coverage gaps." });

  const inserted = await Promise.all(recs.map(rec => db.insert(aiRecommendations).values(rec).returning().then(([x]) => x)));
  res.json(inserted);
});

r.patch("/ai/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: aiRecommendations.id, clientId: aiRecommendations.clientId }).from(aiRecommendations).where(eq(aiRecommendations.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [u] = await db.update(aiRecommendations).set({ ...req.body, updatedAt: new Date() }).where(eq(aiRecommendations.id, ex.id)).returning();
  res.json(u);
});

r.delete("/ai/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: aiRecommendations.id, clientId: aiRecommendations.clientId }).from(aiRecommendations).where(eq(aiRecommendations.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(aiRecommendations).where(eq(aiRecommendations.id, ex.id));
  res.json({ ok: true });
});

export { r as fpRouter };
