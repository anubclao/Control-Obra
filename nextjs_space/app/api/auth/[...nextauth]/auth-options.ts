import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { getEffectiveMenuPermissionsForUser } from "@/lib/rbac-db";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      id: "otp",
      name: "otp",
      credentials: {
        email: { label: "Email", type: "email" },
        otp: { label: "OTP", type: "text" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email || "").toLowerCase().trim();
        const otp = String(credentials?.otp || "").trim();

        if (!email || !otp) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.isActive) {
          return null;
        }

        const otpRecord = await prisma.emailOtp.findFirst({
          where: {
            email,
            usedAt: null,
            expiresAt: { gt: new Date() },
          },
          orderBy: { createdAt: "desc" },
        });

        if (!otpRecord) {
          return null;
        }

        const isOtpValid = await bcrypt.compare(otp, otpRecord.codeHash);
        if (!isOtpValid) {
          return null;
        }

        await prisma.emailOtp.update({
          where: { id: otpRecord.id },
          data: { usedAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.isActive) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;

        const permissionsData = await getEffectiveMenuPermissionsForUser(
          user.id,
          user.role
        );
        token.menuPermissions = permissionsData.permissions;
        token.accessRoleId = permissionsData.accessRoleId;
        token.accessRoleName = permissionsData.accessRoleName;
      } else if (token.id && !Array.isArray(token.menuPermissions)) {
        const permissionsData = await getEffectiveMenuPermissionsForUser(
          String(token.id),
          String(token.role || "USER")
        );
        token.menuPermissions = permissionsData.permissions;
        token.accessRoleId = permissionsData.accessRoleId;
        token.accessRoleName = permissionsData.accessRoleName;
      }

      return token;
    },
    async session({ session, token }) {
      if (session?.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).menuPermissions = token.menuPermissions || [];
        (session.user as any).accessRoleId = token.accessRoleId || null;
        (session.user as any).accessRoleName = token.accessRoleName || null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
