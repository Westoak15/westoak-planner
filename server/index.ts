import "dotenv/config";
import express from "express";

process.on("unhandledRejection", (reason) => { console.error("[unhandledRejection]", reason); });
process.on("uncaughtException",  (err)    => { console.error("[uncaughtException]", err); });

import cors            from "cors";
import helmet          from "helmet";
import rateLimit       from "express-rate-limit";
import path            from "path";
import { fileURLToPath } from "url";
import { pool, poolCA, poolUS, jurisdictionStore } from "./db/index.js";
import { authRouter }       from "./routes/auth.js";
import { clientsRouter }    from "./routes/clients.js";
import { financialRouter }  from "./routes/financial.js";
import { simulateRouter }   from "./routes/simulate.js";
import { simulationRouter } from "./routes/simulation.js";
import { reportsRouter }    from "./routes/reports.js";
import { taxRouter }        from "./routes/tax.js";
import { usTaxRouter }      from "./routes/us-tax.js";
import { lettersRouter }    from "./routes/letters.js";
import { goalsRouter }      from "./routes/goals.js";
import { pensionRouter }    from "./routes/pension.js";
import aiVoiceRouter        from "./routes/ai-voice.js";
import { mfaRouter }        from "./routes/mfa.js";
import { auditRouter }      from "./routes/audit.js";
import { httpLogger, logger } from "./logger.js";
import { planningRouter }   from "./planning/routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT      = parseInt(process.env.PORT ?? "8080", 10);

