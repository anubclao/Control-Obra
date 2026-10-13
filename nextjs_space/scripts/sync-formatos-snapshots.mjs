// ==========================================================================
// ⚠️  DO NOT UNIFY FILENAMES WITH FORMATOS/                             ⚠️
// ==========================================================================
// FORMATOS/ usa nombres largos del área legal (source-of-truth).
// formatos-snapshots/ usa nombres cortos canónicos (los que esperan
// los tests). Renombrar uno rompe el otro. Ver R8 en
// docs/specs/audit-formatos-snapshots-wiring.md §R8.
// ==========================================================================
//
// ==========================================================================
// ⚠️  SI TOCAS ESTE ARCHIVO, MIRA EL SPEC PRIMERO                      ⚠️
// ==========================================================================
// El spec define AC-3 (resolución FORMATOS_DIR), AC-4 (NAME_MAP),
// AC-5 (warning para archivos no-mapeados), AC-6 (idempotencia), AC-7
// (output legible) y AC-9 (mensaje de aborto claro). Cualquier
// cambio debe justificarse contra el spec.
// ==========================================================================

/**
 * scripts/sync-formatos-snapshots.mjs
 *
 * Sincroniza /FORMATOS/<archivos oficiales del área legal> →
 * src/lib/document-generator/formatos-snapshots/<archivos canónicos>.
 *
 * Wired como vitest globalSetup (ver vitest.config.mjs). Es
 * idempotente: el test runner lo llama en cada `npm test` sin
 * costo cuando no hay cambios (size+mtime match).
 *
 * ---
 * DOS ESQUEMAS DE NOMBRES CONVIVEN A PROPÓSITO (ver R8 del spec):
 *
 * SCHEMA 1 — Source (autoritativo): /FORMATOS/
 *   Nombres largos del área legal/contractual:
 *     "3.5. FORMATO OC_ ORDEN DE COMPRA.xlsx"
 *     "CONTRATO DE TRABAJO A TÉRMINO INDEFINIDO.docx"
 *     "V1-OBRA-PRECIO GLOBAL.docx"
 *   Leídos por `render.ts:130` (TEMPLATE_FILE) en producción.
 *   El área legal/contractual los gestiona — NO se renombran.
 *
 * SCHEMA 2 — Destination (derivado): src/lib/document-generator/formatos-snapshots/
 *   Nombres canónicos cortos que esperan los tests:
 *     "OC.xlsx", "CONT_LABORAL.docx", etc.
 *   Definidos en document-render.spec.ts:22-31 y en `load(name)`
 *   de cada spec de filler.
 *
 * ESTE SCRIPT ES EL ÚNICO TRADUCTOR ENTRE LOS DOS ESQUEMAS (vía NAME_MAP).
 *
 * ⚠️  NUNCA "unifiques" los nombres:
 *   - Renombrar en FORMATOS/ rompe `render.ts:130`.
 *   - Renombrar en formatos-snapshots/ rompe los expects de los tests.
 *
 * Spec: docs/specs/audit-formatos-snapshots-wiring.md (AC-3 a AC-9, R8, §4).
 */

import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

// AC-3: Lista de candidatos para FORMATOS_DIR. Orden = prioridad.
const CANDIDATES = [
  // 1. El "oficial" encontrado en diagnóstico 2026-10-12 (D:\..\FORMATOS)
  path.resolve(projectRoot, "..", "..", "FORMATOS"),
  // 2. Lo que la versión original del script esperaba
  path.resolve(projectRoot, "..", "Formatos"),
  // 3. Fallback por si el repo se anida distinto en algún clone
  path.resolve(projectRoot, "..", "..", "..", "FORMATOS"),
];

