
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Rocket } from "lucide-react";

interface ComingSoonProps {
  title: string;
  description?: string;
}

export function ComingSoon({ 
  title, 
  description = "Tính năng này đang được phát triển và sẽ sớm ra mắt trong thời gian tới. Vui lòng quay lại sau!" 
}: ComingSoonProps) {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-24 h-24 bg-red-100 rounded-3xl flex items-center justify-center text-red-600 mb-8 animate-bounce">
        <Rocket className="w-12 h-12" />
      </div>
      
      <h1 className="text-3xl md:text-4xl font-black text-gray-900 mb-4 uppercase tracking-tight">
        {title}
      </h1>
      
      <p className="text-gray-500 max-w-md mx-auto mb-10 leading-relaxed">
        {description}
      </p>
      
      <div className="flex flex-col sm:flex-row gap-4">
        <Link href="/">
          <Button variant="default" className="bg-red-600 hover:bg-red-700 px-8 py-6 rounded-2xl font-bold h-auto shadow-lg shadow-red-200 transition-all">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Về trang chủ
          </Button>
        </Link>
        <Button variant="outline" className="px-8 py-6 rounded-2xl font-bold h-auto border-gray-200">
          Nhận thông báo khi ra mắt
        </Button>
      </div>
      
      <div className="mt-20 flex gap-12 text-gray-400 font-bold text-xs uppercase tracking-[0.2em]">
        <span className="animate-pulse">Loading...</span>
        <span>Coming Soon 2024</span>
        <span>E-Class Academy</span>
      </div>
    </div>
  );
}
