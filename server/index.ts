import "dotenv/config";
import express from "express";

process.on("unhandledRejection", (reason) => { console.error("[unhandledRejection]", reason); });
process.on("uncaughtException",  (err)    => { console.error("[uncaughtException]", err); });

import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "./db/index.js";
import { authRouter }       from "./routes/auth.js";
import { clientsRouter }    from "./routes/clients.js";
import { fpRouter } from "./routes/fp.js";
import { fpAliasesRouter } from "./routes/fp-aliases.js";
import { fpFullRouter }     from "./routes/fp-full.js";
import { simulateRouter }   from "./routes/simulate.js";
import { simulationRouter } from "./routes/simulation.js";   // ← FIX 1: was missing
import { reportsRouter }    from "./routes/reports.js";
import { taxRouter }        from "./routes/tax.js";
import { lettersRouter } from "./routes/letters.js";
import { goalsRouter } from "./routes/goals.js";
import { pensionRouter } from "./routes/pension.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT ?? "8080", 10);

// ── Startup migrations (idempotent) ───────────────────────────────────────────
async function runMigrations() {
  const migrations = [
    `ALTER TABLE retirement_projections ADD COLUMN IF NOT EXISTS person TEXT DEFAULT 'primary'`,
    `ALTER TABLE ai_recommendations ADD COLUMN IF NOT EXISTS run_id TEXT`,
  ];
  for (const sql of migrations) {
    try { await pool.query(sql); }
    catch (e: any) { console.error("[migration]", sql, e.message); }
  }
  console.log("[migrations] done");
}

const app = express();
app.use(cors({
  origin: process.env.CLIENT_URL ?? "http://localhost:5173",
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.get("/api/health",  (_req, res) => res.json({ ok: true }));
app.use("/api/auth",    authRouter);
app.use("/api",         goalsRouter);
app.use("/api", pensionRouter);
app.use("/api/tax",     taxRouter);
app.use("/api",         fpRouter);
app.use("/api",         fpAliasesRouter);
app.use("/api/clients", clientsRouter);
app.use("/api",         fpFullRouter);
app.use("/api",         simulateRouter);
app.use("/api",         simulationRouter);   // ← FIX 1: mounts /api/simulation/:clientId/*
app.use("/api/reports", reportsRouter);
app.use("/api",         lettersRouter);


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
