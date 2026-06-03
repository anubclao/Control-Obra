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
  ArrowLeft,
  Loader2,
  Building2,
  MapPin,
  User,
  Tags,
} from "lucide-react";
import {
  SUPPLIER_COMMERCIAL_TYPE,
  SUPPLIER_PERSON_TYPE,
  SUPPLIER_PRODUCT_SUBCATEGORY,
  SUPPLIER_SERVICE_SUBCATEGORY,
} from "@/lib/constants";

type PersonType = keyof typeof SUPPLIER_PERSON_TYPE;
type CommercialType = keyof typeof SUPPLIER_COMMERCIAL_TYPE;

export default function NuevoProveedorPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [personType, setPersonType] = useState<PersonType>("JURIDICA");
  const [commercialType, setCommercialType] = useState<CommercialType>("PRODUCTO");

  const [formData, setFormData] = useState({
    personType: "JURIDICA",
    name: "",
    nit: "",
    contact: "",
    email: "",
    secondaryEmail: "",
    phone: "",
    secondaryPhone: "",
    commercialType: "PRODUCTO",
    commercialSubcategory: "ELECTRICO",
    address: "",
    city: "",
    department: "",
    postalCode: "",
    legalRepName: "",
    legalRepCedula: "",
    legalRepEmail: "",
    legalRepPhone: "",
  });

  const commercialSubcategories =
    commercialType === "PRODUCTO"
      ? Object.entries(SUPPLIER_PRODUCT_SUBCATEGORY)
      : Object.entries(SUPPLIER_SERVICE_SUBCATEGORY);

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePersonTypeChange = (value: PersonType) => {
    setPersonType(value);
    setFormData((prev) => ({
      ...prev,
      personType: value,
      legalRepName: value === "JURIDICA" ? prev.legalRepName : "",
      legalRepCedula: value === "JURIDICA" ? prev.legalRepCedula : "",
      legalRepEmail: value === "JURIDICA" ? prev.legalRepEmail : "",
      legalRepPhone: value === "JURIDICA" ? prev.legalRepPhone : "",
    }));
  };

  const handleCommercialTypeChange = (value: CommercialType) => {
    setCommercialType(value);
    setFormData((prev) => ({
      ...prev,
      commercialType: value,
      commercialSubcategory: value === "PRODUCTO" ? "ELECTRICO" : "ALQUILER",
    }));
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
          personType,
          commercialType,
          category: "MATERIALES",
          secondaryEmail: formData.secondaryEmail || null,
          secondaryPhone: formData.secondaryPhone || null,
          legalRepName: personType === "JURIDICA" ? formData.legalRepName : null,
          legalRepCedula: personType === "JURIDICA" ? formData.legalRepCedula : null,
          legalRepEmail: personType === "JURIDICA" ? formData.legalRepEmail : null,
          legalRepPhone: personType === "JURIDICA" ? formData.legalRepPhone : null,
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
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
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
            <div className="space-y-2 col-span-2">
              <Label htmlFor="personType">Tipo de Persona *</Label>
              <Select value={personType} onValueChange={(v) => handlePersonTypeChange(v as PersonType)}>
                <SelectTrigger id="personType">
                  <SelectValue placeholder="Seleccione tipo de persona" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NATURAL">Persona natural</SelectItem>
                  <SelectItem value="JURIDICA">Persona jurídica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">{personType === "NATURAL" ? "Nombre Completo *" : "Razón Social *"}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => updateField("name", e.target.value)}
                required
                placeholder={personType === "NATURAL" ? "Nombre completo" : "Nombre de la empresa"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nit">{personType === "NATURAL" ? "CC / NIT *" : "NIT *"}</Label>
              <Input
                id="nit"
                value={formData.nit}
                onChange={(e) => updateField("nit", e.target.value)}
                required
                placeholder={personType === "NATURAL" ? "Cédula o NIT" : "000000000-0"}
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
              <Label htmlFor="email">Email 1 *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => updateField("email", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="secondaryEmail">Email 2</Label>
              <Input
                id="secondaryEmail"
                type="email"
                value={formData.secondaryEmail}
                onChange={(e) => updateField("secondaryEmail", e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono 1 *</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="secondaryPhone">Teléfono 2</Label>
              <Input
                id="secondaryPhone"
                value={formData.secondaryPhone}
                onChange={(e) => updateField("secondaryPhone", e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </CardContent>
        </Card>

        {/* Clasificación Comercial */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Tags className="w-5 h-5 text-amber-600" />
              <CardTitle>Clasificación Comercial</CardTitle>
            </div>
            <CardDescription>Tipo y subcategoría comercial del proveedor</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="commercialType">Tipo *</Label>
              <Select value={commercialType} onValueChange={(v) => handleCommercialTypeChange(v as CommercialType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SUPPLIER_COMMERCIAL_TYPE).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="commercialSubcategory">Subcategoría *</Label>
              <Select
                value={formData.commercialSubcategory}
                onValueChange={(v) => updateField("commercialSubcategory", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione subcategoría" />
                </SelectTrigger>
                <SelectContent>
                  {commercialSubcategories.map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
        {personType === "JURIDICA" && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-amber-600" />
                <CardTitle>Representante Legal</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="legalRepName">Nombre Completo *</Label>
                <Input
                  id="legalRepName"
                  value={formData.legalRepName}
                  onChange={(e) => updateField("legalRepName", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="legalRepCedula">Cédula *</Label>
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
        )}

        {/* Botones */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>
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
