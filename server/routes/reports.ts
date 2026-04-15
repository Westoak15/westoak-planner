import { Router, Response } from "express";
import { db } from "../db/index.js";
import { clients, netWorthEntries, insuranceAnalyses, debtEntries, educationSavings, users } from "../../shared/schema.js";
import { eq, and, inArray } from "drizzle-orm";
import { isAuthenticated, type AuthRequest } from "../auth/index.js";
import { generateFnaReport, generateNetWorthReport, generateComprehensiveReport } from "../services/reportGenerator.js";

const r = Router();
r.use(isAuthenticated);

async function accessibleUserIds(userId: number): Promise<number[]> {
  const [me] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  if (me?.role === "ga") {
    const fas = await db.select({ id: users.id }).from(users).where(eq(users.gaId, userId));
    return [userId, ...fas.map(f => f.id)];
  }
  return [userId];
}

async function getClient(clientId: number, userId: number) {
  const ids = await accessibleUserIds(userId);
  const [c] = await db.select().from(clients).where(and(eq(clients.id, clientId), inArray(clients.userId, ids)));
  return c ?? null;
}

// GET /api/reports/:clientId/fna/:analysisId
r.get("/:clientId/fna/:analysisId", async (req: AuthRequest, res: Response) => {
  try {
    const client = await getClient(+req.params.clientId, req.userId!);
    if (!client) return res.status(404).json({ message: "Not found" });

    const [analysis] = await db.select().from(insuranceAnalyses)
      .where(and(eq(insuranceAnalyses.id, +req.params.analysisId), eq(insuranceAnalyses.clientId, +req.params.clientId)));
    if (!analysis) return res.status(404).json({ message: "Analysis not found" });

    const [advisor] = await db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
      .from(users).where(eq(users.id, req.userId!)).limit(1);

    const html = generateFnaReport({ client, analysis, advisor });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    console.error("FNA report error:", err);
    res.status(500).json({ message: "Failed to generate report" });
  }
});

// GET /api/reports/:clientId/net-worth
r.get("/:clientId/net-worth", async (req: AuthRequest, res: Response) => {
  try {
    const client = await getClient(+req.params.clientId, req.userId!);
    if (!client) return res.status(404).json({ message: "Not found" });

    const netWorth = await db.select().from(netWorthEntries).where(eq(netWorthEntries.clientId, +req.params.clientId));
    const html = generateNetWorthReport({ client, netWorth });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    console.error("Net worth report error:", err);
    res.status(500).json({ message: "Failed to generate report" });
  }
});

// GET /api/reports/:clientId/comprehensive
r.get("/:clientId/comprehensive", async (req: AuthRequest, res: Response) => {
  try {
    const client = await getClient(+req.params.clientId, req.userId!);
    if (!client) return res.status(404).json({ message: "Not found" });

    const [netWorth, insuranceList, debts, education, advisor] = await Promise.all([
      db.select().from(netWorthEntries).where(eq(netWorthEntries.clientId, +req.params.clientId)),
      db.select().from(insuranceAnalyses).where(eq(insuranceAnalyses.clientId, +req.params.clientId)),
      db.select().from(debtEntries).where(eq(debtEntries.clientId, +req.params.clientId)),
      db.select().from(educationSavings).where(eq(educationSavings.clientId, +req.params.clientId)),
      db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, req.userId!)).limit(1),
    ]);

    const insurance = insuranceList[0] ?? null;
    const html = generateComprehensiveReport({ client, advisor: advisor[0], netWorth, insurance, debts, education });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    console.error("Comprehensive report error:", err);
    res.status(500).json({ message: "Failed to generate report" });
  }
});

export { r as reportsRouter };
