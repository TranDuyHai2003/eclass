import Link from "next/link";
import { auth, signOut } from "@/auth";
import { NavLinks } from "./NavLinks";
import { NotificationBell } from "@/components/notification/NotificationBell";

export default async function Header() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-6 sm:px-8">
        <Link
          href="/"
          className="font-extrabold text-2xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600"
        >
          E-Class
        </Link>
        <nav className="flex items-center gap-4">
          <NavLinks role={session?.user?.role} />
          {session ? (
            <div className="flex items-center gap-4">
              <NotificationBell />
              <span className="text-sm font-medium text-gray-700">
                Chào, {session.user.name}
              </span>
              <form
                action={async () => {
                  "use server";
                  await signOut();
                }}
              >
                <button
                  type="submit"
                  className="text-sm font-medium text-gray-500 hover:text-red-600 transition-colors"
                >
                  Đăng xuất
                </button>
              </form>
            </div>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-5 py-2 text-sm font-medium text-white shadow transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
            >
              Đăng nhập
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
