import { Router, Response } from "express";
import { db } from "../db/index.js";
import {
  clients, financialPlans as plans, netWorthEntries, retirementProjections,
  insuranceAnalyses, educationSavings as educationPlans, debtEntries, clientPolicies, householdExpenses,
  taxPlanningNotes as taxNotes, estatePlanningNotes as estateNotes, aiRecommendations,
} from "../../shared/schema.js";
import { isAuthenticated, type AuthRequest } from "../auth/index.js";
import { safe, ownsClient } from "../fpUtils.js";   // Item 3: shared utils
import { eq, and } from "drizzle-orm";

const r = Router();
r.use(isAuthenticated);

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

  const assets      = nw.filter(e => e.type === "asset").reduce((s, e) => s + Number(e.value), 0);
  const liabilities = nw.filter(e => e.type === "liability").reduce((s, e) => s + Number(e.value), 0);
  const totalDebt   = debt.reduce((s, d) => s + Number(d.balance), 0);

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

// ── Net Worth ─────────────────────────────────────────────────────────────────
// Canonical net worth CRUD — fp-full.ts net worth handlers removed (Items 1 & 2).
// Frontend uses: GET, POST /clients/:id/net-worth  |  PUT, DELETE /net-worth/:id

r.get("/clients/:id/net-worth", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(netWorthEntries).where(eq(netWorthEntries.clientId, cid)));
});

r.post("/clients/:id/net-worth", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  try {
    // Accept either wrapped { data: {...} } or flat body (Item 1: match fp-full.ts contract)
    const payload = req.body.data ?? req.body;
    const { type, category, name, value, owner, notes, metadata } = payload;
    const [row] = await db.insert(netWorthEntries)
      .values({ clientId: cid, type, category, name, value, owner, notes, metadata } as any)
      .returning();
    res.status(201).json(row);
  } catch (e: any) {
    console.error("[net-worth/post]", e.message, JSON.stringify(req.body));
    res.status(500).json({ message: e.message });
  }
});

// PUT — used by frontend for updates (was only in fp-full.ts before consolidation)
r.put("/net-worth/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: netWorthEntries.id, clientId: netWorthEntries.clientId })
    .from(netWorthEntries).where(eq(netWorthEntries.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [u] = await db.update(netWorthEntries).set(safe(req.body)).where(eq(netWorthEntries.id, ex.id)).returning();
  res.json(u);
});

r.delete("/net-worth/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: netWorthEntries.id, clientId: netWorthEntries.clientId })
    .from(netWorthEntries).where(eq(netWorthEntries.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(netWorthEntries).where(eq(netWorthEntries.id, ex.id));
  res.json({ ok: true });
});

// ── Retirement ────────────────────────────────────────────────────────────────
// Canonical retirement CRUD — fp-full.ts /retirement-projections removed (Item 2).
// GET response normalised to add currentSavings alias and field defaults.
// POST handles both flat and wrapped body, maps currentSavings → rrspBalance.

r.get("/clients/:id/retirement", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const rows = await db.select().from(retirementProjections).where(eq(retirementProjections.clientId, cid));
  res.json(rows.map(row => ({
    ...row,
    // currentSavings alias — sum of account balances if not stored directly
    currentSavings: row.currentSavings ?? String(
      (Number(row.rrspBalance ?? 0) + Number(row.tfsaBalance ?? 0) + Number(row.nonRegBalance ?? 0)) || 0
    ),
    annualContribution:      row.annualContribution      ?? "0",
    expectedReturn:          row.expectedReturn          ?? "7",
    inflationRate:           row.inflationRate           ?? "2",
    desiredRetirementIncome: row.desiredRetirementIncome ?? "0",
    projectedBalance:        row.projectedBalance        ?? "0",
    shortfallSurplus:        row.shortfallSurplus        ?? "0",
  })));
});

r.post("/clients/:id/retirement", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  try {
    const data = safe(req.body.data ?? req.body);
    // Map currentSavings → rrspBalance if client sent the alias
    if (data.currentSavings && !data.rrspBalance) data.rrspBalance = data.currentSavings;
    const [row] = await (db.insert(retirementProjections) as any).values({
      clientId: cid,
      currentAge:    data.currentAge    || 35,
      retirementAge: data.retirementAge || 65,
      ...data,
    }).returning();
    res.status(201).json(row);
  } catch (err: any) {
    console.error("[retirement POST ERROR]", err.message);
    res.status(500).json({ message: err.message });
  }
});

