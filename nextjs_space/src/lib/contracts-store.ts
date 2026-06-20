"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Contract,
  ContractStatus,
  ContractDocument,
  ContractDocumentType,
} from "@/types";
import { MOCK_CONTRACTS } from "@/mocks";

interface ContractsStore {
  contracts: Contract[];
  addContract: (
    data: Omit<Contract, "id" | "contractNumber" | "documents" | "createdAt">
  ) => Contract;
  updateContract: (id: string, updates: Partial<Contract>) => void;
  deleteContract: (id: string) => void;
  getContract: (id: string) => Contract | undefined;
  addDocument: (contractId: string, doc: Omit<ContractDocument, "id" | "uploadedAt">) => void;
  removeDocument: (contractId: string, docId: string) => void;
  setStatus: (id: string, status: ContractStatus) => void;
}

function nextId(): string {
  return `ct${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

function nextContractNumber(contracts: Contract[]): string {
  const year = new Date().getFullYear();
  const sameYear = contracts.filter((c) => c.contractNumber.startsWith(`CTR-${year}`));
  const next = sameYear.length + 1;
  return `CTR-${year}-${String(next).padStart(4, "0")}`;
}

export const useContractsStore = create<ContractsStore>()(
  persist(
    (set, get) => ({
      contracts: MOCK_CONTRACTS,

      addContract: (data) => {
        const contracts = get().contracts;
        const contract: Contract = {
          ...data,
          id: nextId(),
          contractNumber: nextContractNumber(contracts),
          documents: [],
          createdAt: new Date().toISOString().slice(0, 10),
        };
        set({ contracts: [contract, ...contracts] });
        return contract;
      },

      updateContract: (id, updates) => {
        set({
          contracts: get().contracts.map((c) => (c.id === id ? { ...c, ...updates } : c)),
        });
      },

      deleteContract: (id) => {
        set({ contracts: get().contracts.filter((c) => c.id !== id) });
      },

      getContract: (id) => get().contracts.find((c) => c.id === id),

      addDocument: (contractId, doc) => {
        set({
          contracts: get().contracts.map((c) =>
            c.id !== contractId
              ? c
              : {
                  ...c,
                  documents: [
                    ...c.documents,
                    { ...doc, id: nextId(), uploadedAt: new Date().toISOString().slice(0, 10) },
                  ],
                }
          ),
        });
      },

      removeDocument: (contractId, docId) => {
        set({
          contracts: get().contracts.map((c) =>
            c.id !== contractId
              ? c
              : { ...c, documents: c.documents.filter((d) => d.id !== docId) }
          ),
        });
      },

      setStatus: (id, status) => {
        set({
          contracts: get().contracts.map((c) => (c.id === id ? { ...c, status } : c)),
        });
      },
    }),
    { name: "controlobra-contracts" }
  )
);

export const CONTRACT_TYPE_LABELS: Record<string, string> = {
  OBRA: "Obra",
  SUMINISTRO: "Suministro",
  SERVICIOS: "Servicios",
  CONSULTORIA: "Consultoría",
};

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  DRAFT: "Borrador",
  ACTIVE: "Activo",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
  SUSPENDED: "Suspendido",
};

export const CONTRACT_STATUS_VARIANTS: Record<ContractStatus, "default" | "success" | "warning" | "destructive" | "info"> = {
  DRAFT: "default",
  ACTIVE: "success",
  COMPLETED: "info",
  CANCELLED: "destructive",
  SUSPENDED: "warning",
};

export const CONTRACT_DOCUMENT_TYPE_LABELS: Record<ContractDocumentType, string> = {
  CONTRATO_FIRMADO: "Contrato firmado",
  POLIZA_CUMPLIMIENTO: "Póliza de cumplimiento",
  POLIZA_RESPONSABILIDAD: "Póliza de responsabilidad",
  POLIZA_ANTICIPO: "Póliza de anticipo",
  ACTA_INICIO: "Acta de inicio",
  OTROS: "Otros",
};

export const REQUIRED_CONTRACT_DOCS: ContractDocumentType[] = [
  "CONTRATO_FIRMADO",
  "POLIZA_CUMPLIMIENTO",
  "ACTA_INICIO",
];
