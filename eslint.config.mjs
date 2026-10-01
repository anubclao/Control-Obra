// Flat config para ESLint 9.x + Next 15 (eslint-config-next 15.5.25).
//
// Por qué migrar a flat config:
//   - ESLint 9.x ya no lee .eslintrc.json; requiere eslint.config.js/mjs/cjs.
//   - eslint-config-next 15.5.25 sigue exponiendo sus presets como objetos
//     CommonJS con la forma { extends: [...] }, por lo que los importamos y
//     los "desenvolvemos" con FlatCompat para que funcionen en flat config.
//
// Referencias oficiales:
//   - https://eslint.org/docs/latest/use/configure/configuration-files
//   - https://nextjs.org/docs/app/api-reference/config/eslint#migrating-existing-config

import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const config = [
  // Ignorar patrones de build/artefactos para no analizarlos.
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "tests/setup.ts",
    ],
  },
  // Aplicar los presets de Next (core-web-vitals + typescript) tal como
  // estaban en el .eslintrc.json anterior.
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // Reglas del proyecto (idénticas a la versión previa).
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "react/no-unescaped-entities": "off",
      "@next/next/no-img-element": "off",
    },
  },
];

export default config;
