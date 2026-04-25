// ============================================================================
// SIMULATION ENGINE - PUBLIC API
// ============================================================================
export { runMonteCarloSimulation, ASSET_CLASSES, CORRELATION_MATRIX, PRESET_ALLOCATIONS, } from "./monteCarlo.js";
export { runGuardrailCheck, detectSignificantChanges, GUARDRAIL_THRESHOLDS, } from "./guardrails.js";
export { choleskyDecomposition, matrixMultiply, transpose, matrixMatrixMultiply, verifyCholesky, correlationToCovariance, } from "./matrix.js";
export { randomNormal, randomUniform, randomExponential, randomLogNormal, SeededRandom, randomChoice, randomSample, shuffle, } from "./random.js";
