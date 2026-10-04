/**
 * src/lib/dev-auth.ts
 *
 * Helpers para el bypass de auth en entorno de desarrollo.
 *
 * POR QUE EXISTE:
 *   Cuando `npm run dev` se ejecuta apuntando al MySQL de Hostinger
 *   (`auth-db1569.hstgr.io`), la maquina local NO puede alcanzarlo porque
 *   Hostinger no expone el puerto 3306 a Internet. El flujo OTP
 *   (`request-otp` + `verify-otp`) hace SELECT contra `users` y muere
 *   con `ER_ACCESS_DENIED_ERROR` antes de poder enviar (o devolver)
 *   el codigo. Resultado: el dev no puede entrar a la app.
 *
 * QUE HACE:
 *   `devMockUser(userId)` devuelve un usuario hardcoded con shape
 *   compatible con `User` para popular el store de auth sin tocar MySQL.
 *
 * QUE NO HACE:
 *   - No se invoca en produccion. Doble guard en el handler
 *     (`NODE_ENV !== "production"` + `DEV_AUTH_BYPASS === "true"`).
 *   - No escribe en BD. La sesion dev es legacy (no requiere fila en
 *     `user_sessions`).
 *   - No bypassa endpoints que requieren datos. Solo el login.
 *
 * IDs hardcoded:
 *   - "1" -> ADMIN (area=ADMINISTRATIVO) — uso principal para testing.
 *   - "2" -> TECNICO (area=TECNICO) — para probar flujos tecnicos.
 *   - cualquier otro -> cae al default ADMIN.
 */

export interface DevMockUser {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "TECNICO" | "SUPER_ADMIN";
  /**
   * IMPORTANTE: este campo se usa como segmento de URL (`/${area}`) en
   * la pantalla /login. Next.js es case-sensitive en `app/<area>/page.tsx`,
   * asi que el valor debe ir SIEMPRE en minúsculas para que el redirect
   * funcione. Bug pre-existente en el flujo OTP regular que aprovecho
   * para arreglar aqui.
   */
  area: "administrativo" | "tecnico";
}

const MOCK_USERS: Record<string, DevMockUser> = {
  "1": {
    id: "1",
    email: "admin@controlobra.local",
    name: "Admin Local (DEV)",
    role: "ADMIN",
    area: "administrativo",
  },
  "2": {
    id: "2",
    email: "tecnico@controlobra.local",
    name: "Tecnico Local (DEV)",
    role: "TECNICO",
    area: "tecnico",
  },
  "3": {
    id: "3",
    email: "superadmin@controlobra.local",
    name: "Super Admin Local (DEV)",
    role: "SUPER_ADMIN",
    area: "administrativo",
  },
};

const DEFAULT_MOCK: DevMockUser = {
  id: "0",
  email: "dev@controlobra.local",
  name: "Dev User",
  role: "ADMIN",
  area: "administrativo",
};

/**
 * Devuelve el mock user para un userId dado. Si el userId no esta en el
 * mapa, devuelve el default (ADMIN). userId vacio tambien cae al default.
 *
 * El shape es compatible con el `User` del front — los campos requeridos
 * (id, email, name, role, area) estan presentes.
 */
export function devMockUser(userId: string | undefined | null): DevMockUser {
  if (!userId) return DEFAULT_MOCK;
  return MOCK_USERS[String(userId)] ?? DEFAULT_MOCK;
}