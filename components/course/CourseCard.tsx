import Link from 'next/link';
import Image from 'next/image';



export default function CourseCard({ course }: { 
  course: { 
    id: string; 
    title: string; 
    thumbnail: string | null; 
    chapters: { 
      lessons: { id: string }[] 
    }[] 
  } 
}) {
  const totalLessons = course.chapters.reduce((acc, chapter) => acc + chapter.lessons.length, 0);
  
  // Find the first lesson of the first chapter that has lessons
  const firstLessonId = course.chapters.find(c => c.lessons.length > 0)?.lessons[0]?.id;
  const courseUrl = firstLessonId ? `/watch/${firstLessonId}` : '#';

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] hover:border-purple-200">
      <div className="relative aspect-video w-full overflow-hidden bg-gray-100">
        {course.thumbnail ? (
          <Image
            src={course.thumbnail}
            alt={course.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-110"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            unoptimized={course.thumbnail.includes('localhost') || course.thumbnail.includes('127.0.0.1')}
          />
        ) : (
           <div className="flex h-full w-full items-center justify-center text-gray-400">
             <span className="text-sm font-medium">No Image</span>
           </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      </div>
      
      <div className="flex flex-1 flex-col p-5">
        <h3 className="mb-2 text-xl font-bold leading-snug tracking-tight text-gray-900 line-clamp-2 group-hover:text-purple-600 transition-colors">
          {course.title}
        </h3>
        <p className="mb-5 text-sm text-gray-500 font-medium">
          {totalLessons} bài giảng
        </p>
        
        <div className="mt-auto">
          <Link
            href={courseUrl}
            className={`
              relative inline-flex w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:from-purple-500 hover:to-indigo-500 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2
              ${!firstLessonId ? 'pointer-events-none opacity-50 grayscale' : ''}
            `}
          >
            <span className="relative z-10 flex items-center gap-2">
              Vào học
              <svg className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
