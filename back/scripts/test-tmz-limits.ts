import { PrismaClient, ProductType, UnitType, UserRole } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { LimitsService } from '../src/modules/limits/limits.service';

const prisma = new PrismaClient();
const limitsService = new LimitsService(prisma as any);

async function run() {
  console.log('====================================================');
  console.log('🏛️ TMZ OYLIK ISTE\'MOL ME\'YORLARI VA CHEKLOVLAR TESTI');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Setup mock test data
  console.log('📋 1. Test ma\'lumotlarini tayyorlash...');
  const testOrg = await prisma.organization.upsert({
    where: { code: 'TEST_MINISTRY_ORG' },
    update: {},
    create: {
      name: 'Test Vazirlik Tashkiloti',
      code: 'TEST_MINISTRY_ORG',
    },
  });

  const testDept = await prisma.department.create({
    data: {
      name: 'Moliya va Iqtisodiyot Boshqarmasi',
      organizationId: testOrg.id,
    },
  });

  const testUser = await prisma.user.create({
    data: {
      username: `test_emp_${Date.now()}`,
      fullName: 'Abdullayev Botir (Test Xodim)',
      passwordHash: 'dummyhash',
      role: UserRole.XODIM,
      organizationId: testOrg.id,
      departmentId: testDept.id,
    },
  });

  const testProduct = await prisma.product.create({
    data: {
      name: 'A4 Qog‘oz (SvetoCopy)',
      productType: ProductType.SARFLANADIGAN,
      unit: UnitType.DONA,
      packageSize: 500,
      organizationId: testOrg.id,
    },
  });

  await prisma.inventory.create({
    data: {
      productId: testProduct.id,
      quantity: 1000,
    },
  });

  try {
    // 2. Limit belgilanmagan paytda tekshiruv
    console.log('\n🔍 2. Limit belgilanmagan holat:');
    const initialStatus = await limitsService.getLimitStatus(testProduct.id, testOrg.id, {
      userId: testUser.id,
    });
    assert(initialStatus.hasLimit === false, 'Limit belgilanmagan mahsulot uchun hasLimit=false bo‘lishi kerak');
    assert(initialStatus.currentMonthSpent === 0, 'Sarf miqdori 0 bo‘lishi kerak');

    // 3. Oylik me'yorni belgilash (40 dona A4 qog'oz)
    console.log('\n📏 3. Xodim uchun oylik 40 dona limit belgilash:');
    const monthlyLimit = await limitsService.setMonthlyLimit(
      {
        productId: testProduct.id,
        userId: testUser.id,
        limitQuantity: 40,
        decreeReference: "Vazirlik 14-son ichki me'yoriy buyrug'i",
      },
      {
        id: testUser.id,
        organizationId: testOrg.id,
        role: UserRole.ORG_OMBORCHI,
      },
      false,
    );
    assert(monthlyLimit.limitQuantity === 40, 'Oylik meʼyor 40 dona qilib saqlandi');

    const statusAfterLimit = await limitsService.getLimitStatus(testProduct.id, testOrg.id, {
      userId: testUser.id,
    });
    assert(statusAfterLimit.hasLimit === true, 'Endi hasLimit=true');
    assert(statusAfterLimit.baseLimit === 40, 'Asosiy limit 40');
    assert(statusAfterLimit.remaining === 40, 'Qolgan limit 40');

    // 4. Me'yor doirasida TMZ berish (35 dona)
    console.log('\n📦 4. Limit doirasida 35 dona berish:');
    // checkLimitOrThrow tekshiruvi:
    await limitsService.checkLimitOrThrow(testProduct.id, 35, testOrg.id, {
      userId: testUser.id,
    });
    assert(true, '35 dona berishga ruxsat berildi (limit 40)');

    // Berish amaliyoti yoziladi (Operation GIVE_TO_USER):
    await prisma.operation.create({
      data: {
        type: 'GIVE_TO_USER',
        quantity: 35,
        userId: testUser.id,
        productId: testProduct.id,
        performedById: testUser.id,
        organizationId: testOrg.id,
        documentNumber: 'TLB-0001',
      },
    });

    const statusAfterGiving = await limitsService.getLimitStatus(testProduct.id, testOrg.id, {
      userId: testUser.id,
    });
    assert(statusAfterGiving.currentMonthSpent === 35, 'Shu oyda sarflangan: 35 dona');
    assert(statusAfterGiving.remaining === 5, 'Qolgan limit: 5 dona');

    // 5. Limitdan ortiqcha so'ralganda cheklov (10 dona bermoqchi bo'lganda)
    console.log('\n🚫 5. Limitdan oshib ketganda cheklov (10 dona berishga urinish):');
    let overLimitCaught = false;
    let caughtError: any = null;
    try {
      await limitsService.checkLimitOrThrow(testProduct.id, 10, testOrg.id, {
        userId: testUser.id,
      });
    } catch (err: any) {
      overLimitCaught = true;
      caughtError = err?.response;
    }

    assert(overLimitCaught === true, 'Limitdan oshganda xatolik (blokirovka) tashlandi');
    assert(caughtError?.errorCode === 'OVER_MONTHLY_LIMIT', 'Xatolik kodi OVER_MONTHLY_LIMIT bo‘lishi kerak');
    assert(caughtError?.limitStatus?.remaining === 5, 'Xatolik maʼlumotida qolgan limit 5 dona ekanligi ko‘rsatildi');

    // 6. Vazir buyrug'i biriktirish va limitni oshirish (+100 dona)
    console.log('\n📄 6. Vazir buyrug‘i biriktirilib limitni +100 donaga oshirish:');
    const decreeRes = await limitsService.addLimitException(
      {
        productId: testProduct.id,
        userId: testUser.id,
        monthlyLimitId: monthlyLimit.id,
        additionalQuantity: 100,
        documentNumber: '182-B',
      },
      null, // Faylsiz yoki faylli
      {
        id: testUser.id,
        organizationId: testOrg.id,
        role: UserRole.ORG_OMBORCHI,
      },
    );

    assert(decreeRes.exception.documentNumber === '182-B', 'Buyruq 182-B ro‘yxatga olindi');
    assert(decreeRes.exception.additionalQuantity === 100, 'Qo‘shimcha +100 dona limit qo‘shildi');

    const statusAfterDecree = await limitsService.getLimitStatus(testProduct.id, testOrg.id, {
      userId: testUser.id,
    });
    assert(statusAfterDecree.totalExceptions === 100, 'Jami istisnolar: 100');
    assert(statusAfterDecree.totalAllowed === 140, 'Jami ruxsat etilgan limit: 40 + 100 = 140 dona');
    assert(statusAfterDecree.currentMonthSpent === 35, 'Sarflangan o‘zgarmadi: 35 dona');
    assert(statusAfterDecree.remaining === 105, 'Yangi qolgan limit: 140 - 35 = 105 dona');

    // 7. Endi 10 dona berishga qayta urinish
    console.log('\n✅ 7. Buyruqdan so‘ng 10 dona berishga ruxsat:');
    let retrySucceeded = false;
    try {
      await limitsService.checkLimitOrThrow(testProduct.id, 10, testOrg.id, {
        userId: testUser.id,
      });
      retrySucceeded = true;
    } catch {
      retrySucceeded = false;
    }
    assert(retrySucceeded === true, 'Endi 10 dona berishga to‘liq ruxsat berildi!');

    // 8. Bo'lim uchun 2 pachka limit belgilash va xodimga 5 pachka berishga urinish:
    console.log('\n🏢 8. Bo‘lim uchun 2 limit belgilab, xodimga 5 berishga urinish:');
    const deptProduct = await prisma.product.create({
      data: {
        name: 'A4 test qogoz',
        unit: 'PACHKA',
        productType: ProductType.SARFLANADIGAN,
        organizationId: testOrg.id,
      },
    });

    await limitsService.setMonthlyLimit(
      {
        productId: deptProduct.id,
        departmentId: testDept.id,
        limitQuantity: 2,
        decreeReference: 'Bo‘lim oylik me’yori',
      },
      { id: testUser.id, organizationId: testOrg.id, role: UserRole.ORG_ADMIN },
      false,
    );

    let deptBlockSuccess = false;
    try {
      await limitsService.checkLimitOrThrow(deptProduct.id, 5, testOrg.id, {
        userId: testUser.id, // Xodim shu bo'limga tegishli
      });
    } catch (err: any) {
      if (err instanceof BadRequestException) {
        const resp: any = err.getResponse();
        if (resp.errorCode === 'OVER_MONTHLY_LIMIT') {
          deptBlockSuccess = true;
        }
      }
    }
    assert(deptBlockSuccess === true, 'Bo‘lim limiti 2 bo‘lganda xodimga 5 berish qat’iy bloklandi!');

    // Cleanup deptProduct
    await prisma.tmzMonthlyLimit.deleteMany({ where: { productId: deptProduct.id } });
    await prisma.product.delete({ where: { id: deptProduct.id } });

  } finally {
    // Clean up
    console.log('\n🧹 Test ma\'lumotlarini tozalash...');
    await prisma.operation.deleteMany({ where: { productId: testProduct.id } });
    await prisma.tmzLimitException.deleteMany({ where: { productId: testProduct.id } });
    await prisma.tmzMonthlyLimit.deleteMany({ where: { productId: testProduct.id } });
    await prisma.inventory.deleteMany({ where: { productId: testProduct.id } });
    await prisma.product.deleteMany({ where: { id: testProduct.id } });
    await prisma.user.deleteMany({ where: { id: testUser.id } });
    await prisma.department.deleteMany({ where: { id: testDept.id } });
    await prisma.organization.deleteMany({ where: { id: testOrg.id } });
    await prisma.$disconnect();
  }

  console.log('\n====================================================');
  console.log(`🏁 TEST YAKUNI: ${passed} TA PASS, ${failed} TA FAIL`);
  console.log('====================================================');
  if (failed > 0) process.exit(1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
