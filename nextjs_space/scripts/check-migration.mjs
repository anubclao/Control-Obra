// scripts/check-migration.mjs
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

const [logTbl] = await conn.query("SHOW TABLES LIKE 'document_generation_log'");
console.log(
  `  ${logTbl.length === 0 ? "❌" : "✅"} tabla document_generation_log: ${logTbl.length === 0 ? "FALTA" : "OK"}`,
);

const mappings = [
  { entity: "payments", tableCandidates: ["payment_requests"] },
  { entity: "expenses", tableCandidates: ["expenses"] },
  { entity: "cuts", tableCandidates: ["work_cuts", "cuts"] },
  { entity: "contracts", tableCandidates: ["contracts"] },
  { entity: "employees", tableCandidates: ["employees"] },
  { entity: "workLogs", tableCandidates: ["work_logs"] },
];
for (const { entity, tableCandidates } of mappings) {
  let realTable = null;
  for (const t of tableCandidates) {
    const [tt] = await conn.query(`SHOW TABLES LIKE '${t}'`);
    if (tt.length > 0) {
      realTable = t;
      break;
    }
  }
  if (!realTable) {
    console.log(
      `  ❌ ${entity} (${tableCandidates.join("/")}): tabla no existe`,
    );
    continue;
  }
  const [cols] = await conn.query(
    `SHOW COLUMNS FROM \`${realTable}\` LIKE 'generated_document_url'`,
  );
  console.log(
    `  ${cols.length === 0 ? "❌" : "✅"} ${entity} (tabla \`${realTable}\`): ${cols.length === 0 ? "FALTA columna" : "OK"}`,
  );
}

await conn.end();
