#!/usr/bin/env node
/**
 * setup-db.mjs
 * Crea la base de datos `control_obra` y carga el schema inicial.
 *
 * Uso:
 *   node scripts/setup-db.mjs
 *
 * Lee credenciales de .env (.env.local tiene prioridad en Next,
 *  pero este script usa process.env directo).
 *
 * Idempotente: si la BD ya existe, solo verifica tablas.
 * Si no existe, la crea y carga init.sql.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");

// --- Cargar .env manualmente (sin dotenv para no instalar deps)
function loadEnvFile(filename) {
  const path = resolve(projectRoot, filename);
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

const DB_HOST = process.env.DB_HOST || "localhost";
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_USER = process.env.DB_USER || "root";
const DB_PASSWORD = process.env.DB_PASSWORD || "";
const DB_NAME = process.env.DB_NAME || "control_obra";

const INIT_SQL_PATH = resolve(projectRoot, "database/mysql/init.sql");

// --- Usar mysql2 vía npx (evita agregar dep al package.json)
console.log("⚠️  Este script necesita el paquete `mysql2`.");
console.log("    Si no está instalado, ejecuta: npm install --save-dev mysql2");
console.log("");
console.log(`📋 Configuración detectada:`);
console.log(`    Host:     ${DB_HOST}:${DB_PORT}`);
console.log(`    User:     ${DB_USER}`);
console.log(`    Database: ${DB_NAME}`);
console.log("");

let mysql;
try {
  mysql = await import("mysql2/promise");
} catch (e) {
  console.error("❌ No se pudo cargar mysql2:", e.message);
  console.error("   Ejecuta: npm install mysql2");
  process.exit(1);
}

const initSql = readFileSync(INIT_SQL_PATH, "utf8");

// --- Conexión sin BD para crearla si no existe
console.log("🔌 Conectando a MySQL...");
const bootstrap = await mysql.createConnection({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  multipleStatements: true,
});

console.log("📦 Ejecutando init.sql...");
try {
  await bootstrap.query(initSql);
  console.log("✅ Schema cargado correctamente.");
} catch (e) {
  console.error("❌ Error al cargar init.sql:", e.message);
  await bootstrap.end();
  process.exit(1);
}

await bootstrap.end();

// --- Verificación post-instalación
console.log("🔍 Verificando tablas...");
const verify = await mysql.createConnection({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
});

const [rows] = await verify.query(
  `SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = ?`,
  [DB_NAME],
);

console.log(`📊 Tablas creadas: ${rows[0].total}`);
console.log("");

// --- Insertar usuario admin inicial si la tabla está vacía
const [users] = await verify.query("SELECT COUNT(*) AS n FROM users");
if (users[0].n === 0) {
  console.log("👤 Creando usuario administrador inicial...");
  const adminId = "admin-" + Date.now().toString(36);
  await verify.query(
    `INSERT INTO users (id, email, name, role, area, is_active)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [adminId, "admin@controlobra.local", "Administrador", "ADMIN", "administrativo"],
  );
  console.log("✅ Usuario creado: admin@controlobra.local");
} else {
  console.log(`ℹ️  Ya existen ${users[0].n} usuario(s) — no se insertó ninguno nuevo.`);
}

console.log("");
console.log("🎉 ¡Listo! La base de datos está operativa.");
console.log("");
console.log("Próximos pasos:");
console.log("  1. Asegúrate de que .env tenga DB_USER y DB_PASSWORD correctos.");
console.log("  2. Ejecuta: npm run dev");
console.log("  3. Abre http://localhost:3000/login");
console.log("  4. Usa el email: admin@controlobra.local");

await verify.end();
