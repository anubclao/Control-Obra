// filepath: tests/verifiers/documents-ui.spec.tsx
// Verifier de los componentes de UI para la feature de generación de
// documentos (F3). Cubre:
//   - <DocumentLink />: render condicional, ícono según extensión, attrs.
//   - <GenerateButton />: flujo de carga, error y éxito, callbacks.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DocumentLink } from "@/components/documents/document-link";
import { GenerateButton } from "@/components/documents/generate-button";

// ──────────────────────────────────────────────────────────────
// DocumentLink
// ──────────────────────────────────────────────────────────────
describe("DocumentLink", () => {
  it("no renderiza nada si webUrl es null/undefined/vacío", () => {
    const { container } = render(<DocumentLink webUrl={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("no renderiza nada si webUrl es string vacío", () => {
    const { container } = render(<DocumentLink webUrl="" />);
    expect(container.firstChild).toBeNull();
  });

  it("renderiza un <a target=_blank> con la URL y el nombre del archivo", () => {
    render(
      <DocumentLink
        webUrl="https://example.com/doc.xlsx"
        fileName="OC_PR-001_0001.xlsx"
      />,
    );
    const link = screen.getByTestId("document-link");
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("https://example.com/doc.xlsx");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.getAttribute("data-filename")).toBe("OC_PR-001_0001.xlsx");
    expect(link.textContent).toContain("OC_PR-001_0001.xlsx");
  });

  it("usa el label como fallback cuando fileName es null", () => {
    render(
      <DocumentLink webUrl="https://example.com/x" label="Último documento" />,
    );
    expect(screen.getByTestId("document-link").textContent).toContain(
      "Último documento",
    );
  });

  it("acepta size=sm con clases compactas", () => {
    render(
      <DocumentLink
        webUrl="https://example.com/x"
        fileName="x.pdf"
        size="sm"
      />,
    );
    const link = screen.getByTestId("document-link");
    expect(link.className).toContain("text-xs");
    expect(link.className).toContain("px-2");
  });

  it("acepta className adicional sin romper las clases base", () => {
    render(
      <DocumentLink
        webUrl="https://example.com/x"
        fileName="x.pdf"
        className="ml-2"
      />,
    );
    const link = screen.getByTestId("document-link");
    expect(link.className).toContain("ml-2");
    expect(link.className).toContain("rounded-md");
  });

  it("el data-url siempre contiene la URL", () => {
    render(
      <DocumentLink
        webUrl="https://sharepoint.example.com/sites/foo"
        fileName="x.pdf"
      />,
    );
    expect(screen.getByTestId("document-link").getAttribute("data-url")).toBe(
      "https://sharepoint.example.com/sites/foo",
    );
  });
});

// ──────────────────────────────────────────────────────────────
// GenerateButton
// ─────────────────────────────────────────────────────────────────
describe("GenerateButton", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("deshabilita el botón cuando no hay entityId", () => {
    render(<GenerateButton entity="payments" entityId="" label="Generar" />);
    const btn = screen.getByTestId("generate-button");
    expect(btn).toBeDisabled();
  });

  it("respeta la prop disabled externa con tooltip", () => {
    render(
      <GenerateButton
        entity="payments"
        entityId="abc"
        disabled
        disabledReason="Sin permisos"
      />,
    );
    const btn = screen.getByTestId("generate-button");
    expect(btn).toBeDisabled();
    expect(btn.getAttribute("title")).toBe("Sin permisos");
  });

  it("renderiza el link al documento actual si currentUrl está presente", () => {
    render(
      <GenerateButton
        entity="payments"
        entityId="abc"
        currentUrl="https://sp.example.com/x.xlsx"
        currentFileName="OC.xlsx"
      />,
    );
    const links = screen.getAllByTestId("document-link");
    expect(links.length).toBeGreaterThanOrEqual(1);
    expect(links[0].getAttribute("href")).toBe("https://sp.example.com/x.xlsx");
  });

  it("llama a /api/documents/generate con entity y entityId correctos", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: {
        get: (h: string) => (h === "content-type" ? "application/json" : null),
      },
      json: async () => ({
        ok: true,
        webUrl: "https://sp/x.xlsx",
        fileName: "OC.xlsx",
        path: "Proyectos/PR-001/02-OC-OS/OC.xlsx",
        sizeBytes: 12345,
        version: 1,
        templateId: "OC",
        generatedAt: new Date().toISOString(),
      }),
    });

    const onGenerated = vi.fn();
    render(
      <GenerateButton
        entity="payments"
        entityId="pay-123"
        onGenerated={onGenerated}
      />,
    );

    fireEvent.click(screen.getByTestId("generate-button"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/documents/generate",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({ entity: "payments", entityId: "pay-123" }),
        }),
      );
    });

    await waitFor(() => {
      expect(onGenerated).toHaveBeenCalledTimes(1);
    });
    const arg = onGenerated.mock.calls[0][0];
    expect(arg.templateId).toBe("OC");
    expect(arg.webUrl).toBe("https://sp/x.xlsx");
  });

  it("incluye templateId en el body si se pasa", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: {
        get: (h: string) => (h === "content-type" ? "application/json" : null),
      },
      json: async () => ({
        ok: true,
        webUrl: "https://sp/x.xlsx",
        fileName: "OC.xlsx",
        path: "x",
        sizeBytes: 1,
        version: 1,
        templateId: "OC",
        generatedAt: new Date().toISOString(),
      }),
    });

    render(
      <GenerateButton entity="expenses" entityId="exp-1" templateId="OC" />,
    );

    fireEvent.click(screen.getByTestId("generate-button"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const callArgs = fetchMock.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body).toEqual({
      entity: "expenses",
      entityId: "exp-1",
      templateId: "OC",
    });
  });

  it("muestra el botón en estado loading durante la petición", async () => {
    let resolveFetch: (v: unknown) => void = () => {};
    fetchMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    render(<GenerateButton entity="payments" entityId="p1" />);
    fireEvent.click(screen.getByTestId("generate-button"));

    await waitFor(() => {
      expect(screen.getByTestId("generate-button").textContent).toContain(
        "Generando",
      );
    });
    expect(screen.getByTestId("generate-button")).toBeDisabled();

    // Resolvemos la promesa para limpiar
    resolveFetch({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({
        ok: true,
        webUrl: "x",
        fileName: "x",
        path: "x",
        sizeBytes: 1,
        version: 1,
        templateId: "AD-0033",
        generatedAt: new Date().toISOString(),
      }),
    });
  });

  it("muestra mensaje accionable cuando SharePoint no está configurado (503)", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      headers: { get: () => "application/json" },
      json: async () => ({
        error: "INTERNAL",
        message: "SharePoint no configurado en este servidor",
      }),
    });

    render(<GenerateButton entity="payments" entityId="p1" />);
    fireEvent.click(screen.getByTestId("generate-button"));

    await waitFor(() => {
      expect(screen.getByTestId("generate-button-error")).toBeInTheDocument();
    });
    const error = screen.getByTestId("generate-button-error");
    expect(error.textContent).toContain("no disponible");
  });

  it("muestra mensaje específico para SP_AUTH_FAILED con hint", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      headers: { get: () => "application/json" },
      json: async () => ({
        error: "SP_AUTH_FAILED",
        hint: "Rotar SP_CLIENT_SECRET",
      }),
    });

    render(<GenerateButton entity="payments" entityId="p1" />);
    fireEvent.click(screen.getByTestId("generate-button"));

    await waitFor(() => {
      expect(screen.getByTestId("generate-button-error")).toBeInTheDocument();
    });
    const error = screen.getByTestId("generate-button-error");
    expect(error.textContent).toContain("autenticación");
    expect(error.textContent).toContain("SP_CLIENT_SECRET");
  });

  it("muestra mensaje para TEMPLATE_MISMATCH con tipo esperado vs recibido", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      headers: { get: () => "application/json" },
      json: async () => ({
        error: "TEMPLATE_MISMATCH",
        expected: "AD-0033",
        got: "OTROS",
      }),
    });

    render(<GenerateButton entity="payments" entityId="p1" />);
    fireEvent.click(screen.getByTestId("generate-button"));

    await waitFor(() => {
      expect(screen.getByTestId("generate-button-error")).toBeInTheDocument();
    });
    expect(screen.getByTestId("generate-button-error").textContent).toContain(
      "OTROS",
    );
  });

  it("muestra mensaje para ENTITY_NOT_FOUND", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: { get: () => "application/json" },
      json: async () => ({ error: "ENTITY_NOT_FOUND" }),
    });

    render(<GenerateButton entity="payments" entityId="missing" />);
    fireEvent.click(screen.getByTestId("generate-button"));

    await waitFor(() => {
      expect(screen.getByTestId("generate-button-error")).toBeInTheDocument();
    });
    expect(screen.getByTestId("generate-button-error").textContent).toContain(
      "no encontrada",
    );
  });

  it("muestra mensaje de error de red si fetch rechaza", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));

    render(<GenerateButton entity="payments" entityId="p1" />);
    fireEvent.click(screen.getByTestId("generate-button"));

    await waitFor(() => {
      expect(screen.getByTestId("generate-button-error")).toBeInTheDocument();
    });
    expect(screen.getByTestId("generate-button-error").textContent).toContain(
      "red",
    );
  });

  it("renderiza el chip verde 'Subido a SharePoint' después del éxito", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({
        ok: true,
        webUrl: "https://sp/x.xlsx",
        fileName: "OC_PR-001_0001.xlsx",
        path: "x",
        sizeBytes: 1,
        version: 1,
        templateId: "OC",
        generatedAt: new Date().toISOString(),
      }),
    });

    render(<GenerateButton entity="payments" entityId="p1" />);
    fireEvent.click(screen.getByTestId("generate-button"));

    await waitFor(() => {
      expect(screen.getByTestId("generate-button-success")).toBeInTheDocument();
    });
    expect(screen.getByTestId("generate-button-success").textContent).toContain(
      "Subido",
    );
  });

  it("atributos data-* en el botón para integración con selectores", () => {
    render(<GenerateButton entity="payments" entityId="pay-99" />);
    const btn = screen.getByTestId("generate-button");
    expect(btn.getAttribute("data-entity")).toBe("payments");
    expect(btn.getAttribute("data-entity-id")).toBe("pay-99");
  });
});
