"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect, useState } from "react";
import { Plus, Trash2, Star, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProvidersStore } from "@/lib/data-store";
import {
  PROVIDER_PRODUCT_SUBCATEGORIES,
  PROVIDER_SERVICE_SUBCATEGORIES,
} from "@/types";
import type { Provider, ProviderReference, PersonType } from "@/types";

const refSchema = z.object({
  name: z.string().optional(),
  company: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
});

const providerSchema = z
  .object({
    personType: z.enum(["NATURAL", "JURIDICA"]),
    name: z.string().min(2, "Mínimo 2 caracteres"),
    // NATURAL → CC (5+ dígitos), JURIDICA → NIT
    nit: z.string().min(5, "Documento inválido"),
    contact: z.string().min(2),
    email: z.string().email("Email inválido"),
    email2: z.string().email("Email inválido").optional().or(z.literal("")),
    phone: z.string().min(7),
    phone2: z.string().optional(),
    website: z.string().optional().or(z.literal("")),
    address: z.string().optional(),
    city: z.string().optional(),
    department: z.string().optional(),
    postalCode: z.string().optional(),
    category: z.enum(["PRODUCTO", "SERVICIO"]).optional(),
    subcategory: z.string().optional(),
    subcategoryOther: z.string().optional(),
    // Representante legal — solo JURIDICA (validamos en superRefine)
    legalRepName: z.string().optional(),
    legalRepCedula: z.string().optional(),
    legalRepEmail: z
      .string()
      .email("Email inválido")
      .optional()
      .or(z.literal("")),
    legalRepPhone: z.string().optional(),
    reportedIncome: z.coerce.number().min(0).optional().or(z.literal("")),
    incomeYear: z.coerce.number().optional().or(z.literal("")),
    rating: z.coerce.number().min(0).max(5).optional(),
    references: z.array(refSchema).max(3),
    notes: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.personType === "JURIDICA" && !data.legalRepName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["legalRepName"],
        message: "Requerido para persona jurídica",
      });
    }
  });

type FormData = z.infer<typeof providerSchema>;

const resolver = zodResolver(providerSchema) as Resolver<FormData>;

interface Props {
  provider?: Provider;
  onSuccess: () => void;
}

