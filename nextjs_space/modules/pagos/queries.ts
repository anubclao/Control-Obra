import { prisma } from "@/lib/db";
import { PaymentFilterInput } from "./validations";

const paymentInclude = {
  project: { select: { id: true, name: true, code: true } },
  contractor: { select: { id: true, name: true, nit: true } },
  createdBy: { select: { id: true, name: true } },
  workCut: { select: { id: true, cutNumber: true } },
  contract: { select: { id: true, contractNumber: true } },
  approvals: {
    include: { approver: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: "asc" as const },
  },
  documents: true,
} as const;

export async function findPaymentById(id: string) {
  return prisma.paymentRequest.findUnique({ where: { id }, include: paymentInclude });
}

export async function findManyPayments(filters: PaymentFilterInput, userId?: string, userRole?: string) {
  const { projectId, status, paymentType, page, limit } = filters;
  const skip = (page - 1) * limit;

  const where = {
    ...(projectId && { projectId }),
    ...(status && { status }),
    ...(paymentType && { paymentType }),
    ...(userRole === "CLIENTE" && userId && {
      project: { assignments: { some: { userId } } },
    }),
  };

  const [payments, total] = await prisma.$transaction([
    prisma.paymentRequest.findMany({
      where,
      include: paymentInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.paymentRequest.count({ where }),
  ]);

  return { payments, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getNextPaymentNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.paymentRequest.count();
  return `PAG-${year}-${String(count + 1).padStart(4, "0")}`;
}
