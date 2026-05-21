"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  Plus,
  Search,
  Filter,
  FileSignature,
  Building2,
  DollarSign,
  CheckCircle,
  Clock,
  XCircle,
} from "lucide-react";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { CONTRACT_STATUS, CONTRACT_TYPE, PAYMENT_METHOD } from "@/lib/constants";
import { NuevoContratoDialog } from "./nuevo-contrato-dialog";

interface ContratosClientProps {
  contracts: any[];
  stats: {
    total: number;
    draft: number;
    enabled: number;
    closed: number;
    totalValue: number;
  };
  projects: any[];
  contractors: any[];
  userRole: string;
}

export function ContratosClient({
  contracts,
  stats,
  projects,
  contractors,
  userRole,
}: ContratosClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showNewDialog, setShowNewDialog] = useState(false);
  const router = useRouter();
  const isAdmin = userRole === "ADMIN";

  // Filtrar contratos
  const filteredContracts = contracts.filter((contract) => {
    const matchesSearch =
      contract.contractNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contract.contractObject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contract.contractor.name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesProject =
      projectFilter === "all" || contract.projectId === projectFilter;

    const matchesStatus =
      statusFilter === "all" || contract.status === statusFilter;

    return matchesSearch && matchesProject && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline" | "success" | "warning"> = {
      DRAFT: "secondary",
      ENABLED: "success",
      SUSPENDED: "warning",
      CLOSED: "default",
      CANCELLED: "destructive",
    };
    return (
      <Badge variant={variants[status] || "default"}>
        {CONTRACT_STATUS[status as keyof typeof CONTRACT_STATUS] || status}
      </Badge>
    );
  };

  const handleSuccess = () => {
    setShowNewDialog(false);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contratos</h1>
          <p className="text-gray-600">
            Gestión de contratos de subcontratistas por proyecto
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-3xl font-bold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">Borrador</p>
              <p className="text-3xl font-bold text-gray-500">{stats.draft}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">Habilitados</p>
              <p className="text-3xl font-bold text-green-600">{stats.enabled}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">Cerrados</p>
              <p className="text-3xl font-bold">{stats.closed}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">Valor Total</p>
              <p className="text-xl font-bold text-blue-600">
                {formatCurrency(stats.totalValue)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar por contratista, número o descripción..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Todos los proyectos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los proyectos</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {Object.entries(CONTRACT_STATUS).map(([key, value]) => (
              <SelectItem key={key} value={key}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isAdmin && (
          <Button onClick={() => setShowNewDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Contrato
          </Button>
        )}
      </div>

      {/* Contracts List */}
      <Card>
        <CardContent className="p-0">
          {filteredContracts.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Contratista</TableHead>
                    <TableHead>Proyecto</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Forma de Pago</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha Inicio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContracts.map((contract) => (
                    <TableRow
                      key={contract.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() =>
                        router.push(`/dashboard/planeacion/contratos/${contract.id}`)
                      }
                    >
                      <TableCell className="font-medium">
                        {contract.contractNumber}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{contract.contractor.name}</p>
                          <p className="text-xs text-gray-500">
                            NIT: {contract.contractor.nit}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p>{contract.project.name}</p>
                          {contract.project.code && (
                            <p className="text-xs text-gray-500">
                              {contract.project.code}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{CONTRACT_TYPE[contract.contractType as keyof typeof CONTRACT_TYPE]}</TableCell>
                      <TableCell>
                        {PAYMENT_METHOD[contract.paymentMethod as keyof typeof PAYMENT_METHOD]}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(contract.contractValue)}
                      </TableCell>
                      <TableCell>{getStatusBadge(contract.status)}</TableCell>
                      <TableCell>
                        {formatShortDate(contract.startDate)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-16 text-center">
              <FileSignature className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500 mb-4">No hay contratos registrados aún</p>
              {isAdmin && (
                <Button onClick={() => setShowNewDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Crear primer contrato
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para nuevo contrato */}
      <NuevoContratoDialog
        open={showNewDialog}
        onOpenChange={setShowNewDialog}
        projects={projects}
        contractors={contractors}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
