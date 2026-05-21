"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  Mail,
  Plus,
  Search,
  Copy,
  Check,
  Clock,
  UserPlus,
  Shield,
  XCircle,
} from "lucide-react";
import { formatShortDate } from "@/lib/format";
import { USER_ROLE } from "@/lib/constants";
import { NuevaInvitacionDialog } from "./nueva-invitacion-dialog";

interface UsuariosClientProps {
  users: any[];
  invitations: any[];
  projects: any[];
  accessRoles: { id: string; name: string; isActive: boolean }[];
  currentUserRole: string;
}

export function UsuariosClient({
  users,
  invitations,
  projects,
  accessRoles,
  currentUserRole,
}: UsuariosClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showNewInvitation, setShowNewInvitation] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [updatingRoleUserId, setUpdatingRoleUserId] = useState<string | null>(null);
  const router = useRouter();

  // Filtrar usuarios
  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Estadísticas
  const activeUsers = users.filter((u) => u.isActive).length;
  const pendingInvitations = invitations.filter(
    (i) => i.isActive && new Date(i.expiresAt) > new Date() && i.usedCount < i.maxUses
  ).length;

  const copyToClipboard = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleDeactivateInvitation = async (id: string) => {
    try {
      await fetch(`/api/invitaciones/${id}`, { method: "DELETE" });
      router.refresh();
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleAccessRoleChange = async (userId: string, accessRoleId: string) => {
    try {
      setUpdatingRoleUserId(userId);
      const response = await fetch(`/api/access-control/users/${userId}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessRoleId: accessRoleId || null }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "No se pudo actualizar el rol de acceso");
      }

      router.refresh();
    } catch (error) {
      console.error("Error updating access role:", error);
    } finally {
      setUpdatingRoleUserId(null);
    }
  };

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      ADMIN: "bg-red-100 text-red-700",
      GERENTE: "bg-purple-100 text-purple-700",
      DIRECTOR: "bg-blue-100 text-blue-700",
      RESIDENTE: "bg-green-100 text-green-700",
      CONTABILIDAD: "bg-yellow-100 text-yellow-700",
      TESORERIA: "bg-orange-100 text-orange-700",
      HSEQ: "bg-cyan-100 text-cyan-700",
      CLIENTE: "bg-gray-100 text-gray-700",
      USER: "bg-gray-100 text-gray-600",
    };
    return (
      <Badge className={colors[role] || "bg-gray-100"}>
        {USER_ROLE[role as keyof typeof USER_ROLE] || role}
      </Badge>
    );
  };

  const handleSuccess = () => {
    setShowNewInvitation(false);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Administración de Usuarios</h1>
          <p className="text-gray-600">Gestiona usuarios e invitaciones del sistema</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/administracion/roles">Roles y Permisos</Link>
          </Button>
          <Button onClick={() => setShowNewInvitation(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Nueva Invitación
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Usuarios Activos</p>
                <p className="text-2xl font-bold">{activeUsers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <Mail className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Invitaciones Pendientes</p>
                <p className="text-2xl font-bold">{pendingInvitations}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Shield className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Usuarios</p>
                <p className="text-2xl font-bold">{users.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Usuarios</TabsTrigger>
          <TabsTrigger value="invitations">Invitaciones</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Buscar por nombre o email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Perfil de Acceso</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Proyectos</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Registro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{user.name}</p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell>
                        <select
                          className="h-9 rounded-md border border-input bg-background px-2 text-sm w-full"
                          value={user.accessRoleId || ""}
                          onChange={(e) => handleAccessRoleChange(user.id, e.target.value)}
                          disabled={updatingRoleUserId === user.id}
                        >
                          <option value="">Sin perfil dinamico</option>
                          {accessRoles.map((role) => (
                            <option key={role.id} value={role.id}>
                              {role.name}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell>{user.phone || "-"}</TableCell>
                      <TableCell>
                        {user.projectAssignments.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {user.projectAssignments.slice(0, 2).map((pa: any) => (
                              <Badge key={pa.id} variant="outline" className="text-xs">
                                {pa.project.name}
                              </Badge>
                            ))}
                            {user.projectAssignments.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{user.projectAssignments.length - 2}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.isActive ? "success" : "secondary"}>
                          {user.isActive ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {formatShortDate(user.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invitations" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {invitations.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead>Proyecto</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Creado por</TableHead>
                      <TableHead>Expira</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.map((inv) => {
                      const isExpired = new Date(inv.expiresAt) < new Date();
                      const isUsed = inv.usedCount >= inv.maxUses;
                      return (
                        <TableRow key={inv.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <code className="bg-gray-100 px-2 py-1 rounded font-mono text-sm">
                                {inv.code}
                              </code>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => copyToClipboard(inv.code)}
                              >
                                {copiedCode === inv.code ? (
                                  <Check className="w-4 h-4 text-green-500" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>{getRoleBadge(inv.role)}</TableCell>
                          <TableCell>
                            {inv.project?.name || <span className="text-gray-400">Todos</span>}
                          </TableCell>
                          <TableCell>
                            {inv.email || <span className="text-gray-400">Cualquiera</span>}
                          </TableCell>
                          <TableCell className="text-gray-500">
                            {inv.createdBy.name}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4 text-gray-400" />
                              {formatShortDate(inv.expiresAt)}
                            </div>
                          </TableCell>
                          <TableCell>
                            {isUsed ? (
                              <Badge variant="success">Usado</Badge>
                            ) : isExpired ? (
                              <Badge variant="secondary">Expirado</Badge>
                            ) : !inv.isActive ? (
                              <Badge variant="secondary">Cancelado</Badge>
                            ) : (
                              <Badge variant="warning">Pendiente</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {inv.isActive && !isExpired && !isUsed && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeactivateInvitation(inv.id)}
                              >
                                <XCircle className="w-4 h-4 text-red-500" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12">
                  <Mail className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">No hay invitaciones</p>
                  <Button
                    className="mt-4"
                    onClick={() => setShowNewInvitation(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Crear primera invitación
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog */}
      <NuevaInvitacionDialog
        open={showNewInvitation}
        onOpenChange={setShowNewInvitation}
        projects={projects}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
