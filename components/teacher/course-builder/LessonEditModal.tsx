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
  updateLesson,
  createAttachment,
  deleteAttachment,
} from "@/actions/course";
import axios from "axios";
import { toast } from "sonner";
import { Trash2, Upload, X, Youtube, FileText, ClipboardList, Video } from "lucide-react";
import { cn } from "@/lib/utils";

const LESSON_TYPES = [
  {
    value: "VIDEO",
    label: "Video bài giảng",
    icon: Video,
    hint: "Học sinh xem video bài giảng. Bài tập kèm theo (nếu có) nằm ở mục bài tập của bài học.",
  },
  {
    value: "DOCUMENT",
    label: "Tài liệu / PDF",
    icon: FileText,
    hint: "Hiển thị file PDF đính kèm đầu tiên (khi bài học không có video).",
  },
  {
    value: "QUIZ",
    label: "Bài tập Quiz",
    icon: ClipboardList,
    hint: "Hiển thị thẻ vào làm bài (khi bài học không có video).",
  },
] as const;
import { LibrarySelect } from "./LibrarySelect";
import VideoPlayer from "@/components/player/VideoPlayer";

import { Switch } from "@/components/ui/switch";

interface LessonEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lesson: Lesson & { attachments: Attachment[] };
  /** `updated`: các trường vừa lưu, để danh sách bài học cập nhật ngay (không chờ tải lại) */
  onSuccess: (updated?: Partial<Lesson & { attachments: Attachment[] }>) => void;
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
  const [homeworkVideoUrl, setHomeworkVideoUrl] = useState(lesson.homeworkVideoUrl || "");
  const [hasHomework, setHasHomework] = useState(lesson.hasHomework || false);
  const [attachments, setAttachments] = useState<Attachment[]>(
    lesson.attachments || [],
  );

  const [isSaving, setIsSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [attUploading, setAttUploading] = useState(false);
  
  const [showYoutubeInput, setShowYoutubeInput] = useState(false);
  const [youtubeInput, setYoutubeInput] = useState("");

  const [showHWYoutubeInput, setShowHWYoutubeInput] = useState(false);
  const [hwYoutubeInput, setHwYoutubeInput] = useState("");

  const [showPlayer, setShowPlayer] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(lesson.title);
      setType(lesson.type || "VIDEO");
      setDescription(lesson.description || "");
      setVideoUrl(lesson.videoUrl || "");
      setHomeworkVideoUrl(lesson.homeworkVideoUrl || "");
      setHasHomework(lesson.hasHomework || false);
      setAttachments(lesson.attachments || []);
      setYoutubeInput("");
      setHwYoutubeInput("");
      setShowYoutubeInput(false);
      setShowHWYoutubeInput(false);
    }
  }, [open, lesson.id, lesson.title, lesson.type, lesson.description, lesson.videoUrl, lesson.homeworkVideoUrl, lesson.attachments, lesson.hasHomework]);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        setShowPlayer(true);
      }, 400);
      return () => clearTimeout(timer);
    } else {
      setShowPlayer(false);
    }
  }, [open, lesson.id, videoUrl, homeworkVideoUrl]);

  // ─── Thay đổi chưa lưu ─────────────────────
  // Mọi trường trong form (kể cả video) chỉ lưu khi bấm "Lưu thay đổi" → một cách lưu thống nhất,
  // không còn trường hợp lưu được video nhưng mất loại bài/tiêu đề khi đóng cửa sổ.
  const isDirty =
    title !== lesson.title ||
    type !== (lesson.type || "VIDEO") ||
    description !== (lesson.description || "") ||
    videoUrl !== (lesson.videoUrl || "") ||
    homeworkVideoUrl !== (lesson.homeworkVideoUrl || "") ||
    hasHomework !== (lesson.hasHomework || false);

  // ─── Save ──────────────────────────────────
  const saveChanges = async () => {
    const data = {
      title,
      description,
      videoUrl,
      homeworkVideoUrl,
      type: type as Lesson["type"],
      hasHomework,
    };
    const res = await updateLesson(lesson.id, data);
    if (!res.success) {
      toast.error(res.error || "Lỗi khi lưu");
      return false;
    }
    onSuccess(data);
    return true;
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (await saveChanges()) {
        toast.success("Đã lưu thay đổi");
        onOpenChange(false);
      }
    } catch (error) {
      console.error(error);
      toast.error("Lỗi hệ thống");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddYoutube = () => {
    if (!youtubeInput) return;
    if (!isYoutubeUrl(youtubeInput)) {
      toast.error("Link YouTube không hợp lệ");
      return;
    }
    setVideoUrl(youtubeInput);
    setYoutubeInput("");
    setShowYoutubeInput(false);
  };

  const handleAddHWYoutube = () => {
    if (!hwYoutubeInput) return;
    if (!isYoutubeUrl(hwYoutubeInput)) {
      toast.error("Link YouTube không hợp lệ");
      return;
    }
    setHomeworkVideoUrl(hwYoutubeInput);
    setHwYoutubeInput("");
    setShowHWYoutubeInput(false);
  };

  const handleRemoveVideo = () => {
    if (!confirm("Gỡ video này khỏi bài học? (Áp dụng khi bấm Lưu thay đổi)")) return;
    setVideoUrl("");
  };

  const handleRemoveHWVideo = () => {
    if (!confirm("Gỡ video hướng dẫn này? (Áp dụng khi bấm Lưu thay đổi)")) return;
    setHomeworkVideoUrl("");
  };

  /** Mở trình tạo bài tập: lưu thay đổi đang dở trước, rồi mới chuyển trang */
  const handleOpenTestBuilder = async () => {
    setIsSaving(true);
    try {
      if (isDirty && !(await saveChanges())) return;
      // Chỉ chuyển sang loại "Bài tập Quiz" khi bài học còn trống. Bài video/tài liệu có kèm
      // bài tập giữ nguyên loại — học sinh vẫn vào làm bài qua mục bài tập của bài học.
      const isEmptyLesson = !videoUrl && type !== "DOCUMENT";
      if (type !== "QUIZ" && isEmptyLesson) {
        await updateLesson(lesson.id, { type: "QUIZ" });
      }
      window.location.href = `/teacher/tests/${lesson.id}`;
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
        const next = [...attachments, attachmentRes.attachment];
        setAttachments(next);
        onSuccess({ attachments: next });
        toast.success("Đã thêm tài liệu");
      } else {
        toast.error(("error" in attachmentRes && attachmentRes.error) || "Không thể thêm tài liệu");
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
      const res = await deleteAttachment(attachmentId);
      if (res && "success" in res && !res.success) {
        toast.error(("error" in res && res.error) || "Lỗi xóa tài liệu");
        return;
      }
      const next = attachments.filter((a) => a.id !== attachmentId);
      setAttachments(next);
      onSuccess({ attachments: next });
      toast.success("Đã xóa tài liệu");
    } catch {
      toast.error("Lỗi xóa tài liệu");
    }
  };

  const handleClose = () => {
    if (uploading || attUploading) {
      if (!confirm("File đang được tải lên. Bạn có chắc muốn đóng?")) return;
    }
    if (isDirty && !confirm("Bạn có thay đổi chưa lưu. Đóng và bỏ các thay đổi này?")) return;
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
        className="max-w-4xl sm:max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden"
      >
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>Chỉnh sửa bài học</DialogTitle>
          <DialogDescription>{lesson.title}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="video" className="flex-1 flex flex-col min-h-0">
          <div className="px-3 sm:px-6 py-2 border-b bg-gray-50">
            {/* Điện thoại: 4 tab chia đều với nhãn ngắn; màn rộng: nhãn đầy đủ */}
            <TabsList className="grid w-full grid-cols-4 gap-1 sm:flex sm:justify-start sm:gap-2 bg-transparent p-0 h-auto">
              <TabsTrigger value="video" className="data-[state=active]:bg-white data-[state=active]:text-blue-600 rounded-md py-2 px-2 sm:px-4 text-xs sm:text-sm">
                <span className="sm:hidden">Nội dung</span>
                <span className="hidden sm:inline">Nội dung chính</span>
              </TabsTrigger>
              <TabsTrigger value="homework-video" className="data-[state=active]:bg-white data-[state=active]:text-blue-600 rounded-md py-2 px-2 sm:px-4 text-xs sm:text-sm">
                <span className="sm:hidden">Thực chiến</span>
                <span className="hidden sm:inline">Video thực chiến</span>
              </TabsTrigger>
              <TabsTrigger value="attachments" className="data-[state=active]:bg-white data-[state=active]:text-blue-600 rounded-md py-2 px-2 sm:px-4 text-xs sm:text-sm">
                <span className="sm:hidden">Tài liệu</span>
                <span className="hidden sm:inline">Tài liệu đính kèm</span>
              </TabsTrigger>
              <TabsTrigger value="quiz" className="data-[state=active]:bg-white data-[state=active]:text-blue-600 rounded-md py-2 px-2 sm:px-4 text-xs sm:text-sm">
                <span className="sm:hidden">Bài tập</span>
                <span className="hidden sm:inline">Bài tập Quiz</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="video" className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-6">
            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-2">
                <Label>Tiêu đề bài học</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Loại bài học</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Loại bài học">
                {LESSON_TYPES.map((t) => {
                  const Icon = t.icon;
                  const active = type === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setType(t.value)}
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-bold transition-colors",
                        active
                          ? "border-blue-600 bg-blue-50 text-blue-700"
                          : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{t.label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500">{LESSON_TYPES.find((t) => t.value === type)?.hint}</p>
            </div>

            <div className="flex items-center justify-between p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
               <div className="space-y-0.5">
                  <Label className="text-sm font-black text-slate-800 uppercase tracking-tight">Yêu cầu nộp bài tập</Label>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Học sinh phải nộp ảnh hoặc file PDF kết quả bài làm</p>
               </div>
               <Switch 
                 checked={hasHomework}
                 onCheckedChange={setHasHomework}
               />
            </div>

            {(
              <div className="space-y-4">
                <Label>
                  Video bài giảng
                  {type !== "VIDEO" && <span className="ml-2 text-xs font-normal text-slate-400">(không bắt buộc)</span>}
                </Label>

                {videoUrl ? (
                  <div className="border rounded-xl overflow-hidden bg-black relative shadow-2xl group">
                    <div className="w-full aspect-video flex items-center justify-center">
                       {showPlayer ? (
                         <VideoPlayer key={videoUrl} src={videoUrl} title={title} autoPlay={false} muted={true} />
                       ) : (
                         <div className="flex flex-col items-center gap-2">
                            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                            <p className="text-white text-[10px] font-black uppercase">Khởi tạo...</p>
                         </div>
                       )}
                    </div>
                    {/* Hover Buttons Overlay - High Z-index */}
                    <div className="absolute top-3 right-3 flex gap-2 z-[70] opacity-0 group-hover:opacity-100 transition-opacity">
                      <LibrarySelect
                        onSelectVideo={(url) => setVideoUrl(url)}
                        customTrigger={
                          <button className="bg-white/95 hover:bg-white text-gray-900 text-[10px] font-black px-3 py-2 rounded-lg shadow-xl uppercase tracking-wider">
                            Thư viện
                          </button>
                        }
                      />
                      <button 
                        onClick={() => setShowYoutubeInput(!showYoutubeInput)}
                        className="bg-white/95 hover:bg-white text-blue-600 text-[10px] font-black px-3 py-2 rounded-lg shadow-xl uppercase tracking-wider"
                      >
                        YouTube
                      </button>
                      <button 
                        onClick={handleRemoveVideo}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black px-3 py-2 rounded-lg shadow-xl uppercase tracking-wider"
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
                          onSelectVideo={(url) => setVideoUrl(url)}
                          customTrigger={
                            <Button className="bg-blue-600 hover:bg-blue-700 font-black uppercase text-xs rounded-xl px-6 h-11">
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
                  <div className="p-6 bg-white border-2 border-blue-100 rounded-[2rem] shadow-2xl space-y-4 animate-in slide-in-from-top-4 duration-500 relative z-[80]">
                    <div className="flex items-center gap-2 text-blue-600">
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
                      <Button onClick={handleAddYoutube} disabled={isSaving || !youtubeInput} className="bg-blue-600 hover:bg-blue-700 h-12 px-8 font-black rounded-2xl uppercase">
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

          <TabsContent value="homework-video" className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-6">
            <div className="space-y-4 animate-in fade-in duration-500">
              <Label className="text-lg font-black uppercase tracking-tight">Video hướng dẫn thực chiến</Label>
              <p className="text-sm text-slate-500">Video này sẽ xuất hiện ở phần &quot;Thực chiến bài tập về nhà&quot; của bài học.</p>

              {homeworkVideoUrl ? (
                <div className="border rounded-xl overflow-hidden bg-black relative shadow-2xl group">
                  <div className="w-full aspect-video flex items-center justify-center">
                      {showPlayer ? (
                        <VideoPlayer key={homeworkVideoUrl} src={homeworkVideoUrl} title={`Hướng dẫn: ${title}`} autoPlay={false} muted={true} />
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                          <p className="text-white text-[10px] font-black uppercase">Khởi tạo...</p>
                        </div>
                      )}
                  </div>
                  <div className="absolute top-3 right-3 flex gap-2 z-[70] opacity-0 group-hover:opacity-100 transition-opacity">
                    <LibrarySelect
                      onSelectVideo={(url) => setHomeworkVideoUrl(url)}
                      customTrigger={
                        <button className="bg-white/95 hover:bg-white text-gray-900 text-[10px] font-black px-3 py-2 rounded-lg shadow-xl uppercase tracking-wider">
                          Thư viện
                        </button>
                      }
                    />
                    <button 
                      onClick={() => setShowHWYoutubeInput(!showHWYoutubeInput)}
                      className="bg-white/95 hover:bg-white text-blue-600 text-[10px] font-black px-3 py-2 rounded-lg shadow-xl uppercase tracking-wider"
                    >
                      YouTube
                    </button>
                    <button 
                      onClick={handleRemoveHWVideo}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black px-3 py-2 rounded-lg shadow-xl uppercase tracking-wider"
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center gap-6 bg-slate-50 text-center">
                  <div className="text-5xl">🎯</div>
                  <div>
                    <p className="font-black text-slate-900 uppercase">Chưa có video hướng dẫn</p>
                    <p className="text-sm text-slate-500 mt-1">Chọn từ thư viện hoặc gắn link YouTube cho phần thực chiến</p>
                  </div>
                  <div className="flex gap-4">
                      <LibrarySelect
                        onSelectVideo={(url) => setHomeworkVideoUrl(url)}
                        customTrigger={
                          <Button className="bg-blue-600 hover:bg-blue-700 font-black uppercase text-xs rounded-xl px-6 h-11">
                              Thư viện
                          </Button>
                        }
                      />
                      <Button 
                        onClick={() => setShowHWYoutubeInput(!showHWYoutubeInput)}
                        className="bg-slate-900 hover:bg-black font-black uppercase text-xs rounded-xl px-6 h-11"
                      >
                          YouTube
                      </Button>
                  </div>
                </div>
              )}

              {showHWYoutubeInput && (
                <div className="p-6 bg-white border-2 border-blue-100 rounded-[2rem] shadow-2xl space-y-4 animate-in slide-in-from-top-4 duration-500 relative z-[80]">
                  <div className="flex items-center gap-2 text-blue-600">
                    <Youtube className="w-5 h-5" />
                    <span className="font-black uppercase tracking-tight">Nhập link YouTube hướng dẫn</span>
                  </div>
                  <div className="flex gap-3">
                    <Input 
                      placeholder="Dán đường dẫn vào đây..." 
                      value={hwYoutubeInput}
                      onChange={(e) => setHwYoutubeInput(e.target.value)}
                      className="h-12 bg-slate-50 border-slate-200 rounded-2xl font-bold"
                    />
                    <Button onClick={handleAddHWYoutube} disabled={isSaving || !hwYoutubeInput} className="bg-blue-600 hover:bg-blue-700 h-12 px-8 font-black rounded-2xl uppercase">
                      Xác nhận
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="attachments" className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-6">
            <Label className="text-lg font-black uppercase tracking-tight">Tài liệu học tập</Label>
            <div className="border-2 border-dashed rounded-2xl p-10 text-center space-y-4 bg-slate-50 relative group">
              {attUploading && <div className="absolute inset-0 bg-white/80 z-50 flex items-center justify-center rounded-2xl font-black text-blue-600 animate-pulse">ĐANG TẢI LÊN...</div>}
              <div className="text-4xl">📎</div>
              <p className="font-black text-slate-900 uppercase">Tải lên tài liệu mới</p>
              <label className="cursor-pointer inline-block">
                <span className="bg-slate-900 hover:bg-blue-600 text-white font-black uppercase text-[11px] px-8 py-3 rounded-2xl transition-all shadow-xl">Chọn File</span>
                <Input type="file" className="hidden" onChange={handleAttachmentUpload} disabled={attUploading} />
              </label>
            </div>
            <div className="space-y-3">
              {attachments.map((att) => (
                <div key={att.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-4 overflow-hidden">
                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-black text-xs">PDF</div>
                    <div className="overflow-hidden">
                      <a href={att.url} target="_blank" className="font-bold text-sm text-slate-900 hover:text-blue-600 truncate block">{att.name}</a>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tài liệu đính kèm</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteAttachment(att.id)} className="text-slate-300 hover:text-blue-600 transition-colors"><Trash2 className="h-4 w-4" /></Button>
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
              onClick={handleOpenTestBuilder}
              disabled={isSaving}
              className="bg-slate-900 hover:bg-blue-600 h-14 px-10 font-black uppercase text-xs tracking-widest rounded-2xl shadow-2xl transition-all"
            >
              {isDirty ? "Lưu & mở Trình tạo Bài tập" : "Mở Trình tạo Bài tập"}
            </Button>
          </TabsContent>
        </Tabs>

        <div className="p-6 border-t bg-slate-50 flex items-center justify-end gap-3">
          {isDirty && (
            <span className="mr-auto rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
              Có thay đổi chưa lưu
            </span>
          )}
          <Button variant="ghost" onClick={handleClose} className="font-bold uppercase text-xs">Hủy bỏ</Button>
          <Button onClick={handleSave} disabled={isSaving || uploading || attUploading || !isDirty} className="bg-blue-600 hover:bg-blue-700 font-black uppercase text-xs px-8 h-11 rounded-xl shadow-xl shadow-blue-200">
            {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
