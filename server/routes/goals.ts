import { Router, Response } from "express";
import { db } from "../db/index.js";
import { isAuthenticated, type AuthRequest } from "../auth/index.js";
import { ownsClient } from "../fpUtils.js";
import { eq, and } from "drizzle-orm";
import { financialGoals } from "../../shared/schema.js";

const r = Router();
r.use(isAuthenticated);

r.get("/clients/:id/goals", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const rows = await db.select().from(financialGoals).where(eq(financialGoals.clientId, cid));
  res.json(rows);
});

r.post("/clients/:id/goals", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const { goalType = "custom", title, targetAmount, currentAmount, targetDate, status = "in_progress", notes } = req.body;
  const [row] = await (db.insert(financialGoals) as any).values({ clientId: cid, goalType, title, targetAmount: targetAmount || null, currentAmount: currentAmount || null, targetDate: targetDate || null, status, notes: notes || null }).returning();
  res.status(201).json(row);
});

r.patch("/goals/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: financialGoals.id, clientId: financialGoals.clientId })
    .from(financialGoals).where(eq(financialGoals.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const { goalType, title, targetAmount, currentAmount, targetDate, status, notes } = req.body;
  const [u] = await db.update(financialGoals).set({ goalType, title, targetAmount: targetAmount || null, currentAmount: currentAmount || null, targetDate: targetDate || null, status, notes: notes || null, updatedAt: new Date() } as any)
    .where(eq(financialGoals.id, ex.id)).returning();
  res.json(u);
});

r.delete("/goals/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: financialGoals.id, clientId: financialGoals.clientId })
    .from(financialGoals).where(eq(financialGoals.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(financialGoals).where(eq(financialGoals.id, ex.id));
  res.json({ ok: true });
});

// ── Goal Check-ins ────────────────────────────────────────────────────────────
import { goalCheckIns } from "../../shared/schema.js";

r.get("/goals/:id/check-ins", async (req: AuthRequest, res: Response) => {
  const [goal] = await db.select({ id: financialGoals.id, clientId: financialGoals.clientId })
    .from(financialGoals).where(eq(financialGoals.id, +req.params.id));
  if (!goal || !await ownsClient(goal.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const rows = await db.select().from(goalCheckIns)
    .where(eq(goalCheckIns.goalId, goal.id));
  res.json(rows);
});

r.post("/goals/:id/check-ins", async (req: AuthRequest, res: Response) => {
  const [goal] = await db.select({ id: financialGoals.id, clientId: financialGoals.clientId })
    .from(financialGoals).where(eq(financialGoals.id, +req.params.id));
  if (!goal || !await ownsClient(goal.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const { currentAmount, notes, checkInDate } = req.body;
  const [row] = await (db.insert(goalCheckIns) as any).values({
    goalId: goal.id,
    currentAmount: currentAmount ?? "0",
    notes: notes ?? null,
    checkInDate: checkInDate ?? new Date().toISOString().split("T")[0],
  }).returning();
  // Update the goal's currentAmount to latest check-in
  await db.update(financialGoals)
    .set({ currentAmount, updatedAt: new Date() } as any)
    .where(eq(financialGoals.id, goal.id));
  res.status(201).json(row);
});

r.delete("/goal-check-ins/:id", async (req: AuthRequest, res: Response) => {
  await db.delete(goalCheckIns).where(eq(goalCheckIns.id, +req.params.id));
  res.json({ ok: true });
});

export { r as goalsRouter };
