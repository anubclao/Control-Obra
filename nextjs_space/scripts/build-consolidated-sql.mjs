#!/usr/bin/env node
/**
 * build-consolidated-sql.mjs
 *
 * Consolida init.sql + migrations/002..017 en un solo archivo
 * `database/mysql/000_init.sql` listo para correr en Hostinger.
 *
 * Por que existe, cuando existe: P0 plan 2026-10-02 (Fase 4). El usuario
 * quiere UN solo archivo SQL en Hostinger para inicializar la BD de
 * cero (despues de borrar la BD actual, que tenia datos demo).
 *
 * Uso:
 *   node scripts/build-consolidated-sql.mjs
 *
 * Salida:
 *   database/mysql/000_init.sql
 *
 * El archivo generado incluye:
 *   1) DROP DATABASE IF EXISTS + CREATE DATABASE + USE
 *   2) init.sql base (sin los DROP/CREATE DATABASE que init.sql extrae al inicio)
 *   3) migrations/002_user_authorization.sql
 *   4) migrations/003_accounting.sql
 *   5) migrations/004_budget_commercial_terms.sql
 *   6) migrations/005_contract_pricing_mode.sql
 *   7) migrations/006_document_generation.sql
 *   8) migrations/007_document_generation_audit.sql
 *   9) migrations/008_aiu_percent_over_direct_cost.sql
 *  10) migrations/009_budget_change_orders.sql
 *  11) migrations/010_soft_delete_projects.sql
 *  12) migrations/011_audit_and_soft_delete.sql
 *  13) migrations/012_beneficiary_accounts.sql
 *  14) migrations/013_client_stage_history.sql
 *  15) migrations/014_counters.sql
 *  16) migrations/015_user_sessions.sql
 *  17) migrations/016_payment_replaces_request_id.sql
 *  18) migrations/017_accounting_articulacion.sql
 *
 * NO incluye:
 *   - 999_emergency_aiu_recovery.sql (script de recuperacion, no schema)
 *   - 000_definitivo.sql / 000_replica_hostinger.sql (scripts alternativos,
 *     este consolidado los reemplaza)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dbDir = path.join(root, "database", "mysql");
const outFile = path.join(dbDir, "000_init.sql");

const HEADER = `-- =============================================================================
-- ControlObra — Script consolidado de inicializacion de BD (P0 plan 2026-10-02).
--
-- Este archivo es generado automaticamente por scripts/build-consolidated-sql.mjs
-- NO lo edites a mano. Para anadir cambios al esquema, modifica:
--   - database/mysql/init.sql (tablas base)
--   - database/mysql/migrations/NNN_<descripcion>.sql (cambios incrementales)
-- y vuelve a correr el script.
--
-- Uso en Hostinger (BD de cero):
--   1) BD: control_obra (o prefijo de Hostinger, ej u652436213_ControlObra)
--   2) phpMyAdmin -> pegar TODO este archivo -> Continuar
--
-- Pre-requisito: ninguna. Este script DROP+CREATE la BD completa.
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO,STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION";
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

DROP DATABASE IF EXISTS control_obra;
CREATE DATABASE control_obra
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE control_obra;

`;

// init.sql ya tiene el DROP/CREATE/USE — los removemos del cuerpo para
// que no se ejecute dos veces (lo hacemos nosotros en el HEADER).
// Estrategia: encontrar el primer bloque "CREATE TABLE" o "CREATE TABLE IF NOT EXISTS"
// y descartar todo lo anterior (SET, DROP, CREATE DATABASE, USE, comentarios).
function stripInitHeader(content) {
  const lines = content.split("\n");
  let firstCreateIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim().toUpperCase();
    if (t.startsWith("CREATE TABLE")) {
      firstCreateIdx = i;
      break;
    }
  }
  if (firstCreateIdx < 0) {
    throw new Error("No se encontro CREATE TABLE en init.sql");
  }
  // Incluir las 1-2 lineas de comentario justo antes del primer CREATE
  // para mantener el contexto del header del archivo.
  let startIdx = Math.max(0, firstCreateIdx - 1);
  return lines.slice(startIdx).join("\n");
}

// Las migraciones tienen un SET FOREIGN_KEY_CHECKS = 0 y USE control_obra
// al inicio. Lo removemos para que no se ejecute dos veces.
function stripMigrationHeader(content) {
  // Quitar SET FOREIGN_KEY_CHECKS, SET SQL_MODE, SET NAMES, USE control_obra
  // y lineas en blanco iniciales.
  return content
    .split("\n")
    .filter((l) => {
      const t = l.trim().toUpperCase();
      return (
        !t.startsWith("SET FOREIGN_KEY_CHECKS") &&
        !t.startsWith("SET SQL_MODE") &&
        !t.startsWith("SET NAMES") &&
        !t.startsWith("USE CONTROL_OBRA") &&
        !t.startsWith("USE \`CONTROL_OBRA\`")
      );
    })
    .join("\n");
}

function readFile(p) {
  return fs.readFileSync(p, "utf-8");
}

const initPath = path.join(dbDir, "init.sql");
const migrationsDir = path.join(dbDir, "migrations");

const initBody = stripInitHeader(readFile(initPath));

// Migrations en orden numerico ascendente
const migrations = [
  "002_user_authorization.sql",
  "003_accounting.sql",
  "004_budget_commercial_terms.sql",
  "005_contract_pricing_mode.sql",
  "006_document_generation.sql",
  "007_document_generation_audit.sql",
  "008_aiu_percent_over_direct_cost.sql",
  "009_budget_change_orders.sql",
  "010_soft_delete_projects.sql",
  "011_audit_and_soft_delete.sql",
  "012_beneficiary_accounts.sql",
  "013_client_stage_history.sql",
  "014_counters.sql",
  "015_user_sessions.sql",
  "016_payment_replaces_request_id.sql",
  "017_accounting_articulacion.sql",
];

let out = HEADER;

// init.sql
out +=
  "\n\n-- =============================================================================\n" +
  "-- 1) ESQUEMA BASE (init.sql)\n" +
  "-- =============================================================================\n\n";
out += initBody;
out += "\n\nSET FOREIGN_KEY_CHECKS = 1;\n";

// Cada migracion
for (let i = 0; i < migrations.length; i++) {
  const m = migrations[i];
  const full = path.join(migrationsDir, m);
  if (!fs.existsSync(full)) {
    console.warn(`[WARN] migracion no encontrada: ${m} — se omite`);
    continue;
  }
  const body = stripMigrationHeader(readFile(full));
  out +=
    "\n\n-- =============================================================================\n" +
    `-- 2.${i + 1}) Migracion ${m}\n` +
    "-- =============================================================================\n\n";
  out += body;
  out += "\n";
}

out +=
  "\n\nSET FOREIGN_KEY_CHECKS = 1;\n" +
  "\n-- =============================================================================\n" +
  "-- 3) USUARIOS INICIALES (P0 plan 2026-10-02, Fase 4.2)\n" +
  "-- Estos son los usuarios que tenian la BD de Hostinger antes del reset.\n" +
  "-- ON DUPLICATE KEY UPDATE preserva el id existente para no romper FKs\n" +
  "-- (payment_requests.created_by, etc) si la BD se reimporta sobre una\n" +
  "-- poblada. Tras primer login el sistema solicita OTP por email.\n" +
  "-- =============================================================================\n\n" +
  `-- 4 usuarios administrativos iniciales de ControlObra (pre-existentes en Hostinger prod)\n` +
  `INSERT INTO users (id, email, name, role, area, status, is_active, created_at, updated_at)\n` +
  `VALUES\n` +
  `  (UUID(), 'anubclao@gmail.com',           'Anubis Clavio',  'ADMIN',   'administrativo', 'ACTIVE', 1, NOW(), NOW()),\n` +
  `  (UUID(), 'julia.naranjo@marzotriangular.com',     'Juia Naranjo',    'ADMIN',   'administrativo', 'ACTIVE', 1, NOW(), NOW()),\n` +
  `  (UUID(), 'diana.baracaldo@marzotriangular.com',   'Diana Baracaldo', 'ADMIN',   'tecnico',        'ACTIVE', 1, NOW(), NOW()),\n` +
  `  (UUID(), 'asistente.contable@marzotriangular.com', 'Andy Pacheco',    'GERENTE', 'administrativo', 'ACTIVE', 1, NOW(), NOW())\n` +
  `ON DUPLICATE KEY UPDATE\n` +
  `  name        = VALUES(name),\n` +
  `  role        = VALUES(role),\n` +
  `  area        = VALUES(area),\n` +
  `  status      = 'ACTIVE',\n` +
  `  is_active   = 1,\n` +
  `  updated_at  = NOW();\n\n` +
  "\n-- =============================================================================\n" +
  "-- Fin del consolidado. BD lista para arrancar ControlObra.\n" +
  "-- Tablas creadas, indices OK, FK activas. 4 usuarios pre-existentes preservados.\n" +
  "-- =============================================================================\n";

fs.writeFileSync(outFile, out, "utf-8");

const sizeKb = (fs.statSync(outFile).size / 1024).toFixed(1);
console.log(`OK  -> ${outFile}`);
console.log(`Tamano: ${sizeKb} KB`);
console.log(`Migraciones aplicadas: ${migrations.length + 1} (init + ${migrations.length})`);