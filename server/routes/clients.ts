import { Router, Response } from "express";
import { db } from "../db/index.js";
import { clients, plans } from "../../shared/schema.js";
import { isAuthenticated, type AuthRequest } from "../auth/index.js";
import { eq, and, desc, ilike, or } from "drizzle-orm";

const r = Router();
r.use(isAuthenticated);

// Strip timestamp fields that should never come from client
function safe(body: any) {
  const { id, createdAt, updatedAt, userId, ...rest } = body;
  return rest;
}

r.get("/", async (req: AuthRequest, res: Response) => {
  const s = req.query.search as string | undefined;
  const rows = await db.select().from(clients)
    .where(s
      ? and(eq(clients.userId, req.userId!), or(ilike(clients.firstName, `%${s}%`), ilike(clients.lastName, `%${s}%`)))
      : eq(clients.userId, req.userId!))
    ;
  res.json(rows);
});

r.get("/:id", async (req: AuthRequest, res: Response) => {
  const [c] = await db.select().from(clients).where(and(eq(clients.id, +req.params.id), eq(clients.userId, req.userId!)));
  if (!c) return res.status(404).json({ message: "Not found" });
  res.json(c);
});

r.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const [c] = await db.insert(clients).values({ ...safe(req.body), userId: req.userId }).returning();
    res.status(201).json(c);
  } catch (e: any) {
    console.error("[clients/post]", e.message);
    res.status(500).json({ message: e.message });
  }
});

r.patch("/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: clients.id }).from(clients).where(and(eq(clients.id, +req.params.id), eq(clients.userId, req.userId!)));
  if (!ex) return res.status(404).json({ message: "Not found" });
  try {
    const [u] = await db.update(clients).set(safe(req.body)).where(eq(clients.id, +req.params.id)).returning();
    res.json(u);
  } catch (e: any) {
    console.error("[clients/patch]", e.message);
    res.status(500).json({ message: e.message });
  }
});

r.delete("/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: clients.id }).from(clients).where(and(eq(clients.id, +req.params.id), eq(clients.userId, req.userId!)));
  if (!ex) return res.status(404).json({ message: "Not found" });
  await db.delete(clients).where(eq(clients.id, +req.params.id));
  res.json({ ok: true });
});

r.get("/:id/plans", async (req: AuthRequest, res: Response) => {
  const [c] = await db.select({ id: clients.id }).from(clients).where(and(eq(clients.id, +req.params.id), eq(clients.userId, req.userId!)));
  if (!c) return res.status(404).json({ message: "Not found" });
  const rows = await db.select().from(plans).where(eq(plans.clientId, +req.params.id));
  res.json(rows);
});

r.post("/:id/plans", async (req: AuthRequest, res: Response) => {
  const [c] = await db.select({ id: clients.id }).from(clients).where(and(eq(clients.id, +req.params.id), eq(clients.userId, req.userId!)));
  if (!c) return res.status(404).json({ message: "Not found" });
  const [p] = await (db.insert(plans) as any).values({ clientId: +req.params.id, userId: req.userId!, name: req.body.name ?? "Financial Plan" }).returning();
  res.status(201).json(p);
});

export { r as clientsRouter };
