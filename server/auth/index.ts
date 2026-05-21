import type { Request, Response, NextFunction } from "express";
import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { getDb } from "../db/index.js";
import { users } from "../../shared/schema.js";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === "production")
    throw new Error("JWT_SECRET environment variable is required in production");
  console.warn("[auth] WARNING: JWT_SECRET not set — using insecure default.");
}
const SECRET = JWT_SECRET ?? "change-me-in-env";

export interface AuthRequest extends Request {
  userId?:           number;
  userJurisdiction?: "CA" | "US";
}

/**
 * Sign a JWT that includes the user's jurisdiction.
 * The jurisdiction claim (`jur`) is peeked at by the global middleware so
 * the AsyncLocalStorage context is set before any handler runs.
 */
export function signToken(id: number, jurisdiction: "CA" | "US" = "CA"): string {
  return jwt.sign({ sub: id, jur: jurisdiction }, SECRET, { expiresIn: "14d" });
}

export function isAuthenticated(req: AuthRequest, res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return res.status(401).json({ message: "Unauthorized" });
  try {
    const p = jwt.verify(h.slice(7), SECRET) as any;
    req.userId           = +p.sub;
    req.userJurisdiction = p.jur === "US" ? "US" : "CA";
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
}

export const hashPassword  = (p: string) => bcrypt.hash(p, 12);
export const checkPassword = (p: string, h: string) => bcrypt.compare(p, h);

/** Fetch a user from the appropriate jurisdiction DB. */
export async function getUser(id: number, jurisdiction: "CA" | "US" = "CA") {
  const [u] = await getDb(jurisdiction).select({
    id:           users.id,
    email:        users.email,
    firstName:    users.firstName,
    lastName:     users.lastName,
    firmName:     users.firmName,
    role:         users.role,
    jurisdiction: users.jurisdiction,
  }).from(users).where(eq(users.id, id));
  return u ?? null;
}
