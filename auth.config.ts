import type { NextAuthConfig } from "next-auth"
import Google from "next-auth/providers/google"
import Facebook from "next-auth/providers/facebook"

export default {
  providers: [],
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = (user as any).role;
        token.studentType = (user as any).studentType;
        token.isApproved = (user as any).isApproved;
        token.id = user.id;
      }

      // Handle session update trigger
      if (trigger === "update" && session) {
        token.name = session.name || token.name;
        token.picture = session.image || token.picture;
      }

      // Force ADMIN role for specific email
      if (token.email === "admin@gmail.com") {
        token.role = "ADMIN";
      }
      return token;
    },
    session({ session, token }) {
      if (token.role && session.user) {
        (session.user as any).role = token.role;
      }
      if (token.sub && session.user) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
} satisfies NextAuthConfig
