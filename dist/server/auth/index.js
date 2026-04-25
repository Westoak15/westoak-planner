import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { db } from "../db/index.js";
import { users } from "../../shared/schema.js";
import { eq } from "drizzle-orm";
const JWT_SECRET = process.env.JWT_SECRET ?? "change-me";
export function signToken(id) {
    return jwt.sign({ sub: id }, JWT_SECRET, { expiresIn: "14d" });
}
export function isAuthenticated(req, res, next) {
    const h = req.headers.authorization;
    if (!h?.startsWith("Bearer "))
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const p = jwt.verify(h.slice(7), JWT_SECRET);
        req.userId = p.sub;
        next();
    }
    catch {
        res.status(401).json({ message: "Invalid token" });
    }
}
export const hashPassword = (p) => bcrypt.hash(p, 12);
export const checkPassword = (p, h) => bcrypt.compare(p, h);
export async function getUser(id) {
    const [u] = await db.select({
        id: users.id, email: users.email,
        firstName: users.firstName, lastName: users.lastName, firmName: users.firmName,
        role: users.role,
    }).from(users).where(eq(users.id, id));
    return u ?? null;
}
