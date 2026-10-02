/**
 * tests/verifiers/project-form-edit.spec.ts
 *
 * Verifier del arreglo de edición de proyectos (docs/specs/bug-proyectos-no-crea.md, AC-6/AC-7).
 *
 * Antes: project-form llamaba al hook useProjectsStore() dentro de onSubmit
 * (viola las reglas de hooks → "Invalid hook call" al guardar) y
 * collection.update() se tragaba los errores, así que una edición fallida
 * parecía exitosa.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ api: apiMock }));

import { useDataStore } from "@/lib/data-store";

beforeEach(() => {
  Object.values(apiMock).forEach((m) => m.mockReset());
  useDataStore.setState((s: any) => ({ projects: { ...s.projects, error: null } }));
});

describe("AC-6 · collection.update() informa si funcionó", () => {
  it("devuelve true y limpia el error cuando la API responde bien", async () => {
    apiMock.put.mockResolvedValue({ ok: true });
    apiMock.get.mockResolvedValue([]);
    useDataStore.setState((s: any) => ({ projects: { ...s.projects, error: "viejo" } }));

    const ok = await useDataStore.getState().projects.update("p1", { name: "Nuevo" });

    expect(ok).toBe(true);
    expect(useDataStore.getState().projects.error).toBeNull();
  });

  it("devuelve false y guarda el mensaje cuando la API falla", async () => {
    apiMock.put.mockRejectedValue(new Error("Código de proyecto duplicado"));

    const ok = await useDataStore.getState().projects.update("p1", { code: "X" });

    expect(ok).toBe(false);
    expect(useDataStore.getState().projects.error).toBe("Código de proyecto duplicado");
  });
});

describe("AC-7 · project-form no llama hooks dentro de onSubmit", () => {
  const src = readFileSync(
    path.resolve(__dirname, "../../src/components/projects/project-form.tsx"),
    "utf8",
  );
  const onSubmit = src.match(/async function onSubmit[\s\S]*?\n  }\n/)?.[0] ?? "";

  it("onSubmit existe", () => {
    expect(onSubmit).not.toBe("");
  });

  it("no invoca ningún use*() dentro de onSubmit", () => {
    expect(onSubmit).not.toMatch(/\buse[A-Z]\w*\(/);
  });

  it("al editar, solo cierra si update devolvió true", () => {
    expect(onSubmit).toMatch(/const\s+(\w+)\s*=\s*await\s+updateProject\([\s\S]*?if\s*\(\s*\1\s*\)\s*onSuccess\(/);
  });
});
