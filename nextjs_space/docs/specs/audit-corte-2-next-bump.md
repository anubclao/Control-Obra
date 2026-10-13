# Corte 2 — Bump de seguridad Next.js 15.5.25 → 15.5.27

> Spec generado 2026-10-12 por mavis. Cubre **únicamente** el Corte 2; los
> Cortes 1 (`tailwindcss-animate`), 3 (`xlsx`) y 4 (`@azure/msal-node`) tienen
> specs propias y NO se abordan aquí.

## Contexto

`npm audit --omit=dev` post-Corte 1 reporta 4 vulnerabilidades. Una de ellas es
`next 15.0.0 - 15.5.26` (Moderate, cache poisoning). El fix oficial está en
`next@15.5.27`, pero `npm audit fix` no lo aplica porque el rango está pinneado
exact en `package.json` (`"next": "15.5.25"` y `"eslint-config-next": "15.5.25"`),
sin caret ni tilde. Hay que bumpear manualmente.

El cambio `15.5.25 → 15.5.27` es estrictamente patch-level (mismo minor). El
riesgo principal NO es semántico (no hay API changes) sino:
- (a) la lógica de cache fingerprinting cambia — afecta SSG/ISR, build output.
- (b) consistencia `next` ↔ `eslint-config-next` (deben estar en la misma versión
  o eslint usa presets desactualizados).
- (c) tipos de TypeScript pueden ajustar firmas en ese rango.
- (d) build-time assets (`.next/`) deben regenerarse limpiamente.

**Este spec NO toca:** `xlsx` (Corte 3), `@azure/msal-node` (Corte 4),
`src/**` salvo imperativo, `tailwind.config.*`, ni nada más del árbol.

---

## 1. User Story

**As a** operador de ControlObra,
**I want to** que `next` y `eslint-config-next` estén en la versión parcheada
oficial,
**So that** la vulnerabilidad de cache poisoning en SSG/ISR quede remediada y el
reporte `--omit=dev` pierda la entrada `next 15.5.26`.

---

## 2. Acceptance Criteria

- [ ] **AC-1** `package.json` lista `"next": "15.5.27"` y
      `"eslint-config-next": "15.5.27"`.
- [ ] **AC-2** `npm install --dry-run` reporta 0 paquetes a añadir / 0 a
      modificar después del bump (lockfile coherente con `package.json`).
- [ ] **AC-3** Lockfile resuelve `next` y `eslint-config-next` **exactamente** a
      `15.5.27`, no a otra versión del rango 15.5.x.
- [ ] **AC-4** Lockfile para `react`, `react-dom` y otros transitivos de
      React: **se permiten movimientos dentro del mismo minor**
      (e.g. `react@19.3.0` → `react@19.3.1` es OK; típicamente un patch de
      seguridad). Abortar si aparece **cambio de minor** (`19.3.x → 19.4.x`)
      o **cambio de major** (`19.x → 20.x`); esos cambios quedan reservados
      para un PATCH-3 dedicado. Política aplicada en §9 A3.
- [ ] **AC-5** `npx tsc --noEmit` queda en 0 errores nuevos. Línea base:
      1 error preexistente en `tests/verifiers/advances-suggestion.spec.ts:21`
      (TS2741 'contractId' missing). Requiere
      `NODE_OPTIONS=--max-old-space-size=4096` en este host.
- [ ] **AC-6** `npm test` sin nuevos rojos. Baseline conocido: 685 passing +
      34 failing (ENOENT `formatos-snapshots/`) + 8 skipped. AC del Corte 1
      §6.5 sigue vigente (issue separado pendiente, no parte de este corte).
- [ ] **AC-7** `npm run build` termina con código 0. 29 páginas estáticas
      generadas (mismo conteo que línea base V6 de Corte 1).
- [ ] **AC-8** Validación manual post-deploy:
      - `/login` carga.
      - `/tecnico/proyectos/[id]` carga y renderiza con animaciones.
      - Una ruta estática (`/` o `/login`) sirve con los headers de seguridad
        correctos (`Content-Security-Policy`, `Strict-Transport-Security`,
        `X-Frame-Options: DENY`).
- [ ] **AC-9** El commit toca únicamente `package.json` y `package-lock.json`.
      Cero diff en `nextjs_space/nextjs_space/src/**`, en `docs/`, en
      `nextjs_space/AGENTS.md`, en `next.config.mjs`, en `eslint.config.mjs`,
      en `tailwind.config.ts`.
