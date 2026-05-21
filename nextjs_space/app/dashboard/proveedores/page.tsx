import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { ProveedoresClient } from "./_components/proveedores-client";
import { SupplierDocument, Supplier } from "@prisma/client";

export const dynamic = "force-dynamic";

async function updateSupplierStatus(supplierId: string) {
  const requiredDocs = ["CEDULA", "RUT", "CAMARA_COMERCIO", "CERTIFICADO_BANCARIO"];

  const documents: SupplierDocument[] = await prisma.supplierDocument.findMany({
    where: { supplierId },
  });

  const uploadedTypes = documents.map((d: SupplierDocument) => d.type);
  const hasAllRequired = requiredDocs.every((type) =>
    uploadedTypes.includes(type as SupplierDocument["type"])
  );

  const now = new Date();
  const hasExpired = documents.some(
    (d: SupplierDocument) => d.expirationDate && d.expirationDate < now
  );

  let status: "COMPLETE" | "INCOMPLETE" | "EXPIRED" = "INCOMPLETE";
  if (hasExpired) {
    status = "EXPIRED";
  } else if (hasAllRequired) {
    status = "COMPLETE";
  }

  const currentSupplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (status !== currentSupplier?.status) {
    await prisma.supplier.update({
      where: { id: supplierId },
      data: { status },
    });
  }

  return status;
}

export default async function ProveedoresPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  // Obtener proveedores y actualizar estados
  const suppliers = await prisma.supplier.findMany({
    include: {
      documents: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Actualizar estados de todos los proveedores
  for (const supplier of suppliers) {
    await updateSupplierStatus(supplier.id);
  }

  // Volver a obtener con estados actualizados
  const updatedSuppliers = await prisma.supplier.findMany({
    include: {
      documents: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const serializedSuppliers = updatedSuppliers.map((s: Supplier & { documents: SupplierDocument[] }) => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    documents: s.documents.map((d: SupplierDocument) => ({
      ...d,
      uploadedAt: d.uploadedAt.toISOString(),
      expirationDate: d.expirationDate?.toISOString() || null,
    })),
  }));

  return <ProveedoresClient suppliers={serializedSuppliers} />;
}
