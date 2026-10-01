"use client";

// filepath: src/app/administrativo/empleados/[id]/page.tsx
// F3: Detail page de un empleado.
// Muestra información personal, contractual, bancaria y de seguridad social,
// más el botón para generar el contrato laboral en SharePoint.

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Users,
  Building2,
  Wallet,
  Mail,
  Phone,
  Shield,
  Calendar,
  UserCheck,
  UserX,
  UserMinus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  useEmployeesStore,
  EMPLOYEE_STATUS_LABELS,
  EMPLOYEE_STATUS_VARIANTS,
  EMPLOYEE_DEPARTMENT_LABELS,
  EMPLOYEE_CONTRACT_LABELS,
  EMPLOYEE_DOC_TYPE_LABELS,
} from "@/lib/data-store";
import { useDataStore } from "@/lib/data-store";
import { GenerateButton } from "@/components/documents/generate-button";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Employee, EmployeeDocumentType } from "@/types";

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { getEmployee, load, addDocument, removeDocument } =
    useEmployeesStore();
  const [docRefresh, setDocRefresh] = useState(0);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const employee = getEmployee(id);

  if (!employee) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/administrativo/empleados">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Empleados
          </Link>
        </Button>
        <div className="rounded-lg border border-dashed p-12 text-center">
          <h2 className="text-lg font-semibold">Empleado no encontrado</h2>
        </div>
      </div>
    );
  }

  const variant = EMPLOYEE_STATUS_VARIANTS[employee.status];
  const statusIcon =
    employee.status === "ACTIVE"
      ? UserCheck
      : employee.status === "ON_LEAVE"
        ? UserMinus
        : employee.status === "TERMINATED"
          ? UserX
          : Users;
  const StatusIcon = statusIcon;

  function handleAddDocument(type: EmployeeDocumentType) {
    addDocument(employee!.id, {
      type,
      fileName: `${type.toLowerCase()}.pdf`,
    });
    setDocRefresh((n) => n + 1);
  }

  function handleRemoveDocument(docId: string) {
    removeDocument(employee!.id, docId);
    setDocRefresh((n) => n + 1);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/administrativo/empleados">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Empleados
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/administrativo/empleados?edit=${employee.id}`}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-xs text-muted-foreground">
                {employee.employeeNumber}
              </p>
              <Badge variant={variant}>
                <StatusIcon className="mr-1 h-3 w-3" />
                {EMPLOYEE_STATUS_LABELS[employee.status]}
              </Badge>
              <Badge variant="outline">
                {EMPLOYEE_DEPARTMENT_LABELS[employee.department]}
              </Badge>
              <Badge variant="secondary">
                {EMPLOYEE_CONTRACT_LABELS[employee.contractType]}
              </Badge>
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              {employee.fullName}
            </h1>
            <p className="text-sm text-muted-foreground">{employee.position}</p>
            <div className="mt-3 flex flex-col gap-1.5 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-4">
              <p className="flex items-center gap-1.5">
                <Building2 className="h-4 w-4" />
                CC {employee.documentId}
              </p>
              {employee.email && (
                <p className="flex items-center gap-1.5">
                  <Mail className="h-4 w-4" />
                  {employee.email}
                </p>
              )}
              {employee.phone && (
                <p className="flex items-center gap-1.5">
                  <Phone className="h-4 w-4" />
                  {employee.phone}
                </p>
              )}
              <p className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                Inicio: {formatDate(employee.startDate)}
                {employee.endDate && ` · Fin: ${formatDate(employee.endDate)}`}
              </p>
            </div>
          </div>

          {employee.salary !== undefined && (
            <div className="rounded-lg bg-secondary/50 p-4 sm:min-w-[220px]">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Salario mensual
              </p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">
                {formatCurrency(employee.salary)}
              </p>
              {employee.riskLevel !== undefined && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Nivel de riesgo ARL:{" "}
                  {["—", "I", "II", "III", "IV", "V"][employee.riskLevel]}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* F3: Documento generado en SharePoint */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Documento generado en SharePoint
          </CardTitle>
          <CardDescription>
            Genera el contrato laboral a término indefinido con los datos de
            este empleado y archívalo en la biblioteca de SharePoint.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <GenerateButton
            entity="employees"
            entityId={employee.id}
            currentUrl={employee.generatedDocumentUrl}
            onGenerated={() => {
              useDataStore
                .getState()
                .employees.load()
                .catch(() => {});
            }}
          />
          {!employee.generatedDocumentUrl && (
            <p className="text-xs text-muted-foreground">
              El contrato se nombrará{" "}
              <code className="rounded bg-muted px-1">
                LAB_{employee.fullName.split(" ")[0].toUpperCase()}_
                {new Date().toISOString().slice(0, 10)}.docx
              </code>
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Seguridad social */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              Seguridad social
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="EPS" value={employee.eps} />
            <Row label="Fondo de pensión" value={employee.pensionFund} />
            <Row label="ARL" value={employee.arl} />
          </CardContent>
        </Card>

        {/* Datos bancarios */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              Datos bancarios
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Banco" value={employee.bankName} />
            <Row
              label="Tipo de cuenta"
              value={
                employee.accountType === "CHECKING"
                  ? "Corriente"
                  : employee.accountType === "SAVINGS"
                    ? "Ahorros"
                    : undefined
              }
            />
            <Row label="Número de cuenta" value={employee.accountNumber} />
          </CardContent>
        </Card>
      </div>

      {/* Documentos */}
      <Card>
        <CardHeader>
          <CardTitle>Documentos ({employee.documents.length})</CardTitle>
          <CardDescription>
            Documentación obligatoria y complementaria del empleado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            {(
              [
                "CEDULA",
                "CONTRATO",
                "AFILIACION_EPS",
                "AFILIACION_PENSION",
                "AFILIACION_ARL",
                "EXAMEN_INGRESO",
                "EXAMEN_PERIODICO",
                "CERTIFICACION_ALTURAS",
                "LICENCIA_CONDUCIR",
                "CURSO_SST",
                "OTROS",
              ] as EmployeeDocumentType[]
            ).map((type) => {
              const doc = employee.documents.find((d) => d.type === type);
              return (
                <div
                  key={type}
                  className="flex items-center justify-between rounded-md border bg-secondary/20 p-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {EMPLOYEE_DOC_TYPE_LABELS[type]}
                    </p>
                    {doc && (
                      <p className="text-muted-foreground">
                        {doc.fileName} · {formatDate(doc.uploadedAt)}
                        {doc.expirationDate &&
                          ` · Vence ${formatDate(doc.expirationDate)}`}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {doc ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveDocument(doc.id)}
                      >
                        Quitar
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddDocument(type)}
                      >
                        Agregar
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {/* docRefresh se usa solo para forzar re-render tras add/remove */}
          <span
            data-testid="doc-refresh"
            data-count={docRefresh}
            className="hidden"
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between border-b pb-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          value ? "font-medium" : "font-medium text-muted-foreground italic"
        }
      >
        {value || "No registrado"}
      </span>
    </div>
  );
}
