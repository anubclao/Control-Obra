"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Provider,
  ProviderStatus,
  ProviderDocument,
  ProviderDocumentType,
  PersonType,
} from "@/types";
import { MOCK_PROVIDERS } from "@/mocks";

interface ProvidersStore {
  providers: Provider[];
  addProvider: (
    data: Omit<Provider, "id" | "status" | "documents" | "createdAt">,
  ) => { ok: true; provider: Provider } | { ok: false; error: string };
  updateProvider: (id: string, updates: Partial<Provider>) => void;
  deleteProvider: (id: string) => void;
  getProvider: (id: string) => Provider | undefined;
  addDocument: (
    providerId: string,
    doc: Omit<ProviderDocument, "id" | "uploadedAt">,
  ) => void;
  removeDocument: (providerId: string, docId: string) => void;
}

/** Normaliza un NIT/Cédula removiendo espacios, puntos, guiones y normalizando a mayúsculas. */
function normalizeNit(nit: string): string {
  return nit.replace(/[\s.\-]/g, "").toUpperCase();
}

// Documentos obligatorios según tipo de persona
// PDF p.26: Persona Natural → Cédula, Certif Bancaria, RUT (NO Cámara de Comercio)
// PDF p.32: Persona Jurídica → Cédula, Certif Bancaria, RUT, Cámara de Comercio
export const REQUIRED_DOCS_BY_PERSON_TYPE: Record<
  PersonType,
  ProviderDocumentType[]
> = {
  NATURAL: ["CEDULA", "RUT", "CERTIFICADO_BANCARIO"],
  JURIDICA: ["CEDULA", "RUT", "CERTIFICADO_BANCARIO", "CAMARA_COMERCIO"],
};

export function requiredDocsFor(
  personType: PersonType,
): ProviderDocumentType[] {
  return REQUIRED_DOCS_BY_PERSON_TYPE[personType];
}

function computeStatus(provider: Provider): ProviderStatus {
  const required = requiredDocsFor(provider.personType);
  const hasRequired = required.every((type) =>
    provider.documents.some((d) => d.type === type),
  );
  if (!hasRequired) return "INCOMPLETE";

  const now = new Date();
  const hasExpired = provider.documents.some((d) => {
    if (!d.expirationDate) return false;
    return new Date(d.expirationDate) < now;
  });
  return hasExpired ? "EXPIRED" : "COMPLETE";
}

function nextId(): string {
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

export const useProvidersStore = create<ProvidersStore>()(
  persist(
    (set, get) => ({
      providers: MOCK_PROVIDERS,
      addProvider: (data) => {
        // FIX Bug #8: validar NIT único (normalizado)
        const normalizedNew = normalizeNit(data.nit);
        const existing = get().providers.find(
          (p) => normalizeNit(p.nit) === normalizedNew,
        );
        if (existing) {
          return {
            ok: false,
            error: `Ya existe un proveedor con NIT "${data.nit}": ${existing.name}`,
          };
        }
        // FIX Bug #38: calcular status de forma explícita (no reasignar)
        const draft: Provider = {
          ...data,
          id: nextId(),
          documents: [] as ProviderDocument[],
          createdAt: new Date().toISOString().slice(0, 10),
          status: "INCOMPLETE",
        };
        const baseProvider: Provider = {
          ...draft,
          status: computeStatus(draft),
        };
        set({ providers: [baseProvider, ...get().providers] });
        return { ok: true, provider: baseProvider };
      },
      updateProvider: (id, updates) => {
        set({
          providers: get().providers.map((p) => {
            if (p.id !== id) return p;
            const merged = { ...p, ...updates };
            merged.status = computeStatus(merged);
            return merged;
          }),
        });
      },
      deleteProvider: (id) => {
        set({ providers: get().providers.filter((p) => p.id !== id) });
      },
      getProvider: (id) => get().providers.find((p) => p.id === id),
      addDocument: (providerId, doc) => {
        set({
          providers: get().providers.map((p) => {
            if (p.id !== providerId) return p;
            const newDoc: ProviderDocument = {
              ...doc,
              id: nextId(),
              uploadedAt: new Date().toISOString().slice(0, 10),
            };
            const merged = { ...p, documents: [...p.documents, newDoc] };
            merged.status = computeStatus(merged);
            return merged;
          }),
        });
      },
      removeDocument: (providerId, docId) => {
        set({
          providers: get().providers.map((p) => {
            if (p.id !== providerId) return p;
            const merged = {
              ...p,
              documents: p.documents.filter((d) => d.id !== docId),
            };
            merged.status = computeStatus(merged);
            return merged;
          }),
        });
      },
    }),
    { name: "controlobra-providers" },
  ),
);

export const PROVIDER_STATUS_LABELS: Record<ProviderStatus, string> = {
  COMPLETE: "Habilitado",
  INCOMPLETE: "Incompleto",
  EXPIRED: "Docs vencidos",
};

export const PROVIDER_STATUS_VARIANTS: Record<
  ProviderStatus,
  "success" | "warning" | "destructive"
> = {
  COMPLETE: "success",
  INCOMPLETE: "warning",
  EXPIRED: "destructive",
};

export const DOCUMENT_TYPE_LABELS: Record<ProviderDocumentType, string> = {
  CEDULA: "Cédula de Ciudadanía",
  RUT: "RUT",
  CAMARA_COMERCIO: "Cámara de Comercio",
  CERTIFICADO_BANCARIO: "Certificado Bancario",
  CERTIFICACIONES_COMERCIALES: "Certificaciones Comerciales",
  OTROS: "Otros",
};

export const PERSON_TYPE_LABELS: Record<PersonType, string> = {
  NATURAL: "Persona Natural",
  JURIDICA: "Persona Jurídica",
};

export const CATEGORY_LABELS: Record<"PRODUCTO" | "SERVICIO", string> = {
  PRODUCTO: "Producto",
  SERVICIO: "Servicio",
};
