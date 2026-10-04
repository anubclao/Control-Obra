# Spec: DEV-AUTH bypass para testing en maquina local sin MySQL alcanzable

## User Story

Como developer del proyecto, quiero poder entrar a la aplicacion como admin
sin pasar por el flujo de email/OTP cuando estoy probando localmente, porque
mi maquina no puede alcanzar el MySQL de Hostinger y el lookup del usuario
falla antes de poder enviar (o devolver en `devCode`) el codigo OTP.

## Contexto

- El dev local corre `npm run dev` apuntando a `DB_HOST=auth-db1569.hstgr.io`
  (MySQL compartido en Hostinger).
- Hostinger NO expone el puerto 3306 a Internet: solo sus servidores internos
  pueden conectar.
- Resultado: `request-otp` falla con `ER_ACCESS_DENIED_ERROR` y devuelve 500.
- El dev no puede autenticarse por el flujo normal para probar la app.

## Reglas duras (NO negociables)

1. **Produccion queda bit-identica.** Ningun cambio en este PR afecta el flujo
   OTP real cuando `NODE_ENV === "production"` o cuando `DEV_AUTH_BYPASS`
   no esta activo. La unica ruta nueva devuelve **siempre** `404 Not Found`
   fuera de dev.
2. **Doble guard requerido:** la ruta nueva exige AMBOS:
   - `process.env.NODE_ENV !== "production"` (dev o test)
   - `process.env.DEV_AUTH_BYPASS === "true"` (opt-in explicito)
3. **Hostinger (prod real) NUNCA tendra `DEV_AUTH_BYPASS=true`** porque su
   `.env` no incluye esa variable. Ademas, si por error se pusiera, la doble
   guard + `NODE_ENV === "production"` ya cierra el vector.
4. La sesion creada en dev NO escribe en `user_sessions` (tabla posiblemente
   inalcanzable). Usa formato legacy `${userId}.${signature}` que
   `verifySessionCookie` acepta **sin** consultar MySQL.
5. La sesion dev tiene `maxAge = 8h` (igual que produccion) y se firma con
   el mismo `SESSION_SECRET`. Si el user rota el secret, las sesiones dev
   se invalidan automaticamente.

## Acceptance Criteria

### AC-1 — Produccion: ruta siempre 404
`POST /api/auth/dev-login` con `NODE_ENV === "production"`, **sin importar
el resto del env**, devuelve 404 sin filtrar info de que existe el endpoint.

### AC-2 — Dev sin flag: ruta 404
`POST /api/auth/dev-login` con `NODE_ENV !== "production"` pero
`DEV_AUTH_BYPASS !== "true"` devuelve 404. Asi el bypass esta opt-in.

### AC-3 — Dev con flag: crea sesion y responde
`POST /api/auth/dev-login` con `NODE_ENV !== "production"` Y
`DEV_AUTH_BYPASS === "true"`:
- Status 200.
- Body: `{ ok: true, user: { id, email, name, role, area }, warning }`.
- Cookie `co_session` set con valor legacy `${userId}.${signature}`.
- NO escribe en `user_sessions` (no hace falta para el flujo).
- Rate-limited igual que el resto del auth (30/min por IP).

### AC-4 — GET /api/auth/login devuelve user dev sin MySQL
Con la cookie dev creada en AC-3, al pedir `GET /api/auth/login`:
- Status 200 con `{ user: <mismo user del POST> }`.
- NO consulta MySQL (la rama dev la intercepta antes del SELECT).
- Si el flag esta apagado, comportamiento actual sin cambios.

### AC-5 — Pantalla de login muestra boton dev
Solo cuando el endpoint `/api/auth/dev-login` responde 200 (o sea: si el
bypass esta habilitado en este servidor), la pantalla `/login` muestra un
boton "Entrar como admin (modo dev)". Si NO esta habilitado, el boton
NO aparece y el usuario sigue el flujo OTP normal.

