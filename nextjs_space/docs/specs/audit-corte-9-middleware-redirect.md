# Corte 9 — Fix redirect hardcoded a `/administrativo` (P0 bug)

> Spec generado 2026-10-14 por mavis. Bug **preexistente** (no regresión de Next 15 ni
> de Corte 4) introducido en `23c5db3 feat: plan de mejoras 2026-10-01 (P0 + P1 + P2)`.
> Reproducido en prod el 2026-10-14: usuario con sesión expirada → hard refresh →
> middleware ve cookie (no la valida) → redirect a `/administrativo` → 404.

## Contexto

### Síntoma reportado por el usuario
- Al hacer `Ctrl+Shift+R` o `Ctrl+F5` en cualquier página de la app, la URL cambia
  a `/administrativo` y la página muestra 404 "This page could not be found".
- "Afecta TODA la app, no solo PSC".

### Causa raíz (root cause)

El `src/middleware.ts` hardcodea `/administrativo` como destino de redirect en 2
casos (líneas 48 y 57), sin importar el `user.area` real del usuario:

```typescript
// src/middleware.ts, branch "/"
if (pathname === "/") {
  const has = req.cookies.get(SESSION_COOKIE)?.value;
  if (!has) { /* → /login */ }
  const url = req.nextUrl.clone();
  url.pathname = "/administrativo";   // <-- HARDCODED, wrong para tecnico/ventas
  return NextResponse.redirect(url);
}

// src/middleware.ts, branch "/login"
if (pathname === "/login") {
  const has = req.cookies.get(SESSION_COOKIE)?.value;
  if (has) {
    const url = req.nextUrl.clone();
    url.pathname = "/administrativo";   // <-- HARDCODED, wrong para tecnico/ventas
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
```

El comentario del autor admite: *"best-effort: no tenemos el area aqui sin BD, asi
que redirigimos a /administrativo por defecto; el cliente hara un redirect fino
si lo necesita"*. Pero ese "redirect fino del cliente" no existía en el flujo de
hard refresh — el `useEffect` del `LoginPage` corre DESPUÉS del redirect del
middleware, así que el browser ya navegó a `/administrativo` antes de que el
cliente pueda corregir.

### Por qué se nota en hard refresh
- **Navegación SPA (router.push)**: el middleware NO corre, el cliente
  navega directamente, el `useEffect` del login page redirige a `user.area`
  (correcto).
- **Hard refresh / nueva pestaña**: el browser hace un GET completo al server,
  el middleware SÍ corre, redirige a `/administrativo` (incorrecto).
- **Sesión expirada**: además, el middleware solo comprueba `cookieValue.includes(".")` y `length >= 16`. No valida firma ni expiración. Si el usuario tiene una cookie vieja
  con formato válido pero firma HMAC inválida (o sesión revocada en BD), el
  middleware lo deja pasar al cliente. El cliente llama a `/api/auth/login` (GET)
  que valida contra BD y devuelve `{ user: null }`. `DashboardShell` redirige
  a `/login`. Si el usuario luego hace hard refresh en `/login` mientras la
  cookie vieja todavía existe, **el middleware lo redirige a `/administrativo`
  porque la cookie "existe" y tiene formato válido**.

### Hipótesis secundarias (no son el bug)
- `src/page.tsx` (huérfano, no es route en Next 15 con `app/` directory).
- `src/components/dashboard-shell.tsx` (no redirige a `/administrativo` salvo
  en `handleSwitchArea` que solo se llama desde el user menu).
- Service worker (no existe en el proyecto).

## Decisión arquitectónica

**Recomendado:** fix mínimo en 2 archivos + limpieza de 1 archivo dead.
Sin cambio de arquitectura. Las soluciones de fondo (cookie con `user.area`
firmado, validación de expiración en middleware) quedan en el backlog
como Cortes 10 y 11.

**Por qué NO migrar a cookie con `user.area` ahora:** requiere cambio en el
formato de la cookie + `sign`/`verifySessionCookie` en `session.ts` + rotación
de todas las sesiones activas. Es ~1 día de trabajo + riesgo de invalidar
sesiones de usuarios en prod. El fix de este corte es seguro, chico y resuelve
el síntoma inmediato.

