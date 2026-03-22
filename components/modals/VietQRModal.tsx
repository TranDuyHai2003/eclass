"use client";

import { X } from "lucide-react";

interface VietQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseTitle: string;
  coursePrice?: number;
  userEmail: string;
  onConfirm: () => void;
  isLoading: boolean;
}

export function VietQRModal({
  isOpen,
  onClose,
  courseTitle,
  coursePrice = 0,
  userEmail,
  onConfirm,
  isLoading
}: VietQRModalProps) {
  if (!isOpen) return null;

  const amount = coursePrice > 0 ? coursePrice : 500000; 
  const content = `${courseTitle} ${userEmail}`.substring(0, 50);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 relative animate-in fade-in zoom-in duration-200">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-900 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="text-center space-y-4 pt-2">
          <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Thanh toán</h2>
          <p className="text-gray-600 text-sm font-medium">
            Vui lòng quét mã QR hoặc chuyển khoản để được cấp quyền vào học.
          </p>

          <div className="bg-gray-50 p-4 rounded-2xl flex justify-center border-2 border-dashed border-gray-200">
             <div className="w-48 h-48 bg-white border rounded-xl shadow-sm flex items-center justify-center flex-col gap-2">
                <span className="text-sm font-bold text-gray-400">[Ảnh Mã VietQR]</span>
             </div>
          </div>

          <div className="text-left space-y-2 bg-red-50 p-4 rounded-2xl text-sm border border-red-100">
             <p className="flex justify-between">
                <span className="text-gray-600">Ngân hàng:</span>
                <span className="font-bold">Vietcombank</span>
             </p>
             <p className="flex justify-between">
                <span className="text-gray-600">Số tài khoản:</span>
                <span className="font-bold">0123456789</span>
             </p>
             <p className="flex justify-between">
                <span className="text-gray-600">Chủ tài khoản:</span>
                <span className="font-bold">NGUYEN VAN A</span>
             </p>
             <div className="h-px bg-red-200 my-2"></div>
             <p className="flex justify-between items-center text-lg">
                <span className="text-gray-600 text-sm">Số tiền:</span>
                <span className="font-black text-red-600">{amount.toLocaleString('vi-VN')} đ</span>
             </p>
             <p className="flex flex-col gap-1 mt-2">
                <span className="text-gray-600">Nội dung chuyển khoản:</span>
                <span className="font-bold bg-white px-3 py-2 rounded-lg border text-center break-all">{content}</span>
             </p>
          </div>

          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-black text-lg rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-600/20 uppercase tracking-wide mt-2"
          >
            {isLoading ? "Đang xử lý..." : "Tôi đã chuyển khoản"}
          </button>
        </div>
      </div>
    </div>
  );
}
