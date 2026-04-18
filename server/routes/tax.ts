import { Router } from "express";
import {
  projectTaxYears,
  calculateRrspRoom,
  calculateTfsaRoom,
  analyzeCapitalGains,
  analyzeIncomeSplitting,
} from "../engine/tax/index.js";
import type {
  TaxProjectionProfile,
  RrspRoomInput,
  TfsaRoomInput,
} from "../engine/tax/types.js";

export const taxRouter = Router();

// ── Tax Projection ──────────────────────────────────────────────────────────

taxRouter.post("/:clientId/projection", async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    const input = req.body as Partial<TaxProjectionProfile>;

    // Validate required fields
    if (!input.currentAge || !input.retirementAge || !input.planToAge || !input.province) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Build complete profile with defaults
    const profile: TaxProjectionProfile = {
      currentAge: Number(input.currentAge),
      retirementAge: Number(input.retirementAge),
      planToAge: Number(input.planToAge),
      province: String(input.province),
      employmentIncome: Number(input.employmentIncome || 0),
      selfEmploymentIncome: Number(input.selfEmploymentIncome || 0),
      otherIncome: Number(input.otherIncome || 0),
      incomeGrowthRate: Number(input.incomeGrowthRate || 0.03),
      rrspBalance: Number(input.rrspBalance || 0),
      rrspContributionRoom: Number(input.rrspContributionRoom || 0),
      rrspAnnualContribution: Number(input.rrspAnnualContribution || 0),
      tfsaBalance: Number(input.tfsaBalance || 0),
      tfsaContributionRoom: Number(input.tfsaContributionRoom || 0),
      tfsaAnnualContribution: Number(input.tfsaAnnualContribution || 0),
      nonRegBalance: Number(input.nonRegBalance || 0),
      nonRegAcb: Number(input.nonRegAcb || 0),
      nonRegAnnualContrib: Number(input.nonRegAnnualContrib || 0),
      portfolioYield: Number(input.portfolioYield || 0.06),
      desiredRetirementIncome: Number(input.desiredRetirementIncome || 0),
      pensionIncome: Number(input.pensionIncome || 0),
      cppStartAge: Number(input.cppStartAge || 65),
      oasStartAge: Number(input.oasStartAge || 65),
    };

    const projections = projectTaxYears(profile);

    // Calculate summary
    const totalLifetimeTax = projections.reduce((sum, p) => sum + p.totalTax, 0);
    const totalGrossIncome = projections.reduce((sum, p) => sum + (p.employmentIncome + p.pensionIncome + p.rrifWithdrawal + p.cppBenefit + p.oasBenefit), 0);
    const averageEffectiveRate = totalGrossIncome > 0 ? totalLifetimeTax / totalGrossIncome : 0;
    const projectedFinalWealth = projections[projections.length - 1]?.totalWealth || 0;
    const successProbability = projections.every(p => p.totalWealth > 0) ? 0.85 : 0.45;

    res.json({
      projections,
      summary: {
        totalLifetimeTax,
        averageEffectiveRate,
        projectedFinalWealth,
        successProbability,
      },
    });
  } catch (error) {
    console.error("[tax projection error]", error);
    res.status(500).json({ error: "Failed to run tax projection" });
  }
});

// ── RRSP Room Calculation ───────────────────────────────────────────────────

taxRouter.post("/:clientId/rrsp-room", async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    const input = req.body as Partial<RrspRoomInput>;

    const roomInput: RrspRoomInput = {
      priorYearEarnedIncome: Number(input.priorYearEarnedIncome || 0),
      pensionAdjustment: Number(input.pensionAdjustment || 0),
      priorYearCarryForward: Number(input.priorYearCarryForward || 0),
      currentYearContributions: Number(input.currentYearContributions || 0),
    };

    const summary = calculateRrspRoom(roomInput);
    
    // Calculate additional insights
    const marginalTaxRate = Number(req.body.marginalTaxRate || 0.435);
    const yearsToProject = Number(req.body.yearsToProject || 10);
    const marginalTaxSavings = summary.totalAvailableRoom * marginalTaxRate;
    const effectiveCost = summary.totalAvailableRoom * (1 - marginalTaxRate);
    
    // Catch-up strategy
    const yearsToMaxOut = Math.ceil(summary.totalAvailableRoom / 31560); // Using 2024 limit
    const annualContributionNeeded = summary.totalAvailableRoom / yearsToProject;
    const projectedRefundPerYear = annualContributionNeeded * marginalTaxRate;

    res.json({
      summary,
      marginalTaxSavings,
      effectiveCost,
      catchUpStrategy: {
        yearsToMaxOut,
        annualContributionNeeded,
        projectedRefundPerYear,
      },
    });
  } catch (error) {
    console.error("[rrsp room error]", error);
    res.status(500).json({ error: "Failed to calculate RRSP room" });
  }
});

