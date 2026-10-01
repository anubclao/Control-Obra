// scripts/seed-smoke.mjs
// Inserta datos mínimos para el smoke test del feature F2:
//  - 1 proyecto (P001 / "Demo Smoke")
//  - 1 payment de ANTICIPO contra ese proyecto
//  - 1 payment de LEGALIZACION (para probar LEG también)
//  - 1 expense de COMPRA (para probar OC)
//
// Idempotente: si ya existen filas con esos códigos/fechas, las omite.
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

// 1) Proyecto
const projectId = "prj-smoke-001";
const [existingProject] = await conn.query(
  "SELECT id FROM projects WHERE id = ?",
  [projectId],
);
if (existingProject.length === 0) {
  await conn.query(
    `INSERT INTO projects (id, code, name, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, NOW(), NOW())`,
    [projectId, "P001", "Demo Smoke F2", "ACTIVE"],
  );
  console.log("✅ Proyecto creado:", projectId);
} else {
  console.log("ℹ️  Proyecto ya existe:", projectId);
}

// 2) Payment ANTICIPO
const payAntId = "pay-smoke-ant";
const [existingPay] = await conn.query(
  "SELECT id FROM payment_requests WHERE id = ?",
  [payAntId],
);
if (existingPay.length === 0) {
  await conn.query(
    `INSERT INTO payment_requests
       (id, type, status, project_id, amount, requester_name, requester_id_number,
        bank_name, bank_account, justification, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      payAntId,
      "ANTICIPO",
      "PENDIENTE",
      projectId,
      1500000,
      "Juan Pérez Demo",
      "79.123.456",
      "Bancolombia",
      "123-456789-00",
      "Anticipo para compra de materiales de obra (smoke F2).",
    ],
  );
  console.log("✅ Payment ANTICIPO creado:", payAntId);
} else {
  console.log("ℹ️  Payment ANTICIPO ya existe:", payAntId);
}

// 3) Payment LEGALIZACION
const payLegId = "pay-smoke-leg";
const [existingLeg] = await conn.query(
  "SELECT id FROM payment_requests WHERE id = ?",
  [payLegId],
);
if (existingLeg.length === 0) {
  await conn.query(
    `INSERT INTO payment_requests
       (id, type, status, project_id, amount, requester_name, requester_id_number,
        bank_name, bank_account, justification, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      payLegId,
      "LEGALIZACION",
      "PENDIENTE",
      projectId,
      2300000,
      "Juan Pérez Demo",
      "79.123.456",
      "Bancolombia",
      "123-456789-00",
      "Legalización de gastos menores de la primera quincena (smoke F2).",
    ],
  );
  console.log("✅ Payment LEGALIZACION creado:", payLegId);
} else {
  console.log("ℹ️  Payment LEGALIZACION ya existe:", payLegId);
}

// 4) Expense COMPRA (OC)
const expOcId = "exp-smoke-oc";
const [existingExp] = await conn.query("SELECT id FROM expenses WHERE id = ?", [
  expOcId,
]);
if (existingExp.length === 0) {
  await conn.query(
    `INSERT INTO expenses
       (id, type, status, project_id, amount, provider_name, provider_nit, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      expOcId,
      "COMPRA",
      "PENDIENTE",
      projectId,
      5800000,
      "Hierros del Sur S.A.S.",
      "900.123.456-7",
      "Compra de varillas y cemento (smoke F2).",
    ],
  );
  console.log("✅ Expense COMPRA creado:", expOcId);
} else {
  console.log("ℹ️  Expense COMPRA ya existe:", expOcId);
}

console.log("\n🎯 IDs para smoke test:");
console.log("   payment ANTICIPO    :", payAntId);
console.log("   payment LEGALIZACION:", payLegId);
console.log("   expense COMPRA      :", expOcId);

await conn.end();
