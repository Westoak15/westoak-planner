import { Router } from "express";
import { db } from "../db/index.js";
import { clients, netWorthEntries, insuranceAnalyses, debtEntries, educationSavings, users, retirementProjections, taxPlanningNotes, estatePlanningNotes, householdExpenses } from "../../shared/schema.js";
import { eq, and, inArray } from "drizzle-orm";
import { isAuthenticated } from "../auth/index.js";
import { generateFnaReport, generateNetWorthReport, generateComprehensiveReport, generateRetirementReport, generateInsuranceReport, generateCashFlowReport, generateAssetAllocationReport, generateRetirementReadinessReport, generateGoalStatusReport, generateInsuranceAuditReport, generateEstateSummaryReport, generateTaxStrategyReport, generateOnePagePlan } from "../services/reportGenerator.js";
const r = Router();
r.use((req, res, next) => {
    // Allow token via query param for report downloads
    if (req.query.token && !req.headers.authorization) {
        req.headers.authorization = `Bearer ${req.query.token}`;
    }
    return isAuthenticated(req, res, next);
});
async function accessibleUserIds(userId) {
    return [userId];
}
async function getClient(clientId, userId) {
    const ids = await accessibleUserIds(userId);
    const [c] = await db.select().from(clients).where(and(eq(clients.id, clientId), inArray(clients.userId, ids)));
    return c ?? null;
}
// GET /api/reports/:clientId/fna/:analysisId
r.get("/:clientId/fna/:analysisId", async (req, res) => {
    try {
        const client = await getClient(+req.params.clientId, req.userId);
        if (!client)
            return res.status(404).json({ message: "Not found" });
        const [analysis] = await db.select().from(insuranceAnalyses)
            .where(and(eq(insuranceAnalyses.id, +req.params.analysisId), eq(insuranceAnalyses.clientId, +req.params.clientId)));
        if (!analysis)
            return res.status(404).json({ message: "Analysis not found" });
        const [advisor] = await db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
            .from(users).where(eq(users.id, req.userId)).limit(1);
        const html = generateFnaReport({ client, analysis, advisor });
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.send(html);
    }
    catch (err) {
        console.error("FNA report error:", err);
        res.status(500).json({ message: "Failed to generate report" });
    }
});
// GET /api/reports/:clientId/net-worth
r.get("/:clientId/net-worth", async (req, res) => {
    try {
        const client = await getClient(+req.params.clientId, req.userId);
        if (!client)
            return res.status(404).json({ message: "Not found" });
        const netWorth = await db.select().from(netWorthEntries).where(eq(netWorthEntries.clientId, +req.params.clientId));
        const html = generateNetWorthReport({ client, netWorth });
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.send(html);
    }
    catch (err) {
        console.error("Net worth report error:", err);
        res.status(500).json({ message: "Failed to generate report" });
    }
});
// GET /api/reports/:clientId/comprehensive
r.get("/:clientId/comprehensive", async (req, res) => {
    try {
        const client = await getClient(+req.params.clientId, req.userId);
        if (!client)
            return res.status(404).json({ message: "Not found" });
        const [netWorth, insuranceList, debts, education, advisor] = await Promise.all([
            db.select().from(netWorthEntries).where(eq(netWorthEntries.clientId, +req.params.clientId)),
            db.select().from(insuranceAnalyses).where(eq(insuranceAnalyses.clientId, +req.params.clientId)),
            db.select().from(debtEntries).where(eq(debtEntries.clientId, +req.params.clientId)),
            db.select().from(educationSavings).where(eq(educationSavings.clientId, +req.params.clientId)),
            db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, req.userId)).limit(1),
        ]);
        const insurance = insuranceList[0] ?? null;
        const html = generateComprehensiveReport({ client, advisor: advisor[0], netWorth, insurance, debts, education });
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.send(html);
    }
    catch (err) {
        console.error("Comprehensive report error:", err);
        res.status(500).json({ message: "Failed to generate report" });
    }
});
// ── Helper: fetch all FP data ─────────────────────────────────────────────────
async function fetchClientFpData(clientId, userId) {
    const client = await getClient(clientId, userId);
    if (!client)
        return null;
    const [netWorth, insuranceList, debts, education, retirementList, taxNotesList, estateNotesList, expensesList, advisor] = await Promise.all([
        db.select().from(netWorthEntries).where(eq(netWorthEntries.clientId, clientId)),
        db.select().from(insuranceAnalyses).where(eq(insuranceAnalyses.clientId, clientId)),
        db.select().from(debtEntries).where(eq(debtEntries.clientId, clientId)),
        db.select().from(educationSavings).where(eq(educationSavings.clientId, clientId)),
        db.select().from(retirementProjections).where(eq(retirementProjections.clientId, clientId)),
        db.select().from(taxPlanningNotes).where(eq(taxPlanningNotes.clientId, clientId)),
        db.select().from(estatePlanningNotes).where(eq(estatePlanningNotes.clientId, clientId)),
        db.select().from(householdExpenses).where(eq(householdExpenses.clientId, clientId)),
        db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, userId)).limit(1),
    ]);
    return {
        client: client,
        netWorth: netWorth,
        debts, education,
        expenses: expensesList,
        insurance: insuranceList[0] ?? null,
        retirement: retirementList[0] ?? null,
        taxNotes: taxNotesList,
        estateNotes: estateNotesList,
        advisor: advisor[0] ?? null,
    };
}
// GET /api/reports/:clientId/retirement
r.get("/:clientId/retirement", async (req, res) => {
    try {
        const d = await fetchClientFpData(+req.params.clientId, req.userId);
        if (!d)
            return res.status(404).json({ message: "Not found" });
        const html = generateRetirementReport({ client: d.client, retirement: d.retirement, advisor: d.advisor, generatedAt: new Date().toISOString() });
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.send(html);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed" });
    }
});
// GET /api/reports/:clientId/insurance
r.get("/:clientId/insurance", async (req, res) => {
    try {
        const d = await fetchClientFpData(+req.params.clientId, req.userId);
        if (!d)
            return res.status(404).json({ message: "Not found" });
        const html = generateInsuranceReport({ client: d.client, insurance: d.insurance, products: [] });
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.send(html);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed" });
    }
});
// GET /api/reports/:clientId/cash-flow
r.get("/:clientId/cash-flow", async (req, res) => {
    try {
        const d = await fetchClientFpData(+req.params.clientId, req.userId);
        if (!d)
            return res.status(404).json({ message: "Not found" });
        const html = generateCashFlowReport({ client: d.client, expenses: d.expenses, retirement: d.retirement, advisor: d.advisor, generatedAt: new Date().toISOString() });
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.send(html);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed" });
    }
});
// GET /api/reports/:clientId/asset-allocation
r.get("/:clientId/asset-allocation", async (req, res) => {
    try {
        const d = await fetchClientFpData(+req.params.clientId, req.userId);
        if (!d)
            return res.status(404).json({ message: "Not found" });
        const html = generateAssetAllocationReport({ client: d.client, netWorth: d.netWorth, advisor: d.advisor, generatedAt: new Date().toISOString() });
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.send(html);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed" });
    }
});
// GET /api/reports/:clientId/retirement-readiness
r.get("/:clientId/retirement-readiness", async (req, res) => {
    try {
        const d = await fetchClientFpData(+req.params.clientId, req.userId);
        if (!d)
            return res.status(404).json({ message: "Not found" });
        const html = generateRetirementReadinessReport({ client: d.client, retirement: d.retirement, expenses: d.expenses, netWorth: d.netWorth, advisor: d.advisor, generatedAt: new Date().toISOString() });
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.send(html);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed" });
    }
});
// GET /api/reports/:clientId/goal-status
r.get("/:clientId/goal-status", async (req, res) => {
    try {
        const d = await fetchClientFpData(+req.params.clientId, req.userId);
        if (!d)
            return res.status(404).json({ message: "Not found" });
        const html = generateGoalStatusReport({ client: d.client, plans: [], education: d.education, retirement: d.retirement, netWorth: d.netWorth, advisor: d.advisor, generatedAt: new Date().toISOString() });
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.send(html);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed" });
    }
});
// GET /api/reports/:clientId/insurance-audit
r.get("/:clientId/insurance-audit", async (req, res) => {
    try {
        const d = await fetchClientFpData(+req.params.clientId, req.userId);
        if (!d)
            return res.status(404).json({ message: "Not found" });
        const html = generateInsuranceAuditReport({ client: d.client, insurance: d.insurance, products: [], netWorth: d.netWorth, advisor: d.advisor, generatedAt: new Date().toISOString() });
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.send(html);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed" });
    }
});
// GET /api/reports/:clientId/estate-summary
r.get("/:clientId/estate-summary", async (req, res) => {
    try {
        const d = await fetchClientFpData(+req.params.clientId, req.userId);
        if (!d)
            return res.status(404).json({ message: "Not found" });
        const html = generateEstateSummaryReport({ client: d.client, estateNotes: d.estateNotes, netWorth: d.netWorth, products: [], advisor: d.advisor, generatedAt: new Date().toISOString() });
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.send(html);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed" });
    }
});
// GET /api/reports/:clientId/tax-strategy
r.get("/:clientId/tax-strategy", async (req, res) => {
    try {
        const d = await fetchClientFpData(+req.params.clientId, req.userId);
        if (!d)
            return res.status(404).json({ message: "Not found" });
        const html = generateTaxStrategyReport({ client: d.client, taxNotes: d.taxNotes, netWorth: d.netWorth, retirement: d.retirement, advisor: d.advisor, generatedAt: new Date().toISOString() });
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.send(html);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed" });
    }
});
r.get("/:clientId/one-page", async (req, res) => {
    try {
        const d = await fetchClientFpData(+req.params.clientId, req.userId);
        if (!d)
            return res.status(404).json({ message: "Not found" });
        const html = generateOnePagePlan({ client: d.client, netWorth: d.netWorth, retirement: d.retirement, insurance: d.insurance, plans: [], education: d.education, aiRecs: [], expenses: d.expenses, advisor: d.advisor, generatedAt: new Date().toISOString() });
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.send(html);
    }
    catch (err) {
        console.error("REPORT ERROR:", err?.message);
        res.status(500).json({ message: err?.message ?? "Failed" });
    }
});
export { r as reportsRouter };
