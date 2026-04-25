import { Router } from "express";
import { db } from "../db/index.js";
import { clients, financialPlans as plans, users } from "../../shared/schema.js";
import { isAuthenticated } from "../auth/index.js";
import { eq, and, ilike, or, inArray } from "drizzle-orm";
const r = Router();
r.use(isAuthenticated);
function safe(body) {
    const { id, createdAt, updatedAt, userId, ...rest } = body;
    return rest;
}
// Get all userIds this requester can access (own + FA's if GA)
async function accessibleUserIds(userId) {
    const [me] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
    if (me?.role === "ga") {
        const fas = await db.select({ id: users.id }).from(users).where(eq(users.gaId, userId));
        return [userId, ...fas.map(f => f.id)];
    }
    return [userId];
}
// Check if requester can access a specific client
async function canAccessClient(userId, clientId) {
    const ids = await accessibleUserIds(userId);
    const [c] = await db.select({ id: clients.id }).from(clients)
        .where(and(eq(clients.id, clientId), inArray(clients.userId, ids)));
    return !!c;
}
r.get("/", async (req, res) => {
    const s = req.query.search;
    const agentId = req.query.agentId ? +req.query.agentId : null;
    const ids = await accessibleUserIds(req.userId);
    const effectiveIds = agentId && ids.includes(agentId) ? [agentId] : ids;
    const rows = await db.select().from(clients)
        .where(s
        ? and(inArray(clients.userId, effectiveIds), or(ilike(clients.firstName, `%${s}%`), ilike(clients.lastName, `%${s}%`)))
        : inArray(clients.userId, effectiveIds));
    res.json(rows);
});
r.get("/:id", async (req, res) => {
    const ok = await canAccessClient(req.userId, +req.params.id);
    if (!ok)
        return res.status(404).json({ message: "Not found" });
    const [c] = await db.select().from(clients).where(eq(clients.id, +req.params.id));
    res.json(c);
});
r.post("/", async (req, res) => {
    try {
        const [c] = await db.insert(clients).values({ ...safe(req.body), userId: req.userId }).returning();
        res.status(201).json(c);
    }
    catch (e) {
        console.error("[clients/post]", e.message);
        res.status(500).json({ message: e.message });
    }
});
r.patch("/:id", async (req, res) => {
    const ok = await canAccessClient(req.userId, +req.params.id);
    if (!ok)
        return res.status(404).json({ message: "Not found" });
    try {
        const [u] = await db.update(clients).set(safe(req.body)).where(eq(clients.id, +req.params.id)).returning();
        res.json(u);
    }
    catch (e) {
        console.error("[clients/patch]", e.message);
        res.status(500).json({ message: e.message });
    }
});
r.delete("/:id", async (req, res) => {
    const ok = await canAccessClient(req.userId, +req.params.id);
    if (!ok)
        return res.status(404).json({ message: "Not found" });
    await db.delete(clients).where(eq(clients.id, +req.params.id));
    res.json({ ok: true });
});
r.get("/:id/plans", async (req, res) => {
    const ok = await canAccessClient(req.userId, +req.params.id);
    if (!ok)
        return res.status(404).json({ message: "Not found" });
    const rows = await db.select().from(plans).where(eq(plans.clientId, +req.params.id));
    res.json(rows);
});
r.post("/:id/plans", async (req, res) => {
    const ok = await canAccessClient(req.userId, +req.params.id);
    if (!ok)
        return res.status(404).json({ message: "Not found" });
    const [p] = await db.insert(plans).values({ clientId: +req.params.id, userId: req.userId, name: req.body.name ?? "Financial Plan" }).returning();
    res.status(201).json(p);
});
export { r as clientsRouter };
