import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { authRouter }    from "./routes/auth.js";
import { clientsRouter } from "./routes/clients.js";
import { fpRouter }      from "./routes/fp.js";
import { fpFullRouter }  from "./routes/fp-full.js";
import { simulateRouter } from "./routes/simulate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT ?? "5000", 10);

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL ?? "http://localhost:5173", credentials: true }));
app.use(express.json({ limit: "10mb" }));

app.use("/api/auth",    authRouter);
app.use("/api/clients", clientsRouter);
app.use("/api",         fpRouter);
app.use("/api",         fpFullRouter);
app.use("/api",         simulateRouter);
app.get("/api/health",  (_req, res) => res.json({ ok: true }));

if (process.env.NODE_ENV === "production") {
    const dist = path.join(__dirname, "../client");
    app.use(express.static(dist, {
       setHeaders: (res, filePath) => {
         if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript');
         if (filePath.endsWith('.css')) res.setHeader('Content-Type', 'text/css');
    }
  }));
    app.get("*", (req, res) => {
       if (req.path.includes(".")) {
         res.status(404).send("Not found");
       return;
       }
    res.sendFile(path.join(dist, "index.html"));
});
}

app.listen(PORT, "0.0.0.0", () => console.log(`✅  FP running on :${PORT}`));
export default app;
