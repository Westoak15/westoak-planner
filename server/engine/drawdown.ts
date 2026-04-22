/**
 * RRSP/TFSA/Non-Reg Drawdown Strategy Engine
 * Simulates three strategies year-by-year from retirement to end of plan
 */

export interface DrawdownInput {
  currentAge:              number;
  retirementAge:           number;
  lifeExpectancy:          number;
  province:                string;
  rrspBalance:             number;
  tfsaBalance:             number;
  nonRegBalance:           number;
  nonRegAcb:               number;
  desiredAnnualIncome:     number;   // gross target
  cppAnnual:               number;   // CPP at start age
  oasAnnual:               number;   // OAS at start age
  cppStartAge:             number;
  oasStartAge:             number;
  pensionIncome:           number;   // other pension
  expectedReturn:          number;   // decimal e.g. 0.06
  inflationRate:           number;   // decimal e.g. 0.02
  bpa:                     number;   // basic personal amount (default 16129)
}

export interface DrawdownYear {
  age:            number;
  year:           number;
  rrspBalance:    number;
  tfsaBalance:    number;
  nonRegBalance:  number;
  totalWealth:    number;
  rrspWithdrawal: number;
  tfsaWithdrawal: number;
  nonRegWithdrawal: number;
  cppIncome:      number;
  oasIncome:      number;
  pensionIncome:  number;
  totalIncome:    number;
  federalTax:     number;
  provincialTax:  number;
  totalTax:       number;
  effectiveRate:  number;
  afterTaxIncome: number;
  rrifMinimum:    number;
}

export interface DrawdownResult {
  strategy:         "rrsp_first" | "tfsa_first" | "blended";
  strategyLabel:    string;
  years:            DrawdownYear[];
  totalLifetimeTax: number;
  totalAfterTax:    number;
  finalWealth:      number;
  wealthAtAge90:    number;
  portfolioLasts:   number | null;  // age when money runs out, or null if survives
  averageEffRate:   number;
  taxSavingsVsWorst?: number;
}

// ── Federal 2025 brackets ─────────────────────────────────────────────────────
const FED = [
  { min: 0,      max: 57375,  rate: 0.15  },
  { min: 57375,  max: 114750, rate: 0.205 },
  { min: 114750, max: 177882, rate: 0.26  },
  { min: 177882, max: 253414, rate: 0.29  },
  { min: 253414, max: Infinity, rate: 0.33 },
];

// Provincial top brackets (simplified — use marginal for quick calc)
const PROV: Record<string, { brackets: { min: number; max: number; rate: number }[] }> = {
  ON: { brackets: [
    { min: 0,      max: 52886,  rate: 0.0505 },
    { min: 52886,  max: 105775, rate: 0.0915 },
    { min: 105775, max: 150000, rate: 0.1116 },
    { min: 150000, max: 220000, rate: 0.1216 },
    { min: 220000, max: Infinity, rate: 0.1316 },
  ]},
  BC: { brackets: [
    { min: 0,      max: 49279,  rate: 0.0506 },
    { min: 49279,  max: 98560,  rate: 0.077  },
    { min: 98560,  max: 113158, rate: 0.105  },
    { min: 113158, max: 137407, rate: 0.1229 },
    { min: 137407, max: 186306, rate: 0.147  },
    { min: 186306, max: 259829, rate: 0.168  },
    { min: 259829, max: Infinity, rate: 0.205 },
  ]},
  AB: { brackets: [
    { min: 0,      max: 60000,  rate: 0.08  },
    { min: 60000,  max: 151234, rate: 0.10  },
    { min: 151234, max: 181481, rate: 0.12  },
    { min: 181481, max: 241974, rate: 0.13  },
    { min: 241974, max: 362961, rate: 0.14  },
    { min: 362961, max: Infinity, rate: 0.15 },
  ]},
  QC: { brackets: [
    { min: 0,      max: 53255,  rate: 0.14   },
    { min: 53255,  max: 106495, rate: 0.19   },
    { min: 106495, max: 129590, rate: 0.24   },
    { min: 129590, max: Infinity, rate: 0.2575 },
  ]},
};

// Default provincial brackets for provinces not listed
const DEFAULT_PROV_RATE = 0.10;

function taxFromBrackets(income: number, brackets: { min: number; max: number; rate: number }[]): number {
  let tax = 0;
  for (const b of brackets) {
    if (income <= b.min) break;
    tax += (Math.min(income, b.max) - b.min) * b.rate;
  }
  return tax;
}

