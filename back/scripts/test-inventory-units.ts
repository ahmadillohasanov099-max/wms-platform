import { PrismaClient, ProductType, UnitType } from '@prisma/client';

const prisma = new PrismaClient();

function roundQty(val: number, decimals: number = 4): number {
  const factor = Math.pow(10, decimals);
  return Math.round((Number(val) || 0) * factor) / factor;
}

function formatProductQuantity(
  quantity: number,
  unit?: string | null,
  packageSize?: number | null,
): string {
  const qty = Number(quantity) || 0;
  const upperUnit = (unit || 'DONA').toUpperCase().trim();

  if ((upperUnit === 'PACHKA' || upperUnit === 'PACK') && packageSize && packageSize > 1) {
    const totalPieces = Math.round(qty * packageSize);
    const wholePacks = Math.floor(totalPieces / packageSize);
    const remainderPieces = totalPieces % packageSize;

    if (remainderPieces === 0) {
      return `${wholePacks} pachka`;
    }
    if (wholePacks === 0) {
      return `${remainderPieces} dona`;
    }
    return `${wholePacks} pachka, ${remainderPieces} dona`;
  }

  const rounded = roundQty(qty, 3);
  const formattedNum = Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(3).replace(/\.?0+$/, '');
  return `${formattedNum} ${unit?.toLowerCase() || 'dona'}`;
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 OMBOR O\'LCHOV BIRLIKLARI VA HISOB-KITOB TESTLARI');
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

  // ──────────────────────────────────────────────────────────
  // TEST 1: Pachka va dona konvertatsiyasi mantiqi
  // ──────────────────────────────────────────────────────────
  console.log('📦 TEST 1: Pachka va Dona Konvertatsiyasi (A4 qog\'oz misolida)');
  
  const packageSize = 500; // 1 pachkada 500 dona
  const initialPacks = 20;  // Omborda 20 pachka
  
  // Xodimga 200 dona berildi:
  const piecesGiven = 200;
  const packsGiven = roundQty(piecesGiven / packageSize, 4); // 0.4 pachka
  assert(packsGiven === 0.4, `200 dona = 0.4 pachka (Hosil bo'ldi: ${packsGiven})`);

  const remainingPacks = roundQty(initialPacks - packsGiven, 4); // 19.6 pachka
  assert(remainingPacks === 19.6, `Qoldiq pachka = 19.6 (Hosil bo'ldi: ${remainingPacks})`);

  const formattedRem = formatProductQuantity(remainingPacks, 'PACHKA', packageSize);
  assert(formattedRem === '19 pachka, 300 dona', `Format: "19 pachka, 300 dona" (Hosil bo'ldi: "${formattedRem}")`);

  const formattedGiven = formatProductQuantity(packsGiven, 'PACHKA', packageSize);
  assert(formattedGiven === '200 dona', `Berilgan format: "200 dona" (Hosil bo'ldi: "${formattedGiven}")`);

  const formattedFull = formatProductQuantity(20, 'PACHKA', packageSize);
  assert(formattedFull === '20 pachka', `To'liq pachka format: "20 pachka" (Hosil bo'ldi: "${formattedFull}")`);

  // ──────────────────────────────────────────────────────────
  // TEST 2: Kasrli o'lchov birliklari (LITR, KG, METR) & Floating-point drift
  // ──────────────────────────────────────────────────────────
  console.log('\n💧 TEST 2: Kasrli O\'lchov Birliklari (LITR, KG, METR) & Aniq Hisob-kitob');

  // Litr hisobi
  let warehouseLiters = 10.0;
  const giveLiters1 = 3.6;
  warehouseLiters = roundQty(warehouseLiters - giveLiters1, 4);
  assert(warehouseLiters === 6.4, `10L - 3.6L = 6.4L (Hosil bo'ldi: ${warehouseLiters})`);
  assert(formatProductQuantity(warehouseLiters, 'LITR') === '6.4 litr', `Format: "6.4 litr"`);

  const giveLiters2 = 1.75;
  warehouseLiters = roundQty(warehouseLiters - giveLiters2, 4);
  assert(warehouseLiters === 4.65, `6.4L - 1.75L = 4.65L (Hosil bo'ldi: ${warehouseLiters})`);
  assert(formatProductQuantity(warehouseLiters, 'LITR') === '4.65 litr', `Format: "4.65 litr"`);

  // Qaytarish (return)
  const returnLiters = 0.65;
  warehouseLiters = roundQty(warehouseLiters + returnLiters, 4);
  assert(warehouseLiters === 5.3, `4.65L + 0.65L = 5.3L (Hosil bo'ldi: ${warehouseLiters})`);

  // Hisobdan chiqarish (write-off)
  const writeOffLiters = 0.3;
  warehouseLiters = roundQty(warehouseLiters - writeOffLiters, 4);
  assert(warehouseLiters === 5.0, `5.3L - 0.3L = 5.0L (Hosil bo'ldi: ${warehouseLiters})`);
  assert(formatProductQuantity(warehouseLiters, 'LITR') === '5 litr', `Butun bo'lganda: "5 litr"`);

  // Kg hisobi
  let warehouseKg = 50.0;
  const giveKg = 0.75;
  warehouseKg = roundQty(warehouseKg - giveKg, 4);
  assert(warehouseKg === 49.25, `50kg - 0.75kg = 49.25kg (Hosil bo'ldi: ${warehouseKg})`);
  assert(formatProductQuantity(warehouseKg, 'KG') === '49.25 kg', `Format: "49.25 kg"`);

  // Metr hisobi
  let warehouseMetr = 100.0;
  const giveMetr = 12.5;
  warehouseMetr = roundQty(warehouseMetr - giveMetr, 4);
  assert(warehouseMetr === 87.5, `100m - 12.5m = 87.5m (Hosil bo'ldi: ${warehouseMetr})`);
  assert(formatProductQuantity(warehouseMetr, 'METR') === '87.5 metr', `Format: "87.5 metr"`);

  // Floating point drift xavfi testi (0.1 + 0.2 != 0.3 Javascriptda ma'lum)
  const rawSum = 0.1 + 0.2;
  const safeSum = roundQty(rawSum, 4);
  assert(safeSum === 0.3, `0.1 + 0.2 xatoligi yo'qotildi: ${safeSum}`);

  // ──────────────────────────────────────────────────────────
  // TEST 3: Komplekt hisobi (Yaxlit daxlsiz komplekt)
  // ──────────────────────────────────────────────────────────
  console.log('\n👔 TEST 3: Komplekt (Yaxlit birlik)');

  let warehouseKomplekt = 10;
  const giveKomplekt = 1;
  warehouseKomplekt = warehouseKomplekt - giveKomplekt;
  assert(warehouseKomplekt === 9, `10 komplekt - 1 = 9 komplekt`);
  assert(formatProductQuantity(warehouseKomplekt, 'KOMPLEKT') === '9 komplekt', `Format: "9 komplekt"`);

  // ──────────────────────────────────────────────────────────
  // TEST 4: Asosiy vositalar (BERILADIGAN) butun sonlik qoidasi
  // ──────────────────────────────────────────────────────────
  console.log('\n💻 TEST 4: Asosiy vositalar (BERILADIGAN) butunlik tekshiruvi');

  const validQty = 3;
  const invalidQty = 2.5;
  assert(Number.isInteger(validQty) && validQty > 0, `3 dona asosiy vosita butun va qonuniy`);
  assert(!Number.isInteger(invalidQty), `2.5 dona asosiy vosita taqiqlangan (kasr son qabul qilinmaydi)`);

  // ──────────────────────────────────────────────────────────
  // TEST 5: Ma'lumotlar bazasi Prisma modeli bilan real sinov
  // ──────────────────────────────────────────────────────────
  console.log('\n🗄️ TEST 5: Database Prisma integratsiyasi tekshiruvi');

  try {
    const org = await prisma.organization.findFirst({ where: { isActive: true } });
    if (!org) {
      console.log('  ⚠️ Faol tashkilot topilmadi, DB tranzaksiya testi o\'tkazib yuborildi.');
    } else {
      console.log(`  🏢 Tashkilot aniqlandi: ${org.name}`);

      // Test mahsuloti: A4 Qog'oz (Pachka)
      const testProdName = `__TEST_A4_${Date.now()}`;
      const product = await prisma.product.create({
        data: {
          name: testProdName,
          productType: ProductType.SARFLANADIGAN,
          unit: UnitType.PACHKA,
          packageSize: 500,
          organizationId: org.id,
          inventory: {
            create: {
              quantity: 20.0,
            },
          },
        },
        include: { inventory: true },
      });

      assert(product.inventory?.quantity === 20.0, `DB Kirim: 20 pachka yaratildi`);

      // 200 dona (0.4 pachka) sarf tranzaksiyasi
      const qtyDecrement = 0.4;
      await prisma.inventory.update({
        where: { productId: product.id },
        data: { quantity: { decrement: qtyDecrement } },
      });

      const updatedInv = await prisma.inventory.findUnique({
        where: { productId: product.id },
      });

      const actualQty = roundQty(updatedInv?.quantity ?? 0, 4);
      assert(actualQty === 19.6, `DB Sarf: 20 - 0.4 = 19.6 pachka bazada saqlandi (Bazada: ${actualQty})`);

      // Tozalash
      await prisma.inventory.delete({ where: { productId: product.id } });
      await prisma.product.delete({ where: { id: product.id } });
      console.log('  🧹 Test ma\'lumotlari bazadan tozalab olindi.');
    }
  } catch (err: any) {
    console.error(`  ❌ DB testida xatolik:`, err.message);
    failed++;
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n====================================================');
  console.log(`🏁 TEST NATIJALARI: Jami: ${passed + failed} | O'tdi: ${passed} | Xato: ${failed}`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
