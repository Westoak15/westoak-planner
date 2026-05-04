/**
 * server/fpUtils.ts  ← place here, alongside server/index.ts
 *
 * Shared utilities for fp.ts, fp-full.ts, simulate.ts.
 * Eliminates three copies of ownsClient() and two copies of safe().
 *
 * Import from any route file:
 *   import { safe, ownsClient, ownsPlan } from "../fpUtils.js";
 */

import { db } from "./db/index.js";
import { clients, financialPlans, users } from "../shared/schema.js";
import { and, eq, inArray } from "drizzle-orm";

/**
 * Returns the set of user IDs whose data the given user can access.
 * GA users can access their own data + all of their FAs' data.
 * FA / standard users only access their own data.
 */
async function accessibleUserIds(userId: number): Promise<number[]> {
  const [me] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  if (me?.role === "ga") {
    const fas = await db.select({ id: users.id }).from(users).where(eq(users.gaId, userId));
    return [userId, ...fas.map(f => f.id)];
  }
  return [userId];
}

// Numeric columns: coerce empty string → "0" rather than null.
const ZERO_FIELDS = new Set([
  "annualContribution", "currentRrsp", "currentTfsa", "currentNonReg",
  "currentNonRegAcb", "expectedReturn", "inflationRate", "desiredIncome",
  "cppMonthly", "oasMonthly", "coverageAmount", "premium",
  "monthlyAmount", "retirementAdjustmentPct",
  "value", "balance", "rrspBalance", "tfsaBalance", "nonRegBalance",
]);

// Text columns: blank stays as empty string, not null.
const TEXT_FIELDS = new Set([
  "label", "name", "notes", "description", "type", "category", "status",
  "owner", "province", "occupation", "phone", "email", "method", "frequency",
  "premiumFrequency", "accountType", "beneficiary", "policyNumber",
  "provider", "insured", "inforceDate", "renewalDate", "relationship",
  "title", "content", "priority",
]);

/**
 * Strip server-managed fields from a client payload and coerce empty strings
 * to null (text) or "0" (numeric), preventing Drizzle insert/update errors.
 */
export function safe(body: any): Record<string, unknown> {
  const {
    id, createdAt, updatedAt, userId, clientId, planId, calculatedAt,
    ...rest
  } = body;
  for (const key of Object.keys(rest)) {
    if (rest[key] === "") {
      if (ZERO_FIELDS.has(key))       rest[key] = "0";
      else if (!TEXT_FIELDS.has(key)) rest[key] = null;
    }
  }
  return rest;
}

/**
 * Returns true if the given client is owned by the given user OR — when the
 * user is a GA — by one of the GA's FAs.
 */
export async function ownsClient(clientId: number, userId: number): Promise<boolean> {
  const ids = await accessibleUserIds(userId);
  const [c] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, clientId), inArray(clients.userId, ids)));
  return !!c;
}

/**
 * Returns the plan row if it belongs to the user (or, for GAs, to one of their
 * FAs), or null.
 */
export async function ownsPlan(
  planId: number,
  userId: number,
): Promise<{ id: number; clientId: number } | null> {
  const ids = await accessibleUserIds(userId);
  const [p] = await db
    .select({ id: financialPlans.id, clientId: financialPlans.clientId })
    .from(financialPlans)
    .where(and(eq(financialPlans.id, planId), inArray(financialPlans.userId, ids)));
  return p ?? null;
}