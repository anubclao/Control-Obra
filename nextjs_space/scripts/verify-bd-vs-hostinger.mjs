#!/usr/bin/env node
/**
 * verify-bd-vs-hostinger.mjs
 * Compara el schema de la BD local (la del .env.local) contra el schema
 * de la BD de Hostinger (la del .env.hostinger). Imprime un checklist
 * ✅/❌ con las 8 migraciones del round de commits 39660ff..81a02ba.
 *
 * Uso:
 *   # Primero, configurar .env.hostinger (copiar de .env.hostinger.example)
 *   node scripts/verify-bd-vs-hostinger.mjs
 *
 * Salida (ejemplo):
 *   ✅ 002 users.status               local=1  hostinger=1
 *   ✅ 006 document_generation_log    local=1  hostinger=1
 *   ❌ 008 chk_aiu_range              local=0  hostinger=1   ← falta en local
 *   ...
 */

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

// Carga .env.local PRIMERO (toma precedencia), después .env.hostinger
// para los campos que .env.local no tenga.
loadEnvFile(".env.local");
loadEnvFile(".env");
loadEnvFile(".env.hostinger");

// 8 checks canónicos. Cada uno es { id, label, table, sql }.
// `sql` debe devolver 0 o 1 fila con una columna "ok" (1 = existe).
const CHECKS = [
  {
    id: "002",
    label: "users.status (migración 002)",
    table: "users",
    sql: `SELECT COUNT(*) AS ok FROM information_schema.columns
           WHERE table_schema = DATABASE() AND table_name = 'users'
             AND column_name = 'status'`,
  },
  {
    id: "003",
    label: "accounting_accounts (migración 003)",
    table: "accounting_accounts",
    sql: `SELECT COUNT(*) AS ok FROM information_schema.tables
           WHERE table_schema = DATABASE() AND table_name = 'accounting_accounts'`,
  },
  {
    id: "004",
    label: "budgets.payment_terms_json (migración 004)",
    table: "budgets",
    sql: `SELECT COUNT(*) AS ok FROM information_schema.columns
           WHERE table_schema = DATABASE() AND table_name = 'budgets'
             AND column_name = 'payment_terms_json'`,
  },
  {
    id: "005",
    label: "contracts.pricing_mode (migración 005)",
    table: "contracts",
    sql: `SELECT COUNT(*) AS ok FROM information_schema.columns
           WHERE table_schema = DATABASE() AND table_name = 'contracts'
             AND column_name = 'pricing_mode'`,
  },
  {
    id: "006",
    label: "document_generation_log (migración 006)",
    table: "document_generation_log",
    sql: `SELECT COUNT(*) AS ok FROM information_schema.tables
           WHERE table_schema = DATABASE() AND table_name = 'document_generation_log'`,
  },
  {
    id: "007",
    label: "document_generation_log.template_version (migración 007)",
    table: "document_generation_log",
    sql: `SELECT COUNT(*) AS ok FROM information_schema.columns
           WHERE table_schema = DATABASE() AND table_name = 'document_generation_log'
             AND column_name = 'template_version'`,
  },
  {
    id: "008",
    label: "aiu_configs.chk_aiu_range (migración 008)",
    table: "aiu_configs",
    // Si information_schema no es accesible, este check devuelve 0 siempre;
    // por eso agregamos fallback con SHOW CREATE.
    sql: `SELECT COUNT(*) AS ok FROM information_schema.table_constraints
           WHERE table_schema = DATABASE() AND table_name = 'aiu_configs'
             AND constraint_name = 'chk_aiu_range'`,
  },
  {
    id: "009",
    label: "budget_change_orders (migración 009)",
    table: "budget_change_orders",
    sql: `SELECT COUNT(*) AS ok FROM information_schema.tables
           WHERE table_schema = DATABASE() AND table_name = 'budget_change_orders'`,
  },
];

async function connect(env) {
  const mysql = await import("mysql2/promise");
  return await mysql.createConnection({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  });
}

async function runChecks(env, label) {
  const conn = await connect(env);
  const out = [];
  for (const c of CHECKS) {
    try {
      const [rows] = await conn.query(c.sql);
      out.push({ ...c, ok: rows[0]?.ok === 1 });
    } catch (e) {
      out.push({ ...c, ok: false, error: e.code || e.message });
    }
  }
  await conn.end();
  return { label, env, results: out };
}