function calcTax(taxableIncome: number, province: string, bpa: number): { federal: number; provincial: number } {
  const fedTaxable = Math.max(0, taxableIncome - bpa);
  const federal    = taxFromBrackets(fedTaxable, FED);
  const provKey    = province.toUpperCase().substring(0, 2);
  const provData   = PROV[provKey];
  const provincial = provData
    ? taxFromBrackets(taxableIncome, provData.brackets)
    : taxableIncome * DEFAULT_PROV_RATE;
  return { federal, provincial };
}

// RRIF minimum withdrawal factors
function rrifMinFactor(age: number): number {
  if (age < 71) return 1 / Math.max(1, 90 - age);
  const factors: Record<number, number> = {
    71: 0.0528, 72: 0.0540, 73: 0.0553, 74: 0.0567,
    75: 0.0582, 76: 0.0598, 77: 0.0617, 78: 0.0636,
    79: 0.0658, 80: 0.0682, 81: 0.0708, 82: 0.0738,
    83: 0.0771, 84: 0.0808, 85: 0.0851, 86: 0.0899,
    87: 0.0955, 88: 0.1021, 89: 0.1099, 90: 0.1192,
    91: 0.1306, 92: 0.1449, 93: 0.1634, 94: 0.1879,
  };
  return factors[Math.min(age, 94)] ?? 0.20;
}

