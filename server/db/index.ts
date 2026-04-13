import { drizzle } from "drizzle-orm/mssql-serverless";
import * as mssql from "mssql";
import * as schema from "../../shared/schema.js";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

// Parse connection string format:
// mssql://user:pass@server/database  OR  use individual env vars
const url = process.env.DATABASE_URL;

let config: mssql.config;

if (url.startsWith("mssql://") || url.startsWith("sqlserver://")) {
  // Parse URL format
  const u = new URL(url.replace("mssql://","https://").replace("sqlserver://","https://"));
  config = {
    server:   u.hostname,
    database: u.pathname.slice(1),
    user:     u.username ? decodeURIComponent(u.username) : undefined,
    password: u.password ? decodeURIComponent(u.password) : undefined,
    options:  { trustServerCertificate: true, enableArithAbort: true },
    port:     u.port ? parseInt(u.port) : 1433,
  };
} else {
  // Fallback: individual env vars
  config = {
    server:   process.env.DB_SERVER ?? "localhost",
    database: process.env.DB_NAME ?? "fp_standalone",
    user:     process.env.DB_USER,
    password: process.env.DB_PASS,
    options:  { trustServerCertificate: true, enableArithAbort: true, instanceName: process.env.DB_INSTANCE },
    port:     process.env.DB_PORT ? parseInt(process.env.DB_PORT) : undefined,
  };
}

const pool = await mssql.connect(config);
export const db = drizzle(pool, { schema });
export { pool };
