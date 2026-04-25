// ============================================================================
// MONTE CARLO SIMULATION ENGINE WITH CHOLESKY DECOMPOSITION
// ============================================================================
// Generates correlated asset returns for stress-testing financial plans
// Uses Cholesky decomposition to preserve correlation structure between assets
import { randomNormal } from "./random.js";
import { choleskyDecomposition, matrixMultiply } from "./matrix.js";
export const ASSET_CLASSES = {
    CAN_EQUITY: {
        name: "Canadian Equity",
        meanReturn: 0.075, // 7.5% long-term average
        volatility: 0.18, // 18% standard deviation
    },
    US_EQUITY: {
        name: "US Equity",
        meanReturn: 0.095, // 9.5% long-term average
        volatility: 0.20, // 20% standard deviation
    },
    INTL_EQUITY: {
        name: "International Equity",
        meanReturn: 0.080, // 8.0% long-term average
        volatility: 0.19, // 19% standard deviation
    },
    FIXED_INCOME: {
        name: "Fixed Income",
        meanReturn: 0.040, // 4.0% long-term average
        volatility: 0.06, // 6% standard deviation
    },
    CASH: {
        name: "Cash",
        meanReturn: 0.025, // 2.5% current rate
        volatility: 0.01, // 1% standard deviation
    },
};
// Asset class order for correlation matrix
const ASSET_ORDER = ["CAN_EQUITY", "US_EQUITY", "INTL_EQUITY", "FIXED_INCOME", "CASH"];
// ── Correlation Matrix ──────────────────────────────────────────────────────
// Historical correlations between asset classes
// Based on Canadian market data 2000-2024
export const CORRELATION_MATRIX = [
    // CAN_EQ  US_EQ   INTL_EQ FIXED   CASH
    [1.00, 0.75, 0.70, 0.15, 0.05], // CAN_EQUITY
    [0.75, 1.00, 0.80, 0.20, 0.05], // US_EQUITY
    [0.70, 0.80, 1.00, 0.25, 0.05], // INTL_EQUITY
    [0.15, 0.20, 0.25, 1.00, 0.30], // FIXED_INCOME
    [0.05, 0.05, 0.05, 0.30, 1.00], // CASH
];
// ── Cholesky Decomposition for Correlated Returns ──────────────────────────
let choleskyMatrix = null;
function getCholeskyMatrix() {
    if (!choleskyMatrix) {
        choleskyMatrix = choleskyDecomposition(CORRELATION_MATRIX);
    }
    return choleskyMatrix;
}
// ── Generate Correlated Returns ────────────────────────────────────────────
function generateCorrelatedReturns() {
    const L = getCholeskyMatrix();
    // Generate independent standard normal random variables
    const z = ASSET_ORDER.map(() => randomNormal(0, 1));
    // Multiply by Cholesky matrix to get correlated variables
    const correlatedZ = matrixMultiply(L, z);
    // Convert to returns using mean and volatility
    const returns = {};
    ASSET_ORDER.forEach((asset, i) => {
        const ac = ASSET_CLASSES[asset];
        returns[asset] = ac.meanReturn + ac.volatility * correlatedZ[i];
    });
    return returns;
}
// ── Portfolio Return Calculation ───────────────────────────────────────────
function calculatePortfolioReturn(allocation, returns) {
    return (allocation.canEquity * returns.CAN_EQUITY +
        allocation.usEquity * returns.US_EQUITY +
        allocation.intlEquity * returns.INTL_EQUITY +
        allocation.fixedIncome * returns.FIXED_INCOME +
        allocation.cash * returns.CASH);
}
// ── Single Path Simulation ─────────────────────────────────────────────────
function simulatePath(params) {
    const balances = [params.initialBalance];
    let currentBalance = params.initialBalance;
    for (let year = 1; year <= params.yearsToSimulate; year++) {
        // Generate correlated returns for all asset classes
        const returns = generateCorrelatedReturns();
        // Calculate portfolio return
        const portfolioReturn = calculatePortfolioReturn(params.allocation, returns);
        // Apply return to current balance
        currentBalance = currentBalance * (1 + portfolioReturn);
        // Add contribution (or subtract withdrawal if negative)
        currentBalance += params.annualContribution;
        // Adjust for inflation if specified
        if (params.inflationRate) {
            currentBalance /= (1 + params.inflationRate);
        }
        // Floor at zero (can't have negative account balance)
        currentBalance = Math.max(0, currentBalance);
        balances.push(currentBalance);
    }
    return balances;
}
// ── Calculate Percentiles ──────────────────────────────────────────────────
function calculatePercentiles(paths, years) {
    const percentiles = {
        p10: [],
        p25: [],
        p50: [],
        p75: [],
        p90: [],
    };
    for (let year = 0; year <= years; year++) {
        const yearValues = paths.map(path => path[year]).sort((a, b) => a - b);
        const n = yearValues.length;
        percentiles.p10.push(yearValues[Math.floor(n * 0.10)]);
        percentiles.p25.push(yearValues[Math.floor(n * 0.25)]);
        percentiles.p50.push(yearValues[Math.floor(n * 0.50)]);
        percentiles.p75.push(yearValues[Math.floor(n * 0.75)]);
        percentiles.p90.push(yearValues[Math.floor(n * 0.90)]);
    }
    return percentiles;
}
// ── Main Monte Carlo Simulation ────────────────────────────────────────────
export function runMonteCarloSimulation(params) {
    // Validate allocation sums to 1
    const allocationSum = params.allocation.canEquity +
        params.allocation.usEquity +
        params.allocation.intlEquity +
        params.allocation.fixedIncome +
        params.allocation.cash;
    if (Math.abs(allocationSum - 1.0) > 0.01) {
        throw new Error(`Portfolio allocation must sum to 1.0, got ${allocationSum}`);
    }
    // Run all simulation paths
    const paths = [];
    for (let i = 0; i < params.numberOfPaths; i++) {
        paths.push(simulatePath(params));
    }
    // Calculate percentiles
    const percentiles = calculatePercentiles(paths, params.yearsToSimulate);
    // Calculate expected value (mean) for each year
    const expectedValue = [];
    for (let year = 0; year <= params.yearsToSimulate; year++) {
        const sum = paths.reduce((acc, path) => acc + path[year], 0);
        expectedValue.push(sum / paths.length);
    }
    // Calculate probability of success (not running out of money)
    const finalBalances = paths.map(path => path[path.length - 1]);
    const successfulPaths = finalBalances.filter(balance => balance > 0).length;
    const probabilityOfSuccess = successfulPaths / params.numberOfPaths;
    return {
        paths,
        percentiles,
        probabilityOfSuccess,
        expectedValue,
        metadata: {
            paths: params.numberOfPaths,
            years: params.yearsToSimulate,
            completed: new Date(),
        },
    };
}
// ── Preset Portfolio Allocations ───────────────────────────────────────────
export const PRESET_ALLOCATIONS = {
    AGGRESSIVE: {
        canEquity: 0.30,
        usEquity: 0.35,
        intlEquity: 0.25,
        fixedIncome: 0.10,
        cash: 0.00,
    },
    MODERATE: {
        canEquity: 0.20,
        usEquity: 0.25,
        intlEquity: 0.15,
        fixedIncome: 0.35,
        cash: 0.05,
    },
    CONSERVATIVE: {
        canEquity: 0.10,
        usEquity: 0.10,
        intlEquity: 0.05,
        fixedIncome: 0.55,
        cash: 0.20,
    },
    BALANCED: {
        canEquity: 0.20,
        usEquity: 0.20,
        intlEquity: 0.20,
        fixedIncome: 0.30,
        cash: 0.10,
    },
};
