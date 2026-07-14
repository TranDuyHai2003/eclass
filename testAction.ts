import { updateCourse } from './actions/course';
import { prisma } from './lib/prisma';

// We need to bypass auth for this script, so we'll mock auth
import * as authModule from './auth';
// @ts-ignore
authModule.auth = async () => ({ user: { id: "123", role: "ADMIN" } });

async function main() {
  const course = await prisma.course.findFirst({ where: { title: 'LỚP 11 - XPS 2K10' } });
  const cls = await prisma.studyClass.findFirst();
  
  if (!course || !cls) return console.log("Missing course or class");
  
  console.log("Updating course", course.id, "with class", cls.id);
  const res = await updateCourse(course.id, { classIds: [cls.id] });
  console.log("Update res:", res);
  
  const updated = await prisma.course.findUnique({ where: { id: course.id }, include: { classes: true } });
  console.log("Updated course classes:", updated?.classes);
}
main().catch(console.error);