r.patch("/retirement/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: retirementProjections.id, clientId: retirementProjections.clientId })
    .from(retirementProjections).where(eq(retirementProjections.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [u] = await db.update(retirementProjections).set(safe(req.body)).where(eq(retirementProjections.id, ex.id)).returning();
  res.json(u);
});

r.delete("/retirement/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: retirementProjections.id, clientId: retirementProjections.clientId })
    .from(retirementProjections).where(eq(retirementProjections.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(retirementProjections).where(eq(retirementProjections.id, ex.id));
  res.json({ ok: true });
});

// ── Insurance ─────────────────────────────────────────────────────────────────
r.get("/clients/:id/insurance", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(insuranceAnalyses).where(eq(insuranceAnalyses.clientId, cid)));
});

r.post("/clients/:id/insurance", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [row] = await (db.insert(insuranceAnalyses) as any).values({ clientId: cid, ...safe(req.body) }).returning();
  res.status(201).json(row);
});

r.patch("/insurance/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: insuranceAnalyses.id, clientId: insuranceAnalyses.clientId })
    .from(insuranceAnalyses).where(eq(insuranceAnalyses.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [u] = await db.update(insuranceAnalyses).set(safe(req.body)).where(eq(insuranceAnalyses.id, ex.id)).returning();
  res.json(u);
});

r.delete("/insurance/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: insuranceAnalyses.id, clientId: insuranceAnalyses.clientId })
    .from(insuranceAnalyses).where(eq(insuranceAnalyses.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(insuranceAnalyses).where(eq(insuranceAnalyses.id, ex.id));
  res.json({ ok: true });
});

// ── Education / RESP ──────────────────────────────────────────────────────────
r.get("/clients/:id/education", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(educationPlans).where(eq(educationPlans.clientId, cid)));
});

r.post("/clients/:id/education", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [row] = await (db.insert(educationPlans) as any).values({ clientId: cid, ...safe(req.body) }).returning();
  res.status(201).json(row);
});

r.patch("/education/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: educationPlans.id, clientId: educationPlans.clientId })
    .from(educationPlans).where(eq(educationPlans.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [u] = await db.update(educationPlans).set(safe(req.body)).where(eq(educationPlans.id, ex.id)).returning();
  res.json(u);
});

r.delete("/education/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: educationPlans.id, clientId: educationPlans.clientId })
    .from(educationPlans).where(eq(educationPlans.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(educationPlans).where(eq(educationPlans.id, ex.id));
  res.json({ ok: true });
});

// ── Debt ──────────────────────────────────────────────────────────────────────
r.get("/clients/:id/debt", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(debtEntries).where(eq(debtEntries.clientId, cid)));
});

r.post("/clients/:id/debt", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [row] = await (db.insert(debtEntries) as any).values({ clientId: cid, ...safe(req.body) }).returning();
  res.status(201).json(row);
});

r.patch("/debt/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: debtEntries.id, clientId: debtEntries.clientId })
    .from(debtEntries).where(eq(debtEntries.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [u] = await db.update(debtEntries).set(safe(req.body)).where(eq(debtEntries.id, ex.id)).returning();
  res.json(u);
});

r.delete("/debt/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: debtEntries.id, clientId: debtEntries.clientId })
    .from(debtEntries).where(eq(debtEntries.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(debtEntries).where(eq(debtEntries.id, ex.id));
  res.json({ ok: true });
});

// ── Tax Notes ─────────────────────────────────────────────────────────────────
r.get("/clients/:id/tax", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(taxNotes).where(eq(taxNotes.clientId, cid)));
});

r.post("/clients/:id/tax", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [row] = await (db.insert(taxNotes) as any).values({ clientId: cid, ...safe(req.body) }).returning();
  res.status(201).json(row);
});

r.patch("/tax/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: taxNotes.id, clientId: taxNotes.clientId })
    .from(taxNotes).where(eq(taxNotes.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [u] = await db.update(taxNotes).set(safe(req.body)).where(eq(taxNotes.id, ex.id)).returning();
  res.json(u);
});

r.delete("/tax/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: taxNotes.id, clientId: taxNotes.clientId })
    .from(taxNotes).where(eq(taxNotes.id, +req.params.id));
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
    const [u] = await db.update(estateNotes).set(safe(req.body)).where(eq(estateNotes.id, ex.id)).returning();
    return res.json(u);
  }
  const [row] = await (db.insert(estateNotes) as any).values({ clientId: cid, ...safe(req.body) }).returning();
  res.status(201).json(row);
});

