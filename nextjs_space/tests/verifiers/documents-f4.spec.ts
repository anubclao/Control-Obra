// filepath: tests/verifiers/documents-f4.spec.ts
// Verifier de los componentes de F4 (production hardening):
//   - retry: backoff exponencial, retry selectivo (4xx no se reintenta).
//   - rate-limit: por userId, sliding window, headers correctos.
//   - detectTemplateVersion: parsing de versiones en nombre de archivo.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withRetry, isRetryableError } from "@/lib/sharepoint/retry";
import { rateLimitByIdentity, _resetRateLimitForTests } from "@/lib/rate-limit";
import { detectTemplateVersion } from "@/lib/document-generator/render";
import { GraphError, type GraphErrorCode } from "@/lib/sharepoint/client";

// ──────────────────────────────────────────────────────────────
// withRetry
// ──────────────────────────────────────────────────────────────
describe("withRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("ejecuta la función una sola vez si no falla", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const r = await withRetry(fn, { baseDelayMs: 100, jitterMs: 0 });
    expect(r.value).toBe("ok");
    expect(r.attempts).toBe(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("reintenta hasta 3 veces si el error es retryable", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockResolvedValueOnce("ok");
    const p = withRetry(fn, { baseDelayMs: 100, jitterMs: 0, factor: 1 });
    // Avanzar los 2 timers programados (100ms + 100ms con factor=1)
    await vi.runAllTimersAsync();
    const r = await p;
    expect(r.value).toBe("ok");
    expect(r.attempts).toBe(3);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("no reintenta errores no-retryable (propaga inmediato)", async () => {
    const fn = vi
      .fn()
      .mockRejectedValue(new GraphError("SP_AUTH_FAILED", 401, "no auth"));
    await expect(
      withRetry(fn, { baseDelayMs: 100, jitterMs: 0 }),
    ).rejects.toThrow(/no auth/);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("no reintenta 4xx (forbidden, not-found, conflict)", async () => {
    const cases: Array<[GraphErrorCode, number]> = [
      ["SP_FORBIDDEN", 403],
      ["SP_NOT_FOUND", 404],
      ["SP_CONFLICT", 409],
    ];
    for (const [code, status] of cases) {
      const fn = vi.fn().mockRejectedValue(new GraphError(code, status, code));
      await expect(withRetry(fn)).rejects.toThrow(code);
      expect(fn).toHaveBeenCalledTimes(1);
    }
  });

  it("reintenta timeouts (status 0)", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new GraphError("SP_TIMEOUT", 0, "aborted"))
      .mockResolvedValueOnce("ok");
    const p = withRetry(fn, { baseDelayMs: 50, jitterMs: 0, factor: 1 });
    await vi.runAllTimersAsync();
    const r = await p;
    expect(r.value).toBe("ok");
    expect(r.attempts).toBe(2);
  });

  it("reintenta errores 5xx", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new GraphError("SP_SERVER_ERROR", 503, "down"))
      .mockResolvedValueOnce("ok");
    const p = withRetry(fn, { baseDelayMs: 50, jitterMs: 0, factor: 1 });
    await vi.runAllTimersAsync();
    const r = await p;
    expect(r.attempts).toBe(2);
  });

  it("respeta maxAttempts y lanza el último error si se agotan", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("ECONNRESET"));
    const p = withRetry(fn, {
      maxAttempts: 2,
      baseDelayMs: 10,
      jitterMs: 0,
      factor: 1,
    });
    p.catch(() => {}); // swallow
    await vi.runAllTimersAsync();
    await expect(p).rejects.toThrow("ECONNRESET");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("invoca onRetry con attempt/delayMs/error entre reintentos", async () => {
    const onRetry = vi.fn();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockResolvedValueOnce("ok");
    const p = withRetry(fn, {
      baseDelayMs: 100,
      jitterMs: 0,
      factor: 1,
      onRetry,
    });
    await vi.runAllTimersAsync();
    const r = await p;
    expect(r.attempts).toBe(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry.mock.calls[0][0]).toMatchObject({
      attempt: 1,
      delayMs: 100,
    });
    expect(onRetry.mock.calls[0][0].error.message).toBe("ECONNRESET");
  });
});

