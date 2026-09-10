import {
  PrismaClient,
  UserRole,
  OrganizationType,
  ProductType,
  UnitType,
  AssetStatus,
  AssignmentStatus,
  OperationType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log("====================================================");
  console.log("  BAZA TOZALANMOQDA VA BARCHA ROLLAR SEED QILINMOQDA ");
  console.log("====================================================");

  // Cascade tartibida eski ma'lumotlarni tozalash
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

  // Universal test paroli va Super Admin maxsus paroli
  const TEST_PASSWORD = 'test12345';
  const testPasswordHash = await bcrypt.hash(TEST_PASSWORD, 10);
  const superAdminSecretHash = await bcrypt.hash('333053334aa', 10);

  // 1. TASHKILOTLAR
  // 1.1. Markaziy Vazirlik
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

  // 1.2. Quyi Tashkilot (Hududiy Boshqarma - ORG_ADMIN va ORG_OMBORCHI uchun)
  const subOrg = await prisma.organization.create({
    data: {
      name: "Toshkent shahar Qurilish va Uy-Joy Kommunal Xo'jaligi Boshqarmasi",
      code: 'TASHKENT_ORG',
      type: OrganizationType.SUB_ORG,
      parentId: ministry.id,
      address: "Toshkent shahri, Amir Temur shoh ko'chasi 15",
      phone: '+998 71 233 44 55',
      isActive: true,
    },
  });

  // 2. BO'LIMLAR
  const itDept = await prisma.department.create({
    data: {
      name: "Axborot-kommunikatsiya texnologiyalari bo'limi",
      description: "AKT va dasturiy ta'minotni rivojlantirish",
      organizationId: ministry.id,
    },
  });

  const hrDept = await prisma.department.create({
    data: {
      name: "Kadrlar va inson resurslari bo'limi",
      description: "Xodimlar hisobi va hujjatlar",
      organizationId: ministry.id,
    },
  });

  const subOrgDept = await prisma.department.create({
    data: {
      name: "Ekspluatatsiya va moddiy ta'minot bo'limi",
      description: "Hududiy boshqarma texnik bo'limi",
      organizationId: subOrg.id,
    },
  });

  // 3. TEST FOYDALANUVCHILARI (BARCHA ROLLAR)

  // 3.1. Asosiy Bosh Administrator
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

  // 3.2. Test Super Admin (qulay login: superadmin)
  await prisma.user.create({
    data: {
      fullName: 'Super Administrator (Test)',
      username: 'superadmin',
      passwordHash: testPasswordHash,
      role: UserRole.SUPER_ADMIN,
      position: 'Vazirlik Super Admini',
      organizationId: ministry.id,
      phone: '+998901111111',
      isActive: true,
    },
  });

  // 3.3. Rahbariyat (RAHBAR) - faqat kuzatuv va hisobotlar
  await prisma.user.create({
    data: {
      fullName: 'Jamshid Rahbarov',
      username: 'rahbar',
      passwordHash: testPasswordHash,
      role: UserRole.RAHBAR,
      position: "Vazir o'rinbosari",
      organizationId: ministry.id,
      phone: '+998902222222',
      isActive: true,
    },
  });

  // 3.4. Vazirlik Omborchisi (VAZIRLIK_OMBORCHI)
  const vazirlikOmborchiUser = await prisma.user.create({
    data: {
      fullName: 'Sardor Vohidov',
      username: 'vazirlik_omborchi',
      passwordHash: testPasswordHash,
      role: UserRole.VAZIRLIK_OMBORCHI,
      position: 'Vazirlik bosh ombor mudiri',
      organizationId: ministry.id,
      phone: '+998903333333',
      isActive: true,
    },
  });

  // 3.6. Kadrlar bo'limi (KADR)
  await prisma.user.create({
    data: {
      fullName: 'Dilnoza Kadrlarova',
      username: 'kadr',
      passwordHash: testPasswordHash,
      role: UserRole.KADR,
      position: 'Kadrlar bo‘limi yetakchi mutaxassisi',
      organizationId: ministry.id,
      departmentId: hrDept.id,
      phone: '+998906666666',
      isActive: true,
    },
  });

  // 3.8. Oddiy Xodim (XODIM)
  const xodimUser = await prisma.user.create({
    data: {
      fullName: 'Akmal Xodimov',
      username: 'xodim',
      passwordHash: testPasswordHash,
      role: UserRole.XODIM,
      position: 'AKT bo‘limi yetakchi dasturchisi',
      organizationId: ministry.id,
      departmentId: itDept.id,
      phone: '+998907777777',
      isActive: true,
    },
  });

  // 3.9. Quyi Tashkilot Admini (ORG_ADMIN)
  await prisma.user.create({
    data: {
      fullName: 'Farrux Quyi-Admin',
      username: 'org_admin',
      passwordHash: testPasswordHash,
      role: UserRole.ORG_ADMIN,
      position: "Toshkent boshqarma administratori",
      organizationId: subOrg.id,
      phone: '+998908888888',
      isActive: true,
    },
  });

  // 3.10. Quyi Tashkilot Omborchisi (ORG_OMBORCHI)
  await prisma.user.create({
    data: {
      fullName: 'Davron Quyi-Omborchi',
      username: 'org_omborchi',
      passwordHash: testPasswordHash,
      role: UserRole.ORG_OMBORCHI,
      position: 'Toshkent boshqarma omborchisi',
      organizationId: subOrg.id,
      departmentId: subOrgDept.id,
      phone: '+998909999999',
      isActive: true,
    },
  });

  // 4. TEST MAHSULOTLAR VA JİHOZLAR (XODIM VA OMBORCHI TESTI UCHUN)

  // 4.1. ThinkPad Noutbuki (Xodimga biriktirilgan - Ta'mirlash so'rovi uchun tayyor)
  const pLaptop = await prisma.product.create({
    data: {
      name: 'Lenovo ThinkPad E14 Gen 4',
      productType: ProductType.BERILADIGAN,
      unit: UnitType.DONA,
      description: 'Intel Core i7, 16GB RAM, 512GB SSD',
      organizationId: ministry.id,
    },
  });

  await prisma.inventory.create({
    data: {
      productId: pLaptop.id,
      quantity: 1, // 1 ta omborda erkin
      minLevel: 2,
      unitPrice: 11500000,
      totalValue: 11500000,
    },
  });

  // Xodimga biriktirilgan noutbuk
  const laptopAssetAssigned = await prisma.asset.create({
    data: {
      productId: pLaptop.id,
      inventoryNumber: 'INV-2026-0001',
      serialNumber: 'SN-THINKPAD-001',
      status: AssetStatus.ACTIVE,
      organizationId: ministry.id,
      purchasePrice: 11500000,
      purchaseDate: new Date(),
      notes: "Akmal Xodimovga xizmat vazifasi uchun biriktirilgan",
    },
  });

  await prisma.assignment.create({
    data: {
      userId: xodimUser.id,
      assetId: laptopAssetAssigned.id,
      status: AssignmentStatus.ACCEPTED,
      assignedAt: new Date(),
      acceptedAt: new Date(),
      returnedAt: null,
    },
  });

  // Omborda erkin turgan noutbuk
  await prisma.asset.create({
    data: {
      productId: pLaptop.id,
      inventoryNumber: 'INV-2026-0002',
      serialNumber: 'SN-THINKPAD-002',
      status: AssetStatus.ACTIVE,
      organizationId: ministry.id,
      purchasePrice: 11500000,
      purchaseDate: new Date(),
      notes: "Omborda zaxirada turibdi",
    },
  });

  // 4.2. Dell Monitor (Xodimga biriktirilgan)
  const pMonitor = await prisma.product.create({
    data: {
      name: 'Dell UltraSharp 27" 4K Monitor',
      productType: ProductType.BERILADIGAN,
      unit: UnitType.DONA,
      description: '27 dyuymli IPS 4K professional monitor',
      organizationId: ministry.id,
    },
  });

  await prisma.inventory.create({
    data: {
      productId: pMonitor.id,
      quantity: 0,
      minLevel: 1,
      unitPrice: 4200000,
      totalValue: 0,
    },
  });

  const monitorAssetAssigned = await prisma.asset.create({
    data: {
      productId: pMonitor.id,
      inventoryNumber: 'INV-2026-0003',
      serialNumber: 'SN-DELL-003',
      status: AssetStatus.ACTIVE,
      organizationId: ministry.id,
      purchasePrice: 4200000,
      purchaseDate: new Date(),
    },
  });

  await prisma.assignment.create({
    data: {
      userId: xodimUser.id,
      assetId: monitorAssetAssigned.id,
      status: AssignmentStatus.ACCEPTED,
      assignedAt: new Date(),
      acceptedAt: new Date(),
      returnedAt: null,
    },
  });

  // 4.3. Sarflanadigan TMZ (A4 Qog'oz)
  const pPaper = await prisma.product.create({
    data: {
      name: "A4 Qog'oz SvetoCopy Classic",
      productType: ProductType.SARFLANADIGAN,
      unit: UnitType.PACHKA,
      description: '80g/m2, 500 varaq',
      organizationId: ministry.id,
    },
  });

  await prisma.inventory.create({
    data: {
      productId: pPaper.id,
      quantity: 100,
      minLevel: 20,
      unitPrice: 48000,
      totalValue: 4800000,
    },
  });

  // Xodimga topshirilgan TMZ materiali (5 pachka A4 qog'oz)
  await prisma.operation.create({
    data: {
      type: OperationType.GIVE_TO_USER,
      quantity: 5,
      productId: pPaper.id,
      userId: xodimUser.id,
      performedById: vazirlikOmborchiUser.id,
      organizationId: ministry.id,
      documentNumber: 'TLB-2026-0001',
      documentDate: new Date(),
      note: "Xizmat vazifalarini bajarish uchun 5 pachka A4 qog'oz berildi",
    },
  });

  console.log('====================================================');
  console.log('  SEED MUVAFFAQIYATLI BAJARILDI:');
  console.log('  Barcha rollar uchun umumiy test paroli: ' + TEST_PASSWORD);
  console.log('----------------------------------------------------');
  console.log('  1. SUPER_ADMIN:       superadmin  yoki  ahmadillohasanov099@gmail.com');
  console.log('  2. RAHBAR:            rahbar');
  console.log('  3. VAZIRLIK_OMBORCHI: vazirlik_omborchi');
  console.log('  4. ORG_ADMIN:         org_admin');
  console.log('  5. ORG_OMBORCHI:      org_omborchi');
  console.log('  6. KADR:              kadr');
  console.log('  7. XODIM:             xodim');
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