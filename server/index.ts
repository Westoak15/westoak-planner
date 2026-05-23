import "dotenv/config";
import express from "express";

process.on("unhandledRejection", (reason) => { console.error("[unhandledRejection]", reason); });
process.on("uncaughtException",  (err)    => { console.error("[uncaughtException]", err); });

import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { pool, poolCA, poolUS, jurisdictionStore } from "./db/index.js";
import { authRouter }       from "./routes/auth.js";
import { clientsRouter }    from "./routes/clients.js";
import { financialRouter } from "./routes/financial.js";
import { simulateRouter }   from "./routes/simulate.js";
import { simulationRouter } from "./routes/simulation.js";   // ← FIX 1: was missing
import { reportsRouter }    from "./routes/reports.js";
import { taxRouter }        from "./routes/tax.js";
import { usTaxRouter }      from "./routes/us-tax.js";
import { lettersRouter } from "./routes/letters.js";
import { goalsRouter } from "./routes/goals.js";
import { pensionRouter } from "./routes/pension.js";
import aiVoiceRouter from "./routes/ai-voice.js";
import { aiReportRouter } from "./routes/ai-report.js";
import { planningRouter } from "./planning/routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT ?? "8080", 10);

// ── Startup migrations (idempotent)  ───────────────────────────────────────────
async function runMigrations() {
  const migrations = [
    `ALTER TABLE retirement_projections ADD COLUMN IF NOT EXISTS tfsa_contributions_made decimal(15,2)`,
    `ALTER TABLE retirement_projections ADD COLUMN IF NOT EXISTS person TEXT DEFAULT 'primary'`,
    `ALTER TABLE ai_recommendations ADD COLUMN IF NOT EXISTS run_id TEXT`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS spouse_pension_type TEXT`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS jurisdiction TEXT NOT NULL DEFAULT 'CA'`,  // ← add
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS us_state TEXT`,                            // ← add
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS filing_status TEXT`,                       // ← add
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS birth_year INTEGER`,                       // ← add
  ];
  for (const sql of migrations) {
    for (const p of [poolCA, ...(process.env.DATABASE_URL_US ? [poolUS] : [])]) {
      try { await p.query(sql); }
      catch (e: any) { console.error("[migration]", sql, e.message); }
    }
  }
  console.log("[migrations] done");
}

const app = express();
app.use(cors({
  origin: process.env.CLIENT_URL ?? "http://localhost:5173",
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));

// ── Jurisdiction context middleware ────────────────────────────────────────────
// Lightweight JWT peek (no sig verification) — sets AsyncLocalStorage so the
// `db` proxy routes to the correct Postgres instance before any handler runs.
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
app.get("/api/health",  (_req, res) => res.json({ ok: true }));
app.use("/api/auth",    authRouter);
app.use("/api",         goalsRouter);
app.use("/api", pensionRouter);
app.use("/api/tax",     taxRouter);
app.use("/api/us-tax",  usTaxRouter);
app.use("/api", financialRouter);
app.use("/api/clients", clientsRouter);
app.use("/api",         simulateRouter);
app.use("/api",         simulationRouter);   // ← FIX 1: mounts /api/simulation/:clientId/*
app.use("/api/reports", reportsRouter);
app.use("/api",         lettersRouter);
app.use("/api/ai",      aiVoiceRouter);
app.use("/api", aiReportRouter);
app.use("/api/planning", planningRouter);

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
  if (req.path.includes(".")) { res.status(404).send("Not found"); return; }
  res.sendFile(path.join(dist, "index.html"));
});
}

runMigrations().then(() => {
  app.listen(PORT, "0.0.0.0", () => console.log(`✅ FP running on :${PORT}`));
});
export default app;
