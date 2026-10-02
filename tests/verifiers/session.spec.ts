// @vitest-environment node
/**
 * tests/verifiers/session.spec.ts
 *
 * Verifier de Fase 4, P1 (seccion 4.4): la sesion firmada y revocable.
 *
 * Cubre:
 *   - createSession() inserta fila y devuelve cookie con formato
 *     `userId|exp|tokenId.signature`.
 *   - verifySessionCookie() acepta cookies validas y rechaza:
 *       * firma forjada
 *       * payload manipulado
 *       * cookie sin firma
 *       * token_id revocado en BD
 *       * token_id inexistente en BD (anti-robo)
 *       * exp expirado
 *   - revokeSession() marca revoked_at.
 *   - revokeAllUserSessions() cuenta filas afectadas.
 *
 * Mockeamos `@/lib/db` para evitar MySQL real.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const state = vi.hoisted(() => {
  const rows: any[] = [];
  const queryMock = vi.fn(async (sql: string, args: any[] = []) => {
    // Muy simplificado: derivamos que operacion es por el SQL.
    if (/^INSERT/i.test(sql)) {
      const inserted = {
        id: args[0],
        user_id: args[1],
        token_id: args[2],
        revoked_at: null,
        expires_at: new Date(Date.now() + 3600_000),
      };
      rows.push(inserted);
      return { affectedRows: 1, insertId: inserted.id };
    }
    if (/^UPDATE/i.test(sql) && /revoked_at/i.test(sql)) {
      // affectedRows: numero de filas que CAMBIARON (no las que ya
      // estaban en el estado objetivo). Asi un re-revoke devuelve 0.
      // Mapeamos args segun el SQL:
      //   revokeSession:  args = [reason, tokenId, userId]
      //   revokeAllUserSessions: args = [reason, userId]
      const hasTokenFilter = /token_id\s*=/.test(sql);
      const tokenFilter = hasTokenFilter ? args[1] : null;
      const userFilter = hasTokenFilter ? args[2] : args[1];
      let affected = 0;
      for (const r of rows) {
        const matchUser = !userFilter || r.user_id === userFilter;
        const matchToken = !tokenFilter || r.token_id === tokenFilter;
        if (r.revoked_at == null && matchUser && matchToken) {
          r.revoked_at = new Date();
          affected++;
        }
      }
      return { affectedRows: affected };
    }
    if (/^SELECT/i.test(sql) && /user_sessions/i.test(sql)) {
      return rows.filter(
        (r) => r.token_id === args[0] && r.user_id === args[1],
      );
    }
    if (/^UPDATE/i.test(sql) && /last_seen_at/i.test(sql)) {
      return { affectedRows: rows.length };
    }
    return [];
  });
  return { rows, queryMock };
});

vi.mock("@/lib/db", () => ({
  query: state.queryMock,
}));

beforeEach(() => {
  state.rows.length = 0;
  state.queryMock.mockClear();
  process.env.SESSION_SECRET = "test-secret-very-long-1234567890";
});

import {
  createSession,
  verifySessionCookie,
  revokeSession,
  revokeAllUserSessions,
  signSession,
} from "@/lib/session";

beforeEach(() => {
  state.rows.length = 0;
  state.queryMock.mockClear();
  process.env.SESSION_SECRET = "test-secret-very-long-1234567890";
});

describe("createSession", () => {
  it("crea una cookie con formato userId|exp|tokenId.signature", async () => {
    const { cookieValue, sessionId, tokenId, expiresAt } =
      await createSession("u1");
    expect(cookieValue).toMatch(/^u1\|\d+\|[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(sessionId).toBeTruthy();
    expect(tokenId).toBeTruthy();
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("inserta una fila en user_sessions con token_id y expires_at", async () => {
    await createSession("u1", { ip: "1.2.3.4", userAgent: "Mozilla/5.0" });
    expect(state.rows).toHaveLength(1);
    expect(state.rows[0].user_id).toBe("u1");
    expect(state.rows[0].token_id).toBeTruthy();
  });

  it("lanza error si userId es vacio", async () => {
    await expect(createSession("")).rejects.toThrow(/userId/);
  });
});

describe("verifySessionCookie", () => {
  it("acepta una cookie recien creada", async () => {
    const { cookieValue } = await createSession("u1");
    const session = await verifySessionCookie(cookieValue);
    expect(session).not.toBeNull();
    expect(session?.userId).toBe("u1");
    expect(session?.tokenId).toBeTruthy();
  });

  it("rechaza cookie sin firma", async () => {
    const session = await verifySessionCookie("u1|9999999999|abcd");
    expect(session).toBeNull();
  });

  it("rechaza firma forjada", async () => {
    const { cookieValue } = await createSession("u1");
    const tampered = cookieValue.replace(
      /\.[A-Za-z0-9_-]+$/,
      ".forjadaforjada",
    );
    expect(await verifySessionCookie(tampered)).toBeNull();
  });

  it("rechaza payload manipulado (otro userId con misma firma)", async () => {
    const { cookieValue } = await createSession("u1");
    const dot = cookieValue.lastIndexOf(".");
    const payload = cookieValue.slice(0, dot);
    const sig = cookieValue.slice(dot + 1);
    const newPayload = payload.replace("u1", "u2");
    const tampered = `${newPayload}.${sig}`;
    expect(await verifySessionCookie(tampered)).toBeNull();
  });

  it("rechaza token_id que no existe en BD (anti-robo)", async () => {
    // Generamos una cookie con un payload valido pero token_id que
    // jamas fue insertado en BD.
    const { tokenId } = await createSession("u1");
    state.rows.length = 0; // simulamos que la fila se perdio
    // Construimos manualmente la cookie con el mismo tokenId pero
    // ya no esta en la BD.
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const crypto = await import("node:crypto");
    const sig = crypto
      .createHmac("sha256", process.env.SESSION_SECRET!)
      .update(`u1|${exp}|${tokenId}`)
      .digest("base64url");
    const cookieValue = `u1|${exp}|${tokenId}.${sig}`;
    expect(await verifySessionCookie(cookieValue)).toBeNull();
  });

  it("rechaza sesion revocada en BD", async () => {
    const { cookieValue, tokenId } = await createSession("u1");
    // Marcar como revocada.
    state.rows[0].revoked_at = new Date();
    expect(await verifySessionCookie(cookieValue)).toBeNull();
    void tokenId;
  });

  it("rechaza exp en el pasado", async () => {
    const exp = Math.floor(Date.now() / 1000) - 60;
    const crypto = await import("node:crypto");
    const tokenId = "token123";
    const sig = crypto
      .createHmac("sha256", process.env.SESSION_SECRET!)
      .update(`u1|${exp}|${tokenId}`)
      .digest("base64url");
    // Insertamos fila en BD pero con exp en el pasado.
    state.rows.push({
      user_id: "u1",
      token_id: tokenId,
      revoked_at: null,
      expires_at: new Date(exp * 1000),
    });
    const cookieValue = `u1|${exp}|${tokenId}.${sig}`;
    expect(await verifySessionCookie(cookieValue)).toBeNull();
  });

  it("rechaza cookie vacia o sin formato", async () => {
    expect(await verifySessionCookie("")).toBeNull();
    expect(await verifySessionCookie(undefined)).toBeNull();
    expect(await verifySessionCookie("not-a-cookie")).toBeNull();
  });

  it("modo legacy: cookies con formato userId.signature se aceptan como legacy", async () => {
    const cookieValue = signSession("u1");
    const session = await verifySessionCookie(cookieValue);
    expect(session).not.toBeNull();
    expect(session?.userId).toBe("u1");
    expect(session?.sessionId).toBe("legacy");
    expect(session?.tokenId).toBe("legacy");
  });
});

describe("revokeSession", () => {
  it("marca revoked_at y devuelve true", async () => {
    const { cookieValue, tokenId } = await createSession("u1");
    const ok = await revokeSession("u1", tokenId, "logout");
    expect(ok).toBe(true);
    expect(state.rows[0].revoked_at).toBeTruthy();
    // Verificamos que verifySessionCookie ya la rechaza.
    expect(await verifySessionCookie(cookieValue)).toBeNull();
  });

  it("revoke legacy revoca todas las sesiones del usuario", async () => {
    await createSession("u1");
    await createSession("u1");
    const count = await revokeAllUserSessions("u1", "admin_revoke");
    expect(count).toBe(2);
    expect(state.rows.every((r) => r.revoked_at)).toBe(true);
  });
});

describe("revokeAllUserSessions", () => {
  it("devuelve el numero de sesiones revocadas", async () => {
    await createSession("u1");
    await createSession("u1");
    await createSession("u2");
    const count = await revokeAllUserSessions("u1", "test");
    expect(count).toBe(2);
  });

  it("no afecta sesiones ya revocadas", async () => {
    const { tokenId } = await createSession("u1");
    await createSession("u1");
    await revokeSession("u1", tokenId);
    // La segunda sesion queda activa. revokeAll debe devolver 1.
    const count = await revokeAllUserSessions("u1");
    expect(count).toBe(1);
  });
});
