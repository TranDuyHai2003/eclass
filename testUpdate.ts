import { prisma } from './lib/prisma';

async function main() {
  const courseId = 'cmpwrx8mq002ipd1a2ghuwn0d';
  const cls = await prisma.studyClass.findFirst();
  
  const updateData = { classes: { set: [{ id: cls!.id }] } };
  
  const updatedCourse = await prisma.course.update({
    where: { id: courseId },
    data: updateData,
    include: { classes: true }
  });
  console.log("Updated course classes:", updatedCourse.classes);
}
main().catch(console.error);
