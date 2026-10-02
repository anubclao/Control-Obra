/**
 * scripts/apply-auth-guards.ts
 *
 * Aplica requireAuth/requireRole/requireAdmin a todos los endpoints sensibles
 * del proyecto.  Hace un patch textual en cada route.ts bajo src/app/api/.
 *
 * Estrategia:
 *   - GET    → requireAuth (cualquier user logueado)
 *   - POST   → requireRole("ADMIN","GERENTE","DIRECTOR","RESIDENTE","CONTABILIDAD","TESORERIA","HSEQ")
 *   - PUT    → igual que POST
 *   - DELETE → requireAdmin (Super Admin)
 *
 * Solo procesa archivos que aún NO tienen `requireAuth`/`requireRole`/`requireAdmin`.
 * Archivos ya protegidos (auth/*, users/*) se saltan.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "src/app/api");
const SKIP_DIRS = new Set(["auth", "users"]); // auth/users ya tratados a mano

// Roles permitidos para mutaciones (no-DELETE)
const MUTATION_ROLES =
  '"ADMIN","GERENTE","DIRECTOR","RESIDENTE","CONTABILIDAD","TESORERIA","HSEQ"';

const MUTATION_IMPORT_LINE =
  'import { requireAuth, requireRole, requireAdmin } from "@/lib/api-auth";';

const MUTATION_IMPORT_LINE_AUTH_ONLY = 'import { requireAuth } from "@/lib/api-auth";';

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      walk(p, out);
    } else if (entry === "route.ts") {
      out.push(p);
    }
  }
  return out;
}

function patchRoute(file: string): { changed: boolean; reason: string } {
  let src = readFileSync(file, "utf8");

  // Skip si ya tiene guards aplicados
  if (
    src.includes("requireAuth(") ||
    src.includes("requireRole(") ||
    src.includes("requireAdmin(")
  ) {
    return { changed: false, reason: "ya tiene guards" };
  }

  const isAuth = file.includes(`${process.cwd()}\\src\\app\\api\\auth\\`) ||
                 file.includes(`${process.cwd()}/src/app/api/auth/`);
  const isUsers = file.includes(`${process.cwd()}\\src\\app\\api\\users\\`) ||
                  file.includes(`${process.cwd()}/src/app/api/users/`);
  if (isAuth || isUsers) {
    return { changed: false, reason: "auth/users — manejado aparte" };
  }

  const hasGet = /export async function GET\s*\(/.test(src);
  const hasPost = /export async function POST\s*\(/.test(src);
  const hasPut = /export async function PUT\s*\(/.test(src);
  const hasDel = /export async function DELETE\s*\(/.test(src);

  if (!hasGet && !hasPost && !hasPut && !hasDel) {
    return { changed: false, reason: "sin handlers estándar" };
  }

  let patched = src;

  // 1) Añadir import después del último import existente.
  const lastImportIdx = patched.lastIndexOf("import ");
  if (lastImportIdx === -1) {
    return { changed: false, reason: "sin imports detectables" };
  }
  const importEnd = patched.indexOf("\n", lastImportIdx) + 1;
  const importLine = hasDel
    ? MUTATION_IMPORT_LINE
    : MUTATION_IMPORT_LINE_AUTH_ONLY;
  patched =
    patched.slice(0, importEnd) +
    importLine +
    "\n" +
    patched.slice(importEnd);

  // 2) Inyectar guard al inicio de cada handler
  const inject = (handler: "GET" | "POST" | "PUT" | "DELETE") => {
    const re = new RegExp(
      `(export async function ${handler}\\s*\\([^)]*\\)\\s*\\{)`,
    );
    if (handler === "GET") {
      patched = patched.replace(re, `$1\n  const auth = await requireAuth();\n  if (!auth.ok) return auth.response;`);
    } else if (handler === "DELETE") {
      patched = patched.replace(re, `$1\n  const auth = await requireAdmin();\n  if (!auth.ok) return auth.response;`);
    } else {
      // POST / PUT
      patched = patched.replace(
        re,
        `$1\n  const auth = await requireRole(${MUTATION_ROLES});\n  if (!auth.ok) return auth.response;`,
      );
    }
  };

  if (hasGet) inject("GET");
  if (hasPost) inject("POST");
  if (hasPut) inject("PUT");
  if (hasDel) inject("DELETE");

  writeFileSync(file, patched, "utf8");
  return { changed: true, reason: `handlers: ${[hasGet && "GET", hasPost && "POST", hasPut && "PUT", hasDel && "DELETE"].filter(Boolean).join(", ")}` };
}

const files = walk(ROOT);
const results: Array<{ file: string; changed: boolean; reason: string }> = [];
for (const f of files) {
  const r = patchRoute(f);
  results.push({ file: f.replace(process.cwd() + "\\", ""), ...r });
}

console.log("\n=== Resumen de aplicación de auth guards ===\n");
let changedCount = 0;
for (const r of results) {
  const tag = r.changed ? "[MOD] " : "[skip]";
  console.log(`${tag} ${r.file} — ${r.reason}`);
  if (r.changed) changedCount++;
}
console.log(`\nTotal: ${changedCount} archivos modificados, ${results.length - changedCount} saltados.`);
