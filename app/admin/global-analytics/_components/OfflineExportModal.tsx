"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export function OfflineExportModal() {
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [level, setLevel] = useState("ALL");
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!startDate || !endDate) {
      toast.error("Vui lòng chọn đầy đủ ngày bắt đầu và kết thúc");
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      toast.error("Ngày bắt đầu không thể sau ngày kết thúc");
      return;
    }

    setIsExporting(true);

    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        level,
      });

      const response = await fetch(`/api/admin/export-offline?${params.toString()}`, {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error("Lỗi khi tạo báo cáo");
      }

      // Download file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Offline_Report_${format(new Date(), "yyyyMMdd")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Tải báo cáo thành công!");
      setOpen(false);
    } catch (error) {
      toast.error("Có lỗi xảy ra khi xuất báo cáo");
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="rounded-xl h-10 px-4 text-[9px] font-black uppercase tracking-widest gap-2 bg-white hover:bg-slate-50 border-slate-200 text-slate-600 transition-all shadow-sm"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          Báo cáo Offline
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] rounded-[32px] p-8 border-slate-100 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase tracking-tight text-slate-900 flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            </div>
            Xuất Báo Cáo Offline
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 py-6">
          <div className="space-y-2">
            <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Từ ngày</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-12 rounded-2xl border-slate-200 font-bold focus:border-emerald-500"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Đến ngày</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-12 rounded-2xl border-slate-200 font-bold focus:border-emerald-500"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Lớp học</Label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger className="h-12 rounded-2xl border-slate-200 font-bold">
                <SelectValue placeholder="Chọn lớp" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="ALL" className="font-bold">Tất cả lớp Offline</SelectItem>
                <SelectItem value="ADVANCED" className="font-bold">Lớp Nâng cao (12A)</SelectItem>
                <SelectItem value="BASIC" className="font-bold">Lớp Cơ bản (12B)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          onClick={handleExport}
          disabled={isExporting}
          className="w-full h-12 rounded-2xl font-black text-sm uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-lg shadow-emerald-200"
        >
          {isExporting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Download className="w-5 h-5 mr-2" />
              Tải Xuống Excel
            </>
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
