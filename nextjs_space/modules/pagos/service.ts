import { prisma } from "@/lib/db";
import { CreatePaymentInput, PaymentFilterInput } from "./validations";
import { findPaymentById, findManyPayments, getNextPaymentNumber } from "./queries";

const APPROVAL_LEVEL_STATUS = {
  1: "APPROVED_LEVEL_1",
  2: "APPROVED_LEVEL_2",
  3: "APPROVED",
} as const;

export async function getPayments(filters: PaymentFilterInput, userId?: string, userRole?: string) {
  return findManyPayments(filters, userId, userRole);
}

export async function getPaymentById(id: string) {
  const payment = await findPaymentById(id);
  if (!payment) throw new Error("Solicitud de pago no encontrada");
  return payment;
}

export async function createPayment(input: CreatePaymentInput, createdById: string) {
  const paymentNumber = await getNextPaymentNumber();

  return prisma.paymentRequest.create({
    data: {
      paymentNumber,
      projectId: input.projectId,
      concept: input.concept,
      amount: input.amount,
      paymentType: input.paymentType,
      priority: input.priority,
      contractorId: input.contractorId || null,
      workCutId: input.workCutId || null,
      contractId: input.contractId || null,
      beneficiaryName: input.beneficiaryName,
      beneficiaryNit: input.beneficiaryNit,
      bankName: input.bankName,
      accountType: input.accountType,
      accountNumber: input.accountNumber,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      notes: input.notes,
      requiredApprovalLevel: input.requiredApprovalLevel,
      createdById,
    },
  });
}

export async function approvePayment(id: string, approverId: string, approverLevel: number, comments?: string) {
  const payment = await getPaymentById(id);

  if (!["PENDING", "APPROVED_LEVEL_1", "APPROVED_LEVEL_2"].includes(payment.status)) {
    throw new Error("Este pago no puede ser aprobado en su estado actual");
  }

  if (payment.currentApprovalLevel !== approverLevel) {
    throw new Error(`Este pago requiere aprobación de nivel ${payment.currentApprovalLevel}`);
  }

  await prisma.paymentApproval.create({
    data: {
      paymentRequestId: id,
      approverId,
      level: approverLevel,
      action: "APPROVED",
      comments,
    },
  });

  // Determinar nuevo status
  const isFullyApproved = approverLevel >= payment.requiredApprovalLevel;
  const newStatus = isFullyApproved
    ? "APPROVED"
    : (APPROVAL_LEVEL_STATUS[approverLevel as keyof typeof APPROVAL_LEVEL_STATUS] ?? "APPROVED_LEVEL_1");

  return prisma.paymentRequest.update({
    where: { id },
    data: {
      status: newStatus,
      currentApprovalLevel: isFullyApproved ? approverLevel : approverLevel + 1,
    },
  });
}

export async function rejectPayment(id: string, approverId: string, level: number, reason: string) {
  const payment = await getPaymentById(id);

  if (!["PENDING", "APPROVED_LEVEL_1", "APPROVED_LEVEL_2"].includes(payment.status)) {
    throw new Error("Este pago no puede ser rechazado en su estado actual");
  }

  await prisma.paymentApproval.create({
    data: {
      paymentRequestId: id,
      approverId,
      level,
      action: "REJECTED",
      comments: reason,
    },
  });

  return prisma.paymentRequest.update({
    where: { id },
    data: { status: "REJECTED", rejectionReason: reason },
  });
}

export async function markPaymentAsPaid(id: string) {
  const payment = await getPaymentById(id);
  if (payment.status !== "APPROVED") {
    throw new Error("Solo pagos completamente aprobados pueden marcarse como pagados");
  }
  return prisma.paymentRequest.update({
    where: { id },
    data: { status: "PAID", paidAt: new Date() },
  });
}