### AC-6 — Front usa el user dev sin reiniciar
Tras click, el front hace:
1. POST /api/auth/dev-login
2. Recibe `{ ok, user }`
3. Setea el store de auth con el user
4. Redirige a `/${user.area ?? "administrativo"}`
5. La siguiente carga dispara GET /api/auth/login, que devuelve el user
   desde la cookie sin tocar MySQL.

## Edge Cases

- **Sesion dev fuera de la ventana de 8h**: la cookie expira y el user
  vuelve al flujo OTP normal.
- **Sesion dev con SESSION_SECRET rotado**: la firma ya no valida, el
  user queda en null y debe re-autenticarse.
- **Sesion dev + intento de usar endpoints que SI requieren MySQL**:
  `/api/projects`, `/api/budgets`, etc. siguen fallando con 500 si MySQL
  no es alcanzable. Esto es esperado: el bypass es solo para login.
- **Re-entry con la misma cookie dev**: no es problema, es cookie
  httpOnly valida. El rate limit es solo en el POST.

## Technical Contract

### Endpoint nuevo

```
POST /api/auth/dev-login
Body: { userId?: string, email?: string, name?: string, role?: string }
Response 200: { ok: true, user: User, warning: string }
Response 404: { error: "Not found" } (prod o sin flag)
Response 429: rate-limited
Side-effects: set cookie `co_session` (legacy format)
```

### Modificacion en GET /api/auth/login

Inserta antes del SELECT de usuarios:

```typescript
if (process.env.NODE_ENV !== "production"
    && process.env.DEV_AUTH_BYPASS === "true"
    && session) {
  return NextResponse.json({ user: devMockUser(session.userId) });
}
```

### Helper

```typescript
// src/lib/dev-auth.ts
export function devMockUser(userId: string): User
```

Mapea userId string a un user hardcodeado. Default: ADMIN en
area=ADMINISTRATIVO.

### UI

En `src/app/login/page.tsx`, agregar:

```tsx
const [devEnabled, setDevEnabled] = useState(false);
useEffect(() => {
  fetch("/api/auth/dev-login", { method: "POST" })
    .then(r => setDevEnabled(r.status !== 404))
    .catch(() => setDevEnabled(false));
}, []);

{devEnabled && (
  <Button onClick={devLogin} variant="outline">
    Entrar como admin (modo dev)
  </Button>
)}
```

El boton solo aparece si el endpoint esta habilitado.

## Dependencies

- `src/lib/session.ts` — usa `signSession()` legacy export existente.
- `src/lib/rate-limit.ts` — para rate-limit del POST.
- `src/lib/api.ts` — cliente front existente para llamar al endpoint.
- `nextjs_space/.env.local` (gitignored) — agregar `DEV_AUTH_BYPASS=true`.

## Out of scope

- Bypass de otros endpoints que requieren MySQL (`/api/projects`, etc).
  Para probar esos, hay que tener MySQL alcanzable (local o tunnel).
- Crear usuarios dev automaticamente. El bypass usa IDs hardcoded.
- Hacer bypass disponible en produccion bajo cualquier circunstancia.

## Riesgos

- **R1**: Developer olvida y deja `DEV_AUTH_BYPASS=true` en .env de
  produccion. Mitigacion: Hostinger .env no incluye esa variable y el
  guard exige doble check (env + NODE_ENV).
- **R2**: Sesion dev usada para acceder a datos sensibles. Mitigacion:
  el bypass es solo para login, no para datos. Igual, no usar en
  maquinas compartidas.
- **R3**: Sesion legacy sin fila en user_sessions causa confusion si
  el dev luego quiere hacer logout y `revokeSession` falla. Mitigacion:
  logout borra cookie pero loggea warning si no encuentra la fila.

## Cambios necesarios

1. `src/app/api/auth/dev-login/route.ts` (nuevo)
3. `src/lib/dev-auth.ts` (nuevo)
4. `src/app/api/auth/login/route.ts` (modificado — agrega rama dev)
5. `src/app/login/page.tsx` (modificado — agrega boton dev)
6. `nextjs_space/.env.local` (modificado — agrega DEV_AUTH_BYPASS=true)
7. `tests/verifiers/dev-auth-bypass.spec.ts` (nuevo — verificador)