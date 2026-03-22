import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  return (
    <div className="page-shell min-h-screen">
      <div className="container mx-auto py-6 md:py-8 px-4 sm:px-6 lg:px-8 max-w-7xl">
        {/* Mobile Header for Admin */}
        <div className="lg:hidden flex items-center justify-between mb-6 pb-4 border-b">
           <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-black rounded-xl flex items-center justify-center text-white font-black text-xs">
                A
              </div>
              <h1 className="font-black text-sm uppercase tracking-tight">Admin Panel</h1>
           </div>
           
           <Sheet>
             <SheetTrigger asChild>
               <Button variant="ghost" size="icon" className="rounded-xl border border-gray-100">
                 <Menu className="w-5 h-5" />
               </Button>
             </SheetTrigger>
             <SheetContent side="left" className="p-0 border-none w-[300px]">
                <div className="h-full overflow-y-auto">
                   <DashboardSidebar isMobile />
                </div>
             </SheetContent>
           </Sheet>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          <div className="hidden lg:block shrink-0">
             <DashboardSidebar />
          </div>
          <main className="flex-1 w-full overflow-hidden">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
