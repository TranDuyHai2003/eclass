import { Role } from "@prisma/client";
import NextAuth, { DefaultSession } from "next-auth";
import { JWT } from "next-auth/jwt";

export type ExtendedUser = DefaultSession["user"] & {
  role: Role;
};

declare module "next-auth" {
  interface Session {
    user: ExtendedUser;
  }

  interface User {
    role?: Role;
  }
}

// QUAN TRỌNG: Mở rộng JWT để token.role không bị lỗi
declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
  }
}
