import NextAuth from "next-auth";
import { unstable_rethrow } from "next/navigation";
import { cache } from "react";
import { createHash } from "crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import authConfig from "@/auth.config";

/**
 * Ẩn danh dữ liệu cá nhân cho tài khoản demo.
 *
 * Khi người xem là tài khoản demo (isDemo trong JWT), mọi bản ghi User đọc từ
 * Prisma — kể cả khi nằm lồng trong include/select — được thay tên, email, ảnh
 * bằng bí danh cố định theo id (vd: "Học viên 3F9A2C"). Giáo viên/admin chỉ bị
 * ẩn email; chính tài khoản demo giữ nguyên.
 */

// Instance chỉ đọc JWT, không truy vấn DB (giống middleware) → tránh vòng lặp
// prisma → auth → prisma.
const { auth: readSessionFromToken } = NextAuth({ ...authConfig, trustHost: true });

/**
 * Trả về id tài khoản demo đang xem, hoặc null.
 * Không dùng React cache(): bên trong unstable_cache (dùng chung cho mọi người)
 * headers() ném lỗi → trả null → dữ liệu cache luôn là dữ liệu gốc.
 */
export async function getDemoViewerId(): Promise<string | null> {
  try {
    const session = await readSessionFromToken();
    return session?.user?.isDemo ? (session.user.id ?? null) : null;
  } catch (error) {
    unstable_rethrow(error);
    return null;
  }
}

const getStaffIds = cache(async (base: PrismaClient) => {
  const staff = await base.user.findMany({
    where: { role: { in: ["ADMIN", "TEACHER"] } },
    select: { id: true },
  });
  return new Set(staff.map((u) => u.id));
});

// Model → (tên field quan hệ → model đích), lấy từ Prisma DMMF
const relationMap = new Map<string, Map<string, string>>(
  Prisma.dmmf.datamodel.models.map((m) => [
    m.name,
    new Map(m.fields.filter((f) => f.kind === "object").map((f) => [f.name, f.type])),
  ]),
);

type MaskContext = { viewerId: string; staffIds: Set<string> };

function pseudonym(seed: string) {
  return createHash("sha256").update(seed).digest("hex").slice(0, 6).toUpperCase();
}

function maskUser(user: Record<string, any>, ctx: MaskContext) {
  const id: string | undefined = user.id;
  if (id && id === ctx.viewerId) return;

  const tag = pseudonym(id ?? user.email ?? user.name ?? "");
  if ("password" in user) user.password = null;
  if ("email" in user) user.email = `user-${tag.toLowerCase()}@demo.local`;

  // Giáo viên/admin giữ tên & ảnh (thông tin công khai trên trang), chỉ ẩn email
  const isStaff = (id && ctx.staffIds.has(id)) || (user.role && user.role !== "STUDENT");
  if (isStaff) return;

  if ("name" in user) user.name = `Học viên ${tag}`;
  if ("image" in user) user.image = null;
}

function maskValue(value: any, model: string, ctx: MaskContext): any {
  if (Array.isArray(value)) return value.map((v) => maskValue(v, model, ctx));
  if (!value || typeof value !== "object" || value instanceof Date) return value;

  const relations = relationMap.get(model);
  if (relations) {
    for (const key of Object.keys(value)) {
      const target = relations.get(key);
      if (target) value[key] = maskValue(value[key], target, ctx);
    }
  }
  if (model === "User") maskUser(value, ctx);
  return value;
}

/** Ẩn danh danh sách User lấy từ nguồn không qua Prisma extension (vd: unstable_cache). */
export async function maskUsersForDemo<T extends Record<string, any>>(
  users: T[],
  base: PrismaClient,
): Promise<T[]> {
  const viewerId = await getDemoViewerId();
  if (!viewerId) return users;
  const ctx = { viewerId, staffIds: await getStaffIds(base) };
  return users.map((u) => maskValue({ ...u }, "User", ctx));
}

export function withDemoPrivacy(base: PrismaClient) {
  return base.$extends({
    name: "demo-privacy",
    query: {
      $allModels: {
        async $allOperations({ model, args, query }) {
          const result = await query(args);
          const viewerId = await getDemoViewerId();
          if (!viewerId) return result;
          const ctx = { viewerId, staffIds: await getStaffIds(base) };
          return maskValue(result, model, ctx);
        },
      },
    },
  });
}
