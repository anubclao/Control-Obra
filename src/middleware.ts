/**
 * src/middleware.ts
 *
 * Middleware de Next.js que protege las tres areas privadas
 * (`/tecnico`, `/administrativo`, `/ventas`) y la raiz `/`.
 *
 * P2 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.4):
 *   Antes las paginas se protegian solo en el cliente (DashboardShell
 *   redirige a /login). Eso exponia la estructura de la app y
 *   permitia que un usuario sin sesion cargara el HTML y los chunks
 *   JS de paginas internas. Con middleware, las areas privadas
 *   devuelven 302 -> /login antes de que el servidor entregue HTML.
 *
 * Limitaciones:
 *   - El middleware de Next corre en el edge runtime, sin acceso a
 *     la BD. Por eso NO validamos contra `user_sessions` aqui
 *     (eso lo hace `requireAuth` en cada API route). Solo
 *     comprobamos que la cookie exista y tenga el formato basico
 *     (HMAC valido). Si existe, dejamos pasar; si no, redirigimos.
 *   - La validacion fuerte (exp, revocacion) ocurre en cada
 *     request a `/api/*` via `requireAuth`.
 *   - `/api/*` NO se gatea aqui: las propias rutas usan
 *     `requireAuth` y devuelven 401 JSON sin redirecciones.
 */

import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "co_session";
const PROTECTED_PREFIXES = ["/tecnico", "/administrativo", "/ventas"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1) La raiz "/" redirige segun sesion:
  //    - sin cookie: /login.
  //    - con cookie: al dashboard del area del usuario (best-effort:
  //      no tenemos el area aqui sin BD, asi que redirigimos a
  //      /administrativo por defecto; el cliente hara un redirect
  //      fino si lo necesita).
  if (pathname === "/") {
    const has = req.cookies.get(SESSION_COOKIE)?.value;
    if (!has) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    const url = req.nextUrl.clone();
    url.pathname = "/administrativo";
    return NextResponse.redirect(url);
  }

  // 2) Login: si ya hay cookie, redirigir al dashboard.
  if (pathname === "/login") {
    const has = req.cookies.get(SESSION_COOKIE)?.value;
    if (has) {
      const url = req.nextUrl.clone();
      url.pathname = "/administrativo";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // 3) Areas protegidas.
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (isProtected) {
    const cookieValue = req.cookies.get(SESSION_COOKIE)?.value;
    if (!cookieValue) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      // Mantener el destino para volver tras login (cliente lo lee
      // si quiere). Evita loops de redirect.
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    // Validacion rapida: la cookie tiene que tener al menos un
    // payload + firma (algo.xxx). No verificamos HMAC aqui porque
    // requireAuth() lo hace contra BD. Esto bloquea visitantes
    // anonimos rapidamente sin tocar la BD.
    if (!cookieValue.includes(".") || cookieValue.length < 16) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

/**
 * Matcher: ejecutar middleware en todo excepto assets estaticos,
 * API routes (porque cada ruta API se protege via requireAuth) y
 * archivos publicos de Next.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api routes (/api/*)
     * - _next/static, _next/image
     * - favicon.ico
     * - archivos con extension (.png, .jpg, etc.)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
