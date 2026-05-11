"use client";

import { useState, useEffect } from "react";
import { Lesson, Attachment } from "@prisma/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  updateLesson,
  createAttachment,
  deleteAttachment,
} from "@/actions/course";
import axios from "axios";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { toast } from "sonner";
import { Trash2, CheckCircle2, Upload, X, PlaySquare, Youtube, Link as LinkIcon } from "lucide-react";
import { LibrarySelect } from "./LibrarySelect";
import VideoPlayer from "@/components/player/VideoPlayer";

interface LessonEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lesson: Lesson & { attachments: Attachment[]; type: string };
  onSuccess: () => void;
}

const isYoutubeUrl = (url: string) => {
  return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)/.test(url);
};

export function LessonEditModal({
  open,
  onOpenChange,
  lesson,
  onSuccess,
}: LessonEditModalProps) {
  const [title, setTitle] = useState(lesson.title);
  const [type, setType] = useState<string>(lesson.type || "VIDEO");
  const [description, setDescription] = useState(lesson.description || "");
  const [videoUrl, setVideoUrl] = useState(lesson.videoUrl || "");
  const [attachments, setAttachments] = useState<Attachment[]>(
    lesson.attachments || [],
  );

  const [isSaving, setIsSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [attUploading, setAttUploading] = useState(false);
  
  const [showYoutubeInput, setShowYoutubeInput] = useState(false);
  const [youtubeInput, setYoutubeInput] = useState("");

  const [showPlayer, setShowPlayer] = useState(false);
  useEffect(() => {
    if (open) {
      console.log("[LessonEditModal] Opening modal for lesson:", lesson.id, "videoUrl:", videoUrl);
      const timer = setTimeout(() => {
        console.log("[LessonEditModal] Showing player now");
        setShowPlayer(true);
      }, 400);
      return () => clearTimeout(timer);
    } else {
      setShowPlayer(false);
    }
  }, [open, lesson.id, videoUrl]);

  // ─── Save ──────────────────────────────────
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await updateLesson(lesson.id, {
        title,
        description,
        videoUrl,
        type: type as any,
      });
      if (res.success) {
        toast.success("Đã lưu thay đổi");
        onSuccess();
        onOpenChange(false);
      } else {
        toast.error(res.error || "Lỗi khi lưu");
      }
    } catch (error) {
      console.error(error);
      toast.error("Lỗi hệ thống");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddYoutube = async () => {
    if (!youtubeInput) return;
    if (!isYoutubeUrl(youtubeInput)) {
      toast.error("Link YouTube không hợp lệ");
      return;
    }

    setIsSaving(true);
    try {
      const res = await updateLesson(lesson.id, { videoUrl: youtubeInput });
      if (res.success) {
        setVideoUrl(youtubeInput);
        setYoutubeInput("");
        setShowYoutubeInput(false);
        toast.success("Đã gắn link YouTube");
        onSuccess();
      } else {
        toast.error(res.error || "Lỗi khi gắn link");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveVideo = async () => {
    if (!confirm("Xóa video này?")) return;
    setIsSaving(true);
    try {
      const res = await updateLesson(lesson.id, { videoUrl: "" });
      if (res.success) {
        setVideoUrl("");
        toast.success("Đã xóa video");
        onSuccess();
      } else {
        toast.error(res.error || "Lỗi xóa video");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttUploading(true);
    try {
      const uploadRes = await axios.put<{ publicUrl: string }>(
        `/api/upload/proxy?fileName=${encodeURIComponent(file.name)}`,
        file,
        { headers: { "Content-Type": file.type || "application/octet-stream" } }
      );
      const { publicUrl } = uploadRes.data;
      const attachmentRes = await createAttachment({
        lessonId: lesson.id,
        url: publicUrl,
        name: file.name,
        type: file.type,
      });
      if (attachmentRes.success && attachmentRes.attachment) {
        setAttachments((prev) => [...prev, attachmentRes.attachment!]);
        toast.success("Đã thêm tài liệu");
      }
    } catch (error) {
      toast.error("Upload thất bại");
    } finally {
      setAttUploading(false);
      e.target.value = "";
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!confirm("Xóa tài liệu này?")) return;
    try {
      await deleteAttachment(attachmentId);
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
      toast.success("Đã xóa tài liệu");
    } catch {
      toast.error("Lỗi xóa tài liệu");
    }
  };

  const handleClose = () => {
    if (uploading || attUploading) {
      if (!confirm("File đang được tải lên. Bạn có chắc muốn đóng?")) return;
    }
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) handleClose();
        else onOpenChange(true);
      }}
    >
      <DialogContent
        className="max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden"
      >
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>Chỉnh sửa bài học</DialogTitle>
          <DialogDescription>{lesson.title}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="video" className="flex-1 flex flex-col min-h-0">
          <div className="px-6 py-2 border-b bg-gray-50 overflow-x-auto">
            <TabsList className="w-full justify-start gap-2 bg-transparent p-0 h-auto">
              <TabsTrigger value="video" className="data-[state=active]:bg-white data-[state=active]:text-red-600 rounded-md py-2 px-4">Nội dung chính</TabsTrigger>
              <TabsTrigger value="attachments" className="data-[state=active]:bg-white data-[state=active]:text-red-600 rounded-md py-2 px-4">Tài liệu đính kèm</TabsTrigger>
              <TabsTrigger value="quiz" className="data-[state=active]:bg-white data-[state=active]:text-red-600 rounded-md py-2 px-4">Bài tập Quiz</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="video" className="flex-1 p-6 overflow-y-auto space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-2">
                <Label>Tiêu đề bài học</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Loại bài học</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="rounded-xl font-bold border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VIDEO">🎥 Video bài giảng</SelectItem>
                    <SelectItem value="DOCUMENT">📄 Tài liệu / PDF</SelectItem>
                    <SelectItem value="QUIZ">📝 Bài tập Quiz</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {type === "VIDEO" && (
              <div className="space-y-4 animate-in fade-in duration-500">
                <Label>Video bài giảng</Label>

                {videoUrl ? (
                  <div className="border rounded-xl overflow-hidden bg-black relative shadow-2xl group">
                    <div className="w-full aspect-video flex items-center justify-center">
                       {showPlayer ? (
                         <VideoPlayer key={videoUrl} src={videoUrl} title={title} autoPlay={false} muted={true} />
                       ) : (
                         <div className="flex flex-col items-center gap-2">
                            <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                            <p className="text-white text-[10px] font-black uppercase">Khởi tạo...</p>
                         </div>
                       )}
                    </div>
                    {/* Hover Buttons Overlay - High Z-index */}
                    <div className="absolute top-3 right-3 flex gap-2 z-[70] opacity-0 group-hover:opacity-100 transition-opacity">
                      <LibrarySelect
                        onSelectVideo={(url) => {
                          setVideoUrl(url);
                          updateLesson(lesson.id, { videoUrl: url });
                          toast.success("Đã thay đổi video");
                          onSuccess();
                        }}
                        customTrigger={
                          <button className="bg-white/95 hover:bg-white text-gray-900 text-[10px] font-black px-3 py-2 rounded-lg shadow-xl uppercase tracking-wider">
                            Thư viện
                          </button>
                        }
                      />
                      <button 
                        onClick={() => setShowYoutubeInput(!showYoutubeInput)}
                        className="bg-white/95 hover:bg-white text-red-600 text-[10px] font-black px-3 py-2 rounded-lg shadow-xl uppercase tracking-wider"
                      >
                        YouTube
                      </button>
                      <button 
                        onClick={handleRemoveVideo}
                        className="bg-red-600 hover:bg-red-700 text-white text-[10px] font-black px-3 py-2 rounded-lg shadow-xl uppercase tracking-wider"
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center gap-6 bg-slate-50 text-center">
                    <div className="text-5xl">🎥</div>
                    <div>
                      <p className="font-black text-slate-900 uppercase">Chưa có video</p>
                      <p className="text-sm text-slate-500 mt-1">Chọn từ thư viện hoặc gắn link YouTube</p>
                    </div>
                    <div className="flex gap-4">
                        <LibrarySelect
                          onSelectVideo={(url) => {
                            setVideoUrl(url);
                            updateLesson(lesson.id, { videoUrl: url });
                            onSuccess();
                          }}
                          customTrigger={
                            <Button className="bg-red-600 hover:bg-red-700 font-black uppercase text-xs rounded-xl px-6 h-11">
                               Thư viện
                            </Button>
                          }
                        />
                        <Button 
                          onClick={() => setShowYoutubeInput(!showYoutubeInput)}
                          className="bg-slate-900 hover:bg-black font-black uppercase text-xs rounded-xl px-6 h-11"
                        >
                           YouTube
                        </Button>
                    </div>
                  </div>
                )}

                {/* Common YouTube Input Area */}
                {showYoutubeInput && (
                  <div className="p-6 bg-white border-2 border-red-100 rounded-[2rem] shadow-2xl space-y-4 animate-in slide-in-from-top-4 duration-500 relative z-[80]">
                    <div className="flex items-center gap-2 text-red-600">
                      <Youtube className="w-5 h-5" />
                      <span className="font-black uppercase tracking-tight">Nhập link YouTube mới</span>
                    </div>
                    <div className="flex gap-3">
                      <Input 
                        placeholder="Dán đường dẫn vào đây..." 
                        value={youtubeInput}
                        onChange={(e) => setYoutubeInput(e.target.value)}
                        className="h-12 bg-slate-50 border-slate-200 rounded-2xl font-bold"
                      />
                      <Button onClick={handleAddYoutube} disabled={isSaving || !youtubeInput} className="bg-red-600 hover:bg-red-700 h-12 px-8 font-black rounded-2xl uppercase">
                        Xác nhận
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Mô tả bài học</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[120px] rounded-2xl" placeholder="Nội dung bài học..." />
            </div>
          </TabsContent>

          <TabsContent value="attachments" className="flex-1 p-6 overflow-y-auto space-y-6">
            <Label className="text-lg font-black uppercase tracking-tight">Tài liệu học tập</Label>
            <div className="border-2 border-dashed rounded-2xl p-10 text-center space-y-4 bg-slate-50 relative group">
              {attUploading && <div className="absolute inset-0 bg-white/80 z-50 flex items-center justify-center rounded-2xl font-black text-red-600 animate-pulse">ĐANG TẢI LÊN...</div>}
              <div className="text-4xl">📎</div>
              <p className="font-black text-slate-900 uppercase">Tải lên tài liệu mới</p>
              <label className="cursor-pointer inline-block">
                <span className="bg-slate-900 hover:bg-red-600 text-white font-black uppercase text-[11px] px-8 py-3 rounded-2xl transition-all shadow-xl">Chọn File</span>
                <Input type="file" className="hidden" onChange={handleAttachmentUpload} disabled={attUploading} />
              </label>
            </div>
            <div className="space-y-3">
              {attachments.map((att) => (
                <div key={att.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-4 overflow-hidden">
                    <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center font-black text-xs">PDF</div>
                    <div className="overflow-hidden">
                      <a href={att.url} target="_blank" className="font-bold text-sm text-slate-900 hover:text-red-600 truncate block">{att.name}</a>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tài liệu đính kèm</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteAttachment(att.id)} className="text-slate-300 hover:text-red-600 transition-colors"><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="quiz" className="flex-1 p-12 text-center space-y-6 animate-in zoom-in-95 duration-500">
            <div className="text-6xl">📝</div>
            <div className="space-y-2">
               <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Bài tập & Quiz trực tuyến</h3>
               <p className="text-slate-500 max-w-sm mx-auto font-medium">Tạo đề thi từ PDF, thiết lập đáp án và chấm điểm tự động.</p>
            </div>
            <Button 
              onClick={async () => {
                if (lesson.type !== "QUIZ") await updateLesson(lesson.id, { type: "QUIZ" });
                window.location.href = `/teacher/tests/${lesson.id}`;
              }}
              className="bg-slate-900 hover:bg-red-600 h-14 px-10 font-black uppercase text-xs tracking-widest rounded-2xl shadow-2xl transition-all"
            >
              Mở Trình tạo Bài tập
            </Button>
          </TabsContent>
        </Tabs>

        <div className="p-6 border-t bg-slate-50 flex justify-end gap-3">
          <Button variant="ghost" onClick={handleClose} className="font-bold uppercase text-xs">Hủy bỏ</Button>
          <Button onClick={handleSave} disabled={isSaving || uploading || attUploading} className="bg-red-600 hover:bg-red-700 font-black uppercase text-xs px-8 h-11 rounded-xl shadow-xl shadow-red-200">
            {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
