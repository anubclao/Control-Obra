// scripts/apply-migration.mjs
// Aplica una migración SQL a la BD + ejecuta pasos post-migración
// programáticos (information_schema guards para ALTER TABLE ADD COLUMN,
// ya que MySQL 8.0 no soporta IF NOT EXISTS en ADD COLUMN).
//
// Uso: node scripts/apply-migration.mjs [ruta/al/archivo.sql]
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

const migrationPath =
  process.argv[2] || "database/mysql/migrations/006_document_generation.sql";
const fullPath = resolve(projectRoot, migrationPath);
if (!existsSync(fullPath)) {
  console.error(`❌ No existe: ${fullPath}`);
  process.exit(1);
}
const sql = readFileSync(fullPath, "utf8");
console.log(`📄 Aplicando: ${migrationPath}`);

function splitSqlStatements(text) {
  const lines = text.split(/\r?\n/);
  const out = [];
  let buf = [];
  let delim = ";";

  const flush = () => {
    const t = buf.join("\n").trim();
    if (t) out.push(t);
    buf = [];
  };

  for (const raw of lines) {
    const t = raw.trim();
    if (t.startsWith("DELIMITER ")) {
      flush();
      const nd = t.slice("DELIMITER ".length).trim();
      delim = nd === "//" || nd === ";" ? nd : ";";
      continue;
    }
    if (delim === "//" && t === "//") {
      flush();
      continue;
    }
    if (delim === ";" && t === ";") {
      flush();
      continue;
    }
    buf.push(raw);
  }
  flush();
  return out;
}

const mysql = await import("mysql2/promise");
const conn = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  multipleStatements: true,
});

// 1) Aplicar statements del .sql
const statements = splitSqlStatements(sql);
let ok = 0,
  fail = 0;
for (let i = 0; i < statements.length; i++) {
  const stmt = statements[i];
  if (!stmt) continue;
  const firstLine = stmt.split("\n")[0].slice(0, 70);
  try {
    await conn.query(stmt);
    ok++;
    console.log(`  ✅ sql #${i + 1} ${firstLine}`);
  } catch (e) {
    fail++;
    console.log(`  ❌ sql #${i + 1} ${e.code}: ${e.sqlMessage}`);
    console.log(`     ${firstLine}`);
  }
}

// 2) Pasos post-migración programáticos (information_schema guards).
// Detección por prefijo del nombre del archivo de migración.
const fileName = migrationPath.split(/[/\\]/).pop() ?? "";
let columnsToAdd = [];

// F3: columnas generated_document_url en las 6 entidades
if (/^006_/.test(fileName)) {
  columnsToAdd = [
    ["payment_requests", "generated_document_url", "TEXT NULL"],
    ["expenses", "generated_document_url", "TEXT NULL"],
    ["work_cuts", "generated_document_url", "TEXT NULL"],
    ["contracts", "generated_document_url", "TEXT NULL"],
    ["employees", "generated_document_url", "TEXT NULL"],
    ["work_logs", "generated_document_url", "TEXT NULL"],
  ];
}

// F4: columnas de auditoría en document_generation_log
if (/^007_/.test(fileName)) {
  columnsToAdd = [
    ["document_generation_log", "ip", "VARCHAR(64) NULL"],
    ["document_generation_log", "user_agent", "VARCHAR(255) NULL"],
    ["document_generation_log", "attempts", "TINYINT UNSIGNED NULL"],
    ["document_generation_log", "template_version", "VARCHAR(16) NULL"],
  ];
}

if (columnsToAdd.length) {
  console.log("\n📐 Columnas adicionales:");
} else {
  console.log("");
}

for (const [table, column, def] of columnsToAdd) {
  try {
    // Verificar si la tabla existe
    const [tables] = await conn.query(
      "SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
      [table],
    );
    if (tables[0].n === 0) {
      console.log(`  ⚠️  ${table}: tabla no existe, saltando`);
      continue;
    }
    // Verificar si la columna existe
    const [cols] = await conn.query(
      "SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
      [table, column],
    );
    if (cols[0].n > 0) {
      console.log(`  ℹ️  ${table}.${column}: ya existe`);
      continue;
    }
    await conn.query(
      `ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${def}`,
    );
    console.log(`  ✅ ${table}.${column}: agregada`);
  } catch (e) {
    fail++;
    console.log(`  ❌ ${table}.${column}: ${e.code}: ${e.sqlMessage}`);
  }
}

console.log(`\nResultado: ${ok} sql OK, ${fail} FALLÓ`);
await conn.end();
process.exit(fail > 0 ? 1 : 0);