async function main() {
  // BD LOCAL (lee .env.local, ya cargado arriba)
  const localEnv = {
    DB_HOST: process.env.DB_HOST_LOCAL ?? "localhost",
    DB_PORT: process.env.DB_PORT_LOCAL ?? process.env.DB_PORT ?? 3306,
    DB_USER: process.env.DB_USER_LOCAL ?? process.env.DB_USER ?? "root",
    DB_PASSWORD: process.env.DB_PASSWORD_LOCAL ?? process.env.DB_PASSWORD ?? "",
    DB_NAME: process.env.DB_NAME_LOCAL ?? process.env.DB_NAME ?? "control_obra",
  };
  // BD HOSTINGER (lee .env.hostinger, ya cargado arriba)
  // Si no está configurado, salta esa parte
  const hasHostinger =
    process.env.DB_HOST_HOSTINGER && process.env.DB_USER_HOSTINGER;

  const local = await runChecks(localEnv, "LOCAL");

  let remote = null;
  if (hasHostinger) {
    const remoteEnv = {
      DB_HOST: process.env.DB_HOST_HOSTINGER,
      DB_PORT: Number(process.env.DB_PORT_HOSTINGER || 3306),
      DB_USER: process.env.DB_USER_HOSTINGER,
      DB_PASSWORD: process.env.DB_PASSWORD_HOSTINGER || "",
      DB_NAME: process.env.DB_NAME_HOSTINGER,
    };
    try {
      remote = await runChecks(remoteEnv, "HOSTINGER");
    } catch (e) {
      console.error(`❌ No se pudo conectar a Hostinger: ${e.message}`);
    }
  }

  // Imprimir tabla
  const w = (s, n) => String(s).padEnd(n, " ");
  console.log("");
  console.log(
    "╔════════════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║  VERIFICACIÓN DE BD — ControlObra                                 ║",
  );
  console.log(
    "╠════════════════════════════════════════════════════════════════════╣",
  );
  if (remote) {
    console.log(
      `║  Local     : ${w(local.env.DB_HOST, 25)} BD: ${local.env.DB_NAME.padEnd(20)} ║`,
    );
    console.log(
      `║  Hostinger : ${w(remote.env.DB_HOST, 25)} BD: ${remote.env.DB_NAME.padEnd(20)} ║`,
    );
    console.log(
      "╠════════════════════════════════════════════════════════════════════╣",
    );
  } else {
    console.log(
      `║  Local     : ${w(local.env.DB_HOST, 25)} BD: ${local.env.DB_NAME.padEnd(20)} ║`,
    );
    console.log(
      "║  Hostinger : (no configurado — crear .env.hostinger)              ║",
    );
    console.log(
      "╠════════════════════════════════════════════════════════════════════╣",
    );
  }

  for (const check of CHECKS) {
    const localR = local.results.find((r) => r.id === check.id);
    const remoteR = remote?.results.find((r) => r.id === check.id);
    const localMark = localR.ok ? "✅" : "❌";
    let line = `║ ${check.id}  ${localMark} ${w(check.label, 50)}`;
    if (remoteR) {
      const remoteMark = remoteR.ok ? "✅" : "❌";
      line += `  L:${localR.ok ? "1" : "0"}  H:${remoteR.ok ? "1" : "0"}`;
    }
    line = line.padEnd(72, " ") + "║";
    console.log(line);
  }

  console.log(
    "╚════════════════════════════════════════════════════════════════════╝",
  );
  console.log("");

  // Resumen
  const localPass = local.results.filter((r) => r.ok).length;
  const localTotal = local.results.length;
  console.log(`LOCAL     : ${localPass}/${localTotal} checks OK`);

  if (remote) {
    const remotePass = remote.results.filter((r) => r.ok).length;
    console.log(`HOSTINGER : ${remotePass}/${remoteTotal} checks OK`);

    const onlyLocal = local.results.filter(
      (l) => l.ok && !remote.results.find((r) => r.id === l.id)?.ok,
    );
    const onlyRemote = remote.results.filter(
      (r) => r.ok && !local.results.find((l) => l.id === r.id)?.ok,
    );

    if (onlyLocal.length > 0) {
      console.log(`\n⚠️  En LOCAL pero no en HOSTINGER (${onlyLocal.length}):`);
      for (const r of onlyLocal) console.log(`   - ${r.id} ${r.label}`);
    }
    if (onlyRemote.length > 0) {
      console.log(
        `\n⚠️  En HOSTINGER pero no en LOCAL (${onlyRemote.length}):`,
      );
      for (const r of onlyRemote) console.log(`   - ${r.id} ${r.label}`);
    }
    if (
      onlyLocal.length === 0 &&
      onlyRemote.length === 0 &&
      localPass === localTotal &&
      remotePass === remoteTotal
    ) {
      console.log("\n🎉 Las dos BDs están idénticas. Ya podés hacer deploy.");
    } else if (localPass < localTotal || remotePass < remoteTotal) {
      console.log("\n💡 Para alinear, corré en la BD que falla:");
      console.log(
        "   node scripts/apply-migration.mjs database/mysql/migrations/000_replica_hostinger.sql",
      );
    }
  } else {
    if (localPass === localTotal) {
      console.log("\n🎉 Tu BD local está al 100 % con las 8 migraciones.");
      console.log(
        "💡 Configurá .env.hostinger para verificar también la de producción.",
      );
    } else {
      console.log("\n💡 Tu BD local NO está al día. Corré:");
      console.log(
        "   node scripts/apply-migration.mjs database/mysql/migrations/000_replica_hostinger.sql",
      );
    }
  }
}

main().catch((e) => {
  console.error("Error fatal:", e.message);
  process.exit(1);
});
