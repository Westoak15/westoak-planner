import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { db } from "../db/index.js";
import { users } from "../../shared/schema.js";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === "production") throw new Error("JWT_SECRET environment variable is required in production");
  console.warn("[auth] WARNING: JWT_SECRET not set — using insecure default. Set this in .env for any real deployment.");
}
const SECRET = JWT_SECRET ?? "change-me-in-env";

export interface AuthRequest extends Request {
  userId?: number;
}

export function signToken(id: number): string {
  return jwt.sign({ sub: id }, SECRET, { expiresIn: "14d" });
}

export function isAuthenticated(req: AuthRequest, res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return res.status(401).json({ message: "Unauthorized" });
  try {
    const p = jwt.verify(h.slice(7), SECRET) as any;
    req.userId = +p.sub;
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
}

export const hashPassword  = (p: string) => bcrypt.hash(p, 12);
export const checkPassword = (p: string, h: string) => bcrypt.compare(p, h);

export async function getUser(id: number) {
  const [u] = await db.select({
    id: users.id, email: users.email,
    firstName: users.firstName, lastName: users.lastName, firmName: users.firmName,
    role: users.role, jurisdiction: users.jurisdiction,
  }).from(users).where(eq(users.id, id));
  return u ?? null;
}

