import { PrismaClient, UserRole, OrganizationType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log("Baza tozalanmoqda: Faqat boshlang'ich Admin, Omborchi va Kadr rollari yaratilmoqda...");

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

  // Passwords
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const omborchiPasswordHash = await bcrypt.hash('omborchi123', 10);
  const kadrPasswordHash = await bcrypt.hash('kadr123', 10);

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

  // 2. VAZIRLIK ASOSIY FOYDALANUVCHILARI
  await prisma.user.create({
    data: {
      fullName: 'Bosh Administrator (Vazirlik)',
      username: 'admin',
      passwordHash: adminPasswordHash,
      role: UserRole.SUPER_ADMIN,
      position: 'Bosh Administrator',
      organizationId: ministry.id,
      phone: '+998900000001',
      isActive: true,
    },
  });

  await prisma.user.create({
    data: {
      fullName: 'Bosh Omborchi (Vazirlik)',
      username: 'omborchi',
      passwordHash: omborchiPasswordHash,
      role: UserRole.VAZIRLIK_OMBORCHI,
      position: 'Bosh Omborchi',
      organizationId: ministry.id,
      phone: '+998900000002',
      isActive: true,
    },
  });

  await prisma.user.create({
    data: {
      fullName: 'Kadrlar Bo‘limi Mas’uli (Vazirlik)',
      username: 'kadr',
      passwordHash: kadrPasswordHash,
      role: UserRole.KADR,
      position: 'Kadrlar bo‘yicha mas’ul',
      organizationId: ministry.id,
      phone: '+998900000003',
      isActive: true,
    },
  });

  // 3. HUDUDIY BOSHQARMA: SAMARQAND VILOYATI
  const samarkandOrg = await prisma.organization.create({
    data: {
      name: "Samarqand viloyati Qurilish va Uy-joy Kommunal Xo'jaligi Boshqarmasi",
      code: "SAMARKAND_REG",
      type: OrganizationType.SUB_ORG,
      parentId: ministry.id,
      address: "Samarqand shahri, Registon ko'chasi 12",
      phone: "+998 66 230 00 00",
      isActive: true,
    },
  });

  await prisma.user.create({
    data: {
      fullName: 'Samarqand Boshqarmasi Admini',
      username: 'sam_admin',
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
      position: 'Viloyat Administratori',
      organizationId: samarkandOrg.id,
      phone: '+998901000001',
      isActive: true,
    },
  });

  await prisma.user.create({
    data: {
      fullName: 'Samarqand Boshqarmasi Omborchisi',
      username: 'sam_omborchi',
      passwordHash: omborchiPasswordHash,
      role: UserRole.OMBORCHI,
      position: 'Viloyat Omborchisi',
      organizationId: samarkandOrg.id,
      phone: '+998901000002',
      isActive: true,
    },
  });

  await prisma.user.create({
    data: {
      fullName: 'Samarqand Kadrlar Mas’uli',
      username: 'sam_kadr',
      passwordHash: kadrPasswordHash,
      role: UserRole.KADR,
      position: 'Viloyat Kadrlar Mas’uli',
      organizationId: samarkandOrg.id,
      phone: '+998901000003',
      isActive: true,
    },
  });

  // 4. HUDUDIY BOSHQARMA: TOSHKENT VILOYATI
  const toshkentOrg = await prisma.organization.create({
    data: {
      name: "Toshkent viloyati Qurilish va Uy-joy Kommunal Xo'jaligi Boshqarmasi",
      code: "TASHKENT_REG",
      type: OrganizationType.SUB_ORG,
      parentId: ministry.id,
      address: "Nurafshon shahri, Toshkent yo'li 1",
      phone: "+998 70 200 00 00",
      isActive: true,
    },
  });

  await prisma.user.create({
    data: {
      fullName: 'Toshkent Viloyati Admini',
      username: 'tosh_admin',
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
      position: 'Viloyat Administratori',
      organizationId: toshkentOrg.id,
      phone: '+998902000001',
      isActive: true,
    },
  });

  await prisma.user.create({
    data: {
      fullName: 'Toshkent Viloyati Omborchisi',
      username: 'tosh_omborchi',
      passwordHash: omborchiPasswordHash,
      role: UserRole.OMBORCHI,
      position: 'Viloyat Omborchisi',
      organizationId: toshkentOrg.id,
      phone: '+998902000002',
      isActive: true,
    },
  });

  await prisma.user.create({
    data: {
      fullName: 'Toshkent Viloyati Kadr Mas’uli',
      username: 'tosh_kadr',
      passwordHash: kadrPasswordHash,
      role: UserRole.KADR,
      position: 'Viloyat Kadrlar Mas’uli',
      organizationId: toshkentOrg.id,
      phone: '+998902000003',
      isActive: true,
    },
  });

  console.log('====================================================');
  console.log('  SEED MUVAFFAQIYATLI BAJARILDI (Multi-Tenant):');
  console.log('  1. Markaziy Vazirlik:');
  console.log('     • Super Admin: username: "admin"        | parol: "admin123"');
  console.log('     • Omborchi:    username: "omborchi"     | parol: "omborchi123"');
  console.log('     • Kadr:        username: "kadr"         | parol: "kadr123"');
  console.log('  2. Samarqand Viloyat Boshqarmasi:');
  console.log('     • Admin:       username: "sam_admin"    | parol: "admin123"');
  console.log('     • Omborchi:    username: "sam_omborchi" | parol: "omborchi123"');
  console.log('     • Kadr:        username: "sam_kadr"     | parol: "kadr123"');
  console.log('  3. Toshkent Viloyat Boshqarmasi:');
  console.log('     • Admin:       username: "tosh_admin"   | parol: "admin123"');
  console.log('     • Omborchi:    username: "tosh_omborchi"| parol: "omborchi123"');
  console.log('     • Kadr:        username: "tosh_kadr"    | parol: "kadr123"');
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