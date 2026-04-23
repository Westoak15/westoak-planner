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

export { r as goalsRouter };
