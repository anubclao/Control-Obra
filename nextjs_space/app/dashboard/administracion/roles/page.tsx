import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { ROLES_CAN_INVITE } from "@/lib/constants";
import { RolesClient } from "./_components/roles-client";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const session = await getServerSession(authOptions);

  if (!session || !ROLES_CAN_INVITE.includes(session.user.role as any)) {
    redirect("/dashboard");
  }

  return <RolesClient />;
}