// ── Startup migrations (idempotent) ───────────────────────────────────────────
async function runMigrations() {
  const migrations = [
    `ALTER TABLE retirement_projections ADD COLUMN IF NOT EXISTS tfsa_contributions_made decimal(15,2)`,
    `ALTER TABLE retirement_projections ADD COLUMN IF NOT EXISTS person TEXT DEFAULT 'primary'`,
    `ALTER TABLE ai_recommendations ADD COLUMN IF NOT EXISTS run_id TEXT`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS spouse_pension_type TEXT`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS jurisdiction TEXT NOT NULL DEFAULT 'CA'`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS us_state TEXT`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS filing_status TEXT`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS birth_year INTEGER`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS province TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'en'`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT false`,
    `CREATE TABLE IF NOT EXISTS audit_log (
      id                 SERIAL PRIMARY KEY,
      user_id            INTEGER,
      user_email         TEXT,
      action             TEXT NOT NULL,
      resource_type      TEXT,
      resource_id        INTEGER,
      client_id          INTEGER,
      external_processor TEXT,
      data_categories    TEXT,
      purpose_code       TEXT,
      record_count       INTEGER,
      ip_address         TEXT,
      user_agent         TEXT,
      correlation_id     TEXT,
      outcome            TEXT NOT NULL DEFAULT 'success',
      error_message      TEXT,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS audit_log_client_id_idx ON audit_log(client_id)`,
    `CREATE INDEX IF NOT EXISTS audit_log_action_idx ON audit_log(action)`,
    `CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON audit_log(created_at)`,
    `CREATE INDEX IF NOT EXISTS audit_log_external_processor_idx ON audit_log(external_processor)`,
  ];
  for (const sql of migrations) {
    for (const p of [poolCA, ...(process.env.DATABASE_URL_US ? [poolUS] : [])]) {
      try { await p.query(sql); }
      catch (e: any) { console.error("[migration]", e.message); }  // ← Item 1: no sql in log (may contain PII via params)
    }
  }
  console.log("[migrations] done");
}

const app = express();

// ── Item 2a: Helmet — security headers ────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc:    ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc:      ["'self'", "data:", "blob:"],
      connectSrc:  ["'self'", "blob:"],
      fontSrc:     ["'self'", "data:", "https://fonts.gstatic.com"],
      objectSrc:   ["'none'"],
      frameSrc:    ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === "production" ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,   // needed for blob: report windows
}));

// ── Request logging (pino) ───────────────────────────────────────────────────────
app.use(httpLogger);

// ── Item 2b: CORS — locked to configured origin ────────────────────────────────
const allowedOrigins = [
  process.env.CLIENT_URL ?? "http://localhost:5173",
  process.env.CUSTOM_DOMAIN,          // Item 5: CUSTOM_DOMAIN replaces any REPLIT_DOMAINS
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

// ── Item 4: Body limit — 1 MB (was 10 MB) ─────────────────────────────────────
// Audio uploads use multipart/form-data via multer and are unaffected.
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ── Item 2c: Rate limiting ─────────────────────────────────────────────────────
// Global limiter — generous ceiling, stops runaway clients
const globalLimiter = rateLimit({
  windowMs:          15 * 60 * 1000,  // 15 minutes
  max:               500,
  standardHeaders:   true,
  legacyHeaders:     false,
  message:           { message: "Too many requests, please try again later." },
});

// Auth limiter — tight, stops brute force on login/register/forgot
const authLimiter = rateLimit({
  windowMs:          15 * 60 * 1000,  // 15 minutes
  max:               20,              // 20 attempts per IP per 15 min
  standardHeaders:   true,
  legacyHeaders:     false,
  message:           { message: "Too many authentication attempts. Please wait 15 minutes." },
  skipSuccessfulRequests: true,       // only count failures
});

// AI limiter — Whisper + Claude calls are expensive
const aiLimiter = rateLimit({
  windowMs:          60 * 1000,       // 1 minute
  max:               10,
  standardHeaders:   true,
  legacyHeaders:     false,
  message:           { message: "AI rate limit reached. Please wait a moment." },
});

app.use(globalLimiter);
app.use("/api/auth", authLimiter);
app.use("/api/ai",   aiLimiter);

// ── Jurisdiction context middleware ────────────────────────────────────────────
app.use((req: any, _res: any, next: any) => {
  let jur: "CA" | "US" = "CA";
  try {
    const h = req.headers.authorization;
    if (h?.startsWith("Bearer ")) {
      const raw = h.slice(7).split(".")[1];
      if (raw) {
        const payload = JSON.parse(Buffer.from(raw, "base64url").toString());
        if (payload.jur === "US") jur = "US";
      }
    }
  } catch { /* ignore — defaults to CA */ }
  jurisdictionStore.run(jur, next);
});

// ── Routes ─────────────────────────────────────────────────────────────────────
app.get("/api/health",    (_req, res) => res.json({ ok: true }));
app.use("/api/auth",      authRouter);
app.use("/api/auth/mfa",   mfaRouter);
app.use("/api/audit",       auditRouter);
app.use("/api",           goalsRouter);
app.use("/api",           pensionRouter);
app.use("/api/tax",       taxRouter);
app.use("/api/us-tax",    usTaxRouter);
app.use("/api",           financialRouter);
app.use("/api/clients",   clientsRouter);
app.use("/api",           simulateRouter);
app.use("/api",           simulationRouter);
app.use("/api/reports",   reportsRouter);
app.use("/api",           lettersRouter);
app.use("/api/ai",        aiVoiceRouter);
app.use("/api/planning",  planningRouter);

// ── Static (production) ────────────────────────────────────────────────────────
if (process.env.NODE_ENV === "production") {
  const dist = path.join(__dirname, "../client");
  app.use(express.static(dist, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".js"))  res.setHeader("Content-Type", "application/javascript");
      if (filePath.endsWith(".css")) res.setHeader("Content-Type", "text/css");
    },
  }));
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/")) { res.status(404).json({ message: "Not found" }); return; }
    if (req.path.includes("."))       { res.status(404).send("Not found"); return; }
    res.sendFile(path.join(dist, "index.html"));
  });
}

runMigrations().then(() => {
  app.listen(PORT, "0.0.0.0", () => logger.info({ port: PORT }, "FP server started"));
});

export default app;
