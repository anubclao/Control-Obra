import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { getDefaultMenuPermissionsForRole, getRequiredMenuKeyForPath } from "@/lib/rbac";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/dashboard")) {
    return NextResponse.next();
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const requiredMenu = getRequiredMenuKeyForPath(pathname);
  if (!requiredMenu) {
    return NextResponse.next();
  }

  const tokenPermissions = Array.isArray(token.menuPermissions)
    ? (token.menuPermissions as string[])
    : [];
  const effectivePermissions = tokenPermissions.length
    ? tokenPermissions
    : getDefaultMenuPermissionsForRole(String(token.role || "USER"));

  if (!effectivePermissions.includes(requiredMenu)) {
    return NextResponse.redirect(new URL("/dashboard?denied=1", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
