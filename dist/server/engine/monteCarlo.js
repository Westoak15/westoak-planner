import { choleskyDecompose, generateCorrelatedReturns, createSeededRng, DEFAULT_CORRELATIONS, } from "./cholesky";
export function runSimulation(assumptions, initialState, stepFn, successCriteria, includeSensitivity = true) {
    if (assumptions.simulationCount < 1000 || assumptions.simulationCount > 10000) {
        throw new Error(`Simulation count must be between 1,000 and 10,000 (got ${assumptions.simulationCount})`);
    }
    if (assumptions.yearsToProject < 1) {
        throw new Error(`Years to project must be at least 1 (got ${assumptions.yearsToProject})`);
    }
    const correlations = assumptions.correlations ?? DEFAULT_CORRELATIONS;
    const L = choleskyDecompose(correlations);
    const baseSeed = assumptions.seed ?? Date.now();
    const paths = [];
    for (let sim = 0; sim < assumptions.simulationCount; sim++) {
        const rng = createSeededRng(baseSeed + sim);
        let currentState = {
            ...initialState,
            year: 0,
            returns: { equity: 0, bond: 0, inflation: 0 },
            inflationCumulative: 1.0,
            success: true,
        };
        const yearlyStates = [{ ...currentState }];
        for (let year = 1; year <= assumptions.yearsToProject; year++) {
            const returns = generateCorrelatedReturns(L, {
                equity: assumptions.equity,
                bond: assumptions.bond,
                inflation: assumptions.inflation,
            }, rng);
            const nextState = {
                ...currentState,
                year,
                returns,
                inflationCumulative: currentState.inflationCumulative * (1 + returns.inflation),
            };
            const stepped = stepFn(nextState, returns, sim);
            currentState = stepped;
            yearlyStates.push({ ...currentState });
        }
        const path = {
            years: yearlyStates,
            finalBalance: currentState.balance,
            success: currentState.success,
        };
        if (successCriteria) {
            path.success = successCriteria(path);
        }
        paths.push(path);
    }
    const successCount = paths.filter((p) => p.success).length;
    const successRate = successCount / paths.length;
    const percentileBands = computePercentileBands(paths, assumptions.yearsToProject);
    const finalBalances = paths.map((p) => p.finalBalance).sort((a, b) => a - b);
    const finalBalancePercentiles = {
        p10: percentileValue(finalBalances, 0.1),
        p25: percentileValue(finalBalances, 0.25),
        p50: percentileValue(finalBalances, 0.5),
        p75: percentileValue(finalBalances, 0.75),
        p90: percentileValue(finalBalances, 0.9),
    };
    const medianPath = percentileBands.p50;
    const sensitivity = includeSensitivity
        ? runSensitivityAnalysis(assumptions, initialState, stepFn, successCriteria, successRate)
        : [];
    return {
        successRate,
        percentileBands,
        finalBalancePercentiles,
        medianPath,
        sensitivity,
        simulationCount: assumptions.simulationCount,
        yearsProjected: assumptions.yearsToProject,
    };
}
function computePercentileBands(paths, years) {
    const bands = {
        p10: [],
        p25: [],
        p50: [],
        p75: [],
        p90: [],
    };
    for (let y = 0; y <= years; y++) {
        const balances = paths
            .map((p) => (p.years[y] ? p.years[y].balance : 0))
            .sort((a, b) => a - b);
        bands.p10.push(percentileValue(balances, 0.1));
        bands.p25.push(percentileValue(balances, 0.25));
        bands.p50.push(percentileValue(balances, 0.5));
        bands.p75.push(percentileValue(balances, 0.75));
        bands.p90.push(percentileValue(balances, 0.9));
    }
    return bands;
}
function percentileValue(sorted, percentile) {
    if (sorted.length === 0)
        return 0;
    const index = percentile * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper)
        return sorted[lower];
    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}
function runSensitivityAnalysis(baseAssumptions, initialState, stepFn, successCriteria, baseSuccessRate) {
    const results = [];
    const quickSimCount = Math.max(1000, Math.min(baseAssumptions.simulationCount, 2000));
    const shifts = [
        {
            parameter: "Equity Return (+1%)",
            baseValue: baseAssumptions.equity.mean,
            shiftedValue: baseAssumptions.equity.mean + 0.01,
            modify: (a) => ({ ...a, equity: { ...a.equity, mean: a.equity.mean + 0.01 } }),
        },
        {
            parameter: "Equity Return (-1%)",
            baseValue: baseAssumptions.equity.mean,
            shiftedValue: baseAssumptions.equity.mean - 0.01,
            modify: (a) => ({ ...a, equity: { ...a.equity, mean: a.equity.mean - 0.01 } }),
        },
        {
            parameter: "Equity Volatility (+3%)",
            baseValue: baseAssumptions.equity.volatility,
            shiftedValue: baseAssumptions.equity.volatility + 0.03,
            modify: (a) => ({ ...a, equity: { ...a.equity, volatility: a.equity.volatility + 0.03 } }),
        },
        {
            parameter: "Inflation (+0.5%)",
            baseValue: baseAssumptions.inflation.mean,
            shiftedValue: baseAssumptions.inflation.mean + 0.005,
            modify: (a) => ({ ...a, inflation: { ...a.inflation, mean: a.inflation.mean + 0.005 } }),
        },
    ];
    for (const shift of shifts) {
        const shiftedAssumptions = shift.modify({
            ...baseAssumptions,
            simulationCount: quickSimCount,
        });
        const shiftedResult = runSimulation({ ...shiftedAssumptions, simulationCount: quickSimCount }, initialState, stepFn, successCriteria, false);
        results.push({
            parameter: shift.parameter,
            baseValue: shift.baseValue,
            shiftedValue: shift.shiftedValue,
            baseSuccessRate,
            shiftedSuccessRate: shiftedResult.successRate,
            impact: shiftedResult.successRate - baseSuccessRate,
        });
    }
    return results;
}
export const MODERATE_ASSUMPTIONS = {
    equity: { mean: 0.07, volatility: 0.15 },
    bond: { mean: 0.035, volatility: 0.05 },
    inflation: { mean: 0.02, volatility: 0.01 },
};
export const CONSERVATIVE_ASSUMPTIONS = {
    equity: { mean: 0.055, volatility: 0.12 },
    bond: { mean: 0.03, volatility: 0.04 },
    inflation: { mean: 0.02, volatility: 0.01 },
};
export const AGGRESSIVE_ASSUMPTIONS = {
    equity: { mean: 0.085, volatility: 0.18 },
    bond: { mean: 0.04, volatility: 0.06 },
    inflation: { mean: 0.02, volatility: 0.01 },
};
