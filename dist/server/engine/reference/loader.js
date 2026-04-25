import { BENEFIT_RATES_2024, RRIF_MINIMUM_FACTORS, } from "./benefitRates.js";
import { ALL_PROVINCIAL_BRACKETS_2024, } from "./taxBrackets.js";
let cachedData = null;
export function loadReferenceDataFromDb(dbBrackets, dbRates) {
    const benefitRates = new Map();
    for (const row of dbRates) {
        benefitRates.set(row.rateKey, {
            key: row.rateKey,
            label: row.label,
            value: parseFloat(row.value),
            effectiveYear: row.effectiveYear,
            category: row.category,
        });
    }
    const taxBrackets = new Map();
    for (const row of dbBrackets) {
        const bracket = {
            province: row.province,
            minIncome: parseFloat(row.minIncome),
            maxIncome: row.maxIncome !== null ? parseFloat(row.maxIncome) : null,
            rate: parseFloat(row.rate),
            effectiveYear: row.effectiveYear,
        };
        const existing = taxBrackets.get(row.province) ?? [];
        existing.push(bracket);
        taxBrackets.set(row.province, existing);
    }
    const provinces = Array.from(taxBrackets.keys());
    for (const province of provinces) {
        const brackets = taxBrackets.get(province);
        taxBrackets.set(province, brackets.sort((a, b) => a.minIncome - b.minIncome));
    }
    cachedData = {
        benefitRates,
        taxBrackets,
        rrifFactors: { ...RRIF_MINIMUM_FACTORS },
        loadedAt: new Date(),
    };
    return cachedData;
}
export function loadReferenceDataFromConstants() {
    const benefitRates = new Map();
    for (const rate of BENEFIT_RATES_2024) {
        benefitRates.set(rate.key, rate);
    }
    const taxBrackets = new Map();
    for (const [province, brackets] of Object.entries(ALL_PROVINCIAL_BRACKETS_2024)) {
        taxBrackets.set(province, [...brackets]);
    }
    cachedData = {
        benefitRates,
        taxBrackets,
        rrifFactors: { ...RRIF_MINIMUM_FACTORS },
        loadedAt: new Date(),
    };
    return cachedData;
}
export function getReferenceData() {
    if (!cachedData) {
        return loadReferenceDataFromConstants();
    }
    return cachedData;
}
export function getBenefitRate(key) {
    const cache = getReferenceData();
    const rate = cache.benefitRates.get(key);
    if (!rate) {
        throw new Error(`Benefit rate not found in cache: ${key}`);
    }
    return rate.value;
}
export function getTaxBrackets(province) {
    const cache = getReferenceData();
    const brackets = cache.taxBrackets.get(province);
    if (!brackets) {
        return cache.taxBrackets.get("ON") ?? [];
    }
    return brackets;
}
export function getAvailableProvinces() {
    const cache = getReferenceData();
    return Array.from(cache.taxBrackets.keys()).filter((k) => k !== "federal");
}
export function isCacheLoaded() {
    return cachedData !== null;
}
export function getCachedRrifFactor(age) {
    const cache = getReferenceData();
    if (age < 71)
        return 0;
    if (age >= 95)
        return cache.rrifFactors[95] ?? 0.20;
    return cache.rrifFactors[age] ?? 0;
}
export function getCachedRrifWithdrawal(age, balance) {
    return balance * getCachedRrifFactor(age);
}
