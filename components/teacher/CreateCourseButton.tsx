"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function CreateCourseButton() {
  return (
    <Link href="/teacher/courses/create">
      <Button className="bg-purple-600 hover:bg-purple-700">
        <svg
          className="w-5 h-5 mr-2"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
        Tạo khóa học mới
      </Button>
    </Link>
  );
}
