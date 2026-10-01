/**
 * lib/account-mask.ts
 *
 * Helper de enmascaramiento de datos bancarios para respuestas API.
 *
 * P0 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.4):
 *   Cualquier usuario autenticado (incluso CLIENTE y USER) podia ver
 *   `account_number` en claro desde GET /api/payments. La mitigacion
 *   minima viable es: en los listados, devolver solo los ultimos 4
 *   digitos; en el detalle (GET /api/payments/[id]), el numero completo
 *   lo ven solo los roles internos autorizados.
 *
 * El cifrado a nivel de columna y la tabla `beneficiary_accounts` son P1
 * y se haran en la Fase 2. Aqui solo cerramos la fuga.
 */

const ROLES_WITH_FULL_ACCOUNT = new Set([
  "ADMIN",
  "GERENTE",
  "DIRECTOR",
  "TESORERIA",
  "CONTABILIDAD",
]);

/**
 * Enmascara un numero de cuenta dejando visibles solo los ultimos 4
 * caracteres. Si el valor no es string o es muy corto, devuelve el
 * original sin truncar para no perder informacion de pruebas pequenas.
 */
export function maskAccountNumber(
  accountNumber: string | null | undefined,
): string {
  if (!accountNumber) return "";
  const str = String(accountNumber);
  if (str.length <= 4) return str;
  const last4 = str.slice(-4);
  return `****${last4}`;
}

/**
 * Devuelve el numero de cuenta completo solo si el rol pertenece a la
 * lista blanca. En caso contrario, devuelve la version enmascarada.
 */
export function accountNumberForRole(
  accountNumber: string | null | undefined,
  role: string | null | undefined,
): string {
  if (!accountNumber) return "";
  if (role && ROLES_WITH_FULL_ACCOUNT.has(role)) {
    return String(accountNumber);
  }
  return maskAccountNumber(accountNumber);
}
