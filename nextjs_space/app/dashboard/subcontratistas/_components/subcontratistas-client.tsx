"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import Link from "next/link";
import { CONTRACTOR_STATUS } from "@/lib/constants";
import { useRouter } from "next/navigation";

interface SubcontratistasClientProps {
  contractors: any[];
}

export function SubcontratistasClient({ contractors }: SubcontratistasClientProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredContractors = contractors.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.nit.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLETE":
        return <CheckCircle className="w-4 h-4" />;
      case "EXPIRED":
        return <AlertTriangle className="w-4 h-4" />;
      case "INCOMPLETE":
        return <XCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getStatusVariant = (status: string): "success" | "destructive" | "warning" => {
    switch (status) {
      case "COMPLETE":
        return "success";
      case "EXPIRED":
        return "destructive";
      case "INCOMPLETE":
        return "warning";
      default:
        return "warning";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Subcontratistas</h1>
          <p className="text-gray-600 mt-1">
            Gestión de subcontratistas y documentación
          </p>
        </div>
        <Link href="/dashboard/subcontratistas/nuevo">
          <Button className="gap-2 bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4" />
            Nuevo Subcontratista
          </Button>
        </Link>
      </div>

      {/* Búsqueda */}
      <Card className="shadow-md">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              placeholder="Buscar por nombre, NIT o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Subcontratistas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{contractors.length}</div>
          </CardContent>
        </Card>

        <Card className="shadow-md border-green-200">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">
              Documentación Completa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {contractors.filter((c) => c.status === "COMPLETE").length}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md border-red-200">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">
              Con Alertas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {contractors.filter((c) => c.status !== "COMPLETE").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Listado */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Listado de Subcontratistas</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredContractors.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">
                {searchTerm
                  ? "No se encontraron subcontratistas con ese criterio"
                  : "No hay subcontratistas registrados"}
              </p>
              {!searchTerm && (
                <Link href="/dashboard/subcontratistas/nuevo">
                  <Button className="mt-4" variant="outline">
                    Registrar Primer Subcontratista
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredContractors.map((contractor) => (
                <div
                  key={contractor.id}
                  className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all cursor-pointer border border-gray-200"
                  onClick={() => router.push(`/dashboard/subcontratistas/${contractor.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900 text-lg">
                          {contractor.name}
                        </h3>
                        <Badge
                          variant={getStatusVariant(contractor.status)}
                          className="gap-1"
                        >
                          {getStatusIcon(contractor.status)}
                          {CONTRACTOR_STATUS[contractor.status as keyof typeof CONTRACTOR_STATUS]}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">NIT:</span> {contractor.nit}
                        </div>
                        <div>
                          <span className="font-medium">Contacto:</span> {contractor.contact}
                        </div>
                        <div>
                          <span className="font-medium">Email:</span> {contractor.email}
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-gray-600">
                        <span className="font-medium">Teléfono:</span> {contractor.phone}
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Documentos:</span>{" "}
                          <span className="font-medium">
                            {contractor.documents.length} / 5
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Cortes:</span>{" "}
                          <span className="font-medium">{contractor._count.workCuts}</span>
                        </div>
                      </div>
                    </div>
                    <Link href={`/dashboard/subcontratistas/${contractor.id}`}>
                      <Button size="sm" variant="outline">
                        Ver Detalles
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
