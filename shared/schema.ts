import {
  pgTable, serial, text, integer, boolean, timestamp,
  jsonb, numeric, date, uniqueIndex
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ── Users (advisors — our auth table) ────────────────────────────────────────
export const users = pgTable("users", {
  id:                 serial("id").primaryKey(),
  email:              text("email").notNull().unique(),
  passwordHash:       text("password_hash").notNull(),
  firstName:          text("first_name").notNull(),
  lastName:           text("last_name").notNull(),
  firmName:           text("firm_name"),
  securityQuestion:   text("security_question"),
  securityAnswerHash: text("security_answer_hash"),
  createdAt:          timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt:          timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  role:               text("role").default("fa").notNull(),
  agentId:            text("agent_id"),
  agency:             text("agency"),
  phone:              text("phone"),
  level:              text("level").default("standard").notNull(),
  gaId:               integer("ga_id"),
  mustResetPassword:  boolean("must_reset_password").default(false).notNull(),

});
export const insertUserSchema = z.object({
  email:     z.string().email(),
  password:  z.string().min(8),
  firstName: z.string().min(1),
  lastName:  z.string().min(1),
  firmName:  z.string().optional().nullable(),
  securityQuestion: z.string().optional(),
  securityAnswer:   z.string().optional(),
});
export type User = typeof users.$inferSelect;

// ── Clients ───────────────────────────────────────────────────────────────────
export const clients = pgTable("clients", {
  id:                           serial("id").primaryKey(),
  userId:                       integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  firstName:                    text("first_name").notNull(),
  lastName:                     text("last_name").notNull(),
  email:                        text("email"),
  phone:                        text("phone"),
  dateOfBirth:                  text("date_of_birth"),
  province:                     text("province").default("ON"),
  occupation:                   text("occupation"),
  employmentStatus:             text("employment_status"),
  annualIncome:                 numeric("annual_income", { precision: 15, scale: 2 }),
  spouseFirstName:              text("spouse_first_name"),
  spouseLastName:               text("spouse_last_name"),
  spouseDateOfBirth:            text("spouse_date_of_birth"),
  spouseOccupation:             text("spouse_occupation"),
  spouseAnnualIncome:           numeric("spouse_annual_income", { precision: 15, scale: 2 }),
  spouseRetirementAge:          integer("spouse_retirement_age"),
  spouseDesiredRetirementIncome: numeric("spouse_desired_retirement_income", { precision: 15, scale: 2 }),
  retirementAge:                integer("retirement_age"),
  desiredRetirementIncome:      numeric("desired_retirement_income", { precision: 15, scale: 2 }),
  dependants:                   jsonb("dependants"),
  notes:                        text("notes"),
  createdAt:                    timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt:                    timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});
export type Client = typeof clients.$inferSelect;

// ── Financial Plans ───────────────────────────────────────────────────────────
export const financialPlans = pgTable("financial_plans", {
  id:            serial("id").primaryKey(),
  clientId:      integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  userId:        integer("user_id").notNull().references(() => users.id),
  title:         text("title").notNull().default("Financial Plan"),
  status:        text("status").notNull().default("active"),
  goalAmount:    numeric("goal_amount", { precision: 12, scale: 2 }),
  targetDate:    text("target_date"),
  riskTolerance: text("risk_tolerance"),
  notes:         text("notes"),
  planningNotes: text("planning_notes"),
  createdAt:     timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt:     timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});
export const insertFinancialPlanSchema = createInsertSchema(financialPlans).omit({ id: true, createdAt: true, updatedAt: true });
export type FinancialPlan = typeof financialPlans.$inferSelect;
export type InsertFinancialPlan = z.infer<typeof insertFinancialPlanSchema>;

// ── Net Worth Entries ─────────────────────────────────────────────────────────
export const netWorthEntries = pgTable("net_worth_entries", {
  id:        serial("id").primaryKey(),
  clientId:  integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  planId:    integer("plan_id").references(() => financialPlans.id, { onDelete: "set null" }),
  type:      text("type").notNull(),
  category:  text("category").notNull(),
  name:      text("name").notNull(),
  owner:     text("owner").default("primary"),   // "primary" | "spouse"
  value:     numeric("value", { precision: 14, scale: 2 }).notNull(),
  notes:     text("notes"),
  metadata:  jsonb("metadata"),   // category-specific extra fields
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});
export type NetWorthEntry = typeof netWorthEntries.$inferSelect;

// ── Retirement Projections ────────────────────────────────────────────────────
export const retirementProjections = pgTable("retirement_projections", {
  id:                      serial("id").primaryKey(),
  clientId:                integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  planId:                  integer("plan_id").references(() => financialPlans.id, { onDelete: "set null" }),
  currentAge:              integer("current_age").notNull(),
  retirementAge:           integer("retirement_age").notNull(),
  lifeExpectancy:          integer("life_expectancy").notNull().default(90),
  currentSavings:          numeric("current_savings", { precision: 14, scale: 2 }).notNull().default("0"),
  rrspBalance:             numeric("rrsp_balance", { precision: 14, scale: 2 }).default("0"),
  tfsaBalance:             numeric("tfsa_balance", { precision: 14, scale: 2 }).default("0"),
  nonRegBalance:           numeric("non_reg_balance", { precision: 14, scale: 2 }).default("0"),
  annualContribution:      numeric("annual_contribution", { precision: 14, scale: 2 }).notNull().default("0"),
  annualTfsaContribution:  numeric("annual_tfsa_contribution", { precision: 14, scale: 2 }).default("0"),
  annualNonRegContribution: numeric("annual_non_reg_contribution", { precision: 14, scale: 2 }).default("0"),
  expectedReturn:          numeric("expected_return", { precision: 5, scale: 2 }).notNull().default("7"),
  inflationRate:           numeric("inflation_rate", { precision: 5, scale: 2 }).notNull().default("2"),
  desiredRetirementIncome: numeric("desired_retirement_income", { precision: 14, scale: 2 }).notNull().default("0"),
  projectedBalance:        numeric("projected_balance", { precision: 14, scale: 2 }),
  shortfallSurplus:        numeric("shortfall_surplus", { precision: 14, scale: 2 }),
  yearlyBreakdown:         text("yearly_breakdown"),
  cppStartAge:             integer("cpp_start_age").default(65),
  oasStartAge:             integer("oas_start_age").default(65),
  cppMonthly:              numeric("cpp_monthly", { precision: 10, scale: 2 }).default("900"),
  oasMonthly:              numeric("oas_monthly", { precision: 10, scale: 2 }).default("700"),
  rrifConversionAge:       integer("rrif_conversion_age").default(71),
  pensionIncome:           numeric("pension_income", { precision: 14, scale: 2 }).default("0"),
  spouseIncome:            numeric("spouse_income", { precision: 14, scale: 2 }).default("0"),
  province:                text("province").default("ON"),
  equityAllocation:        numeric("equity_allocation", { precision: 5, scale: 4 }).default("0.6"),
  bondAllocation:          numeric("bond_allocation", { precision: 5, scale: 4 }).default("0.4"),
  yearsInCanada:           integer("years_in_canada").default(40),
  successRate:             numeric("success_rate", { precision: 5, scale: 2 }),
  monteCarloResults:       jsonb("monte_carlo_results"),
  notes:                   text("notes"),
  createdAt:               timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});
export type RetirementProjection = typeof retirementProjections.$inferSelect;

// ── Insurance Analyses ────────────────────────────────────────────────────────
export const insuranceAnalyses = pgTable("insurance_analyses", {
  id:                               serial("id").primaryKey(),
  clientId:                         integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  planId:                           integer("plan_id").references(() => financialPlans.id, { onDelete: "set null" }),
  annualIncome:                     numeric("annual_income", { precision: 14, scale: 2 }).notNull().default("0"),
  yearsOfIncomeNeeded:              integer("years_of_income_needed").notNull().default(20),
  existingLifeCoverage:             numeric("existing_life_coverage", { precision: 14, scale: 2 }).notNull().default("0"),
  existingAssets:                   numeric("existing_assets", { precision: 14, scale: 2 }).notNull().default("0"),
  monthlyExpenses:                  numeric("monthly_expenses", { precision: 14, scale: 2 }).notNull().default("0"),
  existingDisabilityCoverage:       numeric("existing_disability_coverage", { precision: 14, scale: 2 }).notNull().default("0"),
  criticalIllnessLumpSum:           numeric("critical_illness_lump_sum", { precision: 14, scale: 2 }).notNull().default("0"),
  existingCriticalIllnessCoverage:  numeric("existing_critical_illness_coverage", { precision: 14, scale: 2 }).notNull().default("0"),
  recommendedLifeCoverage:          numeric("recommended_life_coverage", { precision: 14, scale: 2 }),
  lifeCoverageGap:                  numeric("life_coverage_gap", { precision: 14, scale: 2 }),
  recommendedDisabilityCoverage:    numeric("recommended_disability_coverage", { precision: 14, scale: 2 }),
  disabilityCoverageGap:            numeric("disability_coverage_gap", { precision: 14, scale: 2 }),
  recommendedCriticalIllnessCoverage: numeric("recommended_critical_illness_coverage", { precision: 14, scale: 2 }),
  criticalIllnessCoverageGap:       numeric("critical_illness_coverage_gap", { precision: 14, scale: 2 }),
  calculationMethod:                text("calculation_method").default("dime"),
  mortgageBalance:                  numeric("mortgage_balance", { precision: 14, scale: 2 }).default("0"),
  totalDebts:                       numeric("total_debts", { precision: 14, scale: 2 }).default("0"),
  finalExpenses:                    numeric("final_expenses", { precision: 14, scale: 2 }).default("15000"),
  worksheetData:                    jsonb("worksheet_data"),
  analysisResults:                  jsonb("analysis_results"),
  primaryName:                      text("primary_name"),
  primaryAge:                       integer("primary_age"),
  spouseName:                       text("spouse_name"),
  spouseAge:                        integer("spouse_age"),
  spouseAnnualIncome:               numeric("spouse_annual_income", { precision: 14, scale: 2 }).default("0"),
  notes:                            text("notes"),
  createdAt:                        timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});
export type InsuranceAnalysis = typeof insuranceAnalyses.$inferSelect;

// ── Education Savings (RESP) ──────────────────────────────────────────────────
export const educationSavings = pgTable("education_savings", {
  id:                   serial("id").primaryKey(),
  clientId:             integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  planId:               integer("plan_id").references(() => financialPlans.id, { onDelete: "set null" }),
  childName:            text("child_name").notNull(),
  childAge:             integer("child_age").notNull().default(0),
  targetAge:            integer("target_age").notNull().default(18),
  currentBalance:       numeric("current_balance", { precision: 14, scale: 2 }).notNull().default("0"),
  monthlyContribution:  numeric("monthly_contribution", { precision: 14, scale: 2 }).notNull().default("0"),
  expectedReturn:       numeric("expected_return", { precision: 5, scale: 2 }).notNull().default("5"),
  estimatedCost:        numeric("estimated_cost", { precision: 14, scale: 2 }).notNull().default("0"),
  accountType:          text("account_type").notNull().default("RESP"),
  familyIncomeBracket:  text("family_income_bracket").default("high"),
  cesgReceivedToDate:   numeric("cesg_received_to_date", { precision: 14, scale: 2 }).default("0"),
  clbEligible:          boolean("clb_eligible").default(false),
  projectionResults:    jsonb("projection_results"),
  notes:                text("notes"),
  createdAt:            timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});
export const insertEducationSavingsSchema = createInsertSchema(educationSavings).omit({ id: true, createdAt: true });
export type EducationSaving = typeof educationSavings.$inferSelect;
export type InsertEducationSaving = z.infer<typeof insertEducationSavingsSchema>;

// ── Debt Entries ──────────────────────────────────────────────────────────────
export const debtEntries = pgTable("debt_entries", {
  id:             serial("id").primaryKey(),
  clientId:       integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  planId:         integer("plan_id").references(() => financialPlans.id, { onDelete: "set null" }),
  name:           text("name").notNull(),
  category:       text("category").notNull().default("other"),
  balance:        numeric("balance", { precision: 14, scale: 2 }).notNull(),
  interestRate:   numeric("interest_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  minimumPayment: numeric("minimum_payment", { precision: 14, scale: 2 }).notNull().default("0"),
  term:           text("term"),
  priority:       integer("priority").notNull().default(0),
  notes:          text("notes"),
  createdAt:      timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});
export const insertDebtEntrySchema = createInsertSchema(debtEntries).omit({ id: true, createdAt: true });
export type DebtEntry = typeof debtEntries.$inferSelect;
export type InsertDebtEntry = z.infer<typeof insertDebtEntrySchema>;

// ── Tax Planning Notes ────────────────────────────────────────────────────────
export const taxPlanningNotes = pgTable("tax_planning_notes", {
  id:             serial("id").primaryKey(),
  clientId:       integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  planId:         integer("plan_id").references(() => financialPlans.id, { onDelete: "set null" }),
  taxYear:        integer("tax_year").notNull().default(2024),
  category:       text("category").notNull().default("general"),
  title:          text("title").notNull(),
  content:        text("content").notNull(),
  actionRequired: boolean("action_required").notNull().default(false),
  createdAt:      timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});
export const insertTaxPlanningNoteSchema = createInsertSchema(taxPlanningNotes).omit({ id: true, createdAt: true });
export type TaxPlanningNote = typeof taxPlanningNotes.$inferSelect;
export type InsertTaxPlanningNote = z.infer<typeof insertTaxPlanningNoteSchema>;

// ── Estate Planning Notes ─────────────────────────────────────────────────────
export const estatePlanningNotes = pgTable("estate_planning_notes", {
  id:                serial("id").primaryKey(),
  clientId:          integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  planId:            integer("plan_id").references(() => financialPlans.id, { onDelete: "set null" }),
  category:          text("category").notNull().default("general"),
  title:             text("title").notNull(),
  content:           text("content").notNull(),
  documentReference: text("document_reference"),
  createdAt:         timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});
export const insertEstatePlanningNoteSchema = createInsertSchema(estatePlanningNotes).omit({ id: true, createdAt: true });
export type EstatePlanningNote = typeof estatePlanningNotes.$inferSelect;
export type InsertEstatePlanningNote = z.infer<typeof insertEstatePlanningNoteSchema>;

// ── AI Recommendations ────────────────────────────────────────────────────────
export const aiRecommendations = pgTable("ai_recommendations", {
  id:        serial("id").primaryKey(),
  clientId:  integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  planId:    integer("plan_id").references(() => financialPlans.id, { onDelete: "set null" }),
  category:  text("category").notNull(),
  title:     text("title").notNull(),
  content:   text("content").notNull(),
  priority:  text("priority").notNull().default("medium"),
  status:    text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});
export type AiRecommendation = typeof aiRecommendations.$inferSelect;

// ── Plan Assumptions ──────────────────────────────────────────────────────────
export const planAssumptions = pgTable("plan_assumptions", {
  id:                    serial("id").primaryKey(),
  planId:                integer("plan_id").notNull().references(() => financialPlans.id, { onDelete: "cascade" }),
  scenario:              text("scenario").notNull().default("base"),
  equityReturn:          numeric("equity_return", { precision: 6, scale: 4 }).notNull().default("0.07"),
  equityVolatility:      numeric("equity_volatility", { precision: 6, scale: 4 }).notNull().default("0.15"),
  bondReturn:            numeric("bond_return", { precision: 6, scale: 4 }).notNull().default("0.04"),
  bondVolatility:        numeric("bond_volatility", { precision: 6, scale: 4 }).notNull().default("0.05"),
  inflationMean:         numeric("inflation_mean", { precision: 6, scale: 4 }).notNull().default("0.02"),
  inflationVolatility:   numeric("inflation_volatility", { precision: 6, scale: 4 }).notNull().default("0.01"),
  corrEquityBond:        numeric("corr_equity_bond", { precision: 6, scale: 4 }).notNull().default("-0.15"),
  corrEquityInflation:   numeric("corr_equity_inflation", { precision: 6, scale: 4 }).notNull().default("0.10"),
  corrBondInflation:     numeric("corr_bond_inflation", { precision: 6, scale: 4 }).notNull().default("0.30"),
  planToAge:             integer("plan_to_age").notNull().default(95),
  simulationCount:       integer("simulation_count").notNull().default(1000),
  cppStartAge:           integer("cpp_start_age").notNull().default(65),
  oasStartAge:           integer("oas_start_age").notNull().default(65),
  province:              text("province").notNull().default("ON"),
  createdAt:             timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt:             timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("plan_assumptions_plan_scenario_unique").on(table.planId, table.scenario),
]);
export type PlanAssumption = typeof planAssumptions.$inferSelect;
export type InsertPlanAssumption = typeof planAssumptions.$inferInsert;

// ── Simulation Results ────────────────────────────────────────────────────────
export const simulationResults = pgTable("simulation_results", {
  id:                    serial("id").primaryKey(),
  planId:                integer("plan_id").notNull().references(() => financialPlans.id, { onDelete: "cascade" }),
  module:                text("module").notNull(),
  scenario:              text("scenario").notNull().default("base"),
  successRate:           numeric("success_rate", { precision: 6, scale: 4 }).notNull(),
  p10:                   numeric("p10", { precision: 14, scale: 2 }).notNull(),
  p25:                   numeric("p25", { precision: 14, scale: 2 }).notNull(),
  p50:                   numeric("p50", { precision: 14, scale: 2 }).notNull(),
  p75:                   numeric("p75", { precision: 14, scale: 2 }).notNull(),
  p90:                   numeric("p90", { precision: 14, scale: 2 }).notNull(),
  percentileBands:       jsonb("percentile_bands"),
  moduleMedians:         jsonb("module_medians"),
  sensitivityData:       jsonb("sensitivity_data"),
  assumptionsSnapshot:   jsonb("assumptions_snapshot"),
  medianPath:            jsonb("median_path"),
  simulationCount:       integer("simulation_count").notNull(),
  yearsProjected:        integer("years_projected").notNull(),
  calculatedAt:          timestamp("calculated_at", { mode: "date" }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("sim_results_plan_module_scenario_unique").on(table.planId, table.module, table.scenario),
]);
export type SimulationResult = typeof simulationResults.$inferSelect;

// ── Plan Snapshots ────────────────────────────────────────────────────────────
export const planSnapshots = pgTable("plan_snapshots", {
  id:           serial("id").primaryKey(),
  planId:       integer("plan_id").notNull().references(() => financialPlans.id, { onDelete: "cascade" }),
  snapshotData: jsonb("snapshot_data").notNull(),
  trigger:      text("trigger").notNull().default("manual"),
  notes:        text("notes"),
  createdAt:    timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});
export type PlanSnapshot = typeof planSnapshots.$inferSelect;

// ── Plan Stale Flags ──────────────────────────────────────────────────────────
export const planStaleFlags = pgTable("plan_stale_flags", {
  id:          serial("id").primaryKey(),
  planId:      integer("plan_id").notNull().references(() => financialPlans.id, { onDelete: "cascade" }),
  module:      text("module").notNull(),
  triggeredBy: text("triggered_by").notNull(),
  resolvedAt:  timestamp("resolved_at", { mode: "date" }),
  createdAt:   timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});
export type PlanStaleFlag = typeof planStaleFlags.$inferSelect;

// ── Plan Action Items ─────────────────────────────────────────────────────────
export const planActionItems = pgTable("plan_action_items", {
  id:          serial("id").primaryKey(),
  planId:      integer("plan_id").notNull().references(() => financialPlans.id, { onDelete: "cascade" }),
  module:      text("module").notNull(),
  priority:    text("priority").notNull().default("medium"),
  title:       text("title").notNull(),
  description: text("description").notNull(),
  status:      text("status").notNull().default("pending"),
  createdAt:   timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt:   timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});
export type PlanActionItem = typeof planActionItems.$inferSelect;

export const clientPolicies = pgTable("client_policies", {
  id:               serial("id").primaryKey(),
  clientId:         integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  type:             text("type").notNull(),
  insured:          text("insured").default("primary"),
  provider:         text("provider"),
  policyNumber:     text("policy_number"),
  coverageAmount:   numeric("coverage_amount", { precision: 14, scale: 2 }),
  premium:          numeric("premium", { precision: 10, scale: 2 }),
  premiumFrequency: text("premium_frequency").default("Monthly"),
  beneficiary:      text("beneficiary"),
  notes:            text("notes"),
  createdAt:        timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});
export type ClientPolicy = typeof clientPolicies.$inferSelect;

// ── Legacy aliases (backward compat) ─────────────────────────────────────────
export const plans = financialPlans;
export type Plan = FinancialPlan;
export const educationPlans = educationSavings;
export const taxNotes = taxPlanningNotes;
export const estateNotes = estatePlanningNotes;
