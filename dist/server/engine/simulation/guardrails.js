// ============================================================================
// FINANCIAL PLAN GUARDRAIL SYSTEM
// ============================================================================
// Continuously validates financial plans using Monte Carlo stress testing
// Flags plans that need recalculation or have low probability of success
import { runMonteCarloSimulation, PRESET_ALLOCATIONS } from "./monteCarlo.js";
// ── Guardrail Thresholds ───────────────────────────────────────────────────
export const GUARDRAIL_THRESHOLDS = {
    // Probability of success thresholds
    CRITICAL: 0.50, // Below 50% = critical risk
    WARNING: 0.70, // Below 70% = warning
    GOOD: 0.85, // Above 85% = good shape
    EXCELLENT: 0.95, // Above 95% = excellent
    // Deviation thresholds for triggering recalculation
    INCOME_CHANGE: 0.10, // 10% change in income
    ASSET_CHANGE: 0.15, // 15% change in assets
    AGE_CHANGE: 1, // 1 year passed
    CONTRIBUTION_CHANGE: 0.20, // 20% change in contributions
};
export async function runGuardrailCheck(input) {
    const issues = [];
    const recommendations = [];
    const flags = [];
    // Determine portfolio allocation
    const allocation = input.allocation || determineAllocation(input.currentAge, input.retirementAge);
    // Years to retirement
    const yearsToRetirement = input.retirementAge - input.currentAge;
    const yearsInRetirement = input.lifeExpectancy - input.retirementAge;
    // ── Accumulation Phase Simulation ────────────────────────────────────────
    const totalAssets = input.rrspBalance + input.tfsaBalance + input.nonRegBalance;
    const totalContributions = input.rrspContribution + input.tfsaContribution + input.nonRegContribution;
    const accumulationSim = runMonteCarloSimulation({
        initialBalance: totalAssets,
        allocation,
        annualContribution: totalContributions,
        yearsToSimulate: yearsToRetirement,
        numberOfPaths: 5000,
    });
    // ── Retirement Phase Simulation ──────────────────────────────────────────
    // Calculate required withdrawals in retirement
    const totalGuaranteedIncome = input.pensionIncome + input.cppAmount + input.oasAmount;
    const requiredWithdrawal = Math.max(0, input.desiredRetirementIncome - totalGuaranteedIncome);
    // Use median accumulation result as starting point
    const retirementStartBalance = accumulationSim.percentiles.p50[yearsToRetirement];
    // Shift to more conservative allocation in retirement
    const retirementAllocation = shiftToConservative(allocation);
    const retirementSim = runMonteCarloSimulation({
        initialBalance: retirementStartBalance,
        allocation: retirementAllocation,
        annualContribution: -requiredWithdrawal, // Negative = withdrawal
        yearsToSimulate: yearsInRetirement,
        numberOfPaths: 5000,
    });
    const probabilityOfSuccess = retirementSim.probabilityOfSuccess;
    // ── Analyze Results ──────────────────────────────────────────────────────
    // Check probability thresholds
    if (probabilityOfSuccess < GUARDRAIL_THRESHOLDS.CRITICAL) {
        issues.push(`Critical: Only ${(probabilityOfSuccess * 100).toFixed(0)}% chance of funding retirement`);
        recommendations.push("Increase savings rate immediately or reduce retirement income target");
        recommendations.push("Consider working 2-3 years longer to improve odds");
    }
    else if (probabilityOfSuccess < GUARDRAIL_THRESHOLDS.WARNING) {
        issues.push(`Warning: ${(probabilityOfSuccess * 100).toFixed(0)}% chance of meeting retirement goals`);
        recommendations.push("Increase monthly contributions by 10-20%");
        recommendations.push("Review portfolio allocation for age-appropriate risk");
    }
    else if (probabilityOfSuccess < GUARDRAIL_THRESHOLDS.GOOD) {
        issues.push(`Moderate risk: ${(probabilityOfSuccess * 100).toFixed(0)}% success probability`);
        recommendations.push("Consider small increases to savings to improve margin of safety");
    }
    // Check if assets are on track
    const yearsElapsed = Math.min(5, yearsToRetirement);
    const expectedValue = accumulationSim.expectedValue[yearsElapsed];
    const tenthPercentile = accumulationSim.percentiles.p10[yearsElapsed];
    if (totalAssets < tenthPercentile * 0.8) {
        issues.push("Assets below 10th percentile projection - behind target");
        recommendations.push("Review spending and increase savings rate");
    }
    // Check contribution adequacy
    const savingsRate = totalContributions / input.annualIncome;
    const recommendedRate = yearsToRetirement > 20 ? 0.15 : 0.20;
    if (savingsRate < recommendedRate) {
        issues.push(`Savings rate of ${(savingsRate * 100).toFixed(0)}% is below ` +
            `recommended ${(recommendedRate * 100).toFixed(0)}%`);
        recommendations.push(`Increase annual savings by $${((recommendedRate - savingsRate) * input.annualIncome).toFixed(0)}`);
    }
    // Check allocation appropriateness
    const equityAllocation = allocation.canEquity + allocation.usEquity + allocation.intlEquity;
    const recommendedEquity = Math.max(0.20, Math.min(0.90, (100 - input.currentAge) / 100));
    if (Math.abs(equityAllocation - recommendedEquity) > 0.15) {
        issues.push(`Equity allocation of ${(equityAllocation * 100).toFixed(0)}% may not be ` +
            `age-appropriate (recommended: ${(recommendedEquity * 100).toFixed(0)}%)`);
        if (equityAllocation < recommendedEquity) {
            recommendations.push("Consider increasing equity allocation for better growth potential");
        }
        else {
            recommendations.push("Consider reducing equity allocation to lower volatility risk");
        }
    }
    // Determine overall health
    let health;
    if (probabilityOfSuccess >= GUARDRAIL_THRESHOLDS.EXCELLENT) {
        health = "excellent";
    }
    else if (probabilityOfSuccess >= GUARDRAIL_THRESHOLDS.GOOD) {
        health = "good";
    }
    else if (probabilityOfSuccess >= GUARDRAIL_THRESHOLDS.WARNING) {
        health = "warning";
    }
    else {
        health = "critical";
    }
    return {
        health,
        probabilityOfSuccess,
        issues,
        recommendations,
        lastChecked: new Date(),
        nextCheckDue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    };
}
// ── Allocation Helpers ─────────────────────────────────────────────────────
function determineAllocation(currentAge, retirementAge) {
    const yearsToRetirement = retirementAge - currentAge;
    if (yearsToRetirement > 20) {
        return PRESET_ALLOCATIONS.AGGRESSIVE;
    }
    else if (yearsToRetirement > 10) {
        return PRESET_ALLOCATIONS.BALANCED;
    }
    else if (yearsToRetirement > 5) {
        return PRESET_ALLOCATIONS.MODERATE;
    }
    else {
        return PRESET_ALLOCATIONS.CONSERVATIVE;
    }
}
function shiftToConservative(allocation) {
    // Reduce equity by 20 percentage points, increase fixed income
    const equityReduction = 0.20;
    const totalEquity = allocation.canEquity + allocation.usEquity + allocation.intlEquity;
    const scaleFactor = Math.max(0, totalEquity - equityReduction) / totalEquity;
    return {
        canEquity: allocation.canEquity * scaleFactor,
        usEquity: allocation.usEquity * scaleFactor,
        intlEquity: allocation.intlEquity * scaleFactor,
        fixedIncome: allocation.fixedIncome + equityReduction,
        cash: allocation.cash,
    };
}
export function detectSignificantChanges(previous, current) {
    const flags = [];
    // Income change
    const incomeChange = Math.abs(current.income - previous.income) / previous.income;
    if (incomeChange > GUARDRAIL_THRESHOLDS.INCOME_CHANGE) {
        flags.push({
            id: `income_${Date.now()}`,
            type: "income_changed",
            severity: "warning",
            message: `Income changed by ${(incomeChange * 100).toFixed(0)}% - plan should be recalculated`,
            createdAt: new Date(),
            metadata: { previous: previous.income, current: current.income },
        });
    }
    // Asset change
    const assetChange = Math.abs(current.assets - previous.assets) / previous.assets;
    if (assetChange > GUARDRAIL_THRESHOLDS.ASSET_CHANGE) {
        flags.push({
            id: `assets_${Date.now()}`,
            type: "assets_changed",
            severity: "info",
            message: `Assets changed by ${(assetChange * 100).toFixed(0)}% - consider updating plan`,
            createdAt: new Date(),
            metadata: { previous: previous.assets, current: current.assets },
        });
    }
    // Age milestone
    if (current.age - previous.age >= GUARDRAIL_THRESHOLDS.AGE_CHANGE) {
        flags.push({
            id: `age_${Date.now()}`,
            type: "age_milestone",
            severity: "info",
            message: "Annual review recommended - age has changed",
            createdAt: new Date(),
            metadata: { previous: previous.age, current: current.age },
        });
    }
    // Contribution change
    const contribChange = Math.abs(current.contributions - previous.contributions) / previous.contributions;
    if (contribChange > GUARDRAIL_THRESHOLDS.CONTRIBUTION_CHANGE) {
        flags.push({
            id: `contrib_${Date.now()}`,
            type: "contribution_changed",
            severity: "warning",
            message: `Contributions changed by ${(contribChange * 100).toFixed(0)}% - recalculation recommended`,
            createdAt: new Date(),
            metadata: { previous: previous.contributions, current: current.contributions },
        });
    }
    return flags;
}
