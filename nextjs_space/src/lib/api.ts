/**
 * lib/api.ts
 *
 * Cliente HTTP fetch para hacer requests desde el frontend (Zustand) a las
 * API routes de Next.js (/api/*). Centraliza:
 *  - serialización JSON
 *  - headers consistentes
 *  - manejo de errores → Error legible (no traga el mensaje del backend)
 *  - método convenience: api.get / api.post / api.put / api.del
 */

export class ApiError extends Error {
  status: number;
  payload: any;
  constructor(message: string, status: number, payload: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

async function request<T>(
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
  url: string,
  body?: unknown,
): Promise<T> {
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  const text = await res.text();
  let json: any = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      // No es JSON; lo devolvemos crudo.
      json = { raw: text };
    }
  }

  if (!res.ok) {
    const msg =
      json?.error || json?.message || `Error HTTP ${res.status} en ${method} ${url}`;
    throw new ApiError(msg, res.status, json);
  }
  return json as T;
}

export const api = {
  get: <T>(url: string) => request<T>("GET", url),
  post: <T>(url: string, body?: unknown) => request<T>("POST", url, body),
  put: <T>(url: string, body?: unknown) => request<T>("PUT", url, body),
  patch: <T>(url: string, body?: unknown) => request<T>("PATCH", url, body),
  del: <T>(url: string) => request<T>("DELETE", url),
};
