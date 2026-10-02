// scripts/describe-tables.mjs
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
function loadEnvFile(filename) {
  const p = resolve(projectRoot, filename);
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}
loadEnvFile(".env.local");
const mysql = await import("mysql2/promise");
const conn = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});
for (const t of [
  "projects",
  "payment_requests",
  "expenses",
  "contracts",
  "employees",
  "work_logs",
  "users",
]) {
  try {
    const [cols] = await conn.query(`SHOW COLUMNS FROM ${t}`);
    console.log(`\n=== ${t} ===`);
    for (const c of cols) {
      const nullable = c.Null === "YES" ? "NULL" : "NOT NULL";
      const def = c.Default === null ? "" : ` default=${c.Default}`;
      console.log(
        `  ${c.Field.padEnd(28)} ${c.Type.padEnd(28)} ${nullable}${def}`,
      );
    }
  } catch (e) {
    console.log(`\n${t}: ${e.code}`);
  }
}
await conn.end();