// ──────────────────────────────────────────────────────────────
// isRetryableError
// ──────────────────────────────────────────────────────────────
describe("isRetryableError", () => {
  it("true para 5xx", () => {
    expect(isRetryableError(new GraphError("SP_SERVER_ERROR", 500, "x"))).toBe(
      true,
    );
    expect(isRetryableError(new GraphError("SP_SERVER_ERROR", 503, "x"))).toBe(
      true,
    );
  });

  it("true para SP_TIMEOUT", () => {
    expect(isRetryableError(new GraphError("SP_TIMEOUT", 0, "x"))).toBe(true);
  });

  it("false para 4xx lógicos", () => {
    expect(isRetryableError(new GraphError("SP_AUTH_FAILED", 401, "x"))).toBe(
      false,
    );
    expect(isRetryableError(new GraphError("SP_FORBIDDEN", 403, "x"))).toBe(
      false,
    );
    expect(isRetryableError(new GraphError("SP_NOT_FOUND", 404, "x"))).toBe(
      false,
    );
    expect(isRetryableError(new GraphError("SP_CONFLICT", 409, "x"))).toBe(
      false,
    );
  });

  it("true para errores de red genéricos", () => {
    expect(isRetryableError(new Error("fetch failed"))).toBe(true);
    expect(isRetryableError(new Error("ECONNRESET"))).toBe(true);
    expect(isRetryableError(new Error("connect ECONNREFUSED"))).toBe(true);
    expect(isRetryableError(new Error("ETIMEDOUT"))).toBe(true);
  });

  it("false para errores genéricos no-retryable", () => {
    expect(isRetryableError(new Error("something else"))).toBe(false);
    expect(isRetryableError("string")).toBe(false);
    expect(isRetryableError(null)).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────
// rateLimitByIdentity
// ──────────────────────────────────────────────────────────────
describe("rateLimitByIdentity", () => {
  beforeEach(() => {
    _resetRateLimitForTests();
  });

  it("permite hasta `limit` hits en la ventana", () => {
    const opts = { key: "test", limit: 3, windowMs: 60_000 };
    const r1 = rateLimitByIdentity("user-1", opts);
    const r2 = rateLimitByIdentity("user-1", opts);
    const r3 = rateLimitByIdentity("user-1", opts);
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it("rechaza el (limit+1)-ésimo hit", () => {
    const opts = { key: "test", limit: 2, windowMs: 60_000 };
    rateLimitByIdentity("user-1", opts);
    rateLimitByIdentity("user-1", opts);
    const r3 = rateLimitByIdentity("user-1", opts);
    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
    expect(r3.response).toBeDefined();
    expect(r3.response!.status).toBe(429);
    expect(r3.response!.headers.get("Retry-After")).toBeTruthy();
  });

  it("los buckets son independientes por identidad", () => {
    const opts = { key: "test", limit: 1, windowMs: 60_000 };
    const a = rateLimitByIdentity("user-A", opts);
    const b = rateLimitByIdentity("user-B", opts);
    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(true);
    // user-A ya gastó su cuota
    const a2 = rateLimitByIdentity("user-A", opts);
    expect(a2.allowed).toBe(false);
    // user-B también
    const b2 = rateLimitByIdentity("user-B", opts);
    expect(b2.allowed).toBe(false);
  });

  it("los buckets son independientes por key", () => {
    const opts1 = { key: "key-1", limit: 1, windowMs: 60_000 };
    const opts2 = { key: "key-2", limit: 1, windowMs: 60_000 };
    const r1a = rateLimitByIdentity("user-1", opts1);
    const r1b = rateLimitByIdentity("user-1", opts2);
    expect(r1a.allowed).toBe(true);
    expect(r1b.allowed).toBe(true);
  });

  it("la respuesta 429 incluye headers X-RateLimit-* y Retry-After", () => {
    const opts = { key: "test", limit: 1, windowMs: 30_000 };
    rateLimitByIdentity("u", opts);
    const blocked = rateLimitByIdentity("u", opts);
    expect(blocked.allowed).toBe(false);
    const headers = blocked.response!.headers;
    expect(headers.get("X-RateLimit-Limit")).toBe("1");
    expect(headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(headers.get("X-RateLimit-Reset")).toBeTruthy();
    expect(Number(headers.get("Retry-After"))).toBeGreaterThan(0);
  });
});

// ──────────────────────────────────────────────────────────────
// detectTemplateVersion
// ──────────────────────────────────────────────────────────────
describe("detectTemplateVersion", () => {
  it("detecta prefijo V<n>-", () => {
    expect(detectTemplateVersion("CONT_GLOBAL")).toBe("v1");
    expect(detectTemplateVersion("CONT_UNITARIO")).toBe("v2");
  });

  it("detecta numeración tipo 3.2", () => {
    expect(detectTemplateVersion("AD-0033")).toBe("3.2");
    expect(detectTemplateVersion("LEG")).toBe("3.3");
    expect(detectTemplateVersion("OC")).toBe("3.5");
    expect(detectTemplateVersion("OS")).toBe("3.6");
    expect(detectTemplateVersion("CORTE")).toBe("3.7");
  });

  it("detecta sufijo [n]", () => {
    expect(detectTemplateVersion("AUSENCIA")).toBe("[1]");
  });

  it("devuelve unversioned si no hay patrón", () => {
    expect(detectTemplateVersion("CONT_DISENOS")).toBe("unversioned");
    expect(detectTemplateVersion("CONT_LABORAL")).toBe("unversioned");
  });
});
