// scripts/sync-formatos-snapshots.mjs
// Sincroniza /Formatos/*.xlsx|docx|pdf → src/lib/document-generator/formatos-snapshots/
// para que los tests puedan cargar las plantillas reales sin depender
// de la ruta padre /Formatos/.
//
// Este script se ejecuta automáticamente antes de `npm test` (vía
// vitest.config.mjs globalSetup) y también está disponible como CLI:
//
//   node scripts/sync-formatos-snapshots.mjs
//
// Es idempotente: si los snapshots ya están al día, no hace nada.

import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const FORMATS_DIR = path.resolve(projectRoot, "..", "Formatos");
const SNAPSHOTS_DIR = path.join(
  projectRoot,
  "src",
  "lib",
  "document-generator",
  "formatos-snapshots",
);

const EXTS = new Set([".xlsx", ".docx", ".pdf"]);

export async function syncSnapshots() {
  if (!existsSync(FORMATS_DIR)) {
    // En CI o en un clone sin /Formatos, fallar suave: los tests
    // individuales pueden no aplicar, pero la suite no se aborta.
    return {
      ok: false,
      reason: `No existe ${FORMATS_DIR}; los tests que necesitan plantillas reales se saltarán.`,
    };
  }

  await fs.mkdir(SNAPSHOTS_DIR, { recursive: true });

  const entries = await fs.readdir(FORMATS_DIR, { withFileTypes: true });
  let copied = 0;
  let skipped = 0;
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!EXTS.has(ext)) continue;
    const src = path.join(FORMATS_DIR, entry.name);
    const dst = path.join(SNAPSHOTS_DIR, entry.name);
    // Si el destino ya existe y tiene el mismo tamaño, saltar.
    try {
      const [srcStat, dstStat] = await Promise.all([
        fs.stat(src),
        fs.stat(dst),
      ]);
      if (dstStat.size === srcStat.size) {
        skipped++;
        continue;
      }
    } catch {
      // dst no existe, seguimos.
    }
    await fs.copyFile(src, dst);
    copied++;
  }

  return {
    ok: true,
    copied,
    skipped,
    snapshotDir: SNAPSHOTS_DIR,
  };
}

// Si se ejecuta como CLI (no como import), corre directamente.
const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const r = await syncSnapshots();
  if (r.ok) {
    console.log(
      `✅ sync-formatos-snapshots: copiados=${r.copied}, skipped=${r.skipped}, dir=${r.snapshotDir}`,
    );
  } else {
    console.warn(`⚠️  ${r.reason}`);
  }
}
