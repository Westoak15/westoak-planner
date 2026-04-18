import { Router, Response } from "express";
import { z } from "zod";
import { isAuthenticated, type AuthRequest } from "../auth/index.js";
import { db } from "../db/index.js";
import { netWorthEntries, clients } from "../../shared/schema.js";
import { eq, and } from "drizzle-orm";

const r = Router();

r.get(
  "/api/clients/:clientId/net-worth",
  isAuthenticated,
  async (req: AuthRequest, res: Response) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const userId = req.userId!;
      
      const [client] = await db
        .select()
        .from(clients)
        .where(eq(clients.id, clientId))
        .limit(1);
      
      if (!client || client.userId !== userId) {
        return res.status(404).json({ message: "Client not found" });
      }
      
      const entries = await db
        .select()
        .from(netWorthEntries)
        .where(eq(netWorthEntries.clientId, clientId));
      
      res.json(entries);
    } catch (err: any) {
      console.error("[net worth get]", err);
      res.status(500).json({ message: err.message ?? "Failed to fetch net worth" });
    }
  }
);

const createSchema = z.object({
  type: z.enum(["asset", "liability"]),
  category: z.string().min(1),
  name: z.string().min(1),
  value: z.string(),
});

r.post(
  "/api/clients/:clientId/net-worth",
  isAuthenticated,
  async (req: AuthRequest, res: Response) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const userId = req.userId!;
      
      const [client] = await db
        .select()
        .from(clients)
        .where(eq(clients.id, clientId))
        .limit(1);
      
      if (!client || client.userId !== userId) {
        return res.status(404).json({ message: "Client not found" });
      }
      
      const data = createSchema.parse(req.body);
      
      const [entry] = await (db.insert(netWorthEntries) as any).values({
        clientId,
        type: data.type,
        category: data.category,
        name: data.name,
        value: data.value,
      }).returning();
      
      res.status(201).json(entry);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message ?? "Validation error" });
      }
      console.error("[net worth create]", err);
      res.status(500).json({ message: err.message ?? "Failed to create entry" });
    }
  }
);

const updateSchema = z.object({
  type: z.enum(["asset", "liability"]).optional(),
  category: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  value: z.string().optional(),
});

r.patch(
  "/api/clients/:clientId/net-worth/:id",
  isAuthenticated,
  async (req: AuthRequest, res: Response) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const entryId = parseInt(req.params.id);
      const userId = req.userId!;
      
      const [client] = await db
        .select()
        .from(clients)
        .where(eq(clients.id, clientId))
        .limit(1);
      
      if (!client || client.userId !== userId) {
        return res.status(404).json({ message: "Client not found" });
      }
      
      const data = updateSchema.parse(req.body);
      
      const [updated] = await (db.update(netWorthEntries) as any)
        .set(data)
        .where(
          and(
            eq(netWorthEntries.id, entryId),
            eq(netWorthEntries.clientId, clientId)
          )
        )
        .returning();
      
      if (!updated) {
        return res.status(404).json({ message: "Entry not found" });
      }
      
      res.json(updated);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message ?? "Validation error" });
      }
      console.error("[net worth update]", err);
      res.status(500).json({ message: err.message ?? "Failed to update entry" });
    }
  }
);

r.delete(
  "/api/clients/:clientId/net-worth/:id",
  isAuthenticated,
  async (req: AuthRequest, res: Response) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const entryId = parseInt(req.params.id);
      const userId = req.userId!;
      
      const [client] = await db
        .select()
        .from(clients)
        .where(eq(clients.id, clientId))
        .limit(1);
      
      if (!client || client.userId !== userId) {
        return res.status(404).json({ message: "Client not found" });
      }
      
      await (db.delete(netWorthEntries) as any)
        .where(
          and(
            eq(netWorthEntries.id, entryId),
            eq(netWorthEntries.clientId, clientId)
          )
        );
      
      res.json({ success: true });
    } catch (err: any) {
      console.error("[net worth delete]", err);
      res.status(500).json({ message: err.message ?? "Failed to delete entry" });
    }
  }
);

export { r as networthRouter };