// ── TFSA Room Calculation ───────────────────────────────────────────────────

taxRouter.post("/:clientId/tfsa-room", async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    const input = req.body as Partial<TfsaRoomInput>;

    const roomInput: TfsaRoomInput = {
      priorYearClosingBalance: Number(input.priorYearClosingBalance || 0),
      priorYearWithdrawals: Number(input.priorYearWithdrawals || 0),
      currentYearContributions: Number(input.currentYearContributions || 0),
      ageAtYearStart: Number(input.ageAtYearStart || 18),
    };

    const summary = calculateTfsaRoom(roomInput);
    
    // Calculate cumulative room since 2009
    const birthYear = Number(req.body.birthYear || 1985);
    const currentYear = new Date().getFullYear();
    const ageNow = currentYear - birthYear;
    const cumulativeRoomSince2009 = summary.totalAvailableRoom;
    
    // Future limits (next 5 years, assuming $7000/year)
    const futureLimits = [];
    for (let i = 1; i <= 5; i++) {
      futureLimits.push({ year: currentYear + i, limit: 7000 });
    }
    
    // 30-year projection
    const currentBalance = Number(req.body.currentTfsaBalance || 0);
    const annualContrib = Number(req.body.annualContribution || 7000);
    const portfolioReturn = Number(req.body.portfolioReturn || 0.06);
    
    let tfsaBalance = currentBalance;
    let taxableBalance = currentBalance;
    
    for (let i = 0; i < 30; i++) {
      tfsaBalance = (tfsaBalance + annualContrib) * (1 + portfolioReturn);
      // Taxable account: 50% of gains taxed at marginal rate (assume 43.5%)
      const taxableGrowth = taxableBalance * portfolioReturn;
      const taxOnGrowth = taxableGrowth * 0.5 * 0.435;
      taxableBalance = (taxableBalance + annualContrib) * (1 + portfolioReturn) - taxOnGrowth;
    }

    res.json({
      summary,
      cumulativeRoomSince2009,
      futureLimits,
      thirtyYearProjection: {
        tfsaBalanceFinal: Math.round(tfsaBalance),
        taxableBalanceFinal: Math.round(taxableBalance),
        tfsaAdvantage: Math.round(tfsaBalance - taxableBalance),
      },
    });
  } catch (error) {
    console.error("[tfsa room error]", error);
    res.status(500).json({ error: "Failed to calculate TFSA room" });
  }
});

// ── Capital Gains Analysis ──────────────────────────────────────────────────

taxRouter.post("/:clientId/capital-gains", async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    const input = req.body;

    if (!input.positions || !Array.isArray(input.positions)) {
      return res.status(400).json({ error: "Positions array required" });
    }

    const positions = input.positions.map((p: any) => ({
      symbol: String(p.symbol || ""),
      acb: Number(p.acb || 0),
      fmv: Number(p.fmv || 0),
    }));

    const marginalTaxRate = Number(input.marginalTaxRate || 0.435);
    const province = String(input.province || "ON");

    const result = analyzeCapitalGains(positions, marginalTaxRate, province);
    res.json(result);
  } catch (error) {
    console.error("[capital gains error]", error);
    res.status(500).json({ error: "Failed to analyze capital gains" });
  }
});

// ── Income Splitting Optimization ───────────────────────────────────────────

taxRouter.post("/:clientId/income-splitting", async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    const input = req.body;

    const higherIncome = Number(input.higherIncome || 0);
    const lowerIncome = Number(input.lowerIncome || 0);
    const pensionIncome = Number(input.pensionIncome || 0);
    const age = Number(input.age || 65);
    const province = String(input.province || "ON");

    const result = analyzeIncomeSplitting(higherIncome, lowerIncome, pensionIncome, age, province);
    res.json(result);
  } catch (error) {
    console.error("[income splitting error]", error);
    res.status(500).json({ error: "Failed to analyze income splitting" });
  }
});