- [ ] **AC-10** `xlsx` permanece en `^0.18.5`. `@azure/msal-node` permanece en
      `^3.8.10`. `tailwindcss-animate` permanece en `devDependencies`
      (decisión del Corte 1).

---

## 3. Edge Cases / Riesgos

### Áreas de riesgo del bump Next.js 15.5.x → 15.5.x+2

- **R1 (CVE siendo parcheada):** GHSA-4jqv-mc3x-m676 + GHSA-mcj8-r9mp-w47p —
    cache poisoning de SSG/ISR en apps self-hosted. Riesgo de regresión: si las
    páginas estáticas no se invalidan correctamente, podrían servir contenido
    cruzado entre usuarios. **Mitigación:** validar en prod que `/` y otras
    rutas estáticas sirvan headers correctos (AC-8); el cliente no debería ver
    datos de otro tenant tras login.
- **R2 (Tipos de TypeScript):** los tipos `@types/...` no cambian (vienen de
    `react@19`), pero los tipos internos de Next pueden ajustar firmas. Si la
    `tsc` falla con errores en código de Next (no nuestro), abortar.
- **R3 (Middleware, 34.4 kB según V6 de Corte 1):** el middleware del proyecto
    es sustancial. El parche de cache NO afecta middleware directamente, pero
    si Next ajusta headers por defecto (e.g., `cache-control`) en respuestas
    con middleware, puede haber cambios sutiles. **Mitigación:** V4 build OK +
    V5 verificación manual post-deploy.
- **R4 (React transitivos):** rango declarado `^19.3.0` (semi-abierto). El
    parche podría arrastrar `react@19.3.x`. **Política del spec** (corregida
    2026-10-12 con el usuario): **se permite el mismo minor**
    (`19.3.x → 19.3.y`); abortar en cambio de minor o major. Razón práctica:
    un patch de React es típicamente fix de seguridad y abortar por ese
    movimiento sería desproporcionado. Un cambio de minor puede introducir
    features que rompan, y eso merece spec aparte.
- **R5 (Build artifacts):** `.next/` se regenera completamente. Esto es
    esperado y NO requiere commit del directorio (es gitignored).
- **R6 (eslint-config-next):** debe bumpearse a la misma versión que `next`.
    Los presets `next/core-web-vitals` y `next/typescript` esperan una versión
    específica. Bumpear uno sin el otro deja presets desactualizados. Por eso
    la Tarea 2 está acoplada a la Tarea 1 (mismo commit).
- **R7 (Dev-bypass auth, líneas ~136-176 de session.ts según AGENTS.md
    histórico):** el flujo legacy `signSession(userId)` (formato `${userId}.`)
    NO debería verse afectado por un patch de cache — no toca cookies ni
    state. Sin embargo, si V5 post-deploy muestra problemas de login, abortar.
- **R8 (npm install resuelve fuera del set esperado):** abortar si lockfile
    introduce: versiones de React distintas, `xlsx` cambio, `@azure/msal-node`
    cambio, o cualquier `tailwindcss-*` cambio fuera del devDeps actual. Ver
    §9 plan de aborto.

### Estados a evitar
- `npm install` con `--force` o `--legacy-peer-deps`.
- Editar `next.config.mjs` o `eslint.config.mjs`.
- Mover `react`, `react-dom`, ni ningún `@types/*`.
- Combinar el commit con cualquier cambio de `src/**`.
- Bajar el eslint baseline (e.g., degradar reglas por incompatibilidad).

---

## 4. Technical Contract

### 4.1 Patch esperado (`package.json`)

```diff
   "dependencies": {
     ...
     "next": "15.5.25",
     ...
   },
   "devDependencies": {
     ...
-    "eslint-config-next": "15.5.25",
+    "eslint-config-next": "15.5.27",
     ...
   }
```

(El campo `next` también cambia de `"15.5.25"` a `"15.5.27"` — mismo pin exacto.)

### 4.2 Comando exacto (orden estricto)

```
cd "D:\desarrollos\ControlObra\ControlObra\nextjs_space\nextjs_space"
# 1) Editar package.json: bump next 15.5.25 -> 15.5.27 y eslint-config-next 15.5.25 -> 15.5.27
# 2) Instalar para que el lockfile absorba el cambio
npm install
# 3) Verificaciones ver §6
```

### 4.3 Restricciones de versiones (deben resolverse exactamente así)

