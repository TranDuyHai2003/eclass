import { prisma } from './lib/prisma';

async function main() {
  const courseId = 'cmp0qyg1a003iqw0i33q1bs2d'; // GIAI ĐOẠN 2: KIẾN THỨC NỀN TẢNG 12
  const cls = await prisma.studyClass.findFirst({ where: { name: '11A' } });
  const classIds = [cls!.id];
  
  const classes = await prisma.studyClass.findMany({ where: { id: { in: classIds } } });
  if (classes.length !== classIds.length) return console.log("Mismatch!");
  
  const updateData: any = {};
  if (classIds) {
    updateData.classes = { set: classIds.map(id => ({ id })) };
  }
  
  await prisma.course.update({
    where: { id: courseId },
    data: updateData,
  });
  
  const final = await prisma.course.findUnique({ where: { id: courseId }, include: { classes: true } });
  console.log("FINAL CLASSES:", final?.classes);
}
main().catch(console.error);
