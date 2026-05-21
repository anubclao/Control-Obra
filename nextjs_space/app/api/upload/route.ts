import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { saveFile } from "@/lib/s3";

export const dynamic = "force-dynamic";

function isValidUploadPath(path: string) {
  if (!path) return false;
  if (!path.startsWith("uploads/")) return false;
  if (path.includes("..")) return false;
  if (path.includes("\\")) return false;
  return true;
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const uploadPath = request.nextUrl.searchParams.get("path") ?? "";
    if (!isValidUploadPath(uploadPath)) {
      return NextResponse.json({ error: "Ruta de archivo inválida" }, { status: 400 });
    }

    const arrayBuffer = await request.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      return NextResponse.json({ error: "Archivo vacío" }, { status: 400 });
    }

    const fileBuffer = Buffer.from(arrayBuffer);
    const result = await saveFile(uploadPath, fileBuffer);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "No se pudo guardar el archivo" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, path: uploadPath });
  } catch (error) {
    console.error("Error subiendo archivo local:", error);
    return NextResponse.json(
      { error: "Error al subir el archivo" },
      { status: 500 }
    );
  }
}