| Paquete | Versión exacta esperada |
|---|---|
| `next` | `15.5.27` |
| `eslint-config-next` | `15.5.27` |
| `react`, `react-dom` | sin cambio (lo que el lockfile actual tenga) |
| Transitivos de React | sin cambio |
| `xlsx` | sin cambio |
| `@azure/msal-node` | sin cambio |
| `tailwindcss-animate`, `tailwindcss`, `tailwind-merge` | sin cambio |

Cualquier desviación → §9 abortar.

---

## 5. Dependencies

### Files to Modify
- `nextjs_space/nextjs_space/package.json` (2 líneas: `next` + `eslint-config-next`).
- `nextjs_space/nextjs_space/package-lock.json` (regenerado por `npm install`).

### Files to Read (diagnóstico)
- `nextjs_space/nextjs_space/node_modules/next/package.json` — confirmar `15.5.27`.
- `nextjs_space/nextjs_space/node_modules/eslint-config-next/package.json` —
  confirmar `15.5.27`.
- `nextjs_space/nextjs_space/node_modules/react/package.json` — confirmar que
  NO cambió.

### Files explicitly NOT touched (este spec)
- `nextjs_space/nextjs_space/src/**` — código del producto.
- `nextjs_space/nextjs_space/next.config.mjs` — security headers, eslint
  ignore flag, etc.
- `nextjs_space/nextjs_space/eslint.config.mjs` — flat config (aunque `next`
  cambie, esto se acopla al `package.json`, no requiere edición aquí).
- `nextjs_space/nextjs_space/tailwind.config.*`.
- `nextjs_space/nextjs_space/docs/**` — salvo el spec de este corte.
- `nextjs_space/nextjs_space/AGENTS.md` — la entrada de changelog va en un
  commit aparte junto con este spec (ver §7).
- Cualquier entry de `"xlsx"` (Corte 3), `"@azure/msal-node"` (Corte 4),
  `"tailwindcss-animate"` (decisión del Corte 1).

### Si un cambio en `src/**` resulta imperativo (R-gate)
- **Política:** **PARAR** y reportar al usuario. NO aplicar el cambio de
  código sin su aprobación explícita.
- Razones para necesitar cambio en `src/**` son improbables (es un patch de
  parche), pero posibles (e.g., firma de un helper interno de Next cambia).
- Si esto ocurre, el commit principal se aborta, se reabre el spec y se pide
  una nueva revisión.

---

## 6. Verifier Plan

### 6.1 Pre-cambio

```
cd "D:\desarrollos\ControlObra\ControlObra\nextjs_space\nextjs_space"
git rev-parse HEAD           # anclar el SHA previo al bump
node -e "const p=require('./package.json'); console.log(p.dependencies.next, p.devDependencies['eslint-config-next'])"
# esperado: 15.5.25 15.5.25
```

### 6.2 Post-cambio (orden estricto)

| # | Comando | Criterio de éxito |
|---|---|---|
| V1 | `npm install --dry-run` | "up to date" / 0 paquetes a añadir. Si propone instalar versiones distintas, abortar (§9). |
| V2 | `node -e "const p=require('./package.json'); console.log(p.dependencies.next, p.devDependencies['eslint-config-next'])"` | Imprime `15.5.27 15.5.27`. |
| V3 | `node -e "const lock=require('./package-lock.json'); console.log(lock.packages['node_modules/next'].version, lock.packages['node_modules/eslint-config-next'].version, lock.packages['node_modules/react'].version)"` | Imprime `15.5.27 15.5.27 <version_inmutable>`. La de `react` debe ser la misma que antes del bump (≥19.3, sin `^`). |
| V4 | `NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit` | Mismos errores que línea base. 0 nuevos (1 preexistente aceptable en advances-suggestion.spec.ts:21). |
| V5 | `NODE_OPTIONS="--max-old-space-size=4096" npm test` | 685 passing + 34 failing (ENOENT snapshots) + 8 skipped — mismos números que Corte 1. 0 nuevos rojos. |
| V6 | `NODE_OPTIONS="--max-old-space-size=4096" npm run build 2>&1 \| tee ../build-corte-2-after.log` | Exit 0. ~29 páginas estáticas (mismo conteo que V6 de Corte 1). Warnings de DB inalcanzable son ruido esperado y aceptable. |

> **Reminder:** `NODE_OPTIONS=--max-old-space-size=4096` se necesita en este
> host desde el Corte 1 (heap default 1.5 GB OOM). Documentado en
> `nextjs_space/AGENTS.md`, sección "Patrones a recordar (memory)".

### 6.3 Verificación manual post-deploy (workflow del usuario)

