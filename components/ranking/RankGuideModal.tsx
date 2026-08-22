"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Swords, Zap, Award, CheckCircle2, Scale, Target, Flame, FileText, Lock, ShieldCheck, HelpCircle, Trophy } from "lucide-react";

interface RankGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  minRequiredTests?: number;
}

export function RankGuideModal({
  isOpen,
  onClose,
}: RankGuideModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-x-0 bottom-0 top-14 sm:top-16 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[#0D121D] border-2 border-cyan-500/80 rounded-2xl max-w-2xl w-full text-white p-4 sm:p-6 shadow-[0_0_35px_rgba(6,182,212,0.4)] space-y-5 max-h-[calc(100vh-100px)] overflow-y-auto relative my-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-cyan-500/50 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-slate-900">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-400 hover:text-white hover:border-cyan-400 transition-colors z-10 shadow-lg"
          title="Đóng Hướng Dẫn"
        >
          <X className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>

        {/* Modal Header */}
        <div className="flex items-start gap-3.5 border-b border-slate-800 pb-4 pr-12">
          <div className="p-3 rounded-2xl bg-cyan-950/90 border border-cyan-500/60 shadow-[0_0_15px_rgba(6,182,212,0.4)] shrink-0 mt-0.5">
            <Swords className="w-6 h-6 sm:w-8 sm:h-8 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-base sm:text-2xl lg:text-3xl font-black tracking-widest text-slate-100 uppercase flex items-center gap-2">
              🎮 LUẬT XẾP HẠNG & ĐÁNH GIÁ NĂNG LỰC
            </h2>
            <p className="text-xs sm:text-sm text-cyan-300 font-medium italic mt-1 leading-snug">
              🎯 Không phải ai đạt điểm cao một lần cũng là người mạnh nhất — Rank thuộc về người chứng minh được năng lực của mình qua thời gian.
            </p>
          </div>
        </div>

        {/* Section 1: Làm bài để xây dựng Năng Lực */}
        <div className="space-y-2.5">
          <h3 className="text-xs sm:text-base font-black tracking-wider text-cyan-300 uppercase flex items-center gap-2 font-mono">
            <Target className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400 shrink-0" />
            <span>1. LÀM BÀI ĐỂ XÂY DỰNG NĂNG LỰC</span>
          </h3>
          <div className="p-4 rounded-xl bg-[#080B12] border border-slate-800 text-xs sm:text-sm text-slate-300 space-y-2 leading-relaxed font-medium">
            <p>
              Hệ thống sử dụng các bài thi bạn đã hoàn thành để đánh giá năng lực:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-300">
              <li>Mỗi bài thi chỉ tính 1 lần. Nếu bạn làm lại một bài, hệ thống sử dụng <strong className="text-cyan-300">kết quả mới nhất</strong>.</li>
              <li>Điểm trung bình càng cao và số bài đã làm càng nhiều, <strong className="text-cyan-300">Năng Lực Ước Tính</strong> càng phản ánh chính xác khả năng của bạn.</li>
            </ul>
            <div className="p-3 rounded-lg bg-cyan-950/40 border border-cyan-500/40 text-cyan-200 text-xs flex items-start gap-2">
              <span className="text-base shrink-0">💡</span>
              <span>Làm 1 bài được 10 điểm chưa đủ để chứng minh năng lực ổn định. Vì vậy hệ thống sẽ cần thêm dữ liệu trước khi đánh giá bạn ở mức cao nhất.</span>
            </div>
          </div>
        </div>

        {/* Section 2: Điểm Xếp Hạng được tính như thế nào? (Bảng 110 điểm) */}
        <div className="space-y-2.5">
          <h3 className="text-xs sm:text-base font-black tracking-wider text-amber-300 uppercase flex items-center gap-2 font-mono">
            <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0" />
            <span>2. ĐIỂM XẾP HẠNG ĐƯỢC TÍNH NHƯ THẾ NÀO? (TỐI ĐA 110 ĐIỂM)</span>
          </h3>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#080B12]">
            <table className="w-full text-left text-xs sm:text-sm font-mono border-collapse">
              <thead className="bg-[#0B0F17] text-slate-400 font-black uppercase text-[11px] border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-4">THÀNH PHẦN</th>
                  <th className="py-2.5 px-4 text-center">TỐI ĐA</th>
                  <th className="py-2.5 px-4">Ý NGHĨA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                <tr>
                  <td className="py-2.5 px-4 font-bold text-cyan-300 flex items-center gap-1.5">
                    <span>🎯 Năng Lực</span>
                  </td>
                  <td className="py-2.5 px-4 text-center font-black text-cyan-400">100</td>
                  <td className="py-2.5 px-4 text-slate-300">Thành tích học tập là yếu tố quan trọng nhất</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-bold text-amber-300 flex items-center gap-1.5">
                    <span>📝 Thưởng Chăm Chỉ</span>
                  </td>
                  <td className="py-2.5 px-4 text-center font-black text-amber-400">+7</td>
                  <td className="py-2.5 px-4 text-slate-300">Thưởng cho mức độ hoàn thành bài</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-bold text-rose-300 flex items-center gap-1.5">
                    <span>🔥 Thưởng Hoạt Động</span>
                  </td>
                  <td className="py-2.5 px-4 text-center font-black text-rose-400">+3</td>
                  <td className="py-2.5 px-4 text-slate-300">Thưởng cho việc học tập gần đây</td>
                </tr>
                <tr className="bg-cyan-950/30 font-black text-slate-100">
                  <td className="py-2.5 px-4 text-cyan-300">TỔNG CỘNG</td>
                  <td className="py-2.5 px-4 text-center text-amber-300 text-sm">110</td>
                  <td className="py-2.5 px-4 text-cyan-200">Điểm dùng để xếp vị trí trên Leaderboard</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400 italic">
            * Năng Lực chiếm phần lớn điểm Xếp Hạng, vì vậy học tốt luôn quan trọng hơn việc chỉ làm thật nhiều bài.
          </p>
        </div>

        {/* Section 3: Vì sao làm nhiều bài lại có lợi? */}
        <div className="space-y-2.5">
          <h3 className="text-xs sm:text-base font-black tracking-wider text-emerald-300 uppercase flex items-center gap-2 font-mono">
            <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0" />
            <span>3. VÌ SAO LÀM NHIỀU BÀI LAỊ CÓ LỢI?</span>
          </h3>

          <div className="p-4 rounded-xl bg-[#080B12] border border-slate-800 text-xs sm:text-sm text-slate-300 space-y-3 leading-relaxed">
            <p>
              Hệ thống không chỉ nhìn vào điểm trung bình, mà còn xem bạn đã có bao nhiêu bài làm để chứng minh năng lực:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                <div className="text-amber-400 font-bold">Bạn A</div>
                <div className="text-slate-300">1 bài · 10.0 điểm</div>
              </div>
              <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/40 space-y-1">
                <div className="text-emerald-400 font-bold">Bạn B</div>
                <div className="text-slate-200">20 bài · 9.2 điểm</div>
              </div>
            </div>
            <p className="text-slate-300">
              Mặc dù A có điểm trung bình cao hơn, hệ thống chưa có đủ dữ liệu để chắc chắn rằng mức 10.0 của A phản ánh năng lực ổn định. Vì vậy, <strong className="text-emerald-300">B có thể được xếp trên A</strong> vì đã duy trì kết quả tốt qua nhiều bài hơn.
            </p>
            <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 font-bold text-xs flex items-center gap-2">
              <span>👉 Điểm cao + kết quả ổn định qua nhiều bài = Năng Lực cao.</span>
            </div>
          </div>
        </div>

        {/* Section 4: Khi nào được tham gia Bảng Xếp Hạng? */}
        <div className="space-y-2.5">
          <h3 className="text-xs sm:text-base font-black tracking-wider text-cyan-300 uppercase flex items-center gap-2 font-mono">
            <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400 shrink-0" />
            <span>4. KHI NÀO ĐƯỢC THAM GIA BẢNG XẾP HẠNG?</span>
          </h3>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#080B12]">
            <table className="w-full text-left text-xs sm:text-sm font-mono border-collapse">
              <thead className="bg-[#0B0F17] text-slate-400 font-black uppercase text-[11px] border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-4 w-36">SỐ BÀI ĐÃ LÀM</th>
                  <th className="py-2.5 px-4">TRẠNG THÁI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                <tr>
                  <td className="py-2.5 px-4 font-bold text-slate-400">0 – 4 bài</td>
                  <td className="py-2.5 px-4 font-extrabold text-slate-400">🔒 CHƯA MỞ KHÓA</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-bold text-amber-300">5 – 14 bài</td>
                  <td className="py-2.5 px-4 font-extrabold text-amber-300">🔐 ĐANG XÁC NHẬN</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-bold text-emerald-400">15+ bài</td>
                  <td className="py-2.5 px-4 font-extrabold text-emerald-400">👑 CHÍNH THỨC</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="space-y-2 text-xs sm:text-sm leading-relaxed text-slate-300 font-medium">
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <span className="font-bold text-slate-300">🔒 Chưa Mở Khóa — dưới 5 bài:</span> Bạn chưa có đủ dữ liệu để tham gia Bảng Xếp Hạng chính thức. Cần làm ít nhất 5 bài.
            </div>
            <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-500/40">
              <span className="font-bold text-amber-300">🔐 Đang Xác Nhận — 5 đến 14 bài:</span> Bạn đã được xếp hạng, nhưng hệ thống vẫn đang thu thập thêm dữ liệu để xác nhận Rank (VD: <span className="font-mono text-cyan-300">RANK A · ĐANG XÁC NHẬN</span>). Tiếp tục làm bài để tăng Mức Độ Hoàn Thiện Dữ Liệu.
            </div>
            <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/40">
              <span className="font-bold text-emerald-300">👑 Chính Thức — từ 15 bài:</span> Bạn đã đạt ngưỡng dữ liệu cần thiết để xác nhận Rank chính thức (VD: <span className="font-mono text-emerald-300">RANK A · CHÍNH THỨC</span>).
            </div>
          </div>
        </div>

        {/* Section 5: Mức Độ Hoàn Thiện Dữ Liệu */}
        <div className="space-y-2.5">
          <h3 className="text-xs sm:text-base font-black tracking-wider text-cyan-300 uppercase flex items-center gap-2 font-mono">
            <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0" />
            <span>5. MỨC ĐỘ HOÀN THIỆN DỮ LIỆU</span>
          </h3>
          <div className="p-4 rounded-xl bg-[#080B12] border border-slate-800 text-xs sm:text-sm text-slate-300 space-y-2 leading-relaxed">
            <p className="font-mono font-bold text-cyan-300">Mốc xác nhận chính thức là 15 bài:</p>
            <div className="grid grid-cols-3 gap-2 text-center font-mono text-xs">
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="block text-slate-400">5 bài</span>
                <strong className="text-amber-400 text-sm">33%</strong>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="block text-slate-400">10 bài</span>
                <strong className="text-amber-300 text-sm">67%</strong>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40">
                <span className="block text-slate-400">15 bài</span>
                <strong className="text-emerald-400 text-sm">100%</strong>
              </div>
            </div>
            <p className="text-xs text-slate-400 italic pt-1">
              * Đây là tiến độ hoàn thiện dữ liệu để xác nhận Rank, không phải phần trăm khả năng bạn trả lời đúng. Làm càng nhiều bài, hệ thống càng có nhiều dữ liệu để đánh giá năng lực ổn định.
            </p>
          </div>
        </div>

        {/* Section 6: Quy tắc Phân định Bằng điểm (Tie-Breaker) */}
        <div className="space-y-2.5">
          <h3 className="text-xs sm:text-base font-black tracking-wider text-cyan-300 uppercase flex items-center gap-2 font-mono">
            <Scale className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400 shrink-0" />
            <span>6. NẾU HAI HỌC SINH BẰNG ĐIỂM THÌ SAO?</span>
          </h3>
          <div className="p-4 rounded-xl bg-[#080B12] border border-slate-800 text-xs sm:text-sm text-slate-300 space-y-1.5 leading-relaxed font-mono">
            <p className="font-sans font-medium text-slate-400 mb-2">Hệ thống sẽ lần lượt xét theo các bước ưu tiên:</p>
            <ol className="list-decimal list-inside space-y-1.5">
              <li>🏆 <strong className="text-amber-300">Điểm Xếp Hạng cao hơn</strong> ➔ Xếp trên</li>
              <li>🎯 <strong className="text-cyan-300">Năng Lực Ước Tính cao hơn</strong> ➔ Xếp trên</li>
              <li>📊 <strong className="text-emerald-400">Điểm Trung Bình cao hơn</strong> ➔ Xếp trên</li>
              <li>📝 <strong className="text-slate-200">Số bài đã làm nhiều hơn</strong> ➔ Xếp trên</li>
              <li>🔥 <strong className="text-rose-400">Chuỗi ngày học dài hơn</strong> ➔ Xếp trên</li>
              <li className="text-slate-400 font-sans text-xs">Nếu tất cả vẫn giống nhau ➔ Hệ thống dùng mã định danh để giữ thứ tự ổn định và công bằng.</li>
            </ol>
          </div>
        </div>

        {/* Summary Block */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-950/80 via-slate-900 to-amber-950/80 border border-cyan-500/50 space-y-2 text-xs sm:text-sm text-slate-200 shadow-lg">
          <div className="font-black text-cyan-300 uppercase tracking-widest flex items-center gap-2 text-sm sm:text-base font-mono">
            <Trophy className="w-5 h-5 text-amber-400" />
            <span>🏆 TÓM TẮT CỰC NGẮN</span>
          </div>
          <ul className="space-y-1 list-disc list-inside text-slate-300 font-medium">
            <li>Rank của bạn không chỉ dựa vào một vài bài điểm cao.</li>
            <li><strong className="text-cyan-300">Học tốt ➔ Làm bài đều ➔ Duy trì kết quả tốt ➔ Rank tăng.</strong></li>
            <li>Điểm học tập là yếu tố quan trọng nhất. Số bài làm và hoạt động học tập giúp phản ánh sự ổn định và chăm chỉ.</li>
            <li><strong className="text-amber-300">5 bài</strong> ➔ Được tham gia Bảng Xếp Hạng</li>
            <li><strong className="text-emerald-400">15 bài</strong> ➔ Rank được xác nhận chính thức</li>
          </ul>
        </div>

        {/* Footer Close Button */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 font-black text-xs sm:text-sm text-white uppercase tracking-wider transition-colors shadow-lg shadow-cyan-500/25 text-center"
          >
            ĐÃ HIỂU (ĐÓNG)
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
