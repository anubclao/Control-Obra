"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Truck,
  Plus,
  Search,
  CheckCircle,
  AlertTriangle,
  XCircle,
  FileText,
  Mail,
  Phone,
} from "lucide-react";
import { SUPPLIER_STATUS, SUPPLIER_CATEGORY } from "@/lib/constants";

type Supplier = {
  id: string;
  name: string;
  nit: string;
  contact: string;
  email: string;
  phone: string;
  status: keyof typeof SUPPLIER_STATUS;
  category: keyof typeof SUPPLIER_CATEGORY;
  documents: any[];
  createdAt: string;
};

type Props = {
  suppliers: Supplier[];
};

export function ProveedoresClient({ suppliers }: Props) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.nit.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: suppliers.length,
    complete: suppliers.filter((s) => s.status === "COMPLETE").length,
    alerts: suppliers.filter((s) => s.status !== "COMPLETE").length,
  };

  const getStatusBadge = (status: keyof typeof SUPPLIER_STATUS) => {
    switch (status) {
      case "COMPLETE":
        return (
          <Badge variant="success" className="flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            {SUPPLIER_STATUS[status]}
          </Badge>
        );
      case "INCOMPLETE":
        return (
          <Badge variant="warning" className="flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            {SUPPLIER_STATUS[status]}
          </Badge>
        );
      case "EXPIRED":
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            {SUPPLIER_STATUS[status]}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Proveedores</h1>
          <p className="text-gray-600 mt-1">
            Gestión de proveedores y documentación
          </p>
        </div>
        <Button onClick={() => router.push("/dashboard/proveedores/nuevo")}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Proveedor
        </Button>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Proveedores</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Truck className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Documentación Completa</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats.complete}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Con Alertas</p>
                <p className="text-2xl font-bold text-amber-600">
                  {stats.alerts}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Listado de Proveedores</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar por nombre, NIT..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredSuppliers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchTerm
                ? "No se encontraron proveedores"
                : "No hay proveedores registrados"}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredSuppliers.map((supplier) => (
                <div
                  key={supplier.id}
                  onClick={() =>
                    router.push(`/dashboard/proveedores/${supplier.id}`)
                  }
                  className="p-4 border rounded-lg hover:border-amber-500 hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-lg">
                          {supplier.name}
                        </h3>
                        {getStatusBadge(supplier.status)}
                        <Badge variant="outline">
                          {SUPPLIER_CATEGORY[supplier.category]}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                        <span>NIT: {supplier.nit}</span>
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {supplier.email}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {supplier.phone}
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {supplier.documents.length} documentos
                        </span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      Ver Detalles
                    </Button>
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
