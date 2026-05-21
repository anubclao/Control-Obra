"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Building2, MapPin, User, DollarSign, Users } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

type PersonType = "natural" | "juridica";

interface EditContractorDialogProps {
  open: boolean;
  onClose: () => void;
  contractor: any;
}

export function EditContractorDialog({
  open,
  onClose,
  contractor,
}: EditContractorDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [personType, setPersonType] = useState<PersonType>("juridica");
  const [formData, setFormData] = useState({
    name: "",
    nit: "",
    contact: "",
    email: "",
    phone: "",
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
    incomeYear: "",
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

  useEffect(() => {
    if (contractor) {
      const hasLegalRepData = Boolean(
        contractor.legalRepName ||
          contractor.legalRepCedula ||
          contractor.legalRepEmail ||
          contractor.legalRepPhone
      );
      setPersonType(hasLegalRepData ? "juridica" : "natural");

      setFormData({
        name: contractor.name || "",
        nit: contractor.nit || "",
        contact: contractor.contact || "",
        email: contractor.email || "",
        phone: contractor.phone || "",
        website: contractor.website || "",
        address: contractor.address || "",
        city: contractor.city || "",
        department: contractor.department || "",
        postalCode: contractor.postalCode || "",
        legalRepName: contractor.legalRepName || "",
        legalRepCedula: contractor.legalRepCedula || "",
        legalRepEmail: contractor.legalRepEmail || "",
        legalRepPhone: contractor.legalRepPhone || "",
        reportedIncome: contractor.reportedIncome?.toString() || "",
        incomeYear: contractor.incomeYear?.toString() || "",
        ref1Name: contractor.ref1Name || "",
        ref1Company: contractor.ref1Company || "",
        ref1Phone: contractor.ref1Phone || "",
        ref1Email: contractor.ref1Email || "",
        ref2Name: contractor.ref2Name || "",
        ref2Company: contractor.ref2Company || "",
        ref2Phone: contractor.ref2Phone || "",
        ref2Email: contractor.ref2Email || "",
        ref3Name: contractor.ref3Name || "",
        ref3Company: contractor.ref3Company || "",
        ref3Phone: contractor.ref3Phone || "",
        ref3Email: contractor.ref3Email || "",
      });
    }
  }, [contractor]);

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/subcontratistas/${contractor.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          legalRepName: personType === "juridica" ? formData.legalRepName : null,
          legalRepCedula: personType === "juridica" ? formData.legalRepCedula : null,
          legalRepEmail: personType === "juridica" ? formData.legalRepEmail : null,
          legalRepPhone: personType === "juridica" ? formData.legalRepPhone : null,
          reportedIncome: formData.reportedIncome ? parseFloat(formData.reportedIncome) : null,
          incomeYear: formData.incomeYear ? parseInt(formData.incomeYear) : null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Error al actualizar");
      }

      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Editar Subcontratista</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">
                {error}
              </div>
            )}

            {/* Información Básica */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Información Básica
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label>Tipo de Persona *</Label>
                  <Select value={personType} onValueChange={(v) => handlePersonTypeChange(v as PersonType)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione tipo de persona" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="natural">Persona Natural</SelectItem>
                      <SelectItem value="juridica">Persona Jurídica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{personType === "natural" ? "Nombre Completo *" : "Razón Social *"}</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{personType === "natural" ? "RUT *" : "NIT *"}</Label>
                  <Input
                    value={formData.nit}
                    onChange={(e) => updateField("nit", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contacto *</Label>
                  <Input
                    value={formData.contact}
                    onChange={(e) => updateField("contact", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sitio Web</Label>
                  <Input
                    value={formData.website}
                    onChange={(e) => updateField("website", e.target.value)}
                    placeholder="https://"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Dirección */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Dirección
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label>Dirección</Label>
                  <Input
                    value={formData.address}
                    onChange={(e) => updateField("address", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ciudad</Label>
                  <Input
                    value={formData.city}
                    onChange={(e) => updateField("city", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Departamento</Label>
                  <Input
                    value={formData.department}
                    onChange={(e) => updateField("department", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Código Postal</Label>
                  <Input
                    value={formData.postalCode}
                    onChange={(e) => updateField("postalCode", e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Representante Legal */}
            {personType === "juridica" && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Representante Legal
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nombre Completo</Label>
                    <Input
                      value={formData.legalRepName}
                      onChange={(e) => updateField("legalRepName", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Cédula</Label>
                    <Input
                      value={formData.legalRepCedula}
                      onChange={(e) => updateField("legalRepCedula", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={formData.legalRepEmail}
                      onChange={(e) => updateField("legalRepEmail", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Teléfono</Label>
                    <Input
                      value={formData.legalRepPhone}
                      onChange={(e) => updateField("legalRepPhone", e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Información Financiera */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Información Financiera
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Renta Reportada (COP)</Label>
                  <Input
                    type="number"
                    value={formData.reportedIncome}
                    onChange={(e) => updateField("reportedIncome", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Año de Reporte</Label>
                  <Input
                    type="number"
                    value={formData.incomeYear}
                    onChange={(e) => updateField("incomeYear", e.target.value)}
                    placeholder="2024"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Referencias Comerciales */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Referencias Comerciales
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[1, 2, 3].map((num) => (
                  <div key={num} className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg">
                    <div className="col-span-2 font-medium text-sm text-gray-700">
                      Referencia {num}
                    </div>
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
                ))}
              </CardContent>
            </Card>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Guardar Cambios
              </Button>
            </DialogFooter>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
