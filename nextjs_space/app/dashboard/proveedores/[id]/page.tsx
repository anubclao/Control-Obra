import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { ProveedorDetails } from "./_components/proveedor-details";
import { calculateDaysUntil } from "@/lib/format";
import { SupplierDocument } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function ProveedorDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  const supplier = await prisma.supplier.findUnique({
    where: { id: params.id },
    include: {
      documents: {
        orderBy: { uploadedAt: "desc" },
      },
    },
  });

  if (!supplier) {
    notFound();
  }

  // Calcular alertas de documentos
  const documentAlerts = supplier.documents.map((doc: SupplierDocument) => {
    const daysUntil = doc.expirationDate
      ? calculateDaysUntil(doc.expirationDate)
      : null;
    return {
      ...doc,
      uploadedAt: doc.uploadedAt.toISOString(),
      expirationDate: doc.expirationDate?.toISOString() || null,
      isExpired: daysUntil !== null && daysUntil < 0,
      isExpiringSoon: daysUntil !== null && daysUntil >= 0 && daysUntil <= 30,
      daysUntil,
    };
  });

  const serializedSupplier = {
    ...supplier,
    createdAt: supplier.createdAt.toISOString(),
    updatedAt: supplier.updatedAt.toISOString(),
    documents: documentAlerts,
  };

  const userRole = (session.user as any)?.role || "USER";

  return (
    <ProveedorDetails
      supplier={serializedSupplier}
      documentAlerts={documentAlerts}
      userRole={userRole}
    />
  );
}
