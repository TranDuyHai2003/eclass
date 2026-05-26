import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import authConfig from "@/auth.config";
import { compare } from "bcryptjs";
import Credentials from "next-auth/providers/credentials";
import { Role } from "@prisma/client";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  trustHost: true,
  ...authConfig,
  providers: [
    ...authConfig.providers,
    Credentials({
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
          where: {
            email: credentials.email as string,
          },
        });

        if (!user || !user.password) {
          return null;
        }

        const isPasswordValid = await compare(
          credentials.password as string,
          user.password,
        );

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          studentType: user.studentType,
          image: user.image,
          isApproved: user.isApproved,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async session({ session, token }) {
      // Inherit basic session logic from auth.config.ts
      if (token.role && session.user) {
        session.user.role = token.role as Role;
      }
      if (token.studentType && session.user) {
        session.user.studentType = token.studentType as any;
      }
      if (token.isApproved !== undefined && session.user) {
        (session.user as any).isApproved = token.isApproved;
      }
      if (token.sub && session.user) {
        session.user.id = token.sub;
      }

      // Fetch fresh data from DB to ensure profile changes (name, image) reflect immediately
      if (token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { name: true, image: true, role: true, studentType: true, isApproved: true }
        });
        if (dbUser) {
          session.user.name = dbUser.name;
          session.user.image = dbUser.image;
          session.user.role = dbUser.role as Role;
          session.user.studentType = dbUser.studentType;
          (session.user as any).isApproved = dbUser.isApproved;
        }
      }

      return session;
    },
    async signIn({ user }) {
      return true;
    },
  },
});
