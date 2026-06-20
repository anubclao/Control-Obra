"use client";

import { useState, useMemo } from "react";
import {
  Plus,
  Building2,
  Search,
  Mail,
  Phone,
  MapPin,
  Pencil,
  TrendingUp,
  Users,
  XCircle,
  CheckCircle2,
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
import { useClientsStore, CLIENT_STATUS_LABELS, CLIENT_STATUS_VARIANTS, CLIENT_SOURCE_LABELS } from "@/lib/clients-store";
import { useQuotationsStore } from "@/lib/quotations-store";
import type { Client, ClientStatus } from "@/types";

export default function ClientesPage() {
  const { clients } = useClientsStore();
  const { getByClient } = useQuotationsStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | ClientStatus>("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      const matchSearch =
        !search ||
        c.companyName.toLowerCase().includes(search.toLowerCase()) ||
        c.contactName.toLowerCase().includes(search.toLowerCase()) ||
        c.email.toLowerCase().includes(search.toLowerCase()) ||
        (c.nit && c.nit.includes(search));
      const matchStatus = statusFilter === "ALL" || c.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [clients, search, statusFilter]);

  const stats = useMemo(() => {
    const won = clients.filter((c) => c.status === "WON").length;
    const lost = clients.filter((c) => c.status === "LOST").length;
    const inPipeline = clients.filter((c) =>
      ["PROSPECT", "CONTACTED", "QUALIFIED", "PROPOSAL", "NEGOTIATION"].includes(c.status)
    ).length;
    return { total: clients.length, won, lost, inPipeline };
  }, [clients]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            {stats.total} clientes · {stats.won} ganados · {stats.inPipeline} en pipeline
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo cliente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear cliente</DialogTitle>
              <DialogDescription>Información del prospecto / cliente</DialogDescription>
            </DialogHeader>
            <ClientForm onSuccess={() => setCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Total" value={stats.total} icon={Users} color="text-blue-600" />
        <Kpi label="Ganados" value={stats.won} icon={CheckCircle2} color="text-emerald-600" />
        <Kpi label="En pipeline" value={stats.inPipeline} icon={TrendingUp} color="text-amber-600" />
        <Kpi label="Perdidos" value={stats.lost} icon={XCircle} color="text-red-600" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por empresa, contacto, email o NIT…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            {Object.entries(CLIENT_STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">Sin clientes</h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => {
            const quotations = getByClient(c.id);
            return (
              <div key={c.id} className="rounded-lg border bg-card p-4 transition-shadow hover:shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs text-muted-foreground">{c.clientNumber}</p>
                    <p className="truncate text-sm font-medium">{c.companyName}</p>
                    <p className="text-xs text-muted-foreground">{c.contactName}</p>
                  </div>
                  <Badge variant={CLIENT_STATUS_VARIANTS[c.status]}>
                    {CLIENT_STATUS_LABELS[c.status]}
                  </Badge>
                </div>
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1.5 truncate">
                    <Mail className="h-3 w-3" />
                    {c.email}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3" />
                    {c.phone}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <MapPin className="h-3 w-3" />
                    {c.city}
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px]">
                    {CLIENT_SOURCE_LABELS[c.source]}
                  </Badge>
                  {quotations.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {quotations.length} cotizacion{quotations.length === 1 ? "" : "es"}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex gap-1.5">
                  <Button variant="outline" size="sm" className="flex-1">
                    Ver cotizacion{quotations.length === 1 ? "" : "es"}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setEditing(c)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar cliente</DialogTitle>
            <DialogDescription>{editing?.clientNumber}</DialogDescription>
          </DialogHeader>
          {editing && <ClientForm client={editing} onSuccess={() => setEditing(null)} />}
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
  value: number;
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

function ClientForm({ client, onSuccess }: { client?: Client; onSuccess: () => void }) {
  const { addClient, updateClient } = useClientsStore();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const isEditing = !!client;
  const [companyName, setCompanyName] = useState(client?.companyName ?? "");
  const [nit, setNit] = useState(client?.nit ?? "");
  const [contactName, setContactName] = useState(client?.contactName ?? "");
  const [email, setEmail] = useState(client?.email ?? "");
  const [phone, setPhone] = useState(client?.phone ?? "");
  const [city, setCity] = useState(client?.city ?? "");
  const [sector, setSector] = useState(client?.sector ?? "");
  const [source, setSource] = useState(client?.source ?? "WEB");
  const [status, setStatus] = useState<ClientStatus>(client?.status ?? "PROSPECT");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      companyName,
      nit: nit || undefined,
      contactName,
      email,
      phone,
      city,
      sector: sector || undefined,
      source: source as Client["source"],
      status,
    };
    if (client) {
      updateClient(client.id, data);
    } else {
      addClient(data);
    }
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <Label className="mb-1.5 block">Empresa *</Label>
        <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="mb-1.5 block">NIT</Label>
          <Input value={nit} onChange={(e) => setNit(e.target.value)} placeholder="900.123.456-7" />
        </div>
        <div>
          <Label className="mb-1.5 block">Sector</Label>
          <Input value={sector} onChange={(e) => setSector(e.target.value)} placeholder="Construcción, Inmobiliario…" />
        </div>
      </div>
      <div>
        <Label className="mb-1.5 block">Persona de contacto *</Label>
        <Input value={contactName} onChange={(e) => setContactName(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="mb-1.5 block">Email *</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <Label className="mb-1.5 block">Teléfono *</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="mb-1.5 block">Ciudad *</Label>
          <Input value={city} onChange={(e) => setCity(e.target.value)} required />
        </div>
        <div>
          <Label className="mb-1.5 block">Fuente</Label>
          <Select value={source} onValueChange={(v) => setSource(v as Client["source"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(CLIENT_SOURCE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1.5 block">Estado</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as ClientStatus)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(CLIENT_STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onSuccess}>Cancelar</Button>
        <Button type="submit">{isEditing ? "Guardar" : "Crear cliente"}</Button>
      </DialogFooter>
    </form>
  );
}