**Por qué NO validar expiración en middleware ahora:** el edge runtime de
Next.js no tiene acceso a la BD ni al secret HMAC de forma sencilla. La
validación de firma+exp está en `verifySessionCookie`, que requiere `node:crypto`
y `query()` a la BD. Migrar eso al edge runtime es un trabajo aparte (Corte 10).

---

## 1. User Story

**As a** usuario autenticado de ControlObra con `area` distinto a
`"administrativo"` (típicamente `"tecnico"` o `"ventas"`),
**I want to** que el sistema me redirija a mi dashboard de área correcto
después de un hard refresh o una sesión expirada,
**So that** no termine en un 404 con URL equivocada, y pueda seguir
trabajando sin tener que hacer logout/login manual.

---

## 2. Acceptance Criteria

- [ ] **AC-1** `src/middleware.ts` no redirige a `/administrativo` en los
      branches `pathname === "/"` y `pathname === "/login"` cuando hay
      cookie. Verificación (intent): los 2 `url.pathname = "/administrativo"`
      originales ahora son `url.pathname = "/login"`. Verificación literal:
      `grep -c 'url\.pathname = "/administrativo"' src/middleware.ts` retorna
      `0`. **Nota sobre la cadena `"/administrativo"`:** aparece 1 vez en
      `PROTECTED_PREFIXES = ["/tecnico", "/administrativo", "/ventas"]` (línea 29).
      Eso es la **lista de paths protegidos por el middleware** (los URL
      prefixes que requieren cookie válida para entrar), NO un redirect
      target. El AC-1 evalúa el intent ("no redirect a `/administrativo`"),
      no la presencia literal de la cadena. Si en el futuro se quiere un
      grep totalmente limpio, se puede renombrar el path protegido a algo
      como `"/admin"` (cambio de scope mayor, fuera de este corte).
- [ ] **AC-2** `src/app/login/page.tsx` no contiene el fallback
      `?? "administrativo"` en ninguno de sus 3 sitios (líneas 58, 123, 155
      antes del fix). Verificación: `grep -c '?? "administrativo"' src/app/login/page.tsx`
      retorna `0` después del fix.
- [ ] **AC-3** `src/page.tsx` no existe. Verificación:
      `! test -f src/page.tsx`.
- [ ] **AC-4** `npx tsc --noEmit` retorna solo el error preexistente en
      `tests/verifiers/advances-suggestion.spec.ts:21` (TS2741 'contractId'
      missing). 0 nuevos.
- [ ] **AC-5** `npx vitest run` retorna 751 passed | 0 failed | 8 skipped
      (759 total) — el baseline post-Corte-6. Sin regresiones. Si el baseline
      cambia por Cortes futuros, ajustar el número; el invariante es 0 nuevos
      rojos introducidos por este Corte.
- [ ] **AC-6** `next build` exit 0. 29 páginas estáticas. Sin warnings nuevos
      atribuibles al Corte 9.

---

## 3. Edge Cases / Riesgos

- **R1 (cookie expirada, mitigate por AC-2):** usuario con cookie firmada
  correctamente pero con `exp < now`. Hoy: el middleware deja pasar (formato
  OK), el cliente llama a `/api/auth/login` (GET) que valida, devuelve
  `{ user: null }`, DashboardShell redirige a `/login`. Después del fix
  AC-2: si `user.area` falta, mensaje claro en login. Si `user` es null,
  el useEffect del login no redirige (queda en el form). Funciona
  correctamente.
- **R2 (BD caída en `/api/auth/login`):** devuelve 500, `refresh()` setea
  `user: null, error: "..."`. DashboardShell no redirige a `/login` (porque
  `!user && hydrated` solo se activa si el endpoint devolvió 200 con user
  null). El usuario ve un spinner infinito. **Mitigate:** mostrar error
  state en lugar de spinner (fuera de scope de este corte).
- **R3 (browser back-button después de redirect):** el usuario en
  `/administrativo` (antes del fix) hace back, va a `/login`, hard
  refresh, loop infinito de redirects. Después del fix: `/login` →
  `/login` (no redirect, el page renderiza, el useEffect del login decide).
  Loop resuelto.
- **R4 (login fallido reciente):** usuario en `/login` con cookie vieja +
  nueva session creada. La cookie vieja sigue presente hasta logout. Hoy:
  el middleware lo manda a `/administrativo` (incorrecto). Después del
  fix: lo manda a `/login`, ve el form, hace login OK, redirect a su
  area. Comportamiento correcto.
