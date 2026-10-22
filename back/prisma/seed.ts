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
      "TmzLimitException",
      "TmzMonthlyLimit",
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

  console.log('✅ Barcha jadvallar muvaffaqiyatli 0 ga tushirildi.');

  // 2. Asosiy Tashkilot (Vazirlik) yaratiladi
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

  // 3. Yagona Super Admin: Ahmadillo Hasanov
  const superAdminSecretHash = await bcrypt.hash('333053334aa', 10);

  const admin = await prisma.user.create({
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

  console.log('====================================================');
  console.log('  BAZA 0 GA TUSHIRILDI VA FAQAT YAGONA SUPER ADMIN YARATILDI:');
  console.log('----------------------------------------------------');
  console.log(`  F.I.SH: ${admin.fullName}`);
  console.log('  Login: ahmadillohasanov099@gmail.com');
  console.log('  Parol: 333053334aa');
  console.log('  Roli: SUPER_ADMIN');
  console.log('====================================================');
}

main()
  .catch((e) => {
    console.error('❌ Seed xatolik yuz berdi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
