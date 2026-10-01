/**
 * lib/rate-limit.ts
 *
 * Rate limit in-memory por IP+endpoint para prevenir abuso.
 *
 * Por qué este archivo existe:
 *   - El endpoint /api/auth/request-otp no tenía rate limit. Un atacante
 *     podía disparar miles de emails OTP por minuto a direcciones arbitrarias
 *     (email bombing) o intentar fuerza bruta sobre el endpoint verify-otp.
 *   - Esta implementación usa una ventana deslizante simple (Map en memoria).
 *     Suficiente para 1 instancia de Next.js.  Para deployments multi-instancia
 *     habría que mover esto a Redis o similar.
 *
 * Uso:
 *   import { rateLimit } from "@/lib/rate-limit";
 *
 *   export async function POST(req: Request) {
 *     const rl = await rateLimit(req, { key: "request-otp", limit: 5, windowMs: 60_000 });
 *     if (!rl.allowed) return rl.response;
 *     // ...
 *   }
 */

import { NextResponse } from "next/server";

interface Bucket {
  hits: number[];
}

interface RateLimitOptions {
  key: string; // identificador único del bucket (ej: "request-otp")
  limit: number; // número máximo de requests permitidos en windowMs
  windowMs: number; // tamaño de la ventana en ms
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number; // ms hasta que se libere la próxima ranura
  response?: NextResponse;
}

// Singleton: la state vive en globalThis para sobrevivir hot-reloads.
declare global {
  // eslint-disable-next-line no-var
  var __rateLimitBuckets: Map<string, Bucket> | undefined;
}

const buckets: Map<string, Bucket> = globalThis.__rateLimitBuckets ?? new Map();
if (process.env.NODE_ENV !== "production") {
  globalThis.__rateLimitBuckets = buckets;
}

// Limpieza periódica de buckets viejos (cada 5 min).
if (typeof setInterval !== "undefined") {
  const gc = setInterval(
    () => {
      const now = Date.now();
      const keys = Array.from(buckets.keys());
      for (const k of keys) {
        const b = buckets.get(k);
        if (!b) continue;
        // Eliminar si no tiene hits en los últimos 10 minutos.
        const lastHit = b.hits[b.hits.length - 1] ?? 0;
        if (now - lastHit > 10 * 60 * 1000) {
          buckets.delete(k);
        }
      }
    },
    5 * 60 * 1000,
  );
  if (typeof gc.unref === "function") gc.unref();
}

/**
 * Extrae la IP del request desde headers comunes (soporta proxies reversos).
 * Si no hay IP, usa "unknown" — todos los "unknown" comparten bucket.
 */
function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

/**
 * Sliding window rate limit.
 */
export function rateLimit(
  req: Request,
  opts: RateLimitOptions,
): RateLimitResult {
  const ip = getClientIp(req);
  const bucketKey = `${opts.key}:${ip}`;
  const now = Date.now();
  const cutoff = now - opts.windowMs;

  let bucket = buckets.get(bucketKey);
  if (!bucket) {
    bucket = { hits: [] };
    buckets.set(bucketKey, bucket);
  }
  // Filtrar hits fuera de la ventana.
  bucket.hits = bucket.hits.filter((t) => t > cutoff);

  if (bucket.hits.length >= opts.limit) {
    const oldest = bucket.hits[0];
    const resetMs = oldest + opts.windowMs - now;
    return {
      allowed: false,
      remaining: 0,
      resetMs,
      response: NextResponse.json(
        {
          error: "Demasiadas solicitudes. Intenta de nuevo en unos segundos.",
          retryAfterMs: resetMs,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(resetMs / 1000)),
            "X-RateLimit-Limit": String(opts.limit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.ceil(resetMs / 1000)),
          },
        },
      ),
    };
  }

  bucket.hits.push(now);
  return {
    allowed: true,
    remaining: opts.limit - bucket.hits.length,
    resetMs: opts.windowMs,
  };
}

/**
 * Variante que limita por una identidad arbitraria (ej: userId autenticado).
 * Útil cuando el rate limit debe ser por usuario y no por IP (ej: endpoint
 * autenticado donde múltiples usuarios detrás de la misma IP NAT no deben
 * compartir bucket).
 *
 * F4: añadido para /api/documents/generate (cada usuario tiene su propio
 * budget; un usuario no puede DoSear la API para los demás).
 */
export function rateLimitByIdentity(
  identity: string,
  opts: RateLimitOptions,
): RateLimitResult {
  const bucketKey = `${opts.key}:${identity}`;
  const now = Date.now();
  const cutoff = now - opts.windowMs;

  let bucket = buckets.get(bucketKey);
  if (!bucket) {
    bucket = { hits: [] };
    buckets.set(bucketKey, bucket);
  }
  bucket.hits = bucket.hits.filter((t) => t > cutoff);

  if (bucket.hits.length >= opts.limit) {
    const oldest = bucket.hits[0];
    const resetMs = oldest + opts.windowMs - now;
    return {
      allowed: false,
      remaining: 0,
      resetMs,
      response: NextResponse.json(
        {
          error: "Demasiadas solicitudes. Intenta de nuevo en unos segundos.",
          retryAfterMs: resetMs,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(resetMs / 1000)),
            "X-RateLimit-Limit": String(opts.limit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.ceil(resetMs / 1000)),
          },
        },
      ),
    };
  }

  bucket.hits.push(now);
  return {
    allowed: true,
    remaining: opts.limit - bucket.hits.length,
    resetMs: opts.windowMs,
  };
}

/**
 * SOLO PARA TESTS. Limpia todo el store de rate limit.
 */
export function _resetRateLimitForTests(): void {
  buckets.clear();
}
