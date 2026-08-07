"use client";

import { AlertTriangle, Send, MessageSquare, PhoneCall } from "lucide-react";
import { useState } from "react";

interface StudentAlert {
  id: string;
  name: string;
  rank?: number | null;
  reason: string;
  type?: string;
}

interface NeedSupportAlertPanelProps {
  studentsNeedingSupport?: StudentAlert[];
}

export function NeedSupportAlertPanel({ studentsNeedingSupport }: NeedSupportAlertPanelProps) {
  const [notifiedSet, setNotifiedSet] = useState<Record<string, boolean>>({});

  const defaultList: StudentAlert[] = [
    {
      id: "demo-1",
      name: "Trần Văn M (#28)",
      reason: "Chưa nộp 3 bài kiểm tra gần nhất",
      type: "REMIND",
    },
    {
      id: "demo-2",
      name: "Lê Thị Lan (#24)",
      reason: "Tụt 7 bậc (Điểm TB bài vừa rồi: 4.2)",
      type: "MESSAGE",
    },
    {
      id: "demo-3",
      name: "Nguyễn Nam (#31)",
      reason: "7 ngày không đăng nhập hệ thống",
      type: "PHONE",
    },
  ];

  const list = studentsNeedingSupport && studentsNeedingSupport.length > 0 ? studentsNeedingSupport : defaultList;

  const handleAction = (id: string, actionName: string) => {
    setNotifiedSet((prev) => ({ ...prev, [id]: true }));
    alert(`Đã gửi ${actionName} tới học sinh!`);
  };

  return (
    <div className="bg-rose-50/80 border border-rose-200 rounded-3xl p-5 space-y-3 shadow-xs">
      <div className="flex items-center justify-between border-b border-rose-200/80 pb-2">
        <h3 className="text-xs font-extrabold text-rose-800 uppercase tracking-wide flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 text-rose-600" />
          Cần Hỗ Trợ Gấp ({list.length} Học Sinh)
        </h3>
        <span className="text-[10px] font-bold text-rose-600">
          Cảnh báo tự động
        </span>
      </div>

      <div className="space-y-2 text-xs">
        {list.map((st, idx) => {
          const isNotified = notifiedSet[st.id];

          return (
            <div
              key={st.id}
              className="bg-white p-3 rounded-2xl border border-rose-100 flex items-center justify-between gap-2 shadow-xs"
            >
              <div>
                <span className="font-extrabold text-slate-900 block">
                  {st.name}
                </span>
                <span className="text-[11px] text-rose-600 font-medium">
                  {st.reason}
                </span>
              </div>

              <button
                onClick={() => handleAction(st.id, idx === 0 ? "Nhắc nhở" : idx === 1 ? "Tin nhắn" : "Thông báo cuộc gọi")}
                disabled={isNotified}
                className={`px-3 py-1.5 font-extrabold rounded-xl text-[10px] shrink-0 transition flex items-center gap-1 ${
                  isNotified
                    ? "bg-slate-100 text-slate-400 border border-slate-200"
                    : "bg-rose-100 hover:bg-rose-200 text-rose-800"
                }`}
              >
                {idx === 0 ? (
                  <Send className="w-3 h-3 text-rose-800" />
                ) : idx === 1 ? (
                  <MessageSquare className="w-3 h-3 text-rose-800" />
                ) : (
                  <PhoneCall className="w-3 h-3 text-rose-800" />
                )}
                <span>{isNotified ? "Đã gửi" : idx === 0 ? "Nhắc nhở" : idx === 1 ? "Nhắn tin" : "Liên hệ PH"}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
