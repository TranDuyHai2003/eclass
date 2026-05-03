"use client";

import { useState, useCallback, useRef } from "react";
import axios from "axios";
import Cropper from "react-easy-crop";
import { Pencil, Upload, ImageIcon, Trash, Trophy } from "lucide-react";
import Link from "next/link";

import { CourseWithRelations } from "./types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmModal } from "@/components/modals/ConfirmModal";

// --- HELPER: Xử lý cắt ảnh bằng Canvas chất lượng cao ---
const getCroppedImg = async (
  imageSrc: string,
  pixelCrop: any,
): Promise<File> => {
  const image = new Image();
  image.src = imageSrc;
  image.crossOrigin = "anonymous";
  await new Promise((resolve) => (image.onload = resolve));

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) throw new Error("No 2d context");

  // Đảm bảo chất lượng ảnh cao nhất khi vẽ lại
  ctx.imageSmoothingQuality = "high";

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error("Canvas is empty"));
        // Xuất ra file JPEG chất lượng 1.0 (max)
        const file = new File([blob], "thumbnail.jpg", { type: "image/jpeg" });
        resolve(file);
      },
      "image/jpeg",
      1.0,
    );
  });
};

interface CourseUpdateData {
  title?: string;
  description?: string;
  isStructured?: boolean;
  thumbnail?: string;
  examDate?: Date | null;
}

interface CourseHeaderProps {
  course: CourseWithRelations;
  isLoading: boolean;
  onUpdate: (data: CourseUpdateData) => void;
  onDelete: () => Promise<void>;
}

