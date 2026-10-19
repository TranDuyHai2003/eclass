import NextAuth from "next-auth";
import authConfig from "./auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const userRole = req.auth?.user?.role;

  const isApiAuthRoute = nextUrl.pathname.startsWith("/api/auth");
  const isPublicRoute = [
    "/",
    "/login",
    "/register",
    "/courses", // Có thể xem danh sách khóa học mà không cần đăng nhập
  ].includes(nextUrl.pathname);

  const isProtectedRoute = [
    "/profile",
    "/watch",
    "/teacher",
    "/admin",
    "/practice",
    "/library",
  ].some((route) => nextUrl.pathname.startsWith(route));

  // 1. Cho phép các API Auth
  if (isApiAuthRoute) return NextResponse.next();

  // 1b. Tài khoản demo chỉ xem: chặn mọi request ghi dữ liệu vào API
  const isReadMethod = ["GET", "HEAD", "OPTIONS"].includes(req.method);
  if (req.auth?.user?.isDemo && nextUrl.pathname.startsWith("/api") && !isReadMethod) {
    return NextResponse.json(
      { success: false, error: "Demo Mode — tài khoản chỉ xem, không thể thay đổi dữ liệu." },
      { status: 403 },
    );
  }

  // 2. Chặn truy cập trang login/register nếu đã đăng nhập
  if (isLoggedIn && (nextUrl.pathname === "/login" || nextUrl.pathname === "/register")) {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  // 3. Bảo vệ các route cần đăng nhập
  if (!isLoggedIn && isProtectedRoute) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  // 3b. Tài khoản demo không được xem trang ghi danh / tài chính
  if (req.auth?.user?.isDemo && nextUrl.pathname.startsWith("/admin/finance")) {
    return NextResponse.redirect(new URL("/admin/users", nextUrl));
  }

  // 4. Kiểm tra quyền Admin/Teacher cho các route đặc biệt
  if (isLoggedIn) {
    if (nextUrl.pathname.startsWith("/admin") && userRole !== "ADMIN") {
      return NextResponse.redirect(new URL("/", nextUrl));
    }
    if (nextUrl.pathname.startsWith("/teacher") && userRole !== "TEACHER" && userRole !== "ADMIN") {
      return NextResponse.redirect(new URL("/", nextUrl));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
