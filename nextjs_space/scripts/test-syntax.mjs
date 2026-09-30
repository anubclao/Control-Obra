// scripts/test-syntax.mjs
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

// Probar 1: IF NOT EXISTS directo
try {
  await conn.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS test_col_1 INT NULL",
  );
  console.log("✅ Test 1: ALTER TABLE ... ADD COLUMN IF NOT EXISTS funciona");
  await conn.query("ALTER TABLE users DROP COLUMN test_col_1");
} catch (e) {
  console.log("❌ Test 1 falla:", e.sqlMessage);
}

// Probar 2: usar information_schema guard
try {
  const [r] = await conn.query(
    "SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='test_col_2'",
  );
  if (r[0].n === 0) {
    await conn.query("ALTER TABLE users ADD COLUMN test_col_2 INT NULL");
    console.log("✅ Test 2: information_schema guard funciona");
    await conn.query("ALTER TABLE users DROP COLUMN test_col_2");
  } else {
    console.log("ℹ️  Test 2: columna ya existe");
  }
} catch (e) {
  console.log("❌ Test 2 falla:", e.sqlMessage);
}

await conn.end();