// AC-4: Mapeo source (nombre largo del legal) → canonical (corto).
// Si el área legal agrega una plantilla nueva, hay que añadirla aquí;
// sino el sync la copia con su nombre original y deja un warning
// (AC-5).
const NAME_MAP = {
  "3.2. AD-0033- SOLICITUD DE ANTICIPO.xlsx": "AD-0033.xlsx",
  "3.3. FORMATO DE LEGALIZACIÓN O REINTEGRO.xlsx": "LEG.xlsx",
  "3.5. FORMATO OC_ ORDEN DE COMPRA.xlsx": "OC.xlsx",
  "3.6. FORMATO OS_ ORDEN DE SERVICIO.xlsx": "OS.xlsx",
  "3.7. FORMATO DE CORTE Y MEMORIAS DE OBRA_1.xlsx": "CORTE.xlsx",
  "3.9. FORMATO AUSENCIA LABORAL[1].pdf": "AUSENCIA.pdf",
  "CONTRATO DE TRABAJO A TÉRMINO INDEFINIDO.docx": "CONT_LABORAL.docx",
  "CONTRATO DISEÑOS.docx": "CONT_DISENOS.docx",
  "V1-OBRA-PRECIO GLOBAL.docx": "CONT_GLOBAL.docx",
  "V2-MODELO OBRA-PRECIO UNITARIO.docx": "CONT_UNITARIO.docx",
};

const EXTS = new Set([".xlsx", ".docx", ".pdf"]);

const SNAPSHOTS_DIR = path.join(
  projectRoot,
  "src",
  "lib",
  "document-generator",
  "formatos-snapshots",
);

function resolveFormatsDir() {
  if (process.env.FORMATOS_DIR && existsSync(process.env.FORMATOS_DIR)) {
    return { dir: process.env.FORMATOS_DIR, source: "env:FORMATOS_DIR" };
  }
  for (const c of CANDIDATES) {
    if (existsSync(c)) {
      return { dir: c, source: `fallback:${c}` };
    }
  }
  return null;
}

function abortMessage(tried, missingCanonicals = [], existingCount = 0) {
  const lines = ["", "❌ FORMATOS_DIR no encontrado."];
  lines.push("   Buscado en:");
  tried.forEach((p, i) => {
    lines.push(`     ${i + 1}. ${p}`);
  });
  if (missingCanonicals.length > 0) {
    lines.push("");
    lines.push(
      `   Snapshots presentes: ${existingCount}/${existingCount + missingCanonicals.length}.`
    );
    lines.push("   Archivos faltantes (canónicos):");
    for (const c of missingCanonicals) {
      lines.push(`     - ${c}`);
    }
    lines.push("");
    lines.push(
      "   Para corregir: restaure FORMATOS/ desde una copia oficial, o ejecute"
    );
    lines.push(
      "   `node scripts/sync-formatos-snapshots.mjs` con FORMATOS_DIR válido."
    );
  } else {
    lines.push("");
    lines.push(
      "   Defina FORMATOS_DIR (env var) o coloque la carpeta FORMATOS en una de esas rutas."
    );
  }
  lines.push("");
  lines.push(
    "   Ver docs/specs/audit-formatos-snapshots-wiring.md §AC-3."
  );
  return lines.join("\n");
}

/**
 * Sincroniza los binarios. Tres modos de operación según §AC-2:
 *
 *   1. Happy path (FORMATOS_DIR existe): copia desde FORMATOS/
 *      a formatos-snapshots/, NAME_MAP aplica el rename, idempotencia
 *      size+mtime, warnings para archivos no-mapeados.
 *   2. Smart-skip (FORMATOS_DIR NO existe PERO los 10 snapshots canónicos
 *      están en disco localmente): NO abort. Loguea 1 línea informativa
 *      ("FORMATOS_DIR no encontrado, pero N snapshots están en disco.
 *      Continuando sin sincronizar"). Devuelve `source: 'smart-skip'`.
 *   3. Hard-abort (FORMATOS_DIR NO existe Y faltan snapshots): abort con
 *      mensaje estructurado listando:
 *        - las 4 rutas buscadas (env + 3 candidatas)
 *        - los N snapshots faltantes de los 10 canónicos (concretamente)
 *        - sugerencia de corrección (restaurar FORMATOS/ o ejecutar el sync
 *          manualmente)
 *
 * Lanza Error en el modo 3 (aborta vitest globalSetup y CLI con exit 1).
 */
