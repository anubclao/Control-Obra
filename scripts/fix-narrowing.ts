/**
 * scripts/fix-narrowing.ts
 *
 * Convierte el patrón:
 *   if (!auth.ok) return auth.response;
 * al nuevo patrón que narrowea con strict:false:
 *   const fail = authFailureResponse(auth);
 *   if (fail) return fail;
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "src/app/api");
const FULL_IMPORT =
  'import { requireAuth, requireRole, requireAdmin } from "@/lib/api-auth";';
const NEW_IMPORT =
  'import { requireAuth, requireRole, requireAdmin, authFailureResponse } from "@/lib/api-auth";';

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (entry === "route.ts") out.push(p);
  }
  return out;
}

let fixed = 0;

for (const f of walk(ROOT)) {
  let src = readFileSync(f, "utf8");
  if (!src.includes("requireAuth(") && !src.includes("requireRole(") && !src.includes("requireAdmin(")) continue;
  if (!src.includes("if (!auth.ok) return auth.response;")) continue;

  // Reemplazar el patrón en todas sus ocurrencias.
  const oldPattern = "if (!auth.ok) return auth.response;";
  const newPattern =
    "const fail = authFailureResponse(auth);\n  if (fail) return fail;";

  // Reemplazar el patrón `if (!auth.ok) return auth.response;` por la versión
  // que sí narrowea con strict:false.
  src = src.replace(
    /if \(!auth\.ok\) return auth\.response;/g,
    "const fail = authFailureResponse(auth);\n  if (fail) return fail;",
  );

  // Actualizar import si es necesario.
  if (src.includes(FULL_IMPORT) && !src.includes(NEW_IMPORT)) {
    src = src.replace(FULL_IMPORT, NEW_IMPORT);
  } else if (src.includes("import { requireAuth } from \"@/lib/api-auth\";")) {
    src = src.replace(
      "import { requireAuth } from \"@/lib/api-auth\";",
      "import { requireAuth, authFailureResponse } from \"@/lib/api-auth\";",
    );
  }

  writeFileSync(f, src, "utf8");
  fixed++;
  console.log(`[FIX] ${f.replace(process.cwd() + "\\", "")}`);
}

console.log(`\nTotal: ${fixed} archivos modificados.`);