// ── AI Recommendations ────────────────────────────────────────────────────────
r.get("/clients/:id/ai", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(aiRecommendations).where(eq(aiRecommendations.clientId, cid)));
});

r.post("/clients/:id/ai/generate", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [client] = await db.select().from(clients).where(eq(clients.id, cid));
  const [nw, debt] = await Promise.all([
    db.select().from(netWorthEntries).where(eq(netWorthEntries.clientId, cid)),
    db.select().from(debtEntries).where(eq(debtEntries.clientId, cid)),
  ]);
  const assets    = nw.filter(e => e.type === "asset").reduce((s, e) => s + Number(e.value), 0);
  const totalDebt = debt.reduce((s, d) => s + Number(d.balance), 0);
  const recs = [];

  if (!client.retirementAge)  recs.push({ clientId: cid, category: "retirement", priority: "high",   title: "Set Retirement Target Age",  content: "Define a target retirement age to enable accurate projections and CPP/OAS timing optimization." });
if (assets < 50000)         recs.push({ clientId: cid, category: "savings",    priority: "high",   title: "Build Emergency Fund",        content: "Recommend building 3-6 months of expenses in liquid savings before aggressive investing." });
if (totalDebt > 50000)      recs.push({ clientId: cid, category: "debt",       priority: "high",   title: "Debt Reduction Strategy",     content: `Total debt of $${totalDebt.toLocaleString()} is significant. Review avalanche vs snowball strategy.` });
recs.push({ clientId: cid, category: "tax",       priority: "medium", title: "Annual RRSP/TFSA Review",    content: "Review contribution room and optimize between RRSP and TFSA based on current and expected future marginal tax rates." });
recs.push({ clientId: cid, category: "insurance", priority: "medium", title: "Insurance Needs Review",     content: "Conduct annual review of life, disability, and critical illness coverage gaps." });

  const inserted = await Promise.all(recs.map(rec => db.insert(aiRecommendations).values(rec).returning().then(([x]) => x)));
  res.json(inserted);
});

r.patch("/ai/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: aiRecommendations.id, clientId: aiRecommendations.clientId })
    .from(aiRecommendations).where(eq(aiRecommendations.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [u] = await db.update(aiRecommendations).set(safe(req.body)).where(eq(aiRecommendations.id, ex.id)).returning();
  res.json(u);
});

r.delete("/ai/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: aiRecommendations.id, clientId: aiRecommendations.clientId })
    .from(aiRecommendations).where(eq(aiRecommendations.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(aiRecommendations).where(eq(aiRecommendations.id, ex.id));
  res.json({ ok: true });
});

// ── Client Policies ───────────────────────────────────────────────────────────
r.get("/clients/:id/policies", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(clientPolicies).where(eq(clientPolicies.clientId, cid)));
});
r.post("/clients/:id/policies", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  try {
    const [row] = await (db.insert(clientPolicies) as any).values({ clientId: cid, ...safe(req.body) }).returning();
    res.status(201).json(row);
  } catch (err: any) { console.error("[policies POST]", err.message); res.status(500).json({ message: err.message }); }
});
r.patch("/clients/:id/policies/:pid", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [row] = await db.update(clientPolicies).set(safe(req.body))
    .where(and(eq(clientPolicies.id, +req.params.pid), eq(clientPolicies.clientId, cid))).returning();
  res.json(row);
});
r.delete("/clients/:id/policies/:pid", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(clientPolicies).where(and(eq(clientPolicies.id, +req.params.pid), eq(clientPolicies.clientId, cid)));
  res.json({ ok: true });
});

// ── Household Expenses ────────────────────────────────────────────────────────
r.get("/clients/:id/expenses", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(householdExpenses).where(eq(householdExpenses.clientId, cid)));
});
r.post("/clients/:id/expenses", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  try {
    const [row] = await (db.insert(householdExpenses) as any).values({ clientId: cid, ...safe(req.body) }).returning();
    res.status(201).json(row);
  } catch (err: any) { console.error("[expenses POST]", err.message); res.status(500).json({ message: err.message }); }
});
r.patch("/clients/:id/expenses/:eid", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [row] = await db.update(householdExpenses).set(safe(req.body))
    .where(and(eq(householdExpenses.id, +req.params.eid), eq(householdExpenses.clientId, cid))).returning();
  res.json(row);
});
r.delete("/clients/:id/expenses/:eid", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(householdExpenses).where(and(eq(householdExpenses.id, +req.params.eid), eq(householdExpenses.clientId, cid)));
  res.json({ ok: true });
});

export { r as fpRouter };

