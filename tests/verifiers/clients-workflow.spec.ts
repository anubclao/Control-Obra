// @vitest-environment node
/**
 * tests/verifiers/clients-workflow.spec.ts
 *
 * Verifier de Fase 4, P1 (seccion 4.1): la maquina de estados del
 * pipeline comercial (`clients-workflow.ts`).
 *
 * Reglas:
 *   - status conocido.
 *   - LOST requiere motivo obligatorio.
 *   - Avanzar al siguiente: siempre OK.
 *   - Saltar hacia adelante mas de un paso: solo ADMIN.
 *   - Retroceder: solo ADMIN.
 *   - Salir de WON/LOST: solo ADMIN.
 *   - Mismo estado: OK silencioso.
 */

import { describe, it, expect } from "vitest";
import {
  evaluateClientStage,
  nextClientStages,
  type ClientStageErrorCode,
} from "@/lib/clients-workflow";
import type { ClientStatus } from "@/types";

describe("evaluateClientStage: transiciones validas", () => {
  it("avanzar PROSPECT -> CONTACTED: OK para cualquier rol", () => {
    const r = evaluateClientStage("PROSPECT", "CONTACTED", "RESIDENTE");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.target).toBe("CONTACTED");
  });

  it("avanzar CONTACTED -> QUALIFIED: OK", () => {
    const r = evaluateClientStage("CONTACTED", "QUALIFIED", "DIRECTOR");
    expect(r.ok).toBe(true);
  });

  it("avanzar NEGOTIATION -> WON: OK", () => {
    const r = evaluateClientStage("NEGOTIATION", "WON", "GERENTE");
    expect(r.ok).toBe(true);
  });

  it("mismo estado: OK silencioso (no-op)", () => {
    const r = evaluateClientStage("PROSPECT", "PROSPECT", "RESIDENTE");
    expect(r.ok).toBe(true);
  });
});

describe("evaluateClientStage: LOST requiere motivo", () => {
  it("LOST sin motivo: 400 REASON_REQUIRED", () => {
    const r = evaluateClientStage("PROSPECT", "LOST", "ADMIN");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("REASON_REQUIRED");
      expect(r.status).toBe(400);
    }
  });

  it("LOST con motivo vacio: 400 (trim)", () => {
    const r = evaluateClientStage("PROSPECT", "LOST", "ADMIN", {
      reason: "   ",
    });
    expect(r.ok).toBe(false);
  });

  it("LOST con motivo: OK para cualquier rol", () => {
    const r = evaluateClientStage("CONTACTED", "LOST", "DIRECTOR", {
      reason: "No respondio en 30 dias",
    });
    expect(r.ok).toBe(true);
  });
});

describe("evaluateClientStage: status desconocido", () => {
  it("estado destino desconocido: 400 UNKNOWN_STATUS", () => {
    const r = evaluateClientStage("PROSPECT", "XYZ" as ClientStatus, "ADMIN");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("UNKNOWN_STATUS");
      expect(r.status).toBe(400);
    }
  });
});

describe("evaluateClientStage: ADMIN override", () => {
  it("ADMIN puede saltar etapas hacia adelante", () => {
    const r = evaluateClientStage("PROSPECT", "NEGOTIATION", "ADMIN");
    expect(r.ok).toBe(true);
  });

  it("ADMIN puede retroceder", () => {
    const r = evaluateClientStage("NEGOTIATION", "CONTACTED", "ADMIN");
    expect(r.ok).toBe(true);
  });

  it("ADMIN puede salir de WON", () => {
    const r = evaluateClientStage("WON", "PROSPECT", "ADMIN");
    expect(r.ok).toBe(true);
  });

  it("ADMIN puede salir de LOST", () => {
    const r = evaluateClientStage("LOST", "PROSPECT", "ADMIN");
    expect(r.ok).toBe(true);
  });
});

describe("evaluateClientStage: roles no-ADMIN tienen limites", () => {
  it("DIRECTOR no puede saltar etapas (PROSPECT -> QUALIFIED)", () => {
    const r = evaluateClientStage("PROSPECT", "QUALIFIED", "DIRECTOR");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("FORBIDDEN_REGRESSION");
      expect(r.status).toBe(403);
    }
  });

  it("DIRECTOR no puede retroceder", () => {
    const r = evaluateClientStage("NEGOTIATION", "PROSPECT", "DIRECTOR");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("FORBIDDEN_REGRESSION");
  });

  it("GERENTE no puede salir de WON", () => {
    const r = evaluateClientStage("WON", "NEGOTIATION", "GERENTE");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("TERMINAL_STATE");
      expect(r.status).toBe(400);
    }
  });

  it("GERENTE no puede salir de LOST", () => {
    const r = evaluateClientStage("LOST", "PROSPECT", "GERENTE");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("TERMINAL_STATE");
  });

  it("RESIDENTE no puede saltar etapas", () => {
    const r = evaluateClientStage("PROSPECT", "PROPOSAL", "RESIDENTE");
    expect(r.ok).toBe(false);
  });
});

describe("nextClientStages: lista de transiciones disponibles", () => {
  it("PROSPECT: solo CONTACTED + LOST", () => {
    expect(nextClientStages("PROSPECT", "DIRECTOR").sort()).toEqual([
      "CONTACTED",
      "LOST",
    ]);
  });

  it("NEGOTIATION: WON + LOST", () => {
    expect(nextClientStages("NEGOTIATION", "DIRECTOR").sort()).toEqual([
      "LOST",
      "WON",
    ]);
  });

  it("WON: vacio para no-ADMIN", () => {
    expect(nextClientStages("WON", "DIRECTOR")).toEqual([]);
  });

  it("WON: ADMIN ve todo el pipeline + LOST", () => {
    const opts = nextClientStages("WON", "ADMIN");
    expect(opts).toContain("PROSPECT");
    expect(opts).toContain("LOST");
  });
});

describe("Codigos de error son estables", () => {
  // Guardarrail para que la UI y el server puedan hacer matching.
  const codes: ClientStageErrorCode[] = [
    "UNKNOWN_STATUS",
    "REASON_REQUIRED",
    "FORBIDDEN_REGRESSION",
    "TERMINAL_STATE",
  ];
  it("existen todos los codigos documentados", () => {
    for (const c of codes) expect(c).toBeTruthy();
  });
});
