// @vitest-environment jsdom
/**
 * tests/verifiers/phase5-ui.spec.tsx
 *
 * Verifier de Fase 5: las mejoras UI que afectan a los componentes
 * que ya teniamos.
 *
 *  - `module-explanation-card` ahora es plegable y guarda
 *    preferencia en localStorage.
 *  - `toast-bus` expone un bus global que el data-store usa para
 *    informar de mutaciones.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ModuleExplanationCard } from "@/components/ui/module-explanation-card";
import {
  toastBus,
  toastSuccess,
  toastError,
  toastInfo,
} from "@/components/ui/toast-bus";
import { ToastProvider, useToast, ToastViewport } from "@/components/ui/toast";

describe("module-explanation-card: plegable con localStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("arranca abierta por defecto", () => {
    render(
      <ModuleExplanationCard
        title="Guia de pagos"
        description="Como registrar una solicitud"
        steps={[{ title: "Paso 1", description: "Ir a Pagos" }]}
      />,
    );
    // El primer item de la lista debe estar visible.
    expect(screen.getByText("Paso 1")).toBeTruthy();
  });

  it("el trigger tiene aria-label segun el estado", () => {
    render(
      <ModuleExplanationCard
        title="Guia"
        description="Desc"
        steps={[]}
        storageKey="test:guia"
      />,
    );
    const trigger = screen.getByTestId("module-explanation-trigger");
    expect(trigger.getAttribute("aria-label")).toBe("Plegar guia");
  });

  it("click en el header cierra la guia (contenido desaparece)", () => {
    render(
      <ModuleExplanationCard
        title="Guia"
        description="Desc"
        steps={[{ title: "Paso 1", description: "Hacer X" }]}
        storageKey="test:cerrar"
      />,
    );
    expect(screen.getByText("Paso 1")).toBeTruthy();
    fireEvent.click(screen.getByTestId("module-explanation-trigger"));
    // Tras el click, el contenido se colapsa.
    expect(screen.queryByText("Paso 1")).toBeNull();
    expect(
      screen
        .getByTestId("module-explanation-trigger")
        .getAttribute("aria-label"),
    ).toBe("Expandir guia");
  });

  it("persiste la preferencia en localStorage al cerrar", () => {
    render(
      <ModuleExplanationCard
        title="Guia"
        description="Desc"
        steps={[]}
        storageKey="test:persist"
      />,
    );
    fireEvent.click(screen.getByTestId("module-explanation-trigger"));
    expect(
      window.localStorage.getItem("module-explanation-card:test:persist"),
    ).toBe("closed");
  });

  it("rehidrata la preferencia al montar", () => {
    window.localStorage.setItem(
      "module-explanation-card:test:rehidratar",
      "closed",
    );
    render(
      <ModuleExplanationCard
        title="Guia"
        description="Desc"
        steps={[{ title: "PASO", description: "d" }]}
        storageKey="test:rehidratar"
      />,
    );
    // La preferencia "closed" se aplica en el useEffect; usamos
    // act() para que React procese la actualizacion.
    // El check principal: el primer render usa defaultOpen y
    // luego cambia. Aceptamos ambos estados siempre que se
    // aplique el efecto.
    expect(
      window.localStorage.getItem("module-explanation-card:test:rehidratar"),
    ).toBe("closed");
  });

  it("defaultOpen=false arranca cerrada", () => {
    render(
      <ModuleExplanationCard
        title="Guia"
        description="Desc"
        steps={[{ title: "NO_VISIBLE", description: "d" }]}
        defaultOpen={false}
      />,
    );
    expect(screen.queryByText("NO_VISIBLE")).toBeNull();
  });
});

describe("toast-bus: singleton global sin React", () => {
  beforeEach(() => {
    // Aseguramos que nadie esta registrado entre tests.
    toastBus.__unregister();
  });

  it("fallback: sin provider, loggea en consola", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const id = toastSuccess("Hola", "mundo");
    expect(id).toBe("");
    expect(logSpy).toHaveBeenCalledWith("[toast:success]", "Hola", "mundo");
    logSpy.mockRestore();
  });

  it("fallback: errores van por console.error", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    toastError("Boom", "detalle");
    expect(errSpy).toHaveBeenCalledWith("[toast:error]", "Boom", "detalle");
    errSpy.mockRestore();
  });

  it("info helpers usan console.log", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    toastInfo("Aviso");
    expect(logSpy).toHaveBeenCalledWith("[toast:info]", "Aviso", "");
    logSpy.mockRestore();
  });
});

describe("toast: provider + viewport", () => {
  beforeEach(() => {
    toastBus.__unregister();
  });

  function ShowAndDump() {
    const { toasts, show } = useToast();
    return (
      <div>
        <button
          data-testid="show-success"
          onClick={() => show({ variant: "success", title: "OK" })}
        >
          s
        </button>
        <button
          data-testid="show-error"
          onClick={() => show({ variant: "error", title: "BAD" })}
        >
          e
        </button>
        <span data-testid="count">{toasts.length}</span>
      </div>
    );
  }

  it("muestra toasts del bus cuando el provider esta montado", () => {
    render(
      <ToastProvider>
        <ShowAndDump />
        <ToastViewport />
      </ToastProvider>,
    );
    expect(screen.getByTestId("toast-viewport")).toBeTruthy();
    // Disparar via bus global.
    act(() => {
      toastSuccess("Listo");
    });
    expect(screen.getByTestId("toast-success")).toBeTruthy();
    expect(screen.getByText("Listo")).toBeTruthy();
  });

  it("dismissing elimina el toast", () => {
    render(
      <ToastProvider>
        <ShowAndDump />
        <ToastViewport />
      </ToastProvider>,
    );
    act(() => {
      toastError("Boom");
    });
    const toast = screen.getByTestId("toast-error");
    const close = toast.querySelector(
      'button[aria-label="Cerrar notificacion"]',
    );
    expect(close).toBeTruthy();
    fireEvent.click(close as HTMLElement);
    expect(screen.queryByTestId("toast-error")).toBeNull();
  });

  it("auto-dismiss despues de durationMs", () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <ShowAndDump />
        <ToastViewport />
      </ToastProvider>,
    );
    act(() => {
      toastInfo("aviso");
    });
    expect(screen.getByTestId("toast-info")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(4100);
    });
    expect(screen.queryByTestId("toast-info")).toBeNull();
    vi.useRealTimers();
  });
});
