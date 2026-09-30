"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Plus,
  Users,
  Search,
  UserCheck,
  UserX,
  UserMinus,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  useEmployeesStore,
  EMPLOYEE_STATUS_LABELS,
  EMPLOYEE_STATUS_VARIANTS,
  EMPLOYEE_DEPARTMENT_LABELS,
  EMPLOYEE_CONTRACT_LABELS,
  EMPLOYEE_DOC_TYPE_LABELS,
} from "@/lib/data-store";
import { formatCurrency, formatDate } from "@/lib/utils";
import type {
  Employee,
  EmployeeStatus,
  EmployeeDepartment,
  EmployeeContractType,
  EmployeeDocumentType,
} from "@/types";

import { useConfirm } from "@/components/ui/confirm-dialog";
import { ModuleExplanationCard } from "@/components/ui/module-explanation-card";
export default function EmpleadosPage() {
  const { employees, addDocument, removeDocument } = useEmployeesStore();
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<"ALL" | EmployeeDepartment>(
    "ALL",
  );
  const [statusFilter, setStatusFilter] = useState<"ALL" | EmployeeStatus>(
    "ALL",
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [viewing, setViewing] = useState<Employee | null>(null);

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      const matchSearch =
        !search ||
        e.fullName.toLowerCase().includes(search.toLowerCase()) ||
        e.employeeNumber.toLowerCase().includes(search.toLowerCase()) ||
        e.position.toLowerCase().includes(search.toLowerCase());
      const matchDept = deptFilter === "ALL" || e.department === deptFilter;
      const matchStatus = statusFilter === "ALL" || e.status === statusFilter;
      return matchSearch && matchDept && matchStatus;
    });
  }, [employees, search, deptFilter, statusFilter]);

  const stats = useMemo(() => {
    const active = employees.filter((e) => e.status === "ACTIVE").length;
    const onLeave = employees.filter((e) => e.status === "ON_LEAVE").length;
    const terminated = employees.filter(
      (e) => e.status === "TERMINATED",
    ).length;
    const totalSalary = employees
      .filter((e) => e.status === "ACTIVE" && e.salary)
      .reduce((s, e) => s + (e.salary ?? 0), 0);
    const missingDocs = employees.filter((e) => {
      const required = [
        "CEDULA",
        "CONTRATO",
        "AFILIACION_EPS",
        "AFILIACION_PENSION",
        "AFILIACION_ARL",
      ] as const;
      return required.some((t) => !e.documents.some((d) => d.type === t));
    }).length;
    return {
      active,
      onLeave,
      terminated,
      total: employees.length,
      totalSalary,
      missingDocs,
    };
  }, [employees]);

  return (
    <div className="space-y-6">
      <ModuleExplanationCard
        icon={Users}
        variant="guide"
        title="RRHH - Empleados"
        description="Empleados: documentos, cargo, contrato."
        steps={[
          {
            title: "Registra empleado",
            description: "Documento, cargo, contrato, fecha.",
          },
          {
            title: "Asocia a usuario",
            description: "Vincula a usuario del sistema.",
          },
          {
            title: "Carga documentos",
            description: "11 tipos: cedula, EPS, pension, ARL.",
          },
        ]}
        warnings={["Documento de identidad UNICO."]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Empleados</h1>
          <p className="text-sm text-muted-foreground">
            {stats.total} empleados · {stats.active} activos ·{" "}
            {stats.missingDocs} con docs faltantes
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo empleado
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crear empleado</DialogTitle>
              <DialogDescription>
                Información personal, contractual y bancaria
              </DialogDescription>
            </DialogHeader>
            <EmployeeForm onSuccess={() => setCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi
          label="Activos"
          value={stats.active}
          icon={UserCheck}
          color="text-emerald-600"
        />
        <Kpi
          label="En licencia"
          value={stats.onLeave}
          icon={UserMinus}
          color="text-amber-600"
        />
        <Kpi
          label="Terminados"
          value={stats.terminated}
          icon={UserX}
          color="text-red-600"
        />
        <Kpi
          label="Nómina activa"
          value={formatCurrency(stats.totalSalary)}
          icon={Wallet}
          color="text-blue-600"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, número o cargo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={deptFilter}
          onValueChange={(v) => setDeptFilter(v as typeof deptFilter)}
        >
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Departamento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            {(
              Object.keys(EMPLOYEE_DEPARTMENT_LABELS) as Array<
                keyof typeof EMPLOYEE_DEPARTMENT_LABELS
              >
            ).map((k) => (
              <SelectItem key={k} value={k}>
                {EMPLOYEE_DEPARTMENT_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            {Object.entries(EMPLOYEE_STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Users className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">Sin empleados</h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((e) => {
            const required = [
              "CEDULA",
              "CONTRATO",
              "AFILIACION_EPS",
              "AFILIACION_PENSION",
              "AFILIACION_ARL",
            ] as const;
            const missing = required.filter(
              (t) => !e.documents.some((d) => d.type === t),
            );
            return (
              <div
                key={e.id}
                className="rounded-lg border bg-card p-4 transition-shadow hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs text-muted-foreground">
                      {e.employeeNumber}
                    </p>
                    <p className="truncate text-sm font-medium">{e.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.position}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {EMPLOYEE_DEPARTMENT_LABELS[e.department]} ·{" "}
                      {EMPLOYEE_CONTRACT_LABELS[e.contractType]}
                    </p>
                  </div>
                  <Badge variant={EMPLOYEE_STATUS_VARIANTS[e.status]}>
                    {EMPLOYEE_STATUS_LABELS[e.status]}
                  </Badge>
                </div>
                {e.salary && (
                  <p className="mt-2 text-sm font-semibold text-emerald-600">
                    {formatCurrency(e.salary)} / mes
                  </p>
                )}
                {missing.length > 0 && (
                  <p className="mt-1 text-xs text-amber-600">
                    ⚠ {missing.length} doc(s) obligatorio(s) faltante(s)
                  </p>
                )}
                <div className="mt-3 flex gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="flex-1"
                  >
                    <Link href={`/administrativo/empleados/${e.id}`}>
                      Ver detalle
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing(e)}
                  >
                    Editar
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar empleado</DialogTitle>
            <DialogDescription>{editing?.employeeNumber}</DialogDescription>
          </DialogHeader>
          {editing && (
            <EmployeeForm
              employee={editing}
              onSuccess={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle>{viewing.fullName}</DialogTitle>
                <DialogDescription>
                  {viewing.employeeNumber} ·{" "}
                  {EMPLOYEE_DEPARTMENT_LABELS[viewing.department]}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-muted-foreground">Cargo:</span>{" "}
                    {viewing.position}
                  </div>
                  <div>
                    <span className="text-muted-foreground">
                      Tipo contrato:
                    </span>{" "}
                    {EMPLOYEE_CONTRACT_LABELS[viewing.contractType]}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Inicio:</span>{" "}
                    {formatDate(viewing.startDate)}
                  </div>
                  {viewing.endDate && (
                    <div>
                      <span className="text-muted-foreground">Fin:</span>{" "}
                      {formatDate(viewing.endDate)}
                    </div>
                  )}
                  {viewing.email && (
                    <div>
                      <span className="text-muted-foreground">Email:</span>{" "}
                      {viewing.email}
                    </div>
                  )}
                  {viewing.salary && (
                    <div>
                      <span className="text-muted-foreground">Salario:</span>{" "}
                      {formatCurrency(viewing.salary)}
                    </div>
                  )}
                </div>
                <div>
                  <p className="mb-2 font-semibold">
                    Documentos ({viewing.documents.length})
                  </p>
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
                      const doc = viewing.documents.find(
                        (d) => d.type === type,
                      );
                      return (
                        <div
                          key={type}
                          className="flex items-center justify-between rounded-md border bg-secondary/20 p-2 text-xs"
                        >
                          <div>
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
                                onClick={() =>
                                  removeDocument(viewing.id, doc.id)
                                }
                              >
                                Quitar
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  addDocument(viewing.id, {
                                    type,
                                    fileName: `${type.toLowerCase()}.pdf`,
                                  })
                                }
                              >
                                Agregar
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className={`h-3.5 w-3.5 ${color}`} />
        {label}
      </div>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function EmployeeForm({
  employee,
  onSuccess,
}: {
  employee?: Employee;
  onSuccess: () => void;
}) {
  const { addEmployee, updateEmployee } = useEmployeesStore();
  const isEditing = !!employee;
  const [fullName, setFullName] = useState(employee?.fullName ?? "");
  const [documentId, setDocumentId] = useState(employee?.documentId ?? "");
  const [position, setPosition] = useState(employee?.position ?? "");
  const [department, setDepartment] = useState<EmployeeDepartment>(
    employee?.department ?? "OPERACIONES",
  );
  const [contractType, setContractType] = useState<EmployeeContractType>(
    employee?.contractType ?? "INDEFINIDO",
  );
  const [startDate, setStartDate] = useState(
    employee?.startDate ?? new Date().toISOString().slice(0, 10),
  );
  const [endDate, setEndDate] = useState(employee?.endDate ?? "");
  const [salary, setSalary] = useState(employee?.salary ?? 0);
  const [email, setEmail] = useState(employee?.email ?? "");
  const [phone, setPhone] = useState(employee?.phone ?? "");
  const [eps, setEps] = useState(employee?.eps ?? "");
  const [pensionFund, setPensionFund] = useState(employee?.pensionFund ?? "");
  const [arl, setArl] = useState(employee?.arl ?? "");
  const [riskLevel, setRiskLevel] = useState<1 | 2 | 3 | 4 | 5 | undefined>(
    employee?.riskLevel,
  );
  const [bankName, setBankName] = useState(employee?.bankName ?? "");
  const [accountType, setAccountType] = useState<
    "SAVINGS" | "CHECKING" | undefined
  >(employee?.accountType);
  const [accountNumber, setAccountNumber] = useState(
    employee?.accountNumber ?? "",
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      fullName,
      documentId,
      position,
      department,
      contractType,
      startDate,
      endDate: endDate || undefined,
      salary: salary || undefined,
      email: email || undefined,
      phone: phone || undefined,
      eps: eps || undefined,
      pensionFund: pensionFund || undefined,
      arl: arl || undefined,
      riskLevel,
      bankName: bankName || undefined,
      accountType,
      accountNumber: accountNumber || undefined,
      status: employee?.status ?? ("ACTIVE" as const),
    };
    if (employee) {
      updateEmployee(employee.id, data as Partial<Employee>);
    } else {
      addEmployee(
        data as Omit<
          Employee,
          "id" | "employeeNumber" | "documents" | "createdAt"
        >,
      );
    }
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h3 className="mb-2 text-sm font-semibold">Datos personales</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block">Nombre completo *</Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div>
            <Label className="mb-1.5 block">Cédula *</Label>
            <Input
              value={documentId}
              onChange={(e) => setDocumentId(e.target.value)}
              required
            />
          </div>
          <div>
            <Label className="mb-1.5 block">Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label className="mb-1.5 block">Teléfono</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Datos contractuales</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label className="mb-1.5 block">Cargo *</Label>
            <Input
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              required
            />
          </div>
          <div>
            <Label className="mb-1.5 block">Departamento *</Label>
            <Select
              value={department}
              onValueChange={(v) => setDepartment(v as EmployeeDepartment)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  Object.keys(EMPLOYEE_DEPARTMENT_LABELS) as Array<
                    keyof typeof EMPLOYEE_DEPARTMENT_LABELS
                  >
                ).map((k) => (
                  <SelectItem key={k} value={k}>
                    {EMPLOYEE_DEPARTMENT_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block">Tipo de contrato *</Label>
            <Select
              value={contractType}
              onValueChange={(v) => setContractType(v as EmployeeContractType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EMPLOYEE_CONTRACT_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block">Nivel de riesgo (ARL)</Label>
            <Select
              value={riskLevel?.toString() ?? ""}
              onValueChange={(v) =>
                setRiskLevel(Number(v) as 1 | 2 | 3 | 4 | 5)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">I</SelectItem>
                <SelectItem value="2">II</SelectItem>
                <SelectItem value="3">III</SelectItem>
                <SelectItem value="4">IV</SelectItem>
                <SelectItem value="5">V</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block">Inicio *</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <div>
            <Label className="mb-1.5 block">Fin (si aplica)</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="mb-1.5 block">Salario mensual (COP)</Label>
            <Input
              type="number"
              min="0"
              step="100000"
              value={salary}
              onChange={(e) => setSalary(parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Seguridad social</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <Label className="mb-1.5 block">EPS</Label>
            <Input
              value={eps}
              onChange={(e) => setEps(e.target.value)}
              placeholder="Sanitas"
            />
          </div>
          <div>
            <Label className="mb-1.5 block">Fondo de pensión</Label>
            <Input
              value={pensionFund}
              onChange={(e) => setPensionFund(e.target.value)}
              placeholder="Porvenir"
            />
          </div>
          <div>
            <Label className="mb-1.5 block">ARL</Label>
            <Input
              value={arl}
              onChange={(e) => setArl(e.target.value)}
              placeholder="Sura"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Datos bancarios</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <Label className="mb-1.5 block">Banco</Label>
            <Input
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
            />
          </div>
          <div>
            <Label className="mb-1.5 block">Tipo de cuenta</Label>
            <Select
              value={accountType}
              onValueChange={(v) => setAccountType(v as "SAVINGS" | "CHECKING")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CHECKING">Corriente</SelectItem>
                <SelectItem value="SAVINGS">Ahorros</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block">Número de cuenta</Label>
            <Input
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
            />
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancelar
        </Button>
        <Button type="submit">
          {isEditing ? "Guardar" : "Crear empleado"}
        </Button>
      </DialogFooter>
    </form>
  );
}
