export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import crypto from "node:crypto";
import { sendOtpEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";

function hashCode(email: string, code: string): string {
  // hash con sal fija por email para evitar rainbow tables
  return crypto
    .createHash("sha256")
    .update(email.toLowerCase() + ":" + code + ":controlobra2026")
    .digest("hex");
}

export async function POST(req: Request) {
  // Rate limit: 5 requests por minuto por IP.
  // Evita email bombing y brute force sobre el endpoint.
  const rl = rateLimit(req, { key: "request-otp", limit: 5, windowMs: 60_000 });
  if (!rl.allowed) return rl.response!;

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "")
      .trim()
      .toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Correo electronico no valido" },
        { status: 400 },
      );
    }

    // Spec admin-user-authorization-with-otp.md — AC-8:
    // Validar contra el whitelist de usuarios autorizados por estado, NO solo
    // por is_active.  Mensajes diferenciados para que el front pueda mostrar
    // copy distinto al usuario final.
    const users = await query<any[]>(
      `SELECT id, email, status FROM users WHERE LOWER(email) = ? LIMIT 1`,
      [email],
    );
    if (users.length === 0) {
      return NextResponse.json(
        {
          error:
            "Este correo no esta registrado. Contacta al administrador para que te cree una cuenta.",
        },
        { status: 404 },
      );
    }
    const dbUser = users[0];
    if (dbUser.status === "PENDING") {
      return NextResponse.json(
        {
          error:
            "Tu cuenta esta pendiente de autorizacion por el administrador.",
        },
        { status: 403 },
      );
    }
    if (dbUser.status === "SUSPENDED") {
      return NextResponse.json(
        { error: "Tu cuenta esta suspendida. Contacta al administrador." },
        { status: 403 },
      );
    }
    // Si por alguna razon quedo is_active=0 con status=ACTIVE (legacy), tambien
    // bloqueamos para no romper el flujo esperado.
    if (dbUser.is_active === 0 || dbUser.is_active === false) {
      return NextResponse.json(
        { error: "Tu cuenta no esta activa. Contacta al administrador." },
        { status: 403 },
      );
    }

    // Generar OTP de 6 digitos
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    const codeHash = hashCode(email, code);
    // P0 plan 2026-10-02: usamos UTC_TIMESTAMP() del lado de MySQL para
    // que la fecha sea SIEMPRE UTC, sin importar la zona del servidor.
    // El codigo se hashea con la sal fija (no depende del tiempo).
    // Eliminar codigos previos del mismo email no usados
    await query(`DELETE FROM auth_otps WHERE email = ? AND used_at IS NULL`, [
      email,
    ]);

    // Insertar nuevo. Usamos DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 MINUTE)
    // para que expires_at siempre sea UTC, independiente de la zona del
    // servidor MySQL. Asi no hay mismatch con Date.now() de Node.
    await query(
      `INSERT INTO auth_otps
         (email, code_hash, expires_at, attempts, created_at)
       VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 MINUTE), 0, UTC_TIMESTAMP())`,
      [email, codeHash],
    );

    // P0 plan 2026-10-02 (debug): log explicito del codigo generado para
    // que el operador pueda compararlo con lo que recibio en su bandeja.
    // Si LOG_OTP_PLAIN=true, el codigo se imprime en texto plano.
    if (process.env.LOG_OTP_PLAIN === "true") {
      console.log(`[request-otp] email=${email} code=${code}`);
    }

    // P0 (docs/DOCUMENTACION_TECNICA_Y_MEJORAS.md, seccion 4.4):
    //   En produccion, el OTP NUNCA puede devolverse en la respuesta: si el
    //   SMTP cae, alguien que conozca un email registrado podria iniciar
    //   sesion como ese usuario. Por eso abortamos con 503 cuando el envio
    //   falla y ademas invalidamos el codigo persistido.
    const isProd = process.env.NODE_ENV === "production";
    let emailResult: { ok: boolean; error?: string } = { ok: true };
    try {
      emailResult = await sendOtpEmail({ to: email, code });
    } catch (emailErr: any) {
      console.warn(
        "[auth request-otp] email send falló:",
        emailErr?.message ?? emailErr,
      );
      emailResult = {
        ok: false,
        error: emailErr?.message ?? "Email send failed",
      };
    }

    // Si el envio fallo en produccion, invalidamos el codigo y respondemos 503
    // para que el cliente NO pueda continuar con devCode.
    if (!emailResult.ok) {
      await query(`DELETE FROM auth_otps WHERE email = ? AND used_at IS NULL`, [
        email,
      ]);
      if (isProd) {
        return NextResponse.json(
          {
            error:
              "No pudimos enviar el codigo a tu correo. Intenta de nuevo en unos minutos.",
            code: "EMAIL_DELIVERY_FAILED",
          },
          { status: 503 },
        );
      }
      // En dev: seguimos y devolvemos devCode para que el flujo sea testeable
      // aunque el email falle (comun en local donde SMTP esta bloqueado o no
      // se ha configurado). Mostramos emailSent=true cuando Gmail acepto
      // el envio, false cuando fallo, para que el dev sepa el estado real.
      return NextResponse.json({
        ok: true,
        message: emailResult.ok
          ? "Codigo enviado a tu correo (modo DEV: revisa devCode en la respuesta si no llega email)."
          : "Codigo generado. Email fallo pero puedes continuar con el codigo mostrado abajo (modo DEV).",
        devCode: code,
        emailSent: emailResult.ok,
        emailError: emailResult.error,
      });
    }

    // Produccion + SMTP OK => el codigo viaja solo por correo.
// En dev: aunque SMTP funcione, devolvemos devCode tambien para que
// el dev pueda validar el flujo completo desde el entry point sin
// depender del inbox. La proteccion de seguridad (nunca devolver codigo
// en produccion) sigue garantizada porque el if de arriba corta prod.
    return NextResponse.json({
      ok: true,
      message: isProd
        ? "Codigo enviado a tu correo"
        : "Codigo enviado a tu correo (modo DEV: tambien disponible como devCode).",
      ...(isProd ? {} : { devCode: code }),
      emailSent: true,
    });
  } catch (e: any) {
    console.error("[auth request-otp]", e?.code, e?.message);
    return NextResponse.json(
      { error: "Error al enviar codigo", code: e?.code },
      { status: 500 },
    );
  }
}
