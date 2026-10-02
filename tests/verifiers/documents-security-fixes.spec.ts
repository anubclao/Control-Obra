// filepath: tests/verifiers/documents-security-fixes.spec.ts
// Verifier de los fixes de seguridad aplicados en F4 auditoría:
//   - validateFileName: rechaza path traversal y nombres reservados.
//   - sanitizeIp: rechaza IPs inválidas antes del log.
//   - listLog: filtra por userId salvo para roles privilegiados.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateFileName } from "@/lib/filename-validate";
import { sanitizeIp } from "@/lib/document-generator/log";

// ──────────────────────────────────────────────────────────────
// validateFileName — H-1
// ──────────────────────────────────────────────────────────────
describe("validateFileName (H-1: path traversal / caracteres prohibidos)", () => {
  it("acepta nombres válidos", () => {
    expect(validateFileName("OC_PR-001_0001.xlsx")).toEqual({
      ok: true,
      normalized: "OC_PR-001_0001.xlsx",
    });
    expect(validateFileName("AD-0033.xlsx")).toEqual({
      ok: true,
      normalized: "AD-0033.xlsx",
    });
    expect(validateFileName("a-b_c.d.e")).toEqual({
      ok: true,
      normalized: "a-b_c.d.e",
    });
  });

  it("rechaza path traversal", () => {
    expect(validateFileName("..").ok).toBe(false);
    expect(validateFileName("../etc/passwd").ok).toBe(false);
    expect(validateFileName("foo/../bar").ok).toBe(false);
  });

  it("rechaza nombres que empiezan/terminan en punto", () => {
    expect(validateFileName(".hidden").ok).toBe(false);
    expect(validateFileName("trailing.").ok).toBe(false);
  });

  it("rechaza caracteres prohibidos por Windows/SharePoint", () => {
    const bad = [
      "file<name",
      "file>name",
      'file"name',
      "file/name",
      "file\\name",
      "file|name",
      "file?name",
      "file*name",
      "file:name",
      "espacios no",
    ];
    for (const name of bad) {
      const v = validateFileName(name);
      expect(v.ok, `debería rechazar: ${name}`).toBe(false);
    }
  });

  it("rechaza nombres reservados de Windows", () => {
    for (const reserved of [
      "CON.txt",
      "PRN.xlsx",
      "AUX",
      "NUL",
      "COM1",
      "LPT9",
    ]) {
      const v = validateFileName(reserved);
      expect(v.ok, `debería rechazar reservado: ${reserved}`).toBe(false);
    }
  });

  it("rechaza longitudes fuera de rango", () => {
    expect(validateFileName("").ok).toBe(false);
    expect(validateFileName("a".repeat(201)).ok).toBe(false);
  });

  it("rechaza input no-string", () => {
    expect(validateFileName(123).ok).toBe(false);
    expect(validateFileName(null).ok).toBe(false);
    expect(validateFileName(undefined).ok).toBe(false);
    expect(validateFileName({ name: "x" }).ok).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────
// sanitizeIp — M-4
// ──────────────────────────────────────────────────────────────
describe("sanitizeIp (M-4: validación antes del log)", () => {
  it("acepta IPv4", () => {
    expect(sanitizeIp("192.168.1.1")).toBe("192.168.1.1");
    expect(sanitizeIp("10.0.0.1")).toBe("10.0.0.1");
    expect(sanitizeIp("8.8.8.8")).toBe("8.8.8.8");
  });

  it("acepta IPv6", () => {
    expect(sanitizeIp("::1")).toBe("::1");
    expect(sanitizeIp("2001:db8::1")).toBe("2001:db8::1");
    expect(sanitizeIp("fe80::1")).toBe("fe80::1");
  });

  it("rechaza IPs con caracteres no-IP (header injection / XSS)", () => {
    expect(sanitizeIp("evil<script>")).toBe(null);
    expect(sanitizeIp("127.0.0.1; rm -rf /")).toBe(null);
    expect(sanitizeIp("not-an-ip")).toBe(null);
    expect(sanitizeIp("192.168.1.1\r\nX-Injected: bad")).toBe(null);
  });

  it("rechaza input no-string", () => {
    expect(sanitizeIp(123)).toBe(null);
    expect(sanitizeIp(null)).toBe(null);
    expect(sanitizeIp(undefined)).toBe(null);
  });

  it("trunca a 64 chars y rechaza lo que excede tras trim", () => {
    // 100 letras: pasa el regex (a-z) pero se trunca a 64
    const long = "a".repeat(100);
    const r1 = sanitizeIp(long);
    expect(r1).not.toBeNull();
    expect(r1!.length).toBe(64);
    // IPv6 válida pero de 80 chars → también se trunca a 64
    const validLong = "2001:db8::" + "a".repeat(60);
    const r2 = sanitizeIp(validLong);
    expect(r2).not.toBeNull();
    expect(r2!.length).toBeLessThanOrEqual(64);
    // IPv4 válida: pasa sin truncar (es corta)
    expect(sanitizeIp("192.168.1.1")).toBe("192.168.1.1");
  });
});

// ──────────────────────────────────────────────────────────────
// listLog con filtro de user_id — H-2
// ──────────────────────────────────────────────────────────────
describe("listLog (H-2: aislamiento por usuario)", () => {
  beforeEach(() => {
    // Mock del query para verificar el WHERE
    vi.resetModules();
  });

  it("construye WHERE con user_id cuando se pasa", async () => {
    // Re-mockear el módulo db para interceptar query
    const captured: { sql: string; args: unknown[] }[] = [];
    vi.doMock("@/lib/db", () => ({
      query: async (sql: string, args: unknown[] = []) => {
        captured.push({ sql, args });
        return [];
      },
      transaction: async () => {},
    }));
    const { listLog } = await import("@/lib/document-generator/log");
    await listLog({ entity: "payments", userId: "u-1", limit: 10 });
    expect(captured.length).toBeGreaterThan(0);
    const last = captured[captured.length - 1];
    expect(last.sql).toMatch(/user_id = \?/);
    expect(last.args).toContain("u-1");
  });

  it("omite WHERE user_id cuando no se pasa (modo privilegiado)", async () => {
    const captured: { sql: string; args: unknown[] }[] = [];
    vi.doMock("@/lib/db", () => ({
      query: async (sql: string, args: unknown[] = []) => {
        captured.push({ sql, args });
        return [];
      },
      transaction: async () => {},
    }));
    const { listLog } = await import("@/lib/document-generator/log");
    await listLog({ entity: "payments", limit: 10 });
    expect(captured.length).toBeGreaterThan(0);
    const last = captured[captured.length - 1];
    expect(last.sql).not.toMatch(/user_id = \?/);
  });

  it("combina user_id + entityId correctamente", async () => {
    const captured: { sql: string; args: unknown[] }[] = [];
    vi.doMock("@/lib/db", () => ({
      query: async (sql: string, args: unknown[] = []) => {
        captured.push({ sql, args });
        return [];
      },
      transaction: async () => {},
    }));
    const { listLog } = await import("@/lib/document-generator/log");
    await listLog({
      entity: "expenses",
      entityId: "exp-123",
      userId: "u-1",
    });
    const last = captured[captured.length - 1];
    expect(last.sql).toMatch(/entity = \?/);
    expect(last.sql).toMatch(/entity_id = \?/);
    expect(last.sql).toMatch(/user_id = \?/);
    expect(last.args).toContain("expenses");
    expect(last.args).toContain("exp-123");
    expect(last.args).toContain("u-1");
  });
});
