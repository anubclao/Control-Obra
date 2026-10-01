// @vitest-environment jsdom
/**
 * tests/verifiers/kpi-card.spec.tsx
 *
 * Verifier de los componentes UI de Fase 3 (P1, seccion 4.3):
 *
 *  - `KpiCard`     : cuatro estados (loading / error / empty / value).
 *  - `PanelState`  : wrapper que decide cual de los tres mostrar.
 *  - `PaginationControl`: aparece solo si hay mas de una pagina.
 *
 * Cada estado se monta con React Testing Library y se valida con
 * `data-testid` para no depender del texto.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Wallet, AlertCircle, Inbox } from "lucide-react";

import { KpiCard, KpiMini } from "@/components/ui/kpi-card";
import { PanelState } from "@/components/ui/panel-state";
import { PaginationControl } from "@/components/ui/pagination-control";

describe("KpiCard", () => {
  it("muestra el valor cuando todo OK", () => {
    render(
      <KpiCard
        title="Por pagar"
        icon={Wallet}
        value="$1.250.000"
        subtitle="3 solicitudes"
      />,
    );
    expect(screen.getByTestId("kpi-value")).toBeTruthy();
    expect(screen.getByText("$1.250.000")).toBeTruthy();
    expect(screen.getByText("3 solicitudes")).toBeTruthy();
  });

  it("muestra skeleton en loading y oculta el valor", () => {
    render(
      <KpiCard title="Por pagar" icon={Wallet} value="$1.250.000" loading />,
    );
    expect(screen.getByTestId("kpi-loading")).toBeTruthy();
    expect(screen.queryByTestId("kpi-value")).toBeNull();
  });

  it("muestra error con boton Reintentar y llama a onRetry", () => {
    const onRetry = vi.fn();
    render(
      <KpiCard
        title="Por pagar"
        icon={Wallet}
        value="$0"
        error="ECONNREFUSED"
        onRetry={onRetry}
      />,
    );
    expect(screen.getByTestId("kpi-error")).toBeTruthy();
    expect(screen.getByText("ECONNREFUSED")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("muestra estado vacio con CTA opcional", () => {
    render(
      <KpiCard
        title="Por pagar"
        icon={Wallet}
        value="$0"
        isEmpty={{
          title: "Sin pagos pendientes",
          cta: { label: "Crear pago", href: "/administrativo/pagos" },
        }}
      />,
    );
    expect(screen.getByTestId("kpi-empty")).toBeTruthy();
    expect(screen.getByText("Sin pagos pendientes")).toBeTruthy();
    const link = screen.getByRole("link", { name: /crear pago/i });
    expect(link.getAttribute("href")).toBe("/administrativo/pagos");
  });
});

describe("KpiMini", () => {
  it("muestra el valor y la etiqueta", () => {
    render(<KpiMini label="Borrador" value={3} icon={Wallet} />);
    expect(screen.getByText("Borrador")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("muestra skeleton cuando loading=true", () => {
    const { container } = render(
      <KpiMini label="Borrador" value={3} icon={Wallet} loading />,
    );
    // El Skeleton tiene la clase `animate-pulse`.
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });
});

describe("PanelState", () => {
  it("muestra skeleton cuando loading=true", () => {
    render(
      <PanelState loading skeletonRows={3}>
        <div>HOLA</div>
      </PanelState>,
    );
    expect(screen.getByTestId("panel-loading")).toBeTruthy();
  });

  it("muestra error y el boton reintentar", () => {
    const onRetry = vi.fn();
    render(
      <PanelState error="fallo la API" onRetry={onRetry}>
        <div>HOLA</div>
      </PanelState>,
    );
    expect(screen.getByTestId("panel-error")).toBeTruthy();
    expect(screen.getByText("fallo la API")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("muestra estado vacio con CTA", () => {
    render(
      <PanelState
        isEmpty
        emptyTitle="Vacio"
        emptyDescription="no hay nada"
        emptyIcon={Inbox}
        emptyCta={{ label: "Crear", href: "/x" }}
      >
        <div>IGNORAR</div>
      </PanelState>,
    );
    expect(screen.getByTestId("panel-empty")).toBeTruthy();
    expect(screen.getByText("Vacio")).toBeTruthy();
    const link = screen.getByRole("link", { name: /crear/i });
    expect(link.getAttribute("href")).toBe("/x");
  });

  it("renderiza los hijos cuando no hay loading/error/empty", () => {
    render(
      <PanelState>
        <div>CONTENIDO</div>
      </PanelState>,
    );
    expect(screen.getByText("CONTENIDO")).toBeTruthy();
  });
});

describe("PaginationControl", () => {
  it("no se renderiza si solo hay una pagina", () => {
    const { container } = render(
      <PaginationControl
        page={1}
        totalPages={1}
        total={5}
        limit={50}
        onPageChange={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renderiza Anterior / Siguiente y respeta los limites", () => {
    const onPageChange = vi.fn();
    render(
      <PaginationControl
        page={2}
        totalPages={5}
        total={120}
        limit={25}
        onPageChange={onPageChange}
        noun="cortes"
      />,
    );
    expect(screen.getByTestId("pagination-control")).toBeTruthy();
    expect(screen.getByText(/26-50 de 120 cortes/)).toBeTruthy();
    // Pagina 2, prev esta habilitado
    const prev = screen.getByRole("button", { name: /anterior/i });
    expect(prev.hasAttribute("disabled")).toBe(false);
    fireEvent.click(prev);
    expect(onPageChange).toHaveBeenCalledWith(1);
    // Pagina 2 < 5, next habilitado
    const next = screen.getByRole("button", { name: /siguiente/i });
    expect(next.hasAttribute("disabled")).toBe(false);
  });

  it("deshabilita Anterior en la primera pagina y Siguiente en la ultima", () => {
    render(
      <PaginationControl
        page={1}
        totalPages={3}
        total={50}
        limit={20}
        onPageChange={() => {}}
      />,
    );
    expect(
      screen
        .getByRole("button", { name: /anterior/i })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen
        .getByRole("button", { name: /siguiente/i })
        .hasAttribute("disabled"),
    ).toBe(false);
  });
});
