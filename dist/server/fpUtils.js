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
import { clients, financialPlans } from "../shared/schema.js";
import { and, eq } from "drizzle-orm";
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
export function safe(body) {
    const { id, createdAt, updatedAt, userId, clientId, planId, calculatedAt, ...rest } = body;
    for (const key of Object.keys(rest)) {
        if (rest[key] === "") {
            if (ZERO_FIELDS.has(key))
                rest[key] = "0";
            else if (!TEXT_FIELDS.has(key))
                rest[key] = null;
        }
    }
    return rest;
}
/**
 * Returns true if the given client belongs to the given user.
 */
export async function ownsClient(clientId, userId) {
    const [c] = await db
        .select({ id: clients.id })
        .from(clients)
        .where(and(eq(clients.id, clientId), eq(clients.userId, userId)));
    return !!c;
}
/**
 * Returns the plan row if it belongs to the user, or null.
 */
export async function ownsPlan(planId, userId) {
    const [p] = await db
        .select({ id: financialPlans.id, clientId: financialPlans.clientId })
        .from(financialPlans)
        .where(and(eq(financialPlans.id, planId), eq(financialPlans.userId, userId)));
    return p ?? null;
}
