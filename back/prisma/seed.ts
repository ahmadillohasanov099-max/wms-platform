import {
  PrismaClient,
  UserRole,
  OrganizationType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('====================================================');
  console.log('  BAZA 0 GA TUSHIRILMOQDA (BARCHA MA\'LUMOTLAR TOZALANMOQDA)');
  console.log('====================================================');

  // 1. Barcha jadvallarni to'liq tozalash (TRUNCATE CASCADE)
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE 
      "AuditLog", 
      "RefreshToken", 
      "DeletionRequest", 
      "Operation", 
      "DepartmentAsset", 
      "Assignment", 
      "Asset", 
      "Inventory", 
      "Product", 
      "User", 
      "Department", 
      "Organization" 
    CASCADE;
  `);

  console.log('Barcha jadvallar muvaffaqiyatli 0 ga tushirildi.');

  // 2. Faqat Asosiy Tashkilot va Super Admin yaratiladi
  const ministry = await prisma.organization.create({
    data: {
      name: "O'zbekiston Respublikasi Qurilish va Uy-Joy Kommunal Xo'jaligi Vazirligi",
      code: 'MINISTRY',
      type: OrganizationType.MINISTRY,
      address: "Toshkent shahri, Abay ko'chasi 6",
      phone: '+998 71 200 00 00',
      isActive: true,
    },
  });

  const superAdminSecretHash = await bcrypt.hash('333053334aa', 10);
  const testPasswordHash = await bcrypt.hash('test12345', 10);

  // 2.1. Asosiy Super Admin: ahmadillohasanov099@gmail.com
  await prisma.user.create({
    data: {
      fullName: 'Ahmadillo Hasanov',
      username: 'ahmadillohasanov099@gmail.com',
      passwordHash: superAdminSecretHash,
      role: UserRole.SUPER_ADMIN,
      position: 'Bosh Administrator',
      organizationId: ministry.id,
      phone: '+998900000000',
      isActive: true,
    },
  });

  // 2.2. Qulay kirish uchun test Super Admin: superadmin
  await prisma.user.create({
    data: {
      fullName: 'Super Administrator',
      username: 'superadmin',
      passwordHash: testPasswordHash,
      role: UserRole.SUPER_ADMIN,
      position: 'Bosh Administrator',
      organizationId: ministry.id,
      phone: '+998901111111',
      isActive: true,
    },
  });

  console.log('====================================================');
  console.log('  BAZA 0 GA TUSHIRILDI VA FAQAT SUPER ADMIN QOLDIRILDI:');
  console.log('----------------------------------------------------');
  console.log('  1. Login: ahmadillohasanov099@gmail.com');
  console.log('     Parol: 333053334aa');
  console.log('----------------------------------------------------');
  console.log('  2. Login: superadmin');
  console.log('     Parol: test12345');
  console.log('====================================================');
}

main()
  .catch((e) => {
    console.error('Seed xatolik yuz berdi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });