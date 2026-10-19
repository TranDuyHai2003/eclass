import { Role, StudentType, Level } from "@prisma/client";
import NextAuth, { DefaultSession } from "next-auth";
import { JWT } from "next-auth/jwt";

export type ExtendedUser = DefaultSession["user"] & {
  role: Role;
  studentType: StudentType;
  level: Level;
  isDemo?: boolean;
};

declare module "next-auth" {
  interface Session {
    user: ExtendedUser;
  }

  interface User {
    role?: Role;
    studentType?: StudentType;
    level?: Level;
    isDemo?: boolean;
  }
}

// QUAN TRỌNG: Mở rộng JWT để token.role không bị lỗi
declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
    studentType?: StudentType;
    level?: Level;
    isDemo?: boolean;
  }
}
