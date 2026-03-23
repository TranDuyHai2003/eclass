"use client";

import { useState } from "react";
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
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { toast } from "sonner";
import { Trash2, CheckCircle2, Upload, X, PlaySquare } from "lucide-react";
import { LibrarySelect } from "./LibrarySelect";

interface LessonEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lesson: Lesson & { attachments: Attachment[] };
  onSuccess: () => void;
}

export function LessonEditModal({
  open,
  onOpenChange,
  lesson,
  onSuccess,
}: LessonEditModalProps) {
  const [title, setTitle] = useState(lesson.title);
  const [description, setDescription] = useState(lesson.description || "");
  const [videoUrl, setVideoUrl] = useState(lesson.videoUrl || "");
  const [attachments, setAttachments] = useState<Attachment[]>(
    lesson.attachments || [],
  );

  const [isSaving, setIsSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [attUploading, setAttUploading] = useState(false);

  // ─── Save title / description / videoUrl ──────────────────────────────────
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await updateLesson(lesson.id, { title, description, videoUrl });
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

  // ─── Video Upload — dùng proxy để tránh CORS với BunnyCDN/S3 ───────────
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = ""; // reset để chọn lại cùng file
    setUploading(true);
    setUploadProgress(0);

    try {
      // Step 1: Request Presigned URL from Next.js Server
      const presignRes = await axios.post<{ presignedUrl: string; publicUrl: string; fileName: string }>(
        "/api/upload/presign",
        {
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
        }
      );

      const { presignedUrl, publicUrl } = presignRes.data;

      // Step 2: Upload directly to S3 bypassing Next.js server entirely
      await axios.put(presignedUrl, file, {
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
        onUploadProgress: (progressEvent) => {
          const pct = Math.round(
            ((progressEvent.loaded ?? 0) * 100) /
              (progressEvent.total ?? file.size),
          );
          setUploadProgress(pct);
        },
      });

      // Auto-save videoUrl vào DB ngay sau khi upload xong
      const saveRes = await updateLesson(lesson.id, { videoUrl: publicUrl });
      if (saveRes.success) {
        setVideoUrl(publicUrl);
        toast.success("Upload video thành công và đã lưu");
        onSuccess();
      } else {
        toast.error("Upload xong nhưng lưu DB thất bại: " + saveRes.error);
      }
    } catch (error) {
      console.error("Video upload error:", error);
      toast.error("Lỗi upload video");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // ─── Xóa video ───────────────────────────────────────────────────────────
  const handleRemoveVideo = async () => {
    if (!confirm("Xóa video này? Hành động này không thể hoàn tác.")) return;
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

  // ─── Attachment Upload ────────────────────────────────────────────────────
  const handleAttachmentUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAttUploading(true);
    try {
      // Step 1: Request Presigned URL
      const presignRes = await axios.post<{ presignedUrl: string; publicUrl: string; fileName: string }>(
        "/api/upload/presign",
        {
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
        }
      );

      const { presignedUrl, publicUrl } = presignRes.data;

      // Step 2: Upload directly to S3
      await axios.put(presignedUrl, file, {
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        }
      });

      const res = await createAttachment({
        lessonId: lesson.id,
        url: publicUrl,
        name: file.name,
        type: file.type,
      });

      if (res.success && res.attachment) {
        setAttachments((prev) => [...prev, res.attachment!]);
        toast.success("Đã thêm tài liệu");
      } else {
        toast.error("Lỗi lưu tài liệu");
      }
    } catch (error) {
      console.error("Upload failed", error);
      toast.error("Upload thất bại");
    } finally {
      setAttUploading(false);
      e.target.value = "";
    }
  };

  // ─── Xóa attachment ──────────────────────────────────────────────────────
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

  // ─── Close guard ─────────────────────────────────────────────────────────
  const handleClose = () => {
    if (uploading || attUploading) {
      if (!confirm("File đang được tải lên. Nếu đóng, quá trình sẽ bị hủy. Bạn có chắc không?"))
        return;
    }
    if (
      title !== lesson.title ||
      description !== (lesson.description || "") ||
      videoUrl !== (lesson.videoUrl || "")
    ) {
      if (!confirm("Bạn có thay đổi chưa lưu. Bạn có chắc muốn đóng không?"))
        return;
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
        onInteractOutside={(e) => {
          if (uploading || attUploading) e.preventDefault();
        }}
      >
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>Chỉnh sửa bài học</DialogTitle>
          <DialogDescription>{lesson.title}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="video" className="flex-1 flex flex-col min-h-0">
          <div className="px-6 py-2 border-b bg-gray-50 overflow-x-auto">
            <TabsList className="w-full justify-start gap-2 bg-transparent p-0 h-auto">
              <TabsTrigger
                value="video"
                className="data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-red-600 border border-transparent data-[state=active]:border-gray-200 rounded-md py-2 px-4"
              >
                Video bài giảng
              </TabsTrigger>
              <TabsTrigger
                value="attachments"
                className="data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-red-600 border border-transparent data-[state=active]:border-gray-200 rounded-md py-2 px-4"
              >
                Tài liệu đính kèm
              </TabsTrigger>
              <TabsTrigger
                value="quiz"
                className="data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-red-600 border border-transparent data-[state=active]:border-gray-200 rounded-md py-2 px-4"
              >
                Bài tập Quiz
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ── TAB: VIDEO ──────────────────────────────────────── */}
          <TabsContent value="video" className="flex-1 p-6 overflow-y-auto space-y-6">
            {/* Tiêu đề */}
            <div className="space-y-2">
              <Label>Tiêu đề bài học</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            {/* Video Upload Area */}
            <div className="space-y-2">
              <Label>Video bài giảng</Label>

              {videoUrl ? (
                /* ── Đã có video ── */
                <div className="border rounded-lg overflow-hidden bg-black relative group">
                  <video src={videoUrl} controls autoPlay muted className="w-full aspect-video" />

                  {/* Hover controls */}
                  <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <LibrarySelect 
                      onSelectVideo={(url) => {
                        setVideoUrl(url);
                        updateLesson(lesson.id, { videoUrl: url });
                        toast.success("Thay video thành công!");
                        onSuccess();
                      }}
                      customTrigger={
                        <button disabled={isSaving} className="inline-flex cursor-pointer items-center gap-1 bg-white/90 hover:bg-white text-gray-700 text-xs font-medium px-3 py-1.5 rounded-md shadow transition disabled:opacity-50">
                          <PlaySquare className="w-3.5 h-3.5" />
                          Chọn từ Thư viện
                        </button>
                      }
                    />
                    <button
                      onClick={handleRemoveVideo}
                      disabled={isSaving}
                      className="inline-flex items-center gap-1 bg-red-500/90 hover:bg-red-600 text-white text-xs font-medium px-3 py-1.5 rounded-md shadow transition disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" />
                      Xóa
                    </button>
                  </div>

                  {/* URL bar */}
                  <div className="px-3 py-2 bg-gray-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <span className="text-xs text-gray-300 truncate">{videoUrl}</span>
                  </div>
                </div>
              ) : (
                /* ── Chưa có video ── */
                <div className="border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center gap-4 bg-gray-50 text-center">
                  <div className="text-4xl text-gray-300">🎥</div>
                  <div>
                    <p className="font-medium text-gray-700">Tải lên video bài giảng</p>
                    <p className="text-sm text-gray-400 mt-1">MP4, MOV, AVI, MKV...</p>
                  </div>

                  {uploading ? (
                    /* Progress */
                    <div className="w-full max-w-xs space-y-2">
                      <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="bg-red-600 h-2.5 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="text-sm text-red-600 font-medium">
                        Đang tải lên... {uploadProgress}%
                      </p>
                      <p className="text-xs text-gray-400">Vui lòng không đóng cửa sổ này</p>
                    </div>
                  ) : (
                    <LibrarySelect 
                      onSelectVideo={(url) => {
                        setVideoUrl(url);
                        updateLesson(lesson.id, { videoUrl: url });
                        toast.success("Thêm video thành công!");
                        onSuccess();
                      }}
                      customTrigger={
                        <button className="cursor-pointer inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition shadow">
                          <PlaySquare className="w-4 h-4" />
                          Chọn từ Thư viện
                        </button>
                      }
                    />
                  )}
                </div>
              )}
            </div>

            {/* Mô tả */}
            <div className="space-y-2">
              <Label>Mô tả ngắn</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[100px]"
                placeholder="Mô tả tóm tắt nội dung bài học..."
              />
            </div>

            {/* Rich Text placeholder */}
            <div className="space-y-2">
              <Label>Nội dung chi tiết (Văn bản)</Label>
              <div className="border rounded-md p-2 bg-gray-50 min-h-[150px] text-gray-400 flex items-center justify-center text-sm">
                Rich Text Editor (Coming Soon)
              </div>
            </div>
          </TabsContent>

          {/* ── TAB: ATTACHMENTS ────────────────────────────────── */}
          <TabsContent value="attachments" className="flex-1 p-6 overflow-y-auto">
            <div className="space-y-6">
              <Label className="text-base font-semibold">Tài liệu học tập</Label>

              <div className="border border-dashed rounded-lg p-8 text-center space-y-4 bg-gray-50 relative">
                {attUploading && (
                  <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center rounded-lg">
                    <span className="text-blue-600 font-medium animate-pulse">Đang tải lên...</span>
                  </div>
                )}
                <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl">📎</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Tải lên tài liệu</p>
                  <p className="text-sm text-gray-500 mt-1">PDF, DOCX, XLSX, Images...</p>
                </div>
                <label className="cursor-pointer">
                  <span className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition shadow">
                    <Upload className="w-4 h-4" />
                    Chọn tài liệu
                  </span>
                  <Input
                    type="file"
                    className="hidden"
                    onChange={handleAttachmentUpload}
                    disabled={attUploading}
                  />
                </label>
              </div>

              <div className="space-y-2">
                {attachments.length === 0 ? (
                  <div className="text-sm text-gray-500 italic text-center py-4">
                    Chưa có tài liệu nào được đính kèm.
                  </div>
                ) : (
                  attachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center justify-between p-3 bg-white border rounded-lg shadow-sm"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-8 h-8 flex-shrink-0 bg-blue-100 text-blue-600 rounded flex items-center justify-center">
                          📄
                        </div>
                        <div className="flex flex-col overflow-hidden">
                          <a
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-sm text-blue-600 hover:underline truncate"
                          >
                            {att.name}
                          </a>
                          <span className="text-xs text-gray-400">Đính kèm</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteAttachment(att.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          {/* ── TAB: QUIZ ────────────────────────────────────────── */}
          <TabsContent value="quiz" className="flex-1 p-6 overflow-y-auto">
            <div className="text-center py-10 space-y-4">
              <div className="text-4xl">📝</div>
              <h3 className="font-medium text-gray-900">Bài tập Quiz</h3>
              <p className="text-gray-500 max-w-sm mx-auto">
                Tính năng tạo câu hỏi trắc nghiệm sẽ sớm được cập nhật.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose}>
            Hủy
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || uploading || attUploading}
          >
            {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
