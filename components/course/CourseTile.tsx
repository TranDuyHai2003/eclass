import Link from "next/link";
import Image from "next/image";
import { ArrowRight, MonitorPlay } from "lucide-react";
import { cn } from "@/lib/utils";
import { canOptimizeImage } from "@/lib/image-hosts";
import { getAvatarThumbUrl } from "@/lib/game-rank";
import { getCourseGroup, groupCover, groupLabel } from "@/lib/course-grade";

export interface CourseTileData {
  id: string;
  title: string;
  thumbnail: string | null;
  level?: string | null;
  user?: { name: string | null; image: string | null } | null;
  chapters?: { lessons: { id: string }[] }[];
  category?: { name: string } | null;
  classes?: { grade: number | null }[] | null;
}

/**
 * Thẻ khoá học theo artifact thiết kế (trang Khóa học, Lộ trình ở trang chủ khách).
 * - "catalog": bìa 150px, chip khối + PREMIUM, số bài, danh mục, giáo viên, "Xem khóa học →"
 * - "roadmap": bìa 132px, chip "Bước N", gọn hơn
 * Khoá có ảnh bìa thì dùng ảnh; chưa có thì bìa màu theo khối với chữ số lớn.
 */
export function CourseTile({
  course,
  variant = "catalog",
  step,
  progress,
  dimmed = false,
}: {
  course: CourseTileData;
  variant?: "catalog" | "roadmap";
  /** Số bước trong lộ trình (chỉ "roadmap") */
  step?: number;
  /** Tiến độ % của học sinh (undefined = không hiện) */
  progress?: number;
  /** Làm mờ khi không thuộc khối đang chọn (Lộ trình ở trang chủ) */
  dimmed?: boolean;
}) {
  const group = getCourseGroup(course);
  const cover = groupCover(group, course.level === "ADVANCED");
  const label = groupLabel(group);
  const firstLessonId = course.chapters?.[0]?.lessons?.[0]?.id;
  const href = firstLessonId ? `/watch/${firstLessonId}` : `/courses/${course.id}`;
  const lessons = course.chapters?.reduce((n, ch) => n + (ch.lessons?.length ?? 0), 0) ?? 0;
  const teacher = course.user?.name ?? null;
  const roadmap = variant === "roadmap";

  return (
    <Link
      href={href}
      data-testid="course-tile"
      data-group={group ?? ""}
      data-dimmed={dimmed ? "true" : undefined}
      className={cn(
        "group @container flex h-full flex-col overflow-hidden rounded-[22px] border border-[#ECE9F5] bg-white text-[#1E1B2E] transition-[transform,box-shadow,opacity] duration-150 hover:-translate-y-[3px] hover:shadow-[0_14px_30px_rgba(42,31,92,0.12)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#A78BFA]",
        dimmed && "opacity-35",
      )}
    >
      <div
        className={cn("relative flex shrink-0 items-end p-4", roadmap ? "h-[132px]" : "h-[150px] p-[18px]")}
        style={course.thumbnail ? undefined : { background: cover.bg }}
      >
        {course.thumbnail ? (
          <Image
            src={course.thumbnail}
            alt=""
            fill
            unoptimized={!canOptimizeImage(course.thumbnail)}
            sizes="(min-width: 1280px) 25vw, (min-width: 640px) 45vw, 92vw"
            className="object-cover"
          />
        ) : (
          <span aria-hidden className={cn("relative font-extrabold leading-none", roadmap ? "text-[44px]" : "text-[52px]")} style={{ color: cover.fg }}>
            {cover.big}
          </span>
        )}
        {(roadmap ? step : label) && (
          <span className="absolute left-3.5 top-3.5 rounded-full bg-white/92 px-2.5 py-1 text-xs font-bold text-[#1E1B2E]">
            {roadmap ? `Bước ${step}` : label}
          </span>
        )}
        <span className="absolute right-3.5 top-3.5 rounded-full bg-[#1E1B2E] px-2.5 py-1 text-[11px] font-extrabold tracking-wide text-[#FDE68A]">PREMIUM</span>
      </div>

      <div className={cn("flex flex-1 flex-col", roadmap ? "gap-2.5 px-[18px] pb-[18px] pt-4" : "gap-3 p-[18px]")}>
        <h3 className={cn("line-clamp-2 font-extrabold leading-[1.35]", roadmap ? "text-base" : "text-[17px]")}>{course.title}</h3>

        {roadmap ? (
          <p className="flex gap-3 text-[13px] text-[#5F5B73]">
            <span>{lessons} bài học</span>
            <span aria-hidden>·</span>
            <span>{course.category?.name || "Toán học"}</span>
          </p>
        ) : (
          <div className="flex flex-wrap gap-2 text-[13px] text-[#3B3650]">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#F6F5FB] px-2.5 py-1">
              <MonitorPlay className="h-3.5 w-3.5" aria-hidden /> {lessons} bài học
            </span>
            <span className="rounded-lg bg-[#F6F5FB] px-2.5 py-1">{course.category?.name || "Toán học"}</span>
          </div>
        )}

        {progress !== undefined && (
          <div data-testid="course-progress" className="space-y-1">
            <div className="flex justify-between text-xs font-semibold text-[#5F5B73]">
              <span>{progress >= 100 ? "Đã hoàn thành" : "Tiến độ của bạn"}</span>
              <span className="font-bold text-[#5B2BD6]">{progress}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#F1EEF8]" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Tiến độ khoá học">
              <div className="h-full rounded-full bg-[#5B2BD6]" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
            </div>
          </div>
        )}

        <div className={cn("mt-auto flex items-center border-t border-[#F1EEF8]", roadmap ? "gap-2 pt-2.5" : "gap-2.5 pt-3")}>
          {teacher && (
            <>
              {course.user?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={getAvatarThumbUrl(teacher, course.user.image)} alt="" className={cn("shrink-0 rounded-full object-cover", roadmap ? "h-7 w-7" : "h-8 w-8")} />
              ) : (
                <span aria-hidden className={cn("flex shrink-0 items-center justify-center rounded-full bg-[#EDE7FD] font-extrabold text-[#4319A8]", roadmap ? "h-7 w-7 text-xs" : "h-8 w-8 text-[13px]")}>
                  {teacher.trim()[0]?.toUpperCase()}
                </span>
              )}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className={cn("truncate", roadmap ? "text-[13px] font-semibold" : "text-[13px] font-bold")}>{teacher}</span>
                {!roadmap && <span className="whitespace-nowrap text-xs text-[#6B6680]">Giảng viên</span>}
              </span>
            </>
          )}
          {!roadmap && (
            <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-[13px] font-bold text-[#5B2BD6]">
              <span className="sr-only @[300px]:not-sr-only">{progress ? "Học tiếp" : "Xem khóa học"}</span> <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
