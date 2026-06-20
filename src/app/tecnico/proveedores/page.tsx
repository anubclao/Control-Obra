"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Mail,
  Phone,
  MapPin,
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
  Star,
  CheckCircle2,
  AlertCircle,
  XCircle,
  FileText,
  Briefcase,
} from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  useProvidersStore,
  PROVIDER_STATUS_LABELS,
  PROVIDER_STATUS_VARIANTS,
  PERSON_TYPE_LABELS,
  CATEGORY_LABELS,
} from "@/lib/providers-store";
import { ProviderForm } from "@/components/providers/provider-form";
import type { Provider, ProviderStatus, PersonType, ProviderCategory } from "@/types";

export default function ProveedoresPage() {
  const { providers, deleteProvider } = useProvidersStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | ProviderStatus>("ALL");
  const [personTypeFilter, setPersonTypeFilter] = useState<"ALL" | PersonType>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | ProviderCategory>("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [deleting, setDeleting] = useState<Provider | null>(null);

  const filtered = useMemo(() => {
    return providers.filter((p) => {
      const matchSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.nit.includes(search) ||
        p.contact.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "ALL" || p.status === statusFilter;
      const matchPersonType = personTypeFilter === "ALL" || p.personType === personTypeFilter;
      const matchCategory = categoryFilter === "ALL" || p.category === categoryFilter;
      return matchSearch && matchStatus && matchPersonType && matchCategory;
    });
  }, [providers, search, statusFilter, personTypeFilter, categoryFilter]);

  const stats = useMemo(() => {
    const complete = providers.filter((p) => p.status === "COMPLETE").length;
    const incomplete = providers.filter((p) => p.status === "INCOMPLETE").length;
    const expired = providers.filter((p) => p.status === "EXPIRED").length;
    const naturales = providers.filter((p) => p.personType === "NATURAL").length;
    return { complete, incomplete, expired, naturales, total: providers.length };
  }, [providers]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Proveedores</h1>
          <p className="text-sm text-muted-foreground">
            {providers.length} registrados · {stats.complete} habilitados · {stats.expired} con docs vencidos
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo proveedor
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crear proveedor</DialogTitle>
              <DialogDescription>
                Completa la información. Podrás agregar documentos después.
              </DialogDescription>
            </DialogHeader>
            <ProviderForm onSuccess={() => setCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Total</p>
          <p className="mt-1 text-2xl font-semibold">{stats.total}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Habilitados</p>
          <p className="mt-1 flex items-center gap-1.5 text-2xl font-semibold text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
            {stats.complete}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Incompletos</p>
          <p className="mt-1 flex items-center gap-1.5 text-2xl font-semibold text-amber-600">
            <AlertCircle className="h-5 w-5" />
            {stats.incomplete}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Vencidos</p>
          <p className="mt-1 flex items-center gap-1.5 text-2xl font-semibold text-red-600">
            <XCircle className="h-5 w-5" />
            {stats.expired}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Naturales</p>
          <p className="mt-1 flex items-center gap-1.5 text-2xl font-semibold">
            <Briefcase className="h-5 w-5 text-muted-foreground" />
            {stats.naturales}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, documento o contacto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={personTypeFilter} onValueChange={(v) => setPersonTypeFilter(v as typeof personTypeFilter)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Tipo persona" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los tipos</SelectItem>
            {Object.entries(PERSON_TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as typeof categoryFilter)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas las categorías</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los estados</SelectItem>
            {Object.entries(PROVIDER_STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No hay proveedores</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {search || statusFilter !== "ALL" || personTypeFilter !== "ALL" || categoryFilter !== "ALL"
              ? "Intenta con otros filtros"
              : "Crea el primer proveedor para empezar"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filtered.map((p) => (
            <ProviderCard
              key={p.id}
              provider={p}
              onEdit={() => setEditing(p)}
              onDelete={() => setDeleting(p)}
            />
          ))}
        </div>
      )}

      {/* Modal editar */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar proveedor</DialogTitle>
            <DialogDescription>{editing?.nit}</DialogDescription>
          </DialogHeader>
          {editing && <ProviderForm provider={editing} onSuccess={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar proveedor?</DialogTitle>
            <DialogDescription>
              Se eliminará <strong>{deleting?.name}</strong> y todos sus documentos asociados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleting) {
                  deleteProvider(deleting.id);
                  setDeleting(null);
                }
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProviderCard({
  provider: p,
  onEdit,
  onDelete,
}: {
  provider: Provider;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const docsCount = p.documents.length;
  const variant = PROVIDER_STATUS_VARIANTS[p.status];

  return (
    <div className="rounded-lg border bg-card p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={variant}>{PROVIDER_STATUS_LABELS[p.status]}</Badge>
            <Badge variant="outline">{PERSON_TYPE_LABELS[p.personType]}</Badge>
            {p.category && (
              <Badge variant="secondary">{CATEGORY_LABELS[p.category]}</Badge>
            )}
            {p.rating && (
              <div className="flex items-center gap-0.5 text-xs text-amber-500">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-3 w-3 ${i < p.rating! ? "fill-current" : "opacity-30"}`}
                  />
                ))}
              </div>
            )}
          </div>
          <Link
            href={`/tecnico/proveedores/${p.id}`}
            className="mt-1 block text-lg font-semibold hover:underline"
          >
            {p.name}
          </Link>
          <p className="font-mono text-xs text-muted-foreground">
            {p.personType === "JURIDICA" ? "NIT" : "CC"} {p.nit}
          </p>
          <p className="mt-2 text-sm font-medium">{p.contact}</p>
          <div className="mt-1.5 flex flex-col gap-1 text-sm text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              {p.email}
              {p.email2 && <span className="text-xs">· {p.email2}</span>}
            </p>
            <p className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" />
              {p.phone}
              {p.phone2 && <span className="text-xs">· {p.phone2}</span>}
            </p>
            {p.city && (
              <p className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {p.city}
                {p.department ? `, ${p.department}` : ""}
              </p>
            )}
          </div>
        </div>

        <div className="relative">
          <Button variant="ghost" size="icon" onClick={() => setMenuOpen(!menuOpen)} className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
          </Button>
          {menuOpen && (
            <div
              className="absolute right-0 z-10 mt-1 w-40 rounded-md border bg-card shadow-lg"
              onMouseLeave={() => setMenuOpen(false)}
            >
              <Link
                href={`/tecnico/proveedores/${p.id}`}
                className="flex items-center gap-2 rounded-t-md px-3 py-2 text-sm hover:bg-accent"
              >
                <Eye className="h-4 w-4" />
                Ver detalle
              </Link>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onEdit();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
              >
                <Pencil className="h-4 w-4" />
                Editar
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
                className="flex w-full items-center gap-2 rounded-b-md px-3 py-2 text-sm text-destructive hover:bg-accent"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-md border bg-secondary/40 px-3 py-2 text-xs">
        <span className="text-muted-foreground">Documentos</span>
        <span className="font-medium">
          {docsCount} cargados
        </span>
      </div>
    </div>
  );
}
