import { Router, Request, Response } from "express";
import { db } from "../db/index.js";
import { users, insertUserSchema } from "../../shared/schema.js";
import { hashPassword, checkPassword, signToken, isAuthenticated, getUser, type AuthRequest } from "../auth/index.js";
import { eq } from "drizzle-orm";
import { z } from "zod";

const r = Router();

r.post("/register", async (req: Request, res: Response) => {
  try {
    const body = insertUserSchema.parse(req.body);
    const exists = await db.select({ id: users.id }).from(users).where(eq(users.email, body.email)).limit(1);
    if (exists.length) return res.status(409).json({ message: "Email already registered" });
    const hash = await hashPassword(body.password);
    const [u] = await db.insert(users).values({ email: body.email, passwordHash: hash, firstName: body.firstName, lastName: body.lastName, firmName: body.firmName ?? null }).returning({ id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName, firmName: users.firmName });
    res.status(201).json({ token: signToken(u.id), user: u });
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: e.errors });
    res.status(500).json({ message: "Server error" });
  }
});

r.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = z.object({ email: z.string().email(), password: z.string() }).parse(req.body);
    const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!u || !await checkPassword(password, u.passwordHash))
      return res.status(401).json({ message: "Invalid email or password" });
    res.json({ token: signToken(u.id), user: { id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName, firmName: u.firmName } });
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: e.errors });
    res.status(500).json({ message: "Server error" });
  }
});

r.get("/me", isAuthenticated, async (req: AuthRequest, res: Response) => {
  const u = await getUser(req.userId!);
  if (!u) return res.status(404).json({ message: "Not found" });
  res.json(u);
});

export { r as authRouter };
