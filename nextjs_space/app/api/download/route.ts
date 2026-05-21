import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { getFileUrl } from "@/lib/s3";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const path = searchParams.get("path");
    const isPublic = searchParams.get("isPublic") === "true";
    const format = searchParams.get("format"); // "json" returns URL as JSON

    if (!path) {
      return NextResponse.json(
        { error: "Ruta del archivo no proporcionada" },
        { status: 400 }
      );
    }

    const fileUrl = await getFileUrl(path, isPublic);

    // If format=json, return URL as JSON (for client-side fetching)
    if (format === "json") {
      return NextResponse.json({ url: fileUrl });
    }

    // Redirigir al archivo en S3
    return NextResponse.redirect(fileUrl);
  } catch (error) {
    console.error("Error descargando archivo:", error);
    return NextResponse.json(
      { error: "Error al descargar archivo" },
      { status: 500 }
    );
  }
}
