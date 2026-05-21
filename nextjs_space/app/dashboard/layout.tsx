import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "../api/auth/[...nextauth]/auth-options";
import { MobileNavWrapper } from "@/components/mobile-nav-wrapper";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return (
    <MobileNavWrapper user={session.user}>
      {children}
    </MobileNavWrapper>
  );
}
