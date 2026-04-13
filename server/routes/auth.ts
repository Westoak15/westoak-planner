import { Router, Request, Response } from "express";
import { db } from "../db/index.js";
import { users, insertUserSchema } from "../../shared/schema.js";
import { hashPassword, checkPassword, signToken, isAuthenticated, getUser, type AuthRequest } from "../auth/index.js";
import { eq } from "drizzle-orm";
import { z } from "zod";

const r = Router();

// ── Register ──────────────────────────────────────────────────────────────────
r.post("/register", async (req: Request, res: Response) => {
  try {
    const body = insertUserSchema.parse(req.body);
    const exists = await db.select({ id: users.id }).from(users).where(eq(users.email, body.email)).limit(1);
    if (exists.length) return res.status(409).json({ message: "Email already registered" });

    // Security question is required on register
    const { securityQuestion, securityAnswer } = z.object({
      securityQuestion: z.string().min(1, "Security question is required"),
      securityAnswer:   z.string().min(1, "Security answer is required"),
    }).parse(req.body);

    const hash       = await hashPassword(body.password);
    const answerHash = await hashPassword(securityAnswer.toLowerCase().trim());

    const [u] = await db.insert(users).values({
      email: body.email, passwordHash: hash,
      firstName: body.firstName, lastName: body.lastName,
      firmName: body.firmName ?? null,
      securityQuestion, securityAnswerHash: answerHash,
    }).returning({ id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName, firmName: users.firmName });

    res.status(201).json({ token: signToken(u.id), user: u });
  } catch (e: any) {
    if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0]?.message ?? "Validation error", errors: e.errors });
    console.error("[register]", e.message);
    res.status(500).json({ message: e.message ?? "Server error" });
  }
});

// ── Login ─────────────────────────────────────────────────────────────────────
r.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = z.object({ email: z.string().email(), password: z.string() }).parse(req.body);
    const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!u || !await checkPassword(password, u.passwordHash))
      return res.status(401).json({ message: "Invalid email or password" });
    res.json({ token: signToken(u.id), user: { id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName, firmName: u.firmName } });
  } catch (e: any) {
    if (e instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: e.errors });
    console.error("[login]", e.message);
    res.status(500).json({ message: e.message ?? "Server error" });
  }
});

// ── Me ────────────────────────────────────────────────────────────────────────
r.get("/me", isAuthenticated, async (req: AuthRequest, res: Response) => {
  const u = await getUser(req.userId!);
  if (!u) return res.status(404).json({ message: "Not found" });
  res.json(u);
});

// ── Change Password (logged in) ───────────────────────────────────────────────
r.post("/change-password", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = z.object({
      currentPassword: z.string().min(1),
      newPassword:     z.string().min(8),
    }).parse(req.body);

    const [u] = await db.select().from(users).where(eq(users.id, req.userId!)).limit(1);
    if (!u) return res.status(404).json({ message: "User not found" });

    if (!await checkPassword(currentPassword, u.passwordHash))
      return res.status(401).json({ message: "Current password is incorrect" });

    const hash = await hashPassword(newPassword);
    await db.update(users).set({ passwordHash: hash, updatedAt: new Date() }).where(eq(users.id, req.userId!));
    res.json({ message: "Password changed successfully" });
  } catch (e: any) {
    if (e instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: e.errors });
    console.error("[change-password]", e.message);
    res.status(500).json({ message: e.message ?? "Server error" });
  }
});

// ── Forgot Password: get security question ────────────────────────────────────
r.post("/forgot/question", async (req: Request, res: Response) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const [u] = await db.select({ securityQuestion: users.securityQuestion }).from(users).where(eq(users.email, email)).limit(1);
    // Always return 200 to avoid email enumeration
    if (!u || !u.securityQuestion) {
      return res.json({ question: null, message: "If an account exists, a security question is on file." });
    }
    res.json({ question: u.securityQuestion });
  } catch (e: any) {
    res.status(500).json({ message: "Server error" });
  }
});

// ── Forgot Password: verify answer + reset ────────────────────────────────────
r.post("/forgot/reset", async (req: Request, res: Response) => {
  try {
    const { email, securityAnswer, newPassword } = z.object({
      email:          z.string().email(),
      securityAnswer: z.string().min(1),
      newPassword:    z.string().min(8),
    }).parse(req.body);

    const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!u || !u.securityAnswerHash)
      return res.status(400).json({ message: "Account not found or no security question set." });

    const correct = await checkPassword(securityAnswer.toLowerCase().trim(), u.securityAnswerHash);
    if (!correct)
      return res.status(401).json({ message: "Security answer is incorrect." });

    const hash = await hashPassword(newPassword);
    await db.update(users).set({ passwordHash: hash, updatedAt: new Date() }).where(eq(users.id, u.id));
    res.json({ message: "Password reset successfully. You can now sign in." });
  } catch (e: any) {
    if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0]?.message ?? "Validation error" });
    console.error("[forgot/reset]", e.message);
    res.status(500).json({ message: e.message ?? "Server error" });
  }
});

export { r as authRouter };
