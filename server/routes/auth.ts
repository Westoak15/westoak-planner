import { Router, Request, Response } from "express";
import { db } from "../db/index.js";
import { users, insertUserSchema } from "../../shared/schema.js";
import { hashPassword, checkPassword, signToken, isAuthenticated, getUser, type AuthRequest } from "../auth/index.js";
import { eq } from "drizzle-orm";
import { z } from "zod";

const r = Router();

// ── Register (GA only — first user self-registers as GA) ──────────────────────
r.post("/register", async (req: Request, res: Response) => {
  try {
    const body = insertUserSchema.parse(req.body);
    const exists = await db.select({ id: users.id }).from(users).where(eq(users.email, body.email)).limit(1);
    if (exists.length) return res.status(409).json({ message: "Email already registered" });

    const { securityQuestion, securityAnswer } = z.object({
      securityQuestion: z.string().min(1, "Security question is required"),
      securityAnswer:   z.string().min(1, "Security answer is required"),
    }).parse(req.body);

    const hash       = await hashPassword(body.password);
    const answerHash = await hashPassword(securityAnswer.toLowerCase().trim());

    const [u] = await (db.insert(users) as any).values({
      email: body.email, passwordHash: hash,
      firstName: body.firstName, lastName: body.lastName,
      firmName: body.firmName ?? null,
      securityQuestion, securityAnswerHash: answerHash,
      role: "ga", level: "enhanced",
    }).returning({
      id: users.id, email: users.email, firstName: users.firstName,
      lastName: users.lastName, firmName: users.firmName,
      role: users.role, level: users.level,
    });

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
    res.json({
      token: signToken(u.id),
      user: {
        id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName,
        firmName: u.firmName, role: u.role, level: u.level,
        mustResetPassword: u.mustResetPassword, 
        jurisdiction: u.jurisdiction,
      },
    });
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
    const { currentPassword, newPassword, securityQuestion, securityAnswer } = z.object({
      currentPassword:  z.string().min(1),
      newPassword:      z.string().min(8),
      securityQuestion: z.string().optional(),
      securityAnswer:   z.string().optional(),
    }).parse(req.body);
    const [u] = await db.select().from(users).where(eq(users.id, req.userId!)).limit(1);
    if (!u) return res.status(404).json({ message: "User not found" });
    if (!await checkPassword(currentPassword, u.passwordHash))
      return res.status(401).json({ message: "Current password is incorrect" });
    const hash = await hashPassword(newPassword);
    const updates: any = { passwordHash: hash, mustResetPassword: false };
    if (securityQuestion && securityAnswer) {
      updates.securityQuestion  = securityQuestion;
      updates.securityAnswerHash = await hashPassword(securityAnswer.toLowerCase().trim());
    }
    await db.update(users).set(updates).where(eq(users.id, req.userId!));
    const newToken = signToken(u.id);
    res.json({ message: "Password changed successfully", token: newToken });
  } catch (e: any) {
    if (e instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: e.errors });
    console.error("[change-password]", e.message);
    res.status(500).json({ message: e.message ?? "Server error" });
  }
});

// ── Force Reset Password (FA first login) ─────────────────────────────────────
r.post("/force-reset-password", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
   const { newPassword, securityQuestion, securityAnswer } = z.object({ 
      newPassword: z.string().min(8),
      securityQuestion: z.string().optional(),
      securityAnswer: z.string().optional(),
    }).parse(req.body);
    const hash = await hashPassword(newPassword);
    const updates: any = { passwordHash: hash, mustResetPassword: false };
    if (securityQuestion && securityAnswer) {
      updates.securityQuestion   = securityQuestion;
      updates.securityAnswerHash = await hashPassword(securityAnswer.toLowerCase().trim());
    }
    await db.update(users).set(updates).where(eq(users.id, req.userId!));
    const [u] = await db.select().from(users).where(eq(users.id, req.userId!)).limit(1);
    const newToken = signToken(u.id);
    res.json({ message: "Password reset successfully", token: newToken });
  } catch (e: any) {
    res.status(500).json({ message: e.message ?? "Server error" });
  }
});

// ── Forgot Password: get security question ────────────────────────────────────
r.post("/forgot/question", async (req: Request, res: Response) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const [u] = await db.select({ securityQuestion: users.securityQuestion }).from(users).where(eq(users.email, email)).limit(1);
    if (!u || !u.securityQuestion) return res.json({ question: null });
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
    if (!correct) return res.status(401).json({ message: "Security answer is incorrect." });

    const hash = await hashPassword(newPassword);
    await db.update(users).set({ passwordHash: hash }).where(eq(users.id, u.id));
    res.json({ message: "Password reset successfully. You can now sign in." });
  } catch (e: any) {
    if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0]?.message ?? "Validation error" });
    console.error("[forgot/reset]", e.message);
    res.status(500).json({ message: e.message ?? "Server error" });
  }
});

