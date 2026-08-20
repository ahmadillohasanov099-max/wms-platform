import { PrismaClient, UserRole, OrganizationType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log("Baza tozalanmoqda: Faqat Yagona Bosh Administrator yaratilmoqda...");

  // Delete all data in cascade order
  await prisma.deletionRequest.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.operation.deleteMany();
  await prisma.departmentAsset.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.product.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();
  await prisma.organization.deleteMany();

  console.log("Eski ma'lumotlar to'liq o'chirildi.");

  // Password Hash for Super Admin
  const superAdminPasswordHash = await bcrypt.hash('333053334aa', 10);

  // 1. TIZIM TASHKILOTI (Markaziy Vazirlik)
  const ministry = await prisma.organization.create({
    data: {
      name: "O'zbekiston Respublikasi Qurilish va Uy-Joy Kommunal Xo'jaligi Vazirligi",
      code: "MINISTRY",
      type: OrganizationType.MINISTRY,
      address: "Toshkent shahri, Abay ko'chasi 6",
      phone: "+998 71 200 00 00",
      isActive: true,
    },
  });

  // 2. YAGONA BOSH ADMINISTRATOR
  await prisma.user.create({
    data: {
      fullName: 'Ahmadillo Hasanov',
      username: 'ahmadillohasanov099@gmail.com',
      passwordHash: superAdminPasswordHash,
      role: UserRole.SUPER_ADMIN,
      position: 'Bosh Administrator',
      organizationId: ministry.id,
      phone: '+998900000000',
      isActive: true,
    },
  });

  console.log('====================================================');
  console.log('  SEED MUVAFFAQIYATLI BAJARILDI:');
  console.log('  Tashkilot: Markaziy Vazirlik (MINISTRY)');
  console.log('  Bosh Administrator (Super Admin):');
  console.log('     • Login (username): ahmadillohasanov099@gmail.com');
  console.log('     • Parol:            333053334aa');
  console.log('====================================================');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });