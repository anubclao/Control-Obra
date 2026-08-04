"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Employee,
  EmployeeDocument,
  EmployeeDocumentType,
  EmployeeStatus,
} from "@/types";
import { MOCK_EMPLOYEES } from "@/mocks";

interface EmployeesStore {
  employees: Employee[];
  addEmployee: (
    data: Omit<Employee, "id" | "employeeNumber" | "documents" | "createdAt">,
  ) => Employee;
  updateEmployee: (id: string, updates: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;
  getEmployee: (id: string) => Employee | undefined;
  addDocument: (
    empId: string,
    doc: Omit<EmployeeDocument, "id" | "uploadedAt">,
  ) => void;
  removeDocument: (empId: string, docId: string) => void;
}

function nextId(): string {
  return `emp${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

function nextDocId(): string {
  return `empd${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

function nextEmployeeNumber(employees: Employee[]): string {
  const max = employees.reduce((m, e) => {
    const n = parseInt(e.employeeNumber.replace("EMP-", ""), 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 0);
  return `EMP-${String(max + 1).padStart(4, "0")}`;
}

export const useEmployeesStore = create<EmployeesStore>()(
  persist(
    (set, get) => ({
      employees: MOCK_EMPLOYEES,
      addEmployee: (data) => {
        const employees = get().employees;
        const emp: Employee = {
          ...data,
          id: nextId(),
          employeeNumber: nextEmployeeNumber(employees),
          documents: [],
          createdAt: new Date().toISOString().slice(0, 10),
        };
        set({ employees: [emp, ...employees] });
        return emp;
      },
      updateEmployee: (id, updates) => {
        set({
          employees: get().employees.map((e) =>
            e.id === id ? { ...e, ...updates } : e,
          ),
        });
      },
      deleteEmployee: (id) => {
        set({ employees: get().employees.filter((e) => e.id !== id) });
      },
      getEmployee: (id) => get().employees.find((e) => e.id === id),
      addDocument: (empId, doc) => {
        set({
          employees: get().employees.map((e) =>
            e.id !== empId
              ? e
              : {
                  ...e,
                  documents: [
                    ...e.documents,
                    {
                      ...doc,
                      id: nextDocId(),
                      uploadedAt: new Date().toISOString().slice(0, 10),
                    },
                  ],
                },
          ),
        });
      },
      removeDocument: (empId, docId) => {
        set({
          employees: get().employees.map((e) =>
            e.id !== empId
              ? e
              : { ...e, documents: e.documents.filter((d) => d.id !== docId) },
          ),
        });
      },
    }),
    { name: "controlobra-employees" },
  ),
);

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
  ON_LEAVE: "En licencia",
  TERMINATED: "Terminado",
};

export const EMPLOYEE_STATUS_VARIANTS: Record<
  EmployeeStatus,
  "default" | "success" | "warning" | "destructive"
> = {
  ACTIVE: "success",
  INACTIVE: "default",
  ON_LEAVE: "warning",
  TERMINATED: "destructive",
};

export const EMPLOYEE_DEPARTMENT_LABELS: Record<string, string> = {
  GERENCIA: "Gerencia",
  OPERACIONES: "Operaciones",
  CONTABILIDAD: "Contabilidad",
  TESORERIA: "Tesorería",
  HSEQ: "HSEQ",
  COMERCIAL: "Comercial",
  ADMINISTRATIVO: "Administrativo",
};

export const EMPLOYEE_CONTRACT_LABELS: Record<string, string> = {
  INDEFINIDO: "Término indefinido",
  FIJO: "Término fijo",
  OBRA_LABOR: "Obra o labor",
  PRESTACION: "Prestación de servicios",
  APRENDIZAJE: "Aprendizaje",
};

export const EMPLOYEE_DOC_TYPE_LABELS: Record<EmployeeDocumentType, string> = {
  CEDULA: "Cédula",
  CONTRATO: "Contrato laboral",
  AFILIACION_EPS: "Afiliación EPS",
  AFILIACION_PENSION: "Afiliación Pensión",
  AFILIACION_ARL: "Afiliación ARL",
  EXAMEN_INGRESO: "Examen de ingreso",
  EXAMEN_PERIODICO: "Examen periódico",
  CERTIFICACION_ALTURAS: "Certificación trabajo en alturas",
  LICENCIA_CONDUCIR: "Licencia de conducir",
  CURSO_SST: "Curso SST",
  OTROS: "Otros",
};
