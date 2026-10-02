/**
 * scripts/fix-imports.ts
 *
 * Fix: el script apply-auth-guards.ts solo importaba requireAuth en archivos
 * sin DELETE, pero igualmente inyectaba requireRole(...) en POST/PUT.
 *
 * Este script corrige el import a la línea completa:
 *   import { requireAuth, requireRole, requireAdmin } from "@/lib/api-auth";
 * en cualquier archivo que use requireRole o requireAdmin pero no tenga el
 * import completo.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "src/app/api");
const FULL_IMPORT =
  'import { requireAuth, requireRole, requireAdmin } from "@/lib/api-auth";';

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (entry === "route.ts") out.push(p);
  }
  return out;
}

let fixed = 0;
let skipped = 0;

for (const f of walk(ROOT)) {
  const src = readFileSync(f, "utf8");

  if (src.includes(FULL_IMPORT)) {
    skipped++;
    continue;
  }

  const needsFull =
    /requireRole\s*\(/.test(src) || /requireAdmin\s*\(/.test(src);
  if (!needsFull) {
    skipped++;
    continue;
  }

  const partialPatterns = [
    /import\s*\{\s*requireAuth\s*\}\s*from\s*["']@\/lib\/api-auth["'];?/,
    /import\s*\{\s*requireAuth\s*,\s*requireRole\s*\}\s*from\s*["']@\/lib\/api-auth["'];?/,
    /import\s*\{\s*requireAuth\s*,\s*requireAdmin\s*\}\s*from\s*["']@\/lib\/api-auth["'];?/,
  ];
  let updated = src;
  let replaced = false;
  for (const re of partialPatterns) {
    if (re.test(updated)) {
      updated = updated.replace(re, FULL_IMPORT);
      replaced = true;
      break;
    }
  }
  if (!replaced) {
    skipped++;
    continue;
  }
  writeFileSync(f, updated, "utf8");
  fixed++;
  console.log(`[FIX] ${f.replace(process.cwd() + "\\", "")}`);
}

console.log(`\nTotal: ${fixed} archivos corregidos, ${skipped} saltados.`);
