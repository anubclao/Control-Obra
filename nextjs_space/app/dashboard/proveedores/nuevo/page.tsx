"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Truck,
  ArrowLeft,
  Loader2,
  Building2,
  MapPin,
  User,
  DollarSign,
  Users,
  Package,
} from "lucide-react";
import { SUPPLIER_CATEGORY } from "@/lib/constants";

export default function NuevoProveedorPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    nit: "",
    contact: "",
    email: "",
    phone: "",
    category: "MATERIALES",
    website: "",
    address: "",
    city: "",
    department: "",
    postalCode: "",
    legalRepName: "",
    legalRepCedula: "",
    legalRepEmail: "",
    legalRepPhone: "",
    reportedIncome: "",
    incomeYear: new Date().getFullYear().toString(),
    paymentTerms: "",
    deliveryTerms: "",
    minOrderValue: "",
    ref1Name: "",
    ref1Company: "",
    ref1Phone: "",
    ref1Email: "",
    ref2Name: "",
    ref2Company: "",
    ref2Phone: "",
    ref2Email: "",
    ref3Name: "",
    ref3Company: "",
    ref3Phone: "",
    ref3Email: "",
  });

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/proveedores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          reportedIncome: formData.reportedIncome ? parseFloat(formData.reportedIncome) : null,
          incomeYear: formData.incomeYear ? parseInt(formData.incomeYear) : null,
          minOrderValue: formData.minOrderValue ? parseFloat(formData.minOrderValue) : null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Error al crear proveedor");
      }

      router.push("/dashboard/proveedores");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Nuevo Proveedor</h1>
          <p className="text-gray-600">Registrar un nuevo proveedor</p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Información Básica */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-amber-600" />
              <CardTitle>Información Básica</CardTitle>
            </div>
            <CardDescription>Datos principales del proveedor</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Razón Social *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => updateField("name", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nit">NIT *</Label>
              <Input
                id="nit"
                value={formData.nit}
                onChange={(e) => updateField("nit", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact">Nombre de Contacto *</Label>
              <Input
                id="contact"
                value={formData.contact}
                onChange={(e) => updateField("contact", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => updateField("email", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono *</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Categoría</Label>
              <Select
                value={formData.category}
                onValueChange={(v) => updateField("category", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SUPPLIER_CATEGORY).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Sitio Web</Label>
              <Input
                id="website"
                value={formData.website}
                onChange={(e) => updateField("website", e.target.value)}
                placeholder="https://"
              />
            </div>
          </CardContent>
        </Card>

        {/* Dirección */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-amber-600" />
              <CardTitle>Dirección</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="address">Dirección</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => updateField("address", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">Ciudad</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => updateField("city", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Departamento</Label>
              <Input
                id="department"
                value={formData.department}
                onChange={(e) => updateField("department", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postalCode">Código Postal</Label>
              <Input
                id="postalCode"
                value={formData.postalCode}
                onChange={(e) => updateField("postalCode", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Representante Legal */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-amber-600" />
              <CardTitle>Representante Legal</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="legalRepName">Nombre Completo</Label>
              <Input
                id="legalRepName"
                value={formData.legalRepName}
                onChange={(e) => updateField("legalRepName", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="legalRepCedula">Cédula</Label>
              <Input
                id="legalRepCedula"
                value={formData.legalRepCedula}
                onChange={(e) => updateField("legalRepCedula", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="legalRepEmail">Email</Label>
              <Input
                id="legalRepEmail"
                type="email"
                value={formData.legalRepEmail}
                onChange={(e) => updateField("legalRepEmail", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="legalRepPhone">Teléfono</Label>
              <Input
                id="legalRepPhone"
                value={formData.legalRepPhone}
                onChange={(e) => updateField("legalRepPhone", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Información Comercial */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-amber-600" />
              <CardTitle>Información Comercial</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="paymentTerms">Términos de Pago</Label>
              <Input
                id="paymentTerms"
                value={formData.paymentTerms}
                onChange={(e) => updateField("paymentTerms", e.target.value)}
                placeholder="Ej: 30 días"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deliveryTerms">Términos de Entrega</Label>
              <Input
                id="deliveryTerms"
                value={formData.deliveryTerms}
                onChange={(e) => updateField("deliveryTerms", e.target.value)}
                placeholder="Ej: 5 días hábiles"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minOrderValue">Valor Mínimo de Orden</Label>
              <Input
                id="minOrderValue"
                type="number"
                value={formData.minOrderValue}
                onChange={(e) => updateField("minOrderValue", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Información Financiera */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-amber-600" />
              <CardTitle>Información Financiera</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="reportedIncome">Ingresos Reportados</Label>
              <Input
                id="reportedIncome"
                type="number"
                value={formData.reportedIncome}
                onChange={(e) => updateField("reportedIncome", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="incomeYear">Año</Label>
              <Input
                id="incomeYear"
                type="number"
                value={formData.incomeYear}
                onChange={(e) => updateField("incomeYear", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Referencias Comerciales */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-600" />
              <CardTitle>Referencias Comerciales</CardTitle>
            </div>
            <CardDescription>Mínimo 3 referencias comerciales</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {[1, 2, 3].map((num) => (
              <div key={num} className="p-4 border rounded-lg">
                <h4 className="font-medium mb-3">Referencia {num}</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nombre</Label>
                    <Input
                      value={(formData as any)[`ref${num}Name`]}
                      onChange={(e) => updateField(`ref${num}Name`, e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Empresa</Label>
                    <Input
                      value={(formData as any)[`ref${num}Company`]}
                      onChange={(e) => updateField(`ref${num}Company`, e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Teléfono</Label>
                    <Input
                      value={(formData as any)[`ref${num}Phone`]}
                      onChange={(e) => updateField(`ref${num}Phone`, e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={(formData as any)[`ref${num}Email`]}
                      onChange={(e) => updateField(`ref${num}Email`, e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Botones */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Crear Proveedor
          </Button>
        </div>
      </form>
    </div>
  );
}
