import pg from "pg";
const url = process.env.DATABASE_URL;
if (!url) { console.error("No DATABASE_URL"); process.exit(1); }
const pool = new pg.Pool({ connectionString: url });
const sql = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL, last_name TEXT NOT NULL, firm_name TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL, updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL, last_name TEXT NOT NULL, email TEXT, phone TEXT,
  date_of_birth TEXT, province TEXT DEFAULT 'ON', occupation TEXT, employment_status TEXT,
  spouse_first_name TEXT, spouse_last_name TEXT, spouse_date_of_birth TEXT, spouse_occupation TEXT,
  dependants JSONB, annual_income DECIMAL(15,2), spouse_annual_income DECIMAL(15,2),
  retirement_age INTEGER, spouse_retirement_age INTEGER, desired_retirement_income DECIMAL(15,2),
  notes TEXT, created_at TIMESTAMP DEFAULT NOW() NOT NULL, updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE TABLE IF NOT EXISTS plans (
  id SERIAL PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id), name TEXT NOT NULL DEFAULT 'Financial Plan',
  status TEXT NOT NULL DEFAULT 'active', planning_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL, updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE TABLE IF NOT EXISTS net_worth_entries (
  id SERIAL PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  plan_id INTEGER REFERENCES plans(id) ON DELETE SET NULL,
  type TEXT NOT NULL, category TEXT NOT NULL, name TEXT NOT NULL,
  value DECIMAL(15,2) NOT NULL, notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL, updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE TABLE IF NOT EXISTS retirement_projections (
  id SERIAL PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  plan_id INTEGER REFERENCES plans(id) ON DELETE SET NULL, label TEXT NOT NULL DEFAULT 'Base Case',
  current_age INTEGER, retirement_age INTEGER,
  current_rrsp DECIMAL(15,2), current_tfsa DECIMAL(15,2), current_non_reg DECIMAL(15,2),
  annual_contribution DECIMAL(15,2), expected_return DECIMAL(5,2), inflation_rate DECIMAL(5,2),
  desired_income DECIMAL(15,2), cpp_start_age INTEGER, oas_start_age INTEGER,
  cpp_monthly DECIMAL(10,2), oas_monthly DECIMAL(10,2),
  projected_balance DECIMAL(15,2), success_rate DECIMAL(5,2),
  projection_data JSONB, monte_carlo_results JSONB, notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL, updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE TABLE IF NOT EXISTS insurance_analyses (
  id SERIAL PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  plan_id INTEGER REFERENCES plans(id) ON DELETE SET NULL, method TEXT NOT NULL DEFAULT 'dime',
  annual_income DECIMAL(15,2), years_to_replace INTEGER,
  existing_life_coverage DECIMAL(15,2), existing_disability DECIMAL(15,2), existing_critical_illness DECIMAL(15,2),
  recommended_life DECIMAL(15,2), recommended_disability DECIMAL(15,2), recommended_critical_illness DECIMAL(15,2),
  life_gap DECIMAL(15,2), disability_gap DECIMAL(15,2), critical_illness_gap DECIMAL(15,2),
  worksheet_data JSONB, notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL, updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE TABLE IF NOT EXISTS education_plans (
  id SERIAL PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  plan_id INTEGER REFERENCES plans(id) ON DELETE SET NULL,
  child_name TEXT NOT NULL, child_dob TEXT,
  current_resp_balance DECIMAL(15,2), annual_contribution DECIMAL(15,2), target_amount DECIMAL(15,2),
  projected_balance DECIMAL(15,2), cesg_grant DECIMAL(15,2), projection_data JSONB, notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL, updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE TABLE IF NOT EXISTS debt_entries (
  id SERIAL PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  plan_id INTEGER REFERENCES plans(id) ON DELETE SET NULL,
  name TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'other',
  balance DECIMAL(15,2) NOT NULL, interest_rate DECIMAL(5,2),
  minimum_payment DECIMAL(10,2), payoff_strategy TEXT DEFAULT 'avalanche', notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL, updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE TABLE IF NOT EXISTS tax_notes (
  id SERIAL PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  plan_id INTEGER REFERENCES plans(id) ON DELETE SET NULL,
  sub_tab TEXT NOT NULL DEFAULT 'notes', content TEXT, data JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL, updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE TABLE IF NOT EXISTS estate_notes (
  id SERIAL PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  plan_id INTEGER REFERENCES plans(id) ON DELETE SET NULL,
  content TEXT, has_will BOOLEAN DEFAULT FALSE, has_poa BOOLEAN DEFAULT FALSE,
  has_hc_directive BOOLEAN DEFAULT FALSE, data JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL, updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
CREATE TABLE IF NOT EXISTS ai_recommendations (
  id SERIAL PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  plan_id INTEGER REFERENCES plans(id) ON DELETE SET NULL,
  category TEXT NOT NULL, priority TEXT NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL, description TEXT, status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL, updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
`;
try {
  await pool.query(sql);
  const r = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
  console.log("✅ Tables:", r.rows.map(x => x.table_name).join(", "));
} catch (e) { console.error("❌", e.message); }
finally { await pool.end(); }
