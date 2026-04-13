import { pgTable, serial, text, integer, boolean, timestamp, jsonb, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ── Users (advisors) ──────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id:           serial("id").primaryKey(),
  email:        text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  firstName:    text("first_name").notNull(),
  lastName:     text("last_name").notNull(),
  firmName:     text("firm_name"),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
  updatedAt:    timestamp("updated_at").defaultNow().notNull(),
});
export const insertUserSchema = z.object({
  email:     z.string().email(),
  password:  z.string().min(8),
  firstName: z.string().min(1),
  lastName:  z.string().min(1),
  firmName:  z.string().optional().nullable(),
});
export type User = typeof users.$inferSelect;

// ── Clients ───────────────────────────────────────────────────────────────────
export const clients = pgTable("clients", {
  id:                      serial("id").primaryKey(),
  userId:                  integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // Personal
  firstName:               text("first_name").notNull(),
  lastName:                text("last_name").notNull(),
  email:                   text("email"),
  phone:                   text("phone"),
  dateOfBirth:             text("date_of_birth"),
  province:                text("province").default("ON"),
  occupation:              text("occupation"),
  employmentStatus:        text("employment_status"),
  // Spouse / Partner
  spouseFirstName:         text("spouse_first_name"),
  spouseLastName:          text("spouse_last_name"),
  spouseDateOfBirth:       text("spouse_date_of_birth"),
  spouseOccupation:        text("spouse_occupation"),
  // Dependants
  dependants:              jsonb("dependants"),  // [{name, dob, relationship}]
  // Income
  annualIncome:            decimal("annual_income", { precision: 15, scale: 2 }),
  spouseAnnualIncome:      decimal("spouse_annual_income", { precision: 15, scale: 2 }),
  // Retirement goals
  retirementAge:           integer("retirement_age"),
  spouseRetirementAge:     integer("spouse_retirement_age"),
  desiredRetirementIncome: decimal("desired_retirement_income", { precision: 15, scale: 2 }),
  // Notes
  notes:                   text("notes"),
  createdAt:               timestamp("created_at").defaultNow().notNull(),
  updatedAt:               timestamp("updated_at").defaultNow().notNull(),
});
export const insertClientSchema = createInsertSchema(clients).omit({ id: true, createdAt: true, updatedAt: true });
export type Client = typeof clients.$inferSelect;

// ── Plans (one per client, holds planning config) ─────────────────────────────
export const plans = pgTable("plans", {
  id:            serial("id").primaryKey(),
  clientId:      integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  userId:        integer("user_id").notNull().references(() => users.id),
  name:          text("name").notNull().default("Financial Plan"),
  status:        text("status").notNull().default("active"),
  planningNotes: text("planning_notes"),
  createdAt:     timestamp("created_at").defaultNow().notNull(),
  updatedAt:     timestamp("updated_at").defaultNow().notNull(),
});
export type Plan = typeof plans.$inferSelect;

// ── Net Worth — multiple assets AND liabilities per client ────────────────────
export const netWorthEntries = pgTable("net_worth_entries", {
  id:        serial("id").primaryKey(),
  clientId:  integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  planId:    integer("plan_id").references(() => plans.id, { onDelete: "set null" }),
  type:      text("type").notNull(),      // "asset" | "liability"
  category:  text("category").notNull(),  // RRSP | TFSA | Real Estate | Mortgage | etc.
  name:      text("name").notNull(),
  value:     decimal("value", { precision: 15, scale: 2 }).notNull(),
  notes:     text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export const insertNetWorthSchema = createInsertSchema(netWorthEntries).omit({ id: true, createdAt: true, updatedAt: true });
export type NetWorthEntry = typeof netWorthEntries.$inferSelect;
export type InsertNetWorthEntry = z.infer<typeof insertNetWorthSchema>;

// ── Retirement Projections — multiple scenarios ───────────────────────────────
export const retirementProjections = pgTable("retirement_projections", {
  id:                 serial("id").primaryKey(),
  clientId:           integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  planId:             integer("plan_id").references(() => plans.id, { onDelete: "set null" }),
  label:              text("label").notNull().default("Base Case"),
  currentAge:         integer("current_age"),
  retirementAge:      integer("retirement_age"),
  currentRrsp:        decimal("current_rrsp", { precision: 15, scale: 2 }),
  currentTfsa:        decimal("current_tfsa", { precision: 15, scale: 2 }),
  currentNonReg:      decimal("current_non_reg", { precision: 15, scale: 2 }),
  annualContribution: decimal("annual_contribution", { precision: 15, scale: 2 }),
  expectedReturn:     decimal("expected_return", { precision: 5, scale: 2 }),
  inflationRate:      decimal("inflation_rate", { precision: 5, scale: 2 }),
  desiredIncome:      decimal("desired_income", { precision: 15, scale: 2 }),
  cppStartAge:        integer("cpp_start_age"),
  oasStartAge:        integer("oas_start_age"),
  cppMonthly:         decimal("cpp_monthly", { precision: 10, scale: 2 }),
  oasMonthly:         decimal("oas_monthly", { precision: 10, scale: 2 }),
  projectedBalance:   decimal("projected_balance", { precision: 15, scale: 2 }),
  successRate:        decimal("success_rate", { precision: 5, scale: 2 }),
  projectionData:     jsonb("projection_data"),
  monteCarloResults:  jsonb("monte_carlo_results"),
  notes:              text("notes"),
  createdAt:          timestamp("created_at").defaultNow().notNull(),
  updatedAt:          timestamp("updated_at").defaultNow().notNull(),
});
export const insertRetirementSchema = createInsertSchema(retirementProjections).omit({ id: true, createdAt: true, updatedAt: true });
export type RetirementProjection = typeof retirementProjections.$inferSelect;
export type InsertRetirementProjection = z.infer<typeof insertRetirementSchema>;

// ── Insurance Analyses — multiple worksheets ─────────────────────────────────
export const insuranceAnalyses = pgTable("insurance_analyses", {
  id:                         serial("id").primaryKey(),
  clientId:                   integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  planId:                     integer("plan_id").references(() => plans.id, { onDelete: "set null" }),
  method:                     text("method").notNull().default("dime"),
  annualIncome:               decimal("annual_income", { precision: 15, scale: 2 }),
  yearsToReplace:             integer("years_to_replace"),
  existingLifeCoverage:       decimal("existing_life_coverage", { precision: 15, scale: 2 }),
  existingDisability:         decimal("existing_disability", { precision: 15, scale: 2 }),
  existingCriticalIllness:    decimal("existing_critical_illness", { precision: 15, scale: 2 }),
  recommendedLife:            decimal("recommended_life", { precision: 15, scale: 2 }),
  recommendedDisability:      decimal("recommended_disability", { precision: 15, scale: 2 }),
  recommendedCriticalIllness: decimal("recommended_critical_illness", { precision: 15, scale: 2 }),
  lifeGap:                    decimal("life_gap", { precision: 15, scale: 2 }),
  disabilityGap:              decimal("disability_gap", { precision: 15, scale: 2 }),
  criticalIllnessGap:         decimal("critical_illness_gap", { precision: 15, scale: 2 }),
  worksheetData:              jsonb("worksheet_data"),
  notes:                      text("notes"),
  createdAt:                  timestamp("created_at").defaultNow().notNull(),
  updatedAt:                  timestamp("updated_at").defaultNow().notNull(),
});
export const insertInsuranceSchema = createInsertSchema(insuranceAnalyses).omit({ id: true, createdAt: true, updatedAt: true });
export type InsuranceAnalysis = typeof insuranceAnalyses.$inferSelect;
export type InsertInsuranceAnalysis = z.infer<typeof insertInsuranceSchema>;

// ── Education / RESP — one per child ─────────────────────────────────────────
export const educationPlans = pgTable("education_plans", {
  id:                  serial("id").primaryKey(),
  clientId:            integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  planId:              integer("plan_id").references(() => plans.id, { onDelete: "set null" }),
  childName:           text("child_name").notNull(),
  childDob:            text("child_dob"),
  currentRespBalance:  decimal("current_resp_balance", { precision: 15, scale: 2 }),
  annualContribution:  decimal("annual_contribution", { precision: 15, scale: 2 }),
  targetAmount:        decimal("target_amount", { precision: 15, scale: 2 }),
  projectedBalance:    decimal("projected_balance", { precision: 15, scale: 2 }),
  cespGrant:           decimal("cesg_grant", { precision: 15, scale: 2 }),
  projectionData:      jsonb("projection_data"),
  notes:               text("notes"),
  createdAt:           timestamp("created_at").defaultNow().notNull(),
  updatedAt:           timestamp("updated_at").defaultNow().notNull(),
});
export const insertEducationSchema = createInsertSchema(educationPlans).omit({ id: true, createdAt: true, updatedAt: true });
export type EducationPlan = typeof educationPlans.$inferSelect;
export type InsertEducationPlan = z.infer<typeof insertEducationSchema>;

// ── Debt Entries — multiple debts ────────────────────────────────────────────
export const debtEntries = pgTable("debt_entries", {
  id:             serial("id").primaryKey(),
  clientId:       integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  planId:         integer("plan_id").references(() => plans.id, { onDelete: "set null" }),
  name:           text("name").notNull(),
  type:           text("type").notNull().default("other"),
  balance:        decimal("balance", { precision: 15, scale: 2 }).notNull(),
  interestRate:   decimal("interest_rate", { precision: 5, scale: 2 }),
  minimumPayment: decimal("minimum_payment", { precision: 10, scale: 2 }),
  payoffStrategy: text("payoff_strategy").default("avalanche"),
  notes:          text("notes"),
  createdAt:      timestamp("created_at").defaultNow().notNull(),
  updatedAt:      timestamp("updated_at").defaultNow().notNull(),
});
export const insertDebtSchema = createInsertSchema(debtEntries).omit({ id: true, createdAt: true, updatedAt: true });
export type DebtEntry = typeof debtEntries.$inferSelect;
export type InsertDebtEntry = z.infer<typeof insertDebtSchema>;

// ── Tax Planning Notes ────────────────────────────────────────────────────────
export const taxNotes = pgTable("tax_notes", {
  id:        serial("id").primaryKey(),
  clientId:  integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  planId:    integer("plan_id").references(() => plans.id, { onDelete: "set null" }),
  subTab:    text("sub_tab").notNull().default("notes"),
  content:   text("content"),
  data:      jsonb("data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type TaxNote = typeof taxNotes.$inferSelect;

// ── Estate Planning ───────────────────────────────────────────────────────────
export const estateNotes = pgTable("estate_notes", {
  id:             serial("id").primaryKey(),
  clientId:       integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  planId:         integer("plan_id").references(() => plans.id, { onDelete: "set null" }),
  content:        text("content"),
  hasWill:        boolean("has_will").default(false),
  hasPoa:         boolean("has_poa").default(false),
  hasHcDirective: boolean("has_hc_directive").default(false),
  data:           jsonb("data"),
  createdAt:      timestamp("created_at").defaultNow().notNull(),
  updatedAt:      timestamp("updated_at").defaultNow().notNull(),
});
export type EstateNote = typeof estateNotes.$inferSelect;

// ── AI Recommendations ────────────────────────────────────────────────────────
export const aiRecommendations = pgTable("ai_recommendations", {
  id:          serial("id").primaryKey(),
  clientId:    integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  planId:      integer("plan_id").references(() => plans.id, { onDelete: "set null" }),
  category:    text("category").notNull(),
  priority:    text("priority").notNull().default("medium"),
  title:       text("title").notNull(),
  description: text("description"),
  status:      text("status").notNull().default("pending"),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
  updatedAt:   timestamp("updated_at").defaultNow().notNull(),
});
export type AiRecommendation = typeof aiRecommendations.$inferSelect;
