import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const classesData = [
  {
    name: '12A',
    students: [
      'Đặng Lê Ngọc Anh', 'Hoàng Thục Anh (nc)', 'Nguyễn Trần Hà Anh(NC)',
      'Trương Hải Anh (nc)', 'Đỗ Hải Bình (nc)', 'Nguyễn Ngọc Minh Châu(NC)',
      'Hồ Khả Diệu (NC)', 'Thịnh Đức Dũng (nc)', 'Nguyễn Ngọc Đại (NC)',
      'Nguyễn Gia Hiếu', 'Đào Thuỳ Linh (NC)', 'Nguyễn Ngọc Linh',
      'Thảo Linh(NC)', 'Lại Duy Minh(nc)', 'Mai Lê Minh (NC)',
      'Minh Ngọc (nc)', 'Nguyễn Lan Nhi (NC)', 'Hồng Nhung',
      'Nguyen Lan Phuong', 'Nguyễn Đỗ Như Quỳnh(nc)', 'Nguyễn Linh San (NC)',
      'Đỗ Thái Sơn', 'Thư Đỗ Thanh', 'Lê Bảo Trâm (NC)'
    ]
  },
  {
    name: '12B',
    students: [
      'Nguyễn Tiến Nam', 'Nguyễn Công Việt Anh', 'Phạm Trà My',
      'Khuê', 'Nguyễn Trần Thuỳ Chi', 'Lê Quỳnh Anh', 'Khánh Duy', 'Trần Ngọc Anh',
      'Khánh Ngọc', 'Minh Anh', 'Hoàng Long', 'Minh Ngọc', 'Mỹ Chính', 'Nguyễn Nhung'
    ]
  },
  {
    name: '11A',
    students: [
      'Lê Minh Khôi', 'Đặng Huyền My', 'Đặng Trung Kiên', 'Tú Uyên', 'Nguyễn Duy Phong',
      'Hà chúc an', 'Nguyễn Tiến Anh', 'Vu Linh Chi', 'Phạm Bảo Hân', 'Trần Đức Long'
    ]
  }
];

function normalizeName(name: string | null): string {
  if (!name) return '';
  return name.normalize("NFD")
             .replace(/[\u0300-\u036f]/g, "")
             .replace(/đ/g, "d")
             .replace(/Đ/g, "D")
             .toLowerCase()
             .replace(/\(nc\)/g, "")
             .trim();
}

async function main() {
  console.log('Starting class assignment script...');

  const allUsers = await prisma.user.findMany({
    select: { id: true, name: true }
  });

  const missingStudents: string[] = [];

  for (const cls of classesData) {
    // Upsert class
    const studyClass = await prisma.studyClass.upsert({
      where: { name: cls.name },
      update: {},
      create: { name: cls.name },
    });
    console.log(`Class ${studyClass.name} created/found with ID: ${studyClass.id}`);

    // Find and update users
    let count = 0;
    for (const studentName of cls.students) {
      const normalizedStudentName = normalizeName(studentName);
      
      // Try to find a match
      const matchedUsers = allUsers.filter(u => {
        if (!u.name) return false;
        // Exact case-insensitive match
        if (u.name.toLowerCase().trim() === studentName.toLowerCase().trim()) return true;
        // Normalized match
        if (normalizeName(u.name) === normalizedStudentName) return true;
        return false;
      });

      if (matchedUsers.length === 0) {
        console.log(`Warning: Student ${studentName} not found in DB.`);
        missingStudents.push(`${studentName} (${cls.name})`);
      } else if (matchedUsers.length > 1) {
        console.log(`Warning: Multiple students found for name ${studentName} (${matchedUsers.map(u=>u.name).join(', ')}). Updating all.`);
        for (const u of matchedUsers) {
          await prisma.user.update({
            where: { id: u.id },
            data: { classId: studyClass.id }
          });
        }
        count += matchedUsers.length;
      } else {
        await prisma.user.update({
          where: { id: matchedUsers[0].id },
          data: { classId: studyClass.id }
        });
        count++;
      }
    }
    console.log(`Updated ${count} students for class ${cls.name}`);
  }

  console.log('\n--- SUMMARY ---');
  console.log('Class assignment completed.');
  
  if (missingStudents.length > 0) {
    console.log(`\nThere are ${missingStudents.length} students NOT FOUND in the database:`);
    missingStudents.forEach(student => console.log(`- ${student}`));
  } else {
    console.log('\nAll students were successfully found and assigned!');
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
