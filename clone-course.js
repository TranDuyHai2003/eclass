const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cloneCourses() {
  try {
    console.log("Bắt đầu tiến trình nhân bản khóa học...");

    const originalCourses = await prisma.course.findMany({
      include: {
        attachments: true,
        chapters: {
          include: {
            lessons: {
              include: {
                attachments: true,
                test: {
                  include: {
                    sections: {
                      include: {
                        questions: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        finalTest: {
          include: {
            sections: {
              include: {
                questions: true,
              },
            },
          },
        },
      },
    });

    if (originalCourses.length === 0) {
      console.log("Không tìm thấy khóa học nào để nhân bản.");
      return;
    }

    for (const course of originalCourses) {
      console.log(`Đang nhân bản: ${course.title}...`);

      const { id, createdAt, updatedAt, chapters, attachments, finalTest, ...courseData } = course;

      await prisma.course.create({
        data: {
          ...courseData,
          title: `${course.title} (Duplicate)`,
          attachments: {
            create: attachments.map(att => {
              const { id, courseId, lessonId, createdAt, updatedAt, ...attData } = att;
              return { ...attData };
            }),
          },
          chapters: {
            create: chapters.map(chapter => {
              const { id, courseId, createdAt, updatedAt, lessons, ...chapterData } = chapter;
              return {
                ...chapterData,
                lessons: {
                  create: lessons.map(lesson => {
                    const { id, chapterId, createdAt, updatedAt, attachments, test, ...lessonData } = lesson;
                    return {
                      ...lessonData,
                      attachments: {
                        create: attachments.map(att => {
                          const { id, courseId, lessonId, createdAt, updatedAt, ...attData } = att;
                          return { ...attData };
                        }),
                      },
                      test: test
                        ? {
                            create: (() => {
                              const { id, lessonId, courseId, createdAt, updatedAt, sections, ...testData } = test;
                              return {
                                ...testData,
                                sections: {
                                  create: sections.map(section => {
                                    const { id, testId, createdAt, updatedAt, questions, ...sectionData } = section;
                                    return {
                                      ...sectionData,
                                      questions: {
                                        create: questions.map(q => {
                                          const { id, sectionId, createdAt, updatedAt, ...qData } = q;
                                          return { ...qData };
                                        }),
                                      },
                                    };
                                  }),
                                },
                              };
                            })(),
                          }
                        : undefined,
                    };
                  }),
                },
              };
            }),
          },
          finalTest: finalTest
            ? {
                create: (() => {
                  const { id, lessonId, courseId, createdAt, updatedAt, sections, ...testData } = finalTest;
                  return {
                    ...testData,
                    sections: {
                      create: sections.map(section => {
                        const { id, testId, createdAt, updatedAt, questions, ...sectionData } = section;
                        return {
                          ...sectionData,
                          questions: {
                            create: questions.map(q => {
                              const { id, sectionId, createdAt, updatedAt, ...qData } = q;
                              return { ...qData };
                            }),
                          },
                        };
                      }),
                    },
                  };
                })(),
              }
            : undefined,
        },
      });

      console.log(`Đã nhân bản xong: ${course.title} (Duplicate)`);
    }

    console.log("Hoàn tất quá trình Deep Clone!");
  } catch (error) {
    console.error("Có lỗi xảy ra trong quá trình nhân bản:", error);
  } finally {
    await prisma.$disconnect();
  }
}

cloneCourses();