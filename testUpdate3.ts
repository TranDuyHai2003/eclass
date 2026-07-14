import { prisma } from './lib/prisma';

async function main() {
  const course = await prisma.course.findFirst({ where: { title: 'GIAI ĐOẠN 2: KIẾN THỨC NỀN TẢNG 12' } });
  const cls = await prisma.studyClass.findFirst({ where: { name: '11A' } });
  
  if (!course || !cls) return console.log("Missing course or class");
  
  await prisma.course.update({
    where: { id: course.id },
    data: { classes: { set: [{ id: cls.id }] } }
  });
  
  const after = await prisma.course.findUnique({ where: { id: course.id }, include: { classes: true } });
  console.log("After update:", after?.classes);
}
main().catch(console.error);
