#!/usr/bin/env node
/**
 * build-clean-sql.mjs
 *
 * Genera una version limpia del 000_init.sql para Hostinger/MariaDB antiguos.
 * Sin comentarios, sin caracteres no-ASCII, con prefijo de Hostinger aplicado.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// El script vive en nextjs_space/scripts/, y el 000_init.sql vive en
// nextjs_space/nextjs_space/database/mysql/ (dos niveles mas abajo porque
// el repo se reorganizo: la raiz del repo GitHub ahora es nextjs_space/).
const root = path.resolve(__dirname, "..", "nextjs_space");
const dbDir = path.join(root, "database", "mysql");
const inFile = path.join(dbDir, "000_init.sql");
const outFile = path.join(dbDir, "000_init_clean.sql");

const HOSTINGER_PREFIX = "u652436213_ControlObra";

let content = fs.readFileSync(inFile, "utf-8");

content = content.replace(/^\s*--.*$/gm, "");
content = content.replace(/\n\s*\n\s*\n+/g, "\n\n");
content = content.replace(
  /DROP DATABASE IF EXISTS[^;]+;/gi,
  "-- DROP DATABASE skipped",
);
content = content.replace(
  /CREATE DATABASE[^;]+DEFAULT COLLATE[^;]+;/gi,
  "-- CREATE DATABASE skipped",
);
content = content.replace(
  /^use\s+\w+;\s*$/gim,
  "-- USE skipped",
);
content = content.replace(/\bcontrol_obra\b/gi, HOSTINGER_PREFIX);

// Char map: tildes + caracteres raros a ASCII puro
const charMap = {
  "\u00e1": "a", "\u00e9": "e", "\u00ed": "i", "\u00f3": "o", "\u00fa": "u", "\u00f1": "n",
  "\u00c1": "A", "\u00c9": "E", "\u00cd": "I", "\u00d3": "O", "\u00da": "U", "\u00d1": "N",
  "\u00bf": "?", "\u00a1": "!",
  "\u2014": "--", "\u2013": "-",
  "\u201c": "", "\u201d": "",
  "\u2018": "'", "\u2019": "'",
  "\u2192": "*", "\u2190": "<-",
};
for (const [orig, rep] of Object.entries(charMap)) {
  content = content.split(orig).join(rep);
}

// Quitar cualquier otro caracter no-ASCII
content = content.replace(/[^\x00-\x7F]/g, "");

const HEADER =
"-- ============================================================\n" +
"-- ControlObra - Script LIMPIO para Hostinger (P0 plan 2026-10-02).\n" +
"--\n" +
"-- Generado por scripts/build-clean-sql.mjs\n" +
"-- - Sin comentarios (quita problemas de encoding)\n" +
"-- - Sin DROP/CREATE DATABASE (ya lo hiciste en phpMyAdmin)\n" +
"-- - Solo CREATE TABLE + INSERTs\n" +
"-- - Prefijo Hostinger aplicado: " + HOSTINGER_PREFIX + "\n" +
"--\n" +
"-- Antes de ejecutar:\n" +
"--   1) BD ya debe existir (la creaste con CREATE DATABASE en phpMyAdmin)\n" +
"--   2) Selecciona esa BD del panel izquierdo de phpMyAdmin\n" +
"--   3) Pega este archivo en la pestana SQL -> Continuar\n" +
"-- ============================================================\n\n";

fs.writeFileSync(outFile, HEADER + content, "utf-8");

const sizeKb = (fs.statSync(outFile).size / 1024).toFixed(1);
const nonAsciiCount = (content.match(/[^\x00-\x7F]/g) || []).length;
console.log("OK  -> " + outFile);
console.log("Tamano: " + sizeKb + " KB");
console.log("Prefijo aplicado: " + HOSTINGER_PREFIX);
console.log("Caracteres no-ASCII restantes: " + nonAsciiCount);
if (nonAsciiCount > 0) {
  console.log("ATENCION: aun quedan caracteres no-ASCII!");
}