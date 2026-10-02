/**
 * lib/crypto.ts
 *
 * Cifrado simétrico AES-256-GCM para datos sensibles a nivel de columna
 * (numero de cuenta del beneficiario, en P1).
 *
 * P1 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.2):
 *   `payment_requests.account_number` se guardaba en claro. Esta capa
 *   permite cifrarlo en una futura tabla `beneficiary_accounts` sin
 *   tocar los consumidores actuales.
 *
 * La clave sale de `BENEFICIARY_ENC_KEY` (32 bytes en base64). Si no
 * existe, se deriva deterministicamente de `SESSION_SECRET` con HKDF
 * para que los despliegues existentes sigan funcionando sin cambios.
 * En produccion se recomienda fijar la variable explicitamente.
 */

import crypto from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.BENEFICIARY_ENC_KEY;
  if (raw) {
    const buf = Buffer.from(raw, "base64");
    if (buf.length !== 32) {
      throw new Error(
        "BENEFICIARY_ENC_KEY debe ser base64 de 32 bytes (AES-256)",
      );
    }
    cachedKey = buf;
    return buf;
  }
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    // En dev/tests dejamos que las funciones de cifrado devuelvan null
    // en vez de romper el arranque. Los endpoints deben tolerar el
    // null y caer al comportamiento previo (texto plano).
    throw new Error(
      "No hay clave de cifrado (BENEFICIARY_ENC_KEY o SESSION_SECRET)",
    );
  }
  // HKDF SHA-256 para derivar 32 bytes desde el SESSION_SECRET.
  cachedKey = Buffer.from(
    crypto.hkdfSync("sha256", secret, "controlobra-enc", "beneficiary-v1", 32),
  );
  return cachedKey;
}

/**
 * Cifra un texto y devuelve `iv:cipher:tag` en base64, listo para
 * guardarse en una columna VARCHAR. Si no hay clave, devuelve null
 * para que el caller decida como degradar.
 */
export function encryptColumn(plain: string | null | undefined): string | null {
  if (plain == null || plain === "") return null;
  let key: Buffer;
  try {
    key = getKey();
  } catch {
    return null;
  }
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${enc.toString("base64")}:${tag.toString("base64")}`;
}

/**
 * Inverso de encryptColumn. Devuelve null si la entrada esta vacia
 * o si no hay clave configurada.
 */
export function decryptColumn(
  payload: string | null | undefined,
): string | null {
  if (payload == null || payload === "") return null;
  let key: Buffer;
  try {
    key = getKey();
  } catch {
    return null;
  }
  const parts = payload.split(":");
  if (parts.length !== 3) return null;
  try {
    const iv = Buffer.from(parts[0], "base64");
    const enc = Buffer.from(parts[1], "base64");
    const tag = Buffer.from(parts[2], "base64");
    if (tag.length !== TAG_LEN) return null;
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return dec.toString("utf8");
  } catch {
    return null;
  }
}