// ── Core simulation ───────────────────────────────────────────────────────────
function simulate(
  inp: DrawdownInput,
  strategy: "rrsp_first" | "tfsa_first" | "blended"
): DrawdownResult {
  const years: DrawdownYear[] = [];
  const currentYear = new Date().getFullYear();
  const retireYear  = currentYear + (inp.retirementAge - inp.currentAge);

  let rrsp    = inp.rrspBalance;
  let tfsa    = inp.tfsaBalance;
  let nonReg  = inp.nonRegBalance;
  let nonRegAcb = inp.nonRegAcb;
  const r     = inp.expectedReturn;
  const inf   = inp.inflationRate;

  let totalTax = 0, totalAfterTax = 0;

  for (let age = inp.retirementAge; age <= inp.lifeExpectancy; age++) {
    const year = retireYear + (age - inp.retirementAge);
    const yearsIntoRetirement = age - inp.retirementAge;

    // Grow balances at start of year
    rrsp   *= (1 + r);
    tfsa   *= (1 + r);
    nonReg *= (1 + r);
    // Non-reg ACB grows by return * ACB proportion
    const nonRegGain = nonReg > 0 ? nonReg * r * (1 - nonRegAcb / Math.max(nonReg, 1)) : 0;

    // Inflation-adjusted income need
    const incomeNeed = inp.desiredAnnualIncome * Math.pow(1 + inf, yearsIntoRetirement);

    // Government income
    const cpp = age >= inp.cppStartAge ? inp.cppAnnual * Math.pow(1 + inf, Math.max(0, age - inp.cppStartAge)) : 0;
    const oas = age >= inp.oasStartAge ? inp.oasAnnual * Math.pow(1 + inf, Math.max(0, age - inp.oasStartAge)) : 0;
    const pen = inp.pensionIncome * Math.pow(1 + inf, yearsIntoRetirement);
    const govIncome = cpp + oas + pen;

    // RRIF minimum
    const rrifMin = age >= 71 ? rrsp * rrifMinFactor(age) : 0;

    // Gap to fill from registered/non-reg
    const gap = Math.max(0, incomeNeed - govIncome);

    let rrspW = 0, tfsaW = 0, nonRegW = 0;

    if (strategy === "rrsp_first") {
      // Take RRIF min first, then fill gap from RRSP, then TFSA, then non-reg
      rrspW = Math.min(rrsp, Math.max(rrifMin, gap));
      const remaining = Math.max(0, gap - rrspW);
      tfsaW   = Math.min(tfsa, remaining);
      nonRegW = Math.min(nonReg, Math.max(0, remaining - tfsaW));

    } else if (strategy === "tfsa_first") {
      // Take RRIF min first, then fill gap from TFSA, then RRSP
      rrspW = rrifMin;
      const remaining = Math.max(0, gap - rrspW);
      tfsaW   = Math.min(tfsa, remaining);
      nonRegW = Math.min(nonReg, Math.max(0, remaining - tfsaW));
      // If still short, take more RRSP
      const stillShort = Math.max(0, gap - rrspW - tfsaW - nonRegW);
      rrspW = Math.min(rrsp, rrspW + stillShort);

    } else {
      // Blended: fill lower federal brackets, take TFSA for the rest
      // Strategy: take RRSP up to first bracket threshold (~$57k after BPA)
      const rrspTarget = Math.min(
        Math.max(rrifMin, Math.min(57375, govIncome + gap) - govIncome),
        gap,
        rrsp
      );
      rrspW = Math.max(rrifMin, rrspTarget);
      rrspW = Math.min(rrsp, rrspW);
      const remaining = Math.max(0, gap - rrspW);
      tfsaW   = Math.min(tfsa, remaining);
      nonRegW = Math.min(nonReg, Math.max(0, remaining - tfsaW));
      // If still short, take more RRSP
      const stillShort = Math.max(0, gap - rrspW - tfsaW - nonRegW);
      rrspW = Math.min(rrsp, rrspW + stillShort);
    }

    // Apply withdrawals
    rrsp   -= rrspW;
    tfsa   -= tfsaW;
    nonReg -= nonRegW;

    // Tax calculation — RRSP/RRIF withdrawals are fully taxable, non-reg gain is 50% taxable
    const nonRegTaxable = nonRegW > 0 && nonReg > 0
      ? nonRegW * 0.5 * (nonRegGain / Math.max(nonReg + nonRegW, 1))
      : 0;
    const taxableIncome = govIncome + rrspW + nonRegTaxable;
    const { federal, provincial } = calcTax(taxableIncome, inp.province, inp.bpa);
    const tax = federal + provincial;

    const totalIncome = govIncome + rrspW + tfsaW + nonRegW;
    const afterTax = totalIncome - tax;

    totalTax      += tax;
    totalAfterTax += afterTax;

    // Update ACB
    if (nonRegW > 0) {
      nonRegAcb = Math.max(0, nonRegAcb * (1 - nonRegW / Math.max(nonReg + nonRegW, 1)));
    }

    years.push({
      age, year,
      rrspBalance:    Math.round(rrsp),
      tfsaBalance:    Math.round(tfsa),
      nonRegBalance:  Math.round(nonReg),
      totalWealth:    Math.round(rrsp + tfsa + nonReg),
      rrspWithdrawal: Math.round(rrspW),
      tfsaWithdrawal: Math.round(tfsaW),
      nonRegWithdrawal: Math.round(nonRegW),
      cppIncome:      Math.round(cpp),
      oasIncome:      Math.round(oas),
      pensionIncome:  Math.round(pen),
      totalIncome:    Math.round(totalIncome),
      federalTax:     Math.round(federal),
      provincialTax:  Math.round(provincial),
      totalTax:       Math.round(tax),
      effectiveRate:  totalIncome > 0 ? tax / totalIncome : 0,
      afterTaxIncome: Math.round(afterTax),
      rrifMinimum:    Math.round(rrifMin),
    });

    if (rrsp + tfsa + nonReg <= 0) break;
  }

  const portfolioLasts = years.find(y => y.totalWealth <= 0)?.age ?? null;
  const atAge90 = years.find(y => y.age >= 90);
  const finalYear = years[years.length - 1];

  const labelMap = {
    rrsp_first: "RRSP First",
    tfsa_first: "TFSA First",
    blended:    "Blended (Optimal)",
  };

  return {
    strategy,
    strategyLabel:    labelMap[strategy],
    years,
    totalLifetimeTax: Math.round(totalTax),
    totalAfterTax:    Math.round(totalAfterTax),
    finalWealth:      finalYear ? finalYear.totalWealth : 0,
    wealthAtAge90:    atAge90 ? atAge90.totalWealth : 0,
    portfolioLasts,
    averageEffRate:   years.length > 0
      ? years.reduce((s, y) => s + y.effectiveRate, 0) / years.length
      : 0,
  };
}

export function runDrawdownStrategies(inp: DrawdownInput): {
  rrspFirst: DrawdownResult;
  tfsaFirst: DrawdownResult;
  blended:   DrawdownResult;
} {
  const rrspFirst = simulate(inp, "rrsp_first");
  const tfsaFirst = simulate(inp, "tfsa_first");
  const blended   = simulate(inp, "blended");

  // Calculate tax savings vs worst strategy
  const worstTax = Math.max(rrspFirst.totalLifetimeTax, tfsaFirst.totalLifetimeTax, blended.totalLifetimeTax);
  rrspFirst.taxSavingsVsWorst = worstTax - rrspFirst.totalLifetimeTax;
  tfsaFirst.taxSavingsVsWorst = worstTax - tfsaFirst.totalLifetimeTax;
  blended.taxSavingsVsWorst   = worstTax - blended.totalLifetimeTax;

  return { rrspFirst, tfsaFirst, blended };
}