export const CourseHeader = ({
  course,
  isLoading,
  onUpdate,
  onDelete,
}: CourseHeaderProps) => {
  // --- States quản lý dữ liệu ---
  const [title, setTitle] = useState(course.title || "");
  const [description, setDescription] = useState(course.description || "");
  const [examDate, setExamDate] = useState(
    course.examDate ? new Date(course.examDate).toISOString().slice(0, 16) : "",
  );

  // --- States quản lý UI ---
  const [isDeleting, setIsDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  // --- States Crop ảnh ---
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);

  // --- Refs ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // --- HANDLERS: Xóa khóa học ---
  const onConfirmDelete = async () => {
    setIsDeleting(true);
    await onDelete();
  };

  // --- HANDLERS: Sửa tiêu đề ---
  const enableEditing = () => {
    setIsEditingTitle(true);
    // setTimeout để đảm bảo Input render xong mới focus được
    setTimeout(() => {
      titleInputRef.current?.focus();
    }, 0);
  };

  const disableEditing = () => {
    setIsEditingTitle(false);
    if (title !== course.title) {
      onUpdate({ title });
    }
  };

  const onTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      disableEditing();
    }
  };

  // --- HANDLERS: Sửa mô tả/cấu trúc ---
  const handleDescriptionBlur = () => {
    if (description !== course.description) {
      onUpdate({ description });
    }
  };

  const handleStructureChange = (value: string) => {
    onUpdate({ isStructured: value === "hierarchical" });
  };

  const handleExamDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setExamDate(value);
    onUpdate({ examDate: value ? new Date(value) : null });
  };

  // --- HANDLERS: Upload & Crop ảnh ---
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.readAsDataURL(e.target.files[0]);
      reader.onload = () => {
        setImageToCrop(reader.result as string);
        setIsCropModalOpen(true);
      };
    }
  };

  const onCropComplete = useCallback((_: any, pixels: any) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleUploadFinal = async () => {
    if (!imageToCrop || !croppedAreaPixels) return;

    setUploading(true);
    try {
      const croppedFile = await getCroppedImg(imageToCrop, croppedAreaPixels);

      const res = await axios.put<{ publicUrl: string }>(
        `/api/upload/proxy?fileName=${encodeURIComponent(croppedFile.name)}`,
        croppedFile,
        {
          headers: {
            "Content-Type": croppedFile.type || "image/jpeg",
          },
        },
      );
      const { publicUrl } = res.data;

      onUpdate({ thumbnail: publicUrl });
      setIsCropModalOpen(false);
      setImageToCrop(null);
    } catch (err) {
      console.error("Upload thumbnail error:", err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl border shadow-sm space-y-6 relative">
      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link href={`/teacher/courses/${course.id}/final-test`}>
          <Button
            variant="outline"
            size="sm"
            className="border-yellow-300 text-yellow-700 hover:bg-yellow-50 gap-1.5"
          >
            <Trophy className="h-4 w-4" />
            Bài kiểm tra cuối khóa
          </Button>
        </Link>
        <ConfirmModal
          onConfirm={onConfirmDelete}
          disabled={isDeleting || isLoading}
          title="Xóa khóa học này?"
          description="Hành động này sẽ xóa toàn bộ chương, bài học và tài liệu liên quan vĩnh viễn."
        >
          <Button
            variant="destructive"
            size="sm"
            disabled={isDeleting || isLoading}
          >
            <Trash className="h-4 w-4 mr-2" />
            Xóa khóa học
          </Button>
        </ConfirmModal>
      </div>

      {/* --- Row 1: Title & Structure --- */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div className="space-y-1 flex-1 w-full">
          <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Tên khóa học
          </Label>

          {/* Logic hiển thị Tên khóa học */}
          {isEditingTitle ? (
            <Input
              ref={titleInputRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={disableEditing}
              onKeyDown={onTitleKeyDown}
              className="text-2xl font-bold h-auto py-1 px-2 -ml-2 border-red-200 focus-visible:ring-red-500"
              placeholder="Nhập tên khóa học..."
            />
          ) : (
            <div className="flex items-center gap-2 group w-fit">
              <h3
                className="text-2xl font-bold text-gray-900 truncate max-w-[600px]"
                title={title}
              >
                {title || "Chưa đặt tên khóa học"}
              </h3>
              <Button
                onClick={enableEditing}
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-400 hover:text-red-600 transition-all cursor-pointer"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <Select
          value={course.isStructured ? "hierarchical" : "flat"}
          onValueChange={handleStructureChange}
          disabled={isLoading}
        >
          <SelectTrigger className="w-full md:w-[200px] bg-gray-50">
            <SelectValue placeholder="Cấu trúc" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hierarchical">📂 Phân cấp (Chương)</SelectItem>
            <SelectItem value="flat">📄 Danh sách bài</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex flex-col gap-1 w-full md:w-[220px]">
          <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
            Ngày thi mục tiêu
          </Label>
          <Input
            type="datetime-local"
            value={examDate}
            onChange={handleExamDateChange}
            className="bg-gray-50 border-gray-100 focus:ring-red-500 h-9 text-xs font-bold"
          />
        </div>
      </div>

      {/* --- Row 2: Description & Thumbnail --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-2">
          <Label className="text-gray-600 font-medium">Mô tả khóa học</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleDescriptionBlur}
            placeholder="Viết vài dòng giới thiệu về khóa học này..."
            className="min-h-[150px] resize-none focus-visible:ring-red-500"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-gray-600 font-medium flex justify-between">
            Ảnh bìa (16:9)
            {uploading && (
              <span className="text-xs text-red-600 animate-pulse">
                Đang xử lý...
              </span>
            )}
          </Label>

          <div
            onClick={() => !uploading && fileInputRef.current?.click()}
            className="aspect-video bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:border-red-400 hover:bg-red-50/30 transition-all relative overflow-hidden group"
          >
            {course.thumbnail ? (
              <>
                <img
                  src={course.thumbnail}
                  alt="Thumbnail"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Pencil className="text-white h-8 w-8" />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 text-gray-400">
                <div className="p-3 bg-white rounded-full shadow-sm">
                  <Upload className="h-5 w-5" />
                </div>
                <span className="text-xs font-medium">Tải ảnh bìa lên</span>
              </div>
            )}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={onFileChange}
              className="hidden"
              disabled={uploading}
            />
          </div>
          <p className="text-[11px] text-gray-400">
            Khuyến nghị: 1280x720px (JPG, PNG)
          </p>
        </div>
      </div>

      {/* --- MODAL CROP ẢNH --- */}
      <Dialog
        open={isCropModalOpen}
        onOpenChange={(open) => !uploading && setIsCropModalOpen(open)}
      >
        <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-red-600" />
              Căn chỉnh ảnh bìa
            </DialogTitle>
          </DialogHeader>

          <div className="relative w-full h-[350px] bg-[#1a1a1a]">
            {imageToCrop && (
              <Cropper
                image={imageToCrop}
                crop={crop}
                zoom={zoom}
                aspect={16 / 9}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            )}
          </div>

          <div className="p-6 space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between text-xs font-medium text-gray-500">
                <span>Thu nhỏ</span>
                <span>Phóng to</span>
              </div>
              <Slider
                value={[zoom]}
                min={1}
                max={3}
                step={0.1}
                onValueChange={(val) => setZoom(val[0])}
                className="cursor-pointer"
              />
            </div>
          </div>

          <DialogFooter className="p-4 bg-gray-50 gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setIsCropModalOpen(false)}
              disabled={uploading}
            >
              Hủy bỏ
            </Button>
            <Button
              onClick={handleUploadFinal}
              disabled={uploading}
              className="bg-red-600 hover:bg-red-700 text-white min-w-[120px]"
            >
              {uploading ? "Đang tải lên..." : "Lưu ảnh bìa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