export function ProviderForm({ provider, onSuccess }: Props) {
  const { addProvider, updateProvider } = useProvidersStore();
  const isEditing = !!provider;
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver,
    defaultValues: provider
      ? {
          personType: provider.personType,
          name: provider.name,
          nit: provider.nit,
          contact: provider.contact,
          email: provider.email,
          email2: provider.email2 ?? "",
          phone: provider.phone,
          phone2: provider.phone2 ?? "",
          website: provider.website ?? "",
          address: provider.address ?? "",
          city: provider.city ?? "",
          department: provider.department ?? "",
          postalCode: provider.postalCode ?? "",
          category: provider.category,
          subcategory: provider.subcategory ?? "",
          subcategoryOther: provider.subcategoryOther ?? "",
          legalRepName: provider.legalRepName ?? "",
          legalRepCedula: provider.legalRepCedula ?? "",
          legalRepEmail: provider.legalRepEmail ?? "",
          legalRepPhone: provider.legalRepPhone ?? "",
          reportedIncome: provider.reportedIncome ?? "",
          incomeYear: provider.incomeYear ?? "",
          rating: provider.rating ?? 0,
          references:
            (provider.references ?? []).length > 0
              ? provider.references
              : [{ name: "", company: "", phone: "", email: "" }],
          notes: provider.notes ?? "",
        }
      : {
          personType: "JURIDICA",
          name: "",
          nit: "",
          contact: "",
          email: "",
          email2: "",
          phone: "",
          phone2: "",
          website: "",
          address: "",
          city: "",
          department: "",
          postalCode: "",
          category: undefined,
          subcategory: "",
          subcategoryOther: "",
          legalRepName: "",
          legalRepCedula: "",
          legalRepEmail: "",
          legalRepPhone: "",
          reportedIncome: "",
          incomeYear: "",
          rating: 0,
          references: [{ name: "", company: "", phone: "", email: "" }],
          notes: "",
        },
  });

  useEffect(() => {
    if (provider) reset(provider as unknown as FormData);
  }, [provider, reset]);

  const references = watch("references");
  const rating = watch("rating");
  const personType = watch("personType");
  const category = watch("category");
  const subcategory = watch("subcategory");

  function addRef() {
    if ((references ?? []).length >= 3) return;
    setValue("references", [
      ...(references ?? []),
      { name: "", company: "", phone: "", email: "" },
    ]);
  }

  function removeRef(idx: number) {
    setValue(
      "references",
      (references ?? []).filter((_, i) => i !== idx),
    );
  }

  async function onSubmit(data: FormData) {
    const cleanRefs: ProviderReference[] = (data.references ?? [])
      .filter((r) => r.name || r.company)
      .map((r) => ({
        name: r.name ?? "",
        company: r.company ?? "",
        phone: r.phone ?? "",
        email: r.email ?? "",
      }));

    const payload = {
      ...data,
      email2: data.email2 || undefined,
      phone2: data.phone2 || undefined,
      website: data.website || undefined,
      address: data.address || undefined,
      city: data.city || undefined,
      department: data.department || undefined,
      postalCode: data.postalCode || undefined,
      category: data.category,
      subcategory: data.subcategory || undefined,
      subcategoryOther:
        data.subcategory === "OTROS"
          ? data.subcategoryOther || undefined
          : undefined,
      legalRepName: data.legalRepName || undefined,
      legalRepCedula: data.legalRepCedula || undefined,
      legalRepEmail: data.legalRepEmail || undefined,
      legalRepPhone: data.legalRepPhone || undefined,
      reportedIncome:
        data.reportedIncome === "" ? undefined : Number(data.reportedIncome),
      incomeYear: data.incomeYear === "" ? undefined : Number(data.incomeYear),
      rating: data.rating || undefined,
      references: cleanRefs,
      notes: data.notes || undefined,
    };

    if (provider) {
      updateProvider(provider.id, payload as Partial<Provider>);
    } else {
      await addProvider(
        payload as Omit<Provider, "id" | "status" | "createdAt" | "documents">,
      );
    }
    onSuccess();
  }

  const isJuridica = personType === "JURIDICA";
  const docLabel = isJuridica ? "NIT *" : "Cédula *";
  const docPlaceholder = isJuridica ? "900.123.456-7" : "79.123.456";
  const nameLabel = isJuridica ? "Razón social *" : "Nombre completo *";
  const subcategoryOptions =
    category === "PRODUCTO"
      ? PROVIDER_PRODUCT_SUBCATEGORIES
      : category === "SERVICIO"
        ? PROVIDER_SERVICE_SUBCATEGORIES
        : [];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* 1. Tipo de persona */}
      <Section
        title="Tipo de persona"
        desc="Define los campos y documentos requeridos"
      >
        <div className="flex gap-3">
          {(["NATURAL", "JURIDICA"] as PersonType[]).map((pt) => (
            <button
              key={pt}
              type="button"
              onClick={() => setValue("personType", pt)}
              className={`flex-1 rounded-md border px-4 py-3 text-sm font-medium transition-colors ${
                personType === pt
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card hover:bg-accent"
              }`}
            >
              {pt === "NATURAL" ? "Persona Natural" : "Persona Jurídica"}
            </button>
          ))}
        </div>
        {errors.personType && (
          <p className="mt-1 text-xs text-destructive">
            {errors.personType.message}
          </p>
        )}
      </Section>

      {/* 2. Información básica */}
      <Section
        title="Información básica"
        desc="Datos principales del proveedor"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={nameLabel} error={errors.name?.message}>
            <Input
              {...register("name")}
              placeholder={
                isJuridica ? "Estructuras del Norte S.A.S" : "Juan Pérez"
              }
            />
          </Field>
          <Field label={docLabel} error={errors.nit?.message}>
            <Input {...register("nit")} placeholder={docPlaceholder} />
          </Field>
          <Field label="Persona de contacto *" error={errors.contact?.message}>
            <Input {...register("contact")} placeholder="Nombre del contacto" />
          </Field>
          <Field label="Email principal *" error={errors.email?.message}>
            <Input
              type="email"
              {...register("email")}
              placeholder="contacto@empresa.com"
            />
          </Field>
          <Field label="Email 2 (opcional)" error={errors.email2?.message}>
            <Input
              type="email"
              {...register("email2")}
              placeholder="alternativo@empresa.com"
            />
          </Field>
          <Field label="Teléfono 1 *" error={errors.phone?.message}>
            <Input {...register("phone")} placeholder="+57 310 555 0000" />
          </Field>
          <Field label="Teléfono 2 (opcional)">
            <Input {...register("phone2")} placeholder="+57 311 555 0000" />
          </Field>
          <Field label="Sitio web">
            <Input {...register("website")} placeholder="https://empresa.com" />
          </Field>
        </div>
      </Section>

      {/* 3. Categoría y subcategoría */}
      <Section title="Categoría" desc="Tipo de producto o servicio que ofrece">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Categoría">
            <Select
              value={category ?? ""}
              onValueChange={(v) => {
                setValue("category", v as "PRODUCTO" | "SERVICIO");
                setValue("subcategory", "");
                setValue("subcategoryOther", "");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PRODUCTO">Producto</SelectItem>
                <SelectItem value="SERVICIO">Servicio</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Subcategoría">
            <Select
              value={subcategory ?? ""}
              onValueChange={(v) => setValue("subcategory", v)}
              disabled={!category}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    category ? "Selecciona" : "Elige categoría primero"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {subcategoryOptions.map((sc) => (
                  <SelectItem key={sc} value={sc}>
                    {sc === "OTROS"
                      ? "Otros"
                      : sc.replace(/_/g, " ").toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {subcategory === "OTROS" && (
            <Field
              label="Especificar otra subcategoría"
              className="sm:col-span-2"
            >
              <Input
                {...register("subcategoryOther")}
                placeholder="Escribe la subcategoría"
              />
            </Field>
          )}
        </div>
      </Section>

      {/* 4. Dirección */}
      <Section title="Dirección" desc="Ubicación del proveedor">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Dirección" className="sm:col-span-2">
            <Input {...register("address")} placeholder="Calle 100 #15-20" />
          </Field>
          <Field label="Ciudad">
            <Input {...register("city")} placeholder="Bogotá" />
          </Field>
          <Field label="Departamento">
            <Input {...register("department")} placeholder="Cundinamarca" />
          </Field>
          <Field label="Código postal">
            <Input {...register("postalCode")} placeholder="110111" />
          </Field>
        </div>
      </Section>

      {/* 5. Representante legal — solo JURIDICA */}
      {isJuridica && (
        <Section
          title="Representante legal"
          desc="Obligatorio para persona jurídica"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="Nombre completo *"
              error={errors.legalRepName?.message}
            >
              <Input {...register("legalRepName")} />
            </Field>
            <Field label="Cédula">
              <Input {...register("legalRepCedula")} placeholder="79.123.456" />
            </Field>
            <Field label="Email" error={errors.legalRepEmail?.message}>
              <Input type="email" {...register("legalRepEmail")} />
            </Field>
            <Field label="Teléfono">
              <Input {...register("legalRepPhone")} />
            </Field>
          </div>
        </Section>
      )}

      {/* 6. Información financiera + rating */}
      <Section
        title="Información financiera"
        desc="Renta reportada y calificación"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Renta reportada (COP)">
            <Input
              type="number"
              min="0"
              step="any"
              {...register("reportedIncome")}
            />
          </Field>
          <Field label="Año gravable">
            <Input
              type="number"
              min="2000"
              max="2100"
              {...register("incomeYear")}
              placeholder="2025"
            />
          </Field>
          <Field label="Calificación">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  type="button"
                  key={n}
                  onClick={() => setValue("rating", n)}
                  className="p-1"
                >
                  <Star
                    className={`h-5 w-5 ${
                      n <= (rating ?? 0)
                        ? "fill-amber-400 text-amber-400"
                        : "text-muted-foreground/30"
                    }`}
                  />
                </button>
              ))}
              <input type="hidden" {...register("rating")} />
            </div>
          </Field>
        </div>
      </Section>

      {/* 7. Referencias comerciales */}
      <Section
        title="Referencias comerciales"
        desc="Hasta 3 referencias (opcional)"
      >
        <div className="space-y-3">
          {(references ?? []).map((_, idx) => (
            <div key={idx} className="rounded-md border bg-secondary/30 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium">Referencia {idx + 1}</p>
                {(references ?? []).length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRef(idx)}
                    className="h-7 w-7"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Nombre">
                  <Input {...register(`references.${idx}.name`)} />
                </Field>
                <Field label="Empresa">
                  <Input {...register(`references.${idx}.company`)} />
                </Field>
                <Field label="Teléfono">
                  <Input {...register(`references.${idx}.phone`)} />
                </Field>
                <Field label="Email">
                  <Input
                    type="email"
                    {...register(`references.${idx}.email`)}
                  />
                </Field>
              </div>
            </div>
          ))}
          {(references ?? []).length < 3 && (
            <Button type="button" variant="outline" size="sm" onClick={addRef}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Agregar referencia
            </Button>
          )}
        </div>
      </Section>

      <Section title="Notas" desc="Observaciones internas (opcional)">
        <Textarea
          {...register("notes")}
          placeholder="Comentarios, historial, alertas…"
          rows={2}
        />
      </Section>

      {submitError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No se pudo guardar</AlertTitle>
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isEditing ? "Guardar cambios" : "Crear proveedor"}
        </Button>
      </div>
    </form>
  );
}

function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  children,
  error,
  className,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block">{label}</Label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