// ── GA: List FA users ─────────────────────────────────────────────────────────
r.get("/users", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const [me] = await db.select().from(users).where(eq(users.id, req.userId!)).limit(1);
    if (!me || me.role !== "ga") return res.status(403).json({ message: "Forbidden" });
    const fas = await db.select({
      id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName,
      level: users.level, role: users.role, gaId: users.gaId, createdAt: users.createdAt,
    }).from(users).where(eq(users.gaId, me.id));
    res.json(fas);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// ── GA: Create FA user ────────────────────────────────────────────────────────
r.post("/users", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const [me] = await db.select().from(users).where(eq(users.id, req.userId!)).limit(1);
    if (!me || me.role !== "ga") return res.status(403).json({ message: "Forbidden" });

    const body = z.object({
      firstName: z.string().min(1),
      lastName:  z.string().min(1),
      email:     z.string().email(),
      password:  z.string().min(8),
      level:     z.enum(["standard", "enhanced"]).default("standard"),
    }).parse(req.body);

    const exists = await db.select({ id: users.id }).from(users).where(eq(users.email, body.email)).limit(1);
    if (exists.length) return res.status(409).json({ message: "Email already registered" });

    const hash = await hashPassword(body.password as string);
    const [u] = await (db.insert(users) as any).values({
      email: body.email, passwordHash: hash,
      firstName: body.firstName, lastName: body.lastName,
      level: body.level, role: "fa", gaId: me.id,
      mustResetPassword: true,
    }).returning({
      id: users.id, email: users.email, firstName: users.firstName,
      lastName: users.lastName, level: users.level, role: users.role,
    });

    res.status(201).json(u);
  } catch (e: any) {
    if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0]?.message ?? "Validation error" });
    res.status(500).json({ message: e.message });
  }
});

// ── GA: Update FA user ────────────────────────────────────────────────────────
r.patch("/users/:id", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const [me] = await db.select().from(users).where(eq(users.id, req.userId!)).limit(1);
    if (!me || me.role !== "ga") return res.status(403).json({ message: "Forbidden" });

    const [target] = await db.select({ id: users.id, gaId: users.gaId }).from(users).where(eq(users.id, +req.params.id)).limit(1);
    if (!target || target.gaId !== me.id) return res.status(404).json({ message: "User not found" });

    const body = z.object({
      firstName: z.string().min(1).optional(),
      lastName:  z.string().min(1).optional(),
      level:     z.enum(["standard", "enhanced"]).optional(),
      password:  z.string().min(8).optional(),
    }).parse(req.body);

    const update: any = { ...body };
    if (body.password) {
      update.passwordHash = await hashPassword(body.password);
      update.mustResetPassword = true;
      delete update.password;
    }

    const [u] = await db.update(users).set(update).where(eq(users.id, target.id)).returning({
      id: users.id, email: users.email, firstName: users.firstName,
      lastName: users.lastName, level: users.level, role: users.role,
    });
    res.json(u);
  } catch (e: any) {
    if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0]?.message ?? "Validation error" });
    res.status(500).json({ message: e.message });
  }
});

// ── GA: Delete FA user ────────────────────────────────────────────────────────
r.delete("/users/:id", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const [me] = await db.select().from(users).where(eq(users.id, req.userId!)).limit(1);
    if (!me || me.role !== "ga") return res.status(403).json({ message: "Forbidden" });

    const [target] = await db.select({ id: users.id, gaId: users.gaId }).from(users).where(eq(users.id, +req.params.id)).limit(1);
    if (!target || target.gaId !== me.id) return res.status(404).json({ message: "User not found" });

    await db.delete(users).where(eq(users.id, target.id));
    res.json({ message: "User deleted" });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

r.patch("/me", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const body = z.object({
      firmName:     z.string().nullable().optional(),
      jurisdiction: z.enum(["CA", "US"]).optional(),
    }).parse(req.body);
    const [u] = await db.update(users).set(body).where(eq(users.id, req.userId!)).returning({
      id: users.id, email: users.email, firstName: users.firstName,
      lastName: users.lastName, firmName: users.firmName,
      role: users.role, level: users.level, jurisdiction: (users as any).jurisdiction,
    });
    res.json(u);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

export { r as authRouter };