Después del push a `origin/main` y deploy automático en Hostinger:

1. **Login:** abrir `/login` → confirmar que la página carga con los headers
   de seguridad (`Content-Security-Policy`, `X-Frame-Options: DENY`,
   `Strict-Transport-Security`) presentes en las DevTools > Network.
2. **Ruta estática:** abrir `/` → confirmar que carga sin autenticación (es
   estática).
3. **Ruta dinámica con proyecto:** abrir `/tecnico/proyectos/<id-de-proyecto-real>`
   → confirmar que muestra datos correctos (sin residuos de cache poisoning).
4. **Logout/login doble:** cerrar sesión y abrir en una ventana privada el
   mismo proyecto → confirmar que NO muestra datos del usuario anterior
   (test funcional del fix de cache poisoning).

> Si cualquier paso falla → revertir el commit (`git revert HEAD && git push
> origin main`) y reportar.

---

## 7. Estrategia de commits (aislamiento)

| # | Mensaje | Archivos |
|---|---|---|
| 1 | `chore(deps): bump next + eslint-config-next to 15.5.27 (cache poisoning fix)` | `nextjs_space/nextjs_space/package.json`, `nextjs_space/nextjs_space/package-lock.json` |
| 2 | `docs(specs): spec Corte 2 + log AGENTS.md` | `nextjs_space/nextjs_space/docs/specs/audit-corte-2-next-bump.md` (crear), `nextjs_space/AGENTS.md` (entrada changelog) |

> **Push a `origin/main`, branch `main`, commits individuales
> (`git add` por archivo, NO `git add -A`).** Commits 1 y 2 separados: el
> primero entrega el fix; el segundo cierra el spec + memoria.
> Tras el push del commit 1, V5 (verificación manual) puede comenzar.

---

## 8. Out of Scope

- Migración de `xlsx` 0.18.5 → SheetJS 0.20.3 / `exceljs` → **Corte 3**.
- Upgrade `@azure/msal-node` 3.x → 5.x → **Corte 4**.
- Touch `src/**` salvo imperativo (§5 R-gate).
- Cambios en `next.config.mjs` o `eslint.config.mjs`.
- Cambios en `tailwind.config.*` o `@tailwindcss/*`.
- Cambios en `react`, `react-dom`, `@types/react`, `@types/react-dom`.
- Eliminar la entrada de `npm audit --omit=dev` para `xlsx`, `uuid` (vía
  `@azure/msal-node`) o cualquier otra vulnerabilidad distinta de `next`.
- Cambios en CSP, security headers, o reglas de `next.config.mjs`.
- Investigar/fix los 34 ENOENT de `formatos-snapshots/` (issue separado, ver
  spec Corte 1 §6.5).
- Cambiar versionado semver del proyecto (`"controlobra-pro": "0.1.0"`).

---

## 9. Plan de Aborto

**Cancela el commit principal y reporta si se cumple CUALQUIERA de:**

- **A1:** V1 propone instalar paquetes fuera de `{next 15.5.27, eslint-config-next 15.5.27}`. Ejemplo: otras versiones de React, otro rango de Next, u otro paquete que se haya movido.
- **A2:** V3 muestra `lock.packages['node_modules/next'].version !== '15.5.27'` o `lock.packages['node_modules/eslint-config-next'].version !== '15.5.27'`.
- **A3:** V3 muestra que `react` o `react-dom` cambia **más allá del mismo
  minor** (e.g. salta a `react@19.4.x`, `react@20.x.y`, etc.). Movimientos
  dentro del mismo minor (`19.3.x → 19.3.y`) son aceptables.
- **A4:** V4 introduce un error TS NUEVO (no el preexistente documentado en advances-suggestion.spec.ts:21).
- **A5:** V5 introduce un test rojo NUEVO (no los 34 ENOENT documentados).
- **A6:** V6 falla con `next build` exit != 0.
- **A7:** El diff de `package-lock.json` toca `xlsx`, `@azure/msal-node`, o `tailwindcss-animate`.
- **A8:** El diff de `package-lock.json` introduce versiones nuevas de paquetes NO relacionados con Next (e.g., un webpack plugin bumps por arrastre).

**Si A7 o A8 ocurre y es ambiguo:** revertir el lockfile con
`git checkout HEAD -- nextjs_space/package-lock.json`, mantener el bump de
`package.json`, y abrir nueva conversación para discutir qué hacer. No
aceptar "de paso" sin aprobación explícita.

---

## 10. Approval

**Status:** ⏳ Pending Review
