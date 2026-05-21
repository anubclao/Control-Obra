import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { sendOtpEmail } from "@/lib/email";

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = String(body?.email || "").toLowerCase().trim();

    if (!email) {
      return NextResponse.json({ error: "El correo es requerido" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, isActive: true },
    });

    // Respuesta neutra para no filtrar existencia de usuarios.
    if (!user || !user.isActive) {
      return NextResponse.json({ success: true });
    }

    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

    const latestOtp = await prisma.emailOtp.findFirst({
      where: {
        email,
        createdAt: { gte: oneMinuteAgo },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    if (latestOtp) {
      return NextResponse.json(
        { error: "Espera un minuto antes de solicitar un nuevo codigo" },
        { status: 429 }
      );
    }

    const otp = generateOtp();
    const codeHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);

    await prisma.emailOtp.create({
      data: {
        email,
        codeHash,
        expiresAt,
        requestedIp: request.headers.get("x-forwarded-for") || request.ip || null,
      },
    });

    await sendOtpEmail(email, otp);

    const response: Record<string, unknown> = { success: true };
    if (process.env.NODE_ENV !== "production") {
      response.devOtp = otp;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error requesting OTP:", error);
    return NextResponse.json(
      { error: "No se pudo generar o enviar el codigo OTP" },
      { status: 500 }
    );
  }
}
