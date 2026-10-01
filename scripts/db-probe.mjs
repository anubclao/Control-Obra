// scripts/db-probe.mjs
// Sonda rápida de la BD: cuenta filas en cada tabla relevante
// y muestra 1 fila de payments/expenses para tener un entityId.
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

function loadEnvFile(filename) {
  const path = resolve(projectRoot, filename);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
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

const tables = [
  "users",
  "projects",
  "payment_requests",
  "expenses",
  "contracts",
  "employees",
  "work_logs",
];
console.log("=== Conteos ===");
for (const t of tables) {
  try {
    const [r] = await conn.query(`SELECT COUNT(*) AS n FROM ${t}`);
    console.log(`  ${t.padEnd(20)} ${r[0].n}`);
  } catch (e) {
    console.log(`  ${t.padEnd(20)} ERROR: ${e.code}`);
  }
}

console.log("\n=== Primer payment (si existe) ===");
const [pays] = await conn.query(
  "SELECT id, type, status, project_id, amount, created_at FROM payment_requests ORDER BY created_at DESC LIMIT 3",
);
console.log(pays);

console.log("\n=== Primer proyecto ===");
const [projs] = await conn.query(
  "SELECT id, code, name, status FROM projects LIMIT 3",
);
console.log(projs);

console.log("\n=== Usuarios activos ===");
const [us] = await conn.query(
  "SELECT id, email, name, role FROM users WHERE is_active = 1",
);
console.log(us);

await conn.end();