- **R5 (CSP headers):** los headers de seguridad en `next.config.mjs`
  (CSP, HSTS, etc.) no se ven afectados por este fix. Verificado: el fix
  solo cambia `url.pathname` dentro de `NextResponse.redirect()`, no
  headers HTTP.

---

## 4. Technical Contract

### 4.1 Fix 1 — `src/middleware.ts` (líneas 48 y 57)

```diff
   if (pathname === "/") {
     const has = req.cookies.get(SESSION_COOKIE)?.value;
     if (!has) {
       const url = req.nextUrl.clone();
       url.pathname = "/login";
       return NextResponse.redirect(url);
     }
     const url = req.nextUrl.clone();
-    url.pathname = "/administrativo";
+    url.pathname = "/login";
     return NextResponse.redirect(url);
   }

   if (pathname === "/login") {
     const has = req.cookies.get(SESSION_COOKIE)?.value;
     if (has) {
       const url = req.nextUrl.clone();
-      url.pathname = "/administrativo";
+      url.pathname = "/login";
       return NextResponse.redirect(url);
     }
     return NextResponse.next();
   }
```

**Nota:** la línea 57 (`/login` con cookie → `/login`) resulta en un
self-redirect, que es equivalente a `NextResponse.next()`. El navegador
lo maneja como no-op. Lo dejamos explícito para que el lector del código
vea la intención. (Alternativa: cambiar a `return NextResponse.next();`
directamente. **Decisión:** mantener la línea con el redirect a `/login` por
simetría con el otro branch; ambos muestran la intención "con cookie,
redirige a /login para que el cliente decida".)

### 4.2 Fix 2 — `src/app/login/page.tsx` (3 sitios)

**Sitio A — línea 58 (useEffect de hydration):**

```diff
   useEffect(() => {
     if (hydrated && user) {
-      router.push(`/${String(user.area ?? "administrativo").toLowerCase()}`);
+      if (!user.area) {
+        setError("Tu cuenta no tiene un área asignada. Contacta al administrador.");
+        return;
+      }
+      router.push(`/${user.area.toLowerCase()}`);
     }
   }, [hydrated, user, router]);
```

**Sitio B — línea 123 (devLogin handler):**

```diff
       if (data.ok && data.user) {
         // Sincronizar el store local con el user dev antes de navegar.
         await refresh();
-        // Forzamos lowercase para alinear con los segmentos de Next.js
-        // (`/administrativo`, `/tecnico`). Ver bug fix en verifyOtp arriba.
-        router.push(
-          `/${String(data.user.area ?? "administrativo").toLowerCase()}`,
-        );
+        if (!data.user.area) {
+          setError("Tu cuenta dev no tiene un área asignada. Contacta al administrador.");
+          return;
+        }
+        // Forzamos lowercase para alinear con los segmentos de Next.js
+        // (`/administrativo`, `/tecnico`). Ver bug fix en verifyOtp arriba.
+        router.push(`/${data.user.area.toLowerCase()}`);
       } else {
         setError("Dev login no devolvio un usuario valido.");
       }
```

**Sitio C — línea 155 (verifyOtp handler):**

```diff
       if (data.ok && data.user) {
-        // El area puede llegar en mayusculas desde la BD; Next.js usa
-        // segmentos en minusculas (`/administrativo`, `/tecnico`).
-        // Forzamos toLowerCase() para evitar 404 al redirigir.
-        router.push(`/${String(data.user.area ?? "administrativo").toLowerCase()}`);
+        if (!data.user.area) {
+          setError("Tu cuenta no tiene un área asignada. Contacta al administrador.");
+          return;
+        }
+        // El area puede llegar en mayusculas desde la BD; Next.js usa
+        // segmentos en minusculas (`/administrativo`, `/tecnico`).
+        // Forzamos toLowerCase() para evitar 404 al redirigir.
+        router.push(`/${data.user.area.toLowerCase()}`);
       } else {
         setError("Codigo invalido. Verifica e intenta de nuevo.");
       }
```

### 4.3 Fix 3 — `git rm src/page.tsx`

Archivo huérfano de la migración Next 14 → 15. Nunca fue un route (Next.js
15 con `app/` directory no lee `src/page.tsx`). El build actual no lo
incluye. Borrar para evitar confusión futura.

### 4.4 AGENTS.md update

Agregar entrada en `## Changelog de fixes` con sub-sección
`### [2026-10-14] audit-corte-9-middleware-redirect`. Incluir diagnóstico,
fix aplicado, y un sub-apartado "Backlog" con Corte 10 y 11.

---

## 5. Dependencies

### Files to Modify
- `nextjs_space/nextjs_space/src/middleware.ts` (2 líneas)
- `nextjs_space/nextjs_space/src/app/login/page.tsx` (3 sitios)
- `nextjs_space/nextjs_space/AGENTS.md` (entrada de log)

### Files to Delete
- `nextjs_space/nextjs_space/src/page.tsx`

### Files to Create
- `nextjs_space/nextjs_space/docs/specs/audit-corte-9-middleware-redirect.md` (este spec)

### Files explicitly NOT touched
- `nextjs_space/nextjs_space/src/lib/session.ts` (formato de cookie — Corte 11)
- `nextjs_space/nextjs_space/src/lib/auth-store.ts`
- `nextjs_space/nextjs_space/src/lib/api.ts`
- `nextjs_space/nextjs_space/src/lib/api-auth.ts`
- `nextjs_space/nextjs_space/src/app/api/auth/login/route.ts`
- `nextjs_space/nextjs_space/src/components/dashboard-shell.tsx`
- `nextjs_space/nextjs_space/src/app/layout.tsx`
- `nextjs_space/nextjs_space/src/app/tecnico/layout.tsx`
- Cualquier API route de PSC, PT, etc. (no relacionado al auth middleware)
- `package.json` / `package-lock.json`

---

## 6. Verifier Plan

### V1 — `src/middleware.ts` ya no tiene `/administrativo`

```bash
cd nextjs_space/nextjs_space
grep -c '"/administrativo"' src/middleware.ts
# Esperado: 0
```

### V2 — `src/app/login/page.tsx` no tiene `?? "administrativo"`

```bash
cd nextjs_space/nextjs_space
grep -c '?? "administrativo"' src/app/login/page.tsx
# Esperado: 0
```

### V3 — `src/page.tsx` no existe

```bash
cd nextjs_space/nextjs_space
test -f src/page.tsx && echo "FAIL" || echo "OK"
# Esperado: OK
```

### V4 — TypeScript sin errores nuevos

```bash
cd nextjs_space/nextjs_space
NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit
```

**Criterio:** exit 2 (tsc reporta errores), pero el único error en el output
es el preexistente `tests/verifiers/advances-suggestion.spec.ts:21` (TS2741
'contractId' missing). 0 nuevos.

### V5 — Vitest full intacto

```bash
cd nextjs_space/nextjs_space
NODE_OPTIONS="--max-old-space-size=4096" npx vitest run
```

**Criterio:** 751 passed | 0 failed | 8 skipped (759 total). Sin regresiones.

### V6 — Next build exit 0

```bash
cd nextjs_space/nextjs_space
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

**Criterio:** exit 0. 29 páginas estáticas. Sin warnings nuevos atribuibles al
Corte 9 (los 3 warnings `[db] ER_ACCESS_DENIED_ERROR` son ruido esperado del
host local sin acceso a Hostinger y NO cuentan).

### V7 — Manual: hard refresh en `/login`

(Lo ejecuta el usuario en prod después del deploy.)

1. Login con un usuario de `area: "tecnico"`.
2. Esperar a que la sesión expire (o logout desde otra pestaña sin cerrar esta).
3. En la pestaña con la cookie expirada, hard refresh en `/login`
   (`Ctrl+Shift+R`).
4. **Esperado:** el browser hace GET a `/login`. El middleware deja pasar
   (cookie existe, formato válido). El page renderiza. El `useEffect` llama
   a `refresh()` que falla (sesión expirada) y setea `user: null`. El
   page muestra el form de login. **No** redirige a `/administrativo`.
5. **Antes del fix:** la URL cambiaba a `/administrativo` con 404.

### V8 — Manual: hard refresh en `/` con sesión activa

1. Login con un usuario de `area: "tecnico"`.
2. Hard refresh en `/` (`Ctrl+Shift+R`).
3. **Esperado:** el browser hace GET a `/`. El middleware redirige a `/login`.
   El page renderiza. El `useEffect` ve `user` (sesión activa), redirige a
   `/tecnico` (correcto). **No** redirige a `/administrativo`.

---

## 7. Estrategia de commits (aislamiento)

| # | Mensaje | Archivos | LOC |
|---|---|---|---|
| 1 | `fix(middleware): redirect to /login instead of hardcoded /administrativo` | `src/middleware.ts` | -2/+2 |
| 2 | `fix(auth): explicit error when user.area is missing in login flows` | `src/app/login/page.tsx` | -9/+27 (3 sitios) |
| 3 | `chore(cleanup): remove src/page.tsx (dead code from Next 14 migration) + log AGENTS.md` | `src/page.tsx` (delete) + `AGENTS.md` | -25 + 50 |

**Push:** `origin/main`, branch `main`, commits individuales (`git add` por
archivo, NO `git add -A`). Mensajes exactos arriba. Push sin `--force`.

**Orden de aplicación:**
- Commit 1 → V4 (tsc) → V5 (vitest) → V6 (build) → push.
- Commit 2 → V4 → V5 → V6 → push.
- Commit 3 → V4 → V5 → V6 → push.

---

## 8. Out of Scope

- **Corte 10** (backlog): middleware valida expiración de cookie antes del
  redirect. Requiere llevar `verifySessionCookie` al edge runtime o agregar
  un endpoint lightweight tipo `/api/auth/validate`.
- **Corte 11** (backlog): cookie incluye `user.area` firmado para que el
  middleware pueda redirigir al área correcta sin BD lookup. Cambia el
  formato de cookie y requiere rotación de todas las sesiones activas.
- Refactor de `src/components/dashboard-shell.tsx` para mostrar error
  state cuando `/api/auth/login` devuelve 500 (R2).
- Cambio de UX en el login page para mostrar un mensaje más amigable que
  "Tu cuenta no tiene un área asignada" (e.g., redirigir a un formulario
  de contacto o mostrar un código de error).
- Tests E2E con Playwright (no hay infra; los verifications son shell + manual).

---

## 9. Plan de Aborto

**Cancelar el commit y reportar sin push si se cumple CUALQUIERA de:**

- **A1:** V4 (tsc) introduce errores TS nuevos. Abortar.
- **A2:** V5 (vitest) introduce regresiones. Abortar.
- **A3:** V6 (next build) falla con exit != 0 O cambia el conteo de páginas
  estáticas (29 → ≠29). Abortar.
- **A4:** Después del deploy, el browser test (V7) muestra que el bug
  persiste (sigue redirigiendo a `/administrativo`). Re-diagnóstico.
- **A5:** Después del deploy, V7 muestra que el flujo normal de login
  (OTP + redirect a `/tecnico`) está roto. Abortar y reportar.

---

## 10. Approval

**Status:** ⏳ Pending Review (reproducido en prod, fix listo para aplicar)

---

## 11. Backlog (Cortes futuros, NO tocar en este corte)

- **Corte 10** — Middleware valida expiración de cookie antes del redirect
  al área. Hoy, el middleware solo comprueba `cookieValue.includes(".")` y
  `length >= 16`. No verifica firma HMAC ni `exp` ni fila en `user_sessions`.
  Resultado: cookies expiradas/revocadas con formato válido pasan el gate
  y llegan al cliente, donde `/api/auth/login` (GET) las rechaza. Mientras
  tanto, el browser ya cargó `/login` y luego intenta navegar a otra URL.
  Solución: o (a) llevar `verifySessionCookie` al edge runtime (limitado
  porque el edge runtime no tiene `node:crypto` por defecto en Next 15), o
  (b) agregar un endpoint lightweight `/api/auth/validate` que el middleware
  llama antes de redirigir.

- **Corte 11** — Cookie incluye `user.area` firmado para que el middleware
  pueda redirigir al área correcta sin BD lookup ni endpoint extra. Cambia
  el formato de cookie a `${userId}|${exp}|${tokenId}|${area}.${sig}`. Esto
  requiere:
  - Actualizar `sign`/`verifySessionCookie` en `src/lib/session.ts`.
  - Rotar todas las sesiones activas (logout forzoso de todos los usuarios).
  - Validar que `sign` es backward-compatible (los cookies viejos no se
    pueden deserializar con el formato nuevo).
  - En el middleware, parsear la cookie, extraer `user.area`, hacer el
    redirect correcto.

---

## 12. Changelog post-implementación

(Se llena después de aplicar los 3 commits.)
