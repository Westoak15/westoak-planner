import { Router } from "express";
import { db } from "../db";
import { clients } from "../db/schema";
import { eq } from "drizzle-orm";
import {
  projectTaxYears,
  calculateRrspRoom,
  calculateTfsaRoom,
  analyzeCapitalGains,
  optimizeIncomeSplitting,
} from "../engine/tax";
import type {
  TaxProjectionProfile,
  RrspRoomInput,
  TfsaRoomInput,
  CapitalGainsInput,
  IncomeSplitInput,
} from "../engine/tax/types";

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
    const totalIncome = projections.reduce((sum, p) => sum + p.totalIncome, 0);
    const averageEffectiveRate = totalIncome > 0 ? totalLifetimeTax / totalIncome : 0;
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
      carryForwardRoom: Number(input.carryForwardRoom || 0),
      contributionsMadeThisYear: Number(input.contributionsMadeThisYear || 0),
      marginalTaxRate: Number(input.marginalTaxRate || 0.435),
      yearsToProject: Number(input.yearsToProject || 10),
    };

    const result = calculateRrspRoom(roomInput);
    res.json(result);
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
      birthYear: Number(input.birthYear || 1985),
      priorYearClosingRoom: Number(input.priorYearClosingRoom || 0),
      contributionsMadeThisYear: Number(input.contributionsMadeThisYear || 0),
      withdrawalsLastYear: Number(input.withdrawalsLastYear || 0),
      currentTfsaBalance: Number(input.currentTfsaBalance || 0),
      annualContribution: Number(input.annualContribution || 7000),
      portfolioReturn: Number(input.portfolioReturn || 0.06),
    };

    const result = calculateTfsaRoom(roomInput);
    res.json(result);
  } catch (error) {
    console.error("[tfsa room error]", error);
    res.status(500).json({ error: "Failed to calculate TFSA room" });
  }
});

// ── Capital Gains Analysis ──────────────────────────────────────────────────

taxRouter.post("/:clientId/capital-gains", async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    const input = req.body as Partial<CapitalGainsInput>;

    if (!input.positions || !Array.isArray(input.positions)) {
      return res.status(400).json({ error: "Positions array required" });
    }

    const gainsInput: CapitalGainsInput = {
      positions: input.positions.map(p => ({
        symbol: String(p.symbol || ""),
        acb: Number(p.acb || 0),
        fmv: Number(p.fmv || 0),
      })),
      marginalTaxRate: Number(input.marginalTaxRate || 0.435),
    };

    const result = analyzeCapitalGains(gainsInput);
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
    const input = req.body as Partial<IncomeSplitInput>;

    const splitInput: IncomeSplitInput = {
      higherIncome: Number(input.higherIncome || 0),
      lowerIncome: Number(input.lowerIncome || 0),
      pensionIncome: Number(input.pensionIncome || 0),
      age: Number(input.age || 65),
      province: String(input.province || "ON"),
    };

    const result = optimizeIncomeSplitting(splitInput);
    res.json(result);
  } catch (error) {
    console.error("[income splitting error]", error);
    res.status(500).json({ error: "Failed to analyze income splitting" });
  }
});
