"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Loader2, Building2, User, MapPin, DollarSign, Users } from "lucide-react";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";

type PersonType = "natural" | "juridica";

export default function NuevoSubcontratistaPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [personType, setPersonType] = useState<PersonType>("juridica");
  const [formData, setFormData] = useState({
    // Información básica
    name: "",
    nit: "",
    contact: "",
    email: "",
    phone: "",
    // Información de contacto extendida
    address: "",
    city: "",
    department: "",
    postalCode: "",
    website: "",
    // Representante legal
    legalRepName: "",
    legalRepCedula: "",
    legalRepEmail: "",
    legalRepPhone: "",
    // Información financiera
    reportedIncome: "",
    incomeYear: new Date().getFullYear() - 1,
    // Referencias comerciales
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const payload = {
        ...formData,
        reportedIncome: formData.reportedIncome ? parseFloat(formData.reportedIncome) : null,
        incomeYear: formData.incomeYear || null,
      };

      const response = await fetch("/api/subcontratistas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response?.ok) {
        const data = await response.json();
        throw new Error(data?.error || "Error al crear subcontratista");
      }

      const contractor = await response.json();
      router.push(`/dashboard/subcontratistas/${contractor?.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Error al crear subcontratista");
    } finally {
      setIsLoading(false);
    }
  };

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePersonTypeChange = (value: PersonType) => {
    setPersonType(value);

    if (value === "natural") {
      setFormData((prev) => ({
        ...prev,
        legalRepName: "",
        legalRepCedula: "",
        legalRepEmail: "",
        legalRepPhone: "",
      }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/subcontratistas">
          <Button variant="outline" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Nuevo Subcontratista
          </h1>
          <p className="text-gray-600 mt-1">Registrar un nuevo subcontratista</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Información Básica */}
        <Card className="shadow-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              <CardTitle>Información Básica</CardTitle>
            </div>
            <CardDescription>
              {personType === "natural" ? "Datos generales de la persona" : "Datos generales de la empresa"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="personType">Tipo de Persona *</Label>
                <Select value={personType} onValueChange={(v) => handlePersonTypeChange(v as PersonType)}>
                  <SelectTrigger id="personType" disabled={isLoading}>
                    <SelectValue placeholder="Seleccione tipo de persona" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="natural">Persona Natural</SelectItem>
                    <SelectItem value="juridica">Persona Jurídica</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">{personType === "natural" ? "Nombre Completo *" : "Razón Social *"}</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  required
                  disabled={isLoading}
                  placeholder={personType === "natural" ? "Nombre de la persona" : "Nombre de la empresa"}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nit">{personType === "natural" ? "RUT *" : "NIT *"}</Label>
                <Input
                  id="nit"
                  value={formData.nit}
                  onChange={(e) => updateField("nit", e.target.value)}
                  required
                  disabled={isLoading}
                  placeholder={personType === "natural" ? "Número de RUT" : "000000000-0"}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact">Persona de Contacto *</Label>
                <Input
                  id="contact"
                  value={formData.contact}
                  onChange={(e) => updateField("contact", e.target.value)}
                  required
                  disabled={isLoading}
                  placeholder="Nombre completo"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Correo Electrónico *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  required
                  disabled={isLoading}
                  placeholder="correo@ejemplo.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono *</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  required
                  disabled={isLoading}
                  placeholder="3001234567"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">Sitio Web</Label>
                <Input
                  id="website"
                  value={formData.website}
                  onChange={(e) => updateField("website", e.target.value)}
                  disabled={isLoading}
                  placeholder="https://www.ejemplo.com"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dirección */}
        <Card className="shadow-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-green-600" />
              <CardTitle>Dirección</CardTitle>
            </div>
            <CardDescription>Ubicación de la empresa</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="address">Dirección</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => updateField("address", e.target.value)}
                  disabled={isLoading}
                  placeholder="Calle 123 # 45-67"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">Ciudad</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => updateField("city", e.target.value)}
                  disabled={isLoading}
                  placeholder="Bogotá"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="department">Departamento</Label>
                <Input
                  id="department"
                  value={formData.department}
                  onChange={(e) => updateField("department", e.target.value)}
                  disabled={isLoading}
                  placeholder="Cundinamarca"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="postalCode">Código Postal</Label>
                <Input
                  id="postalCode"
                  value={formData.postalCode}
                  onChange={(e) => updateField("postalCode", e.target.value)}
                  disabled={isLoading}
                  placeholder="110111"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Representante Legal (solo para Persona Jurídica) */}
        {personType === "juridica" && (
          <Card className="shadow-md">
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-purple-600" />
                <CardTitle>Representante Legal</CardTitle>
              </div>
              <CardDescription>Información del representante legal de la empresa</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="legalRepName">Nombre Completo</Label>
                  <Input
                    id="legalRepName"
                    value={formData.legalRepName}
                    onChange={(e) => updateField("legalRepName", e.target.value)}
                    disabled={isLoading}
                    placeholder="Nombre del representante"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="legalRepCedula">Cédula de Ciudadanía</Label>
                  <Input
                    id="legalRepCedula"
                    value={formData.legalRepCedula}
                    onChange={(e) => updateField("legalRepCedula", e.target.value)}
                    disabled={isLoading}
                    placeholder="1234567890"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="legalRepEmail">Correo Electrónico</Label>
                  <Input
                    id="legalRepEmail"
                    type="email"
                    value={formData.legalRepEmail}
                    onChange={(e) => updateField("legalRepEmail", e.target.value)}
                    disabled={isLoading}
                    placeholder="representante@ejemplo.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="legalRepPhone">Teléfono</Label>
                  <Input
                    id="legalRepPhone"
                    value={formData.legalRepPhone}
                    onChange={(e) => updateField("legalRepPhone", e.target.value)}
                    disabled={isLoading}
                    placeholder="3001234567"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Información Financiera */}
        <Card className="shadow-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-yellow-600" />
              <CardTitle>Información Financiera</CardTitle>
            </div>
            <CardDescription>Ingresos reportados en la declaración de renta</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="reportedIncome">Ingresos Reportados (COP)</Label>
                <Input
                  id="reportedIncome"
                  type="number"
                  value={formData.reportedIncome}
                  onChange={(e) => updateField("reportedIncome", e.target.value)}
                  disabled={isLoading}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="incomeYear">Año de Reporte</Label>
                <Input
                  id="incomeYear"
                  type="number"
                  min="2000"
                  max={new Date().getFullYear()}
                  value={formData.incomeYear}
                  onChange={(e) => updateField("incomeYear", parseInt(e.target.value))}
                  disabled={isLoading}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Referencias Comerciales */}
        <Card className="shadow-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-orange-600" />
              <CardTitle>Referencias Comerciales</CardTitle>
            </div>
            <CardDescription>Tres referencias comerciales verificables</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Referencia 1 */}
            <div>
              <h4 className="font-medium text-gray-700 mb-3">Referencia 1</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ref1Name">Nombre del Contacto</Label>
                  <Input
                    id="ref1Name"
                    value={formData.ref1Name}
                    onChange={(e) => updateField("ref1Name", e.target.value)}
                    disabled={isLoading}
                    placeholder="Nombre completo"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ref1Company">Empresa</Label>
                  <Input
                    id="ref1Company"
                    value={formData.ref1Company}
                    onChange={(e) => updateField("ref1Company", e.target.value)}
                    disabled={isLoading}
                    placeholder="Nombre de la empresa"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ref1Phone">Teléfono</Label>
                  <Input
                    id="ref1Phone"
                    value={formData.ref1Phone}
                    onChange={(e) => updateField("ref1Phone", e.target.value)}
                    disabled={isLoading}
                    placeholder="3001234567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ref1Email">Correo Electrónico</Label>
                  <Input
                    id="ref1Email"
                    type="email"
                    value={formData.ref1Email}
                    onChange={(e) => updateField("ref1Email", e.target.value)}
                    disabled={isLoading}
                    placeholder="contacto@empresa.com"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Referencia 2 */}
            <div>
              <h4 className="font-medium text-gray-700 mb-3">Referencia 2</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ref2Name">Nombre del Contacto</Label>
                  <Input
                    id="ref2Name"
                    value={formData.ref2Name}
                    onChange={(e) => updateField("ref2Name", e.target.value)}
                    disabled={isLoading}
                    placeholder="Nombre completo"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ref2Company">Empresa</Label>
                  <Input
                    id="ref2Company"
                    value={formData.ref2Company}
                    onChange={(e) => updateField("ref2Company", e.target.value)}
                    disabled={isLoading}
                    placeholder="Nombre de la empresa"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ref2Phone">Teléfono</Label>
                  <Input
                    id="ref2Phone"
                    value={formData.ref2Phone}
                    onChange={(e) => updateField("ref2Phone", e.target.value)}
                    disabled={isLoading}
                    placeholder="3001234567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ref2Email">Correo Electrónico</Label>
                  <Input
                    id="ref2Email"
                    type="email"
                    value={formData.ref2Email}
                    onChange={(e) => updateField("ref2Email", e.target.value)}
                    disabled={isLoading}
                    placeholder="contacto@empresa.com"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Referencia 3 */}
            <div>
              <h4 className="font-medium text-gray-700 mb-3">Referencia 3</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ref3Name">Nombre del Contacto</Label>
                  <Input
                    id="ref3Name"
                    value={formData.ref3Name}
                    onChange={(e) => updateField("ref3Name", e.target.value)}
                    disabled={isLoading}
                    placeholder="Nombre completo"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ref3Company">Empresa</Label>
                  <Input
                    id="ref3Company"
                    value={formData.ref3Company}
                    onChange={(e) => updateField("ref3Company", e.target.value)}
                    disabled={isLoading}
                    placeholder="Nombre de la empresa"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ref3Phone">Teléfono</Label>
                  <Input
                    id="ref3Phone"
                    value={formData.ref3Phone}
                    onChange={(e) => updateField("ref3Phone", e.target.value)}
                    disabled={isLoading}
                    placeholder="3001234567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ref3Email">Correo Electrónico</Label>
                  <Input
                    id="ref3Email"
                    type="email"
                    value={formData.ref3Email}
                    onChange={(e) => updateField("ref3Email", e.target.value)}
                    disabled={isLoading}
                    placeholder="contacto@empresa.com"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Botones */}
        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                Guardando...
              </>
            ) : (
              "Guardar Subcontratista"
            )}
          </Button>
          <Link href="/dashboard/subcontratistas">
            <Button type="button" variant="outline" disabled={isLoading}>
              Cancelar
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
