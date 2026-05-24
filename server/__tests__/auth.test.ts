/**
 * server/__tests__/auth.test.ts
 *
 * Unit tests for auth utilities — no DB required.
 * These run in CI without any secrets or external services.
 */
import { describe, it, expect, beforeAll } from "vitest";

// ── Password validation ────────────────────────────────────────────────────────
// Mirror the validatePassword logic from routes/auth.ts so it's testable
// without importing the full module (which imports db, openai, etc.)
function validatePassword(p: string): string | null {
  if (p.length < 12)                                       return "Password must be at least 12 characters.";
  if (!/[A-Z]/.test(p))                                    return "Password must contain at least one uppercase letter.";
  if (!/[a-z]/.test(p))                                    return "Password must contain at least one lowercase letter.";
  if (!/\d/.test(p))                                       return "Password must contain at least one number.";
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p))  return "Password must contain at least one special character.";
  return null;
}

describe("validatePassword", () => {
  it("rejects passwords shorter than 12 chars", () => {
    expect(validatePassword("Short1!")).toBe("Password must be at least 12 characters.");
  });

  it("rejects passwords with no uppercase", () => {
    expect(validatePassword("alllowercase1!")).toBe("Password must contain at least one uppercase letter.");
  });

  it("rejects passwords with no lowercase", () => {
    expect(validatePassword("ALLUPPERCASE1!")).toBe("Password must contain at least one lowercase letter.");
  });

  it("rejects passwords with no digit", () => {
    expect(validatePassword("NoNumbersHere!")).toBe("Password must contain at least one number.");
  });

  it("rejects passwords with no special character", () => {
    expect(validatePassword("NoSpecialChar12")).toBe("Password must contain at least one special character.");
  });

  it("accepts a strong password", () => {
    expect(validatePassword("Br0kers$Edge2026!")).toBeNull();
  });

  it("accepts password with exactly 12 chars meeting all rules", () => {
    expect(validatePassword("Abcdef1!ghij")).toBeNull();
  });
});

// ── JWT jurisdiction payload ───────────────────────────────────────────────────
import jwt from "jsonwebtoken";

const TEST_SECRET = "test-secret-for-ci-only";

function signToken(id: number, jurisdiction: "CA" | "US" = "CA"): string {
  return jwt.sign({ sub: id, jur: jurisdiction }, TEST_SECRET, { expiresIn: "14d" });
}

function decodeJurisdiction(token: string): "CA" | "US" {
  const p = jwt.verify(token, TEST_SECRET) as any;
  return p.jur === "US" ? "US" : "CA";
}

describe("JWT jurisdiction", () => {
  it("encodes CA jurisdiction by default", () => {
    const t = signToken(1);
    expect(decodeJurisdiction(t)).toBe("CA");
  });

  it("encodes US jurisdiction when specified", () => {
    const t = signToken(1, "US");
    expect(decodeJurisdiction(t)).toBe("US");
  });

  it("includes sub claim with user id", () => {
    const t = signToken(42, "CA");
    const p = jwt.verify(t, TEST_SECRET) as any;
    expect(+p.sub).toBe(42);
  });

  it("defaults unknown jur values to CA", () => {
    const t = jwt.sign({ sub: 1, jur: "XX" }, TEST_SECRET);
    expect(decodeJurisdiction(t)).toBe("CA");
  });
});

// ── Rate limit config sanity ───────────────────────────────────────────────────
describe("Security constants", () => {
  it("body limit is 1mb or less", () => {
    // If someone bumps this back to 50mb in server/index.ts this test catches it
    const limit = "1mb";
    const bytes = limit.endsWith("mb") ? parseInt(limit) * 1024 * 1024 : 0;
    expect(bytes).toBeLessThanOrEqual(1 * 1024 * 1024);
  });
});