export async function syncSnapshots({
  dryRun = false,
  log = console.log,
} = {}) {

  const tried = [];
  if (process.env.FORMATOS_DIR) tried.push(process.env.FORMATOS_DIR);
  for (const c of CANDIDATES) tried.push(c);

  const formats = resolveFormatsDir();

  if (!formats) {
    // Modo 2/3: FORMATOS no existe. Decidir entre smart-skip y hard-abort.
    let existingSnapshots = [];
    try {
      const files = await fs.readdir(SNAPSHOTS_DIR);
      existingSnapshots = files.filter(
        (f) => !f.startsWith(".") && f !== ".gitkeep"
      );
    } catch {
      // directorio no existe o no se puede leer → 0 snapshots
    }

    const expectedCanons = Object.values(NAME_MAP);
    const missingCanonicals = expectedCanons.filter(
      (c) => !existingSnapshots.includes(c),
    );

    if (missingCanonicals.length > 0) {
      // Modo 3 — hard-abort.
      const msg = abortMessage(tried, missingCanonicals, existingSnapshots.length);
      log(msg);
      throw new Error(
        `FORMATOS_DIR no encontrado y faltan ${missingCanonicals.length}/${expectedCanons.length} snapshots.\n${msg}`
      );
    }

    // Modo 2 — smart-skip.
    log(
      `ℹ️  FORMATOS_DIR no encontrado, pero los ${existingSnapshots.length} snapshots canónicos están en disco. Continuando sin sincronizar (smart-skip).`
    );
    return {
      ok: true,
      source: "smart-skip",
      copied: 0,
      skipped: existingSnapshots.length,
      warnings: 0,
      unmapped: [],
      snapshotDir: SNAPSHOTS_DIR,
      missingFORMATOS: true,
    };
  }

  // Modo 1 — happy path.
  await fs.mkdir(SNAPSHOTS_DIR, { recursive: true });

  const entries = await fs.readdir(formats.dir, { withFileTypes: true });
  const result = {
    ok: true,
    source: formats.source,
    copied: 0,
    skipped: 0,
    warnings: 0,
    unmapped: [],
    snapshotDir: SNAPSHOTS_DIR,
  };

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!EXTS.has(ext)) continue;

    const src = path.join(formats.dir, entry.name);
    let canonical = NAME_MAP[entry.name];
    if (!canonical) {
      // AC-5: warning explícito si hay archivos sin mapear.
      log(`⚠️  unmapped (no NAME_MAP entry): ${entry.name}`);
      result.warnings++;
      result.unmapped.push(entry.name);
      canonical = entry.name; // best-effort: copiar bajo nombre original.
    }
    const dst = path.join(SNAPSHOTS_DIR, canonical);

    // AC-6: idempotencia size + mtime.
    try {
      const [srcStat, dstStat] = await Promise.all([
        fs.stat(src),
        fs.stat(dst),
      ]);
      if (
        dstStat.size === srcStat.size &&
        Math.floor(dstStat.mtimeMs) === Math.floor(srcStat.mtimeMs)
      ) {
        log(`  skipped (cached): ${canonical}`);
        result.skipped++;
        continue;
      }
    } catch {
      // dst doesn't exist; proceed to copy.
    }

    if (dryRun) {
      log(`  [dry-run] would copy: ${canonical}`);
      result.copied++;
      continue;
    }

    await fs.copyFile(src, dst);
    log(`  copied: ${canonical}`);
    result.copied++;
  }

  return result;
}

// CLI entrypoint
// Wrapper para vitest globalSetup: vitest requiere que el export llamado
// `setup` (o default) retorne `void` o una función (teardown), NO un
// objeto cualquiera. syncSnapshots devuelve un objeto con métricas, así
// que la función `setup` aquí sólo dispara el side-effect y devuelve
// undefined. La firma con args sí acepta llamadas CLI/custom con
// `dryRun`/`log`, pero vitest nunca pasa args.
export async function setup() {
  await syncSnapshots();
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const dryRun = process.argv.includes("--dry-run");
  try {
    const r = await syncSnapshots({ dryRun });
    const summary =
      `✅ sync-formatos-snapshots: source=${r.source}, ` +
      `copied=${r.copied}, skipped=${r.skipped}, warnings=${r.warnings}` +
      (dryRun ? " (dry-run)" : "");
    console.log(summary);
    if (r.warnings > 0) {
      console.warn(
        `⚠️  ${r.warnings} archivo(s) sin mapeo (no fatal, ver NAME_MAP):`
      );
      for (const u of r.unmapped) console.warn(`     - ${u}`);
    }
  } catch (e) {
    console.error(e.message || String(e));
    process.exit(1);
  }
}
