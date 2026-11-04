import { PrismaClient, UserRole } from '@prisma/client';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../src/modules/auth/auth.service';
import { UsersService } from '../src/modules/users/users.service';

const prisma = new PrismaClient();
const jwtService = new JwtService({
  secret: 'test-jwt-secret-key-for-testing-12345',
  signOptions: { expiresIn: '1h' },
});
const authService = new AuthService(prisma as any, jwtService);
const usersService = new UsersService(
  prisma as any,
  {} as any,
  {} as any,
  {} as any,
  {} as any,
  {} as any,
);

async function run() {
  console.log('====================================================');
  console.log('🛡️ PROGRESSIV LOGIN RATE LIMITING VA ACCOUNT LOCKOUT TESTI');
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

  const testUsername = `test_ratelimit_${Date.now()}`;
  const testPassword = 'CorrectPassword123!';
  const wrongPassword = 'WrongPassword999!';
  const passwordHash = await bcrypt.hash(testPassword, 10);

  // 1. Test foydalanuvchisini yaratish
  console.log('📋 1. Test foydalanuvchisini tayyorlash...');
  const testUser = await prisma.user.create({
    data: {
      username: testUsername,
      fullName: 'Test Xavfsizlik Foydalanuvchisi',
      passwordHash,
      role: UserRole.XODIM,
      isActive: true,
    },
  });
  console.log(`  Foydalanuvchi yaratildi: ID=${testUser.id}, Username=${testUser.username}\n`);

  try {
    // 2. 1-marta noto'g'ri parol kiritish
    console.log("🔒 2. 1-marta noto'g'ri parol tekshiruvi...");
    try {
      await authService.login({ username: testUsername, password: wrongPassword });
      assert(false, "Noto'g'ri parolda xatolik berishi kerak edi");
    } catch (err: any) {
      assert(err instanceof UnauthorizedException, 'UnauthorizedException tashlandi');
      const msg = err.response?.message || err.message;
      assert(msg.includes('2 ta urinish'), `Qolgan urinishlar to'g'ri ko'rsatildi: "${msg}"`);
    }

    const userAfterAttempt1 = await prisma.user.findUnique({ where: { id: testUser.id } });
    assert(userAfterAttempt1?.failedLoginAttempts === 1, 'Bazada failedLoginAttempts == 1');
    assert(userAfterAttempt1?.lockedUntil === null, 'Bazada lockedUntil == null (hali bloklanmagan)');

    // 3. 2-marta noto'g'ri parol kiritish
    console.log("\n🔒 3. 2-marta noto'g'ri parol tekshiruvi...");
    try {
      await authService.login({ username: testUsername, password: wrongPassword });
      assert(false, "Noto'g'ri parolda xatolik berishi kerak edi");
    } catch (err: any) {
      assert(err instanceof UnauthorizedException, 'UnauthorizedException tashlandi');
      const msg = err.response?.message || err.message;
      assert(msg.includes('1 ta xato urinish'), `Ogohlantirish to'g'ri ko'rsatildi: "${msg}"`);
    }

    const userAfterAttempt2 = await prisma.user.findUnique({ where: { id: testUser.id } });
    assert(userAfterAttempt2?.failedLoginAttempts === 2, 'Bazada failedLoginAttempts == 2');
    assert(userAfterAttempt2?.lockedUntil === null, 'Bazada lockedUntil == null');

    // 4. 3-marta noto'g'ri parol kiritish (1-bosqich: 15 daqiqaga bloklanishi kerak)
    console.log("\n🚫 4. 3-marta noto'g'ri parol kiritish (1-BOSQICH: 15 daqiqaga bloklash)...");
    try {
      await authService.login({ username: testUsername, password: wrongPassword });
      assert(false, "3-xatoda blok xatosi berishi kerak edi");
    } catch (err: any) {
      assert(err instanceof UnauthorizedException, 'UnauthorizedException tashlandi');
      const resp = err.response;
      assert(resp?.isLocked === true, 'Response isLocked === true');
      assert(resp?.remainingSeconds === 15 * 60, 'Response remainingSeconds === 900 (15 min)');
      assert(resp?.message.includes('15 daqiqaga'), `15 daqiqaga bloklash xabari chiqdi: "${resp?.message}"`);
    }

    const userAfterAttempt3 = await prisma.user.findUnique({ where: { id: testUser.id } });
    assert(userAfterAttempt3?.failedLoginAttempts === 3, 'Bazada failedLoginAttempts == 3');
    assert(
      Boolean(userAfterAttempt3?.lockedUntil && userAfterAttempt3.lockedUntil > new Date()),
      `Bazada lockedUntil o'rnatildi: ${userAfterAttempt3?.lockedUntil?.toISOString()}`,
    );

    // 5. Bloklangan paytda kirishga urinish (Live timer ma'lumotlari)
    console.log("\n⛔ 5. Bloklangan holatda kirishga urinish...");
    try {
      await authService.login({ username: testUsername, password: testPassword });
      assert(false, "Bloklangan akkaunt tizimga kira olmasligi kerak edi");
    } catch (err: any) {
      assert(err instanceof UnauthorizedException, 'UnauthorizedException tashlandi');
      const resp = err.response;
      assert(resp?.isLocked === true, 'Blokda response.isLocked === true');
      assert(typeof resp?.remainingSeconds === 'number', `remainingSeconds mavjud: ${resp?.remainingSeconds}`);
      assert(resp?.message.includes('vaqtincha bloklangan'), `Bloklanganlik xabari chiqdi: "${resp?.message}"`);
    }

    // 6. 15 daqiqalik blok muddati tugagach yana 1 ta xato qilsa -> 2-BOSQICH: 1 soatga bloklash!
    console.log("\n⏳ 6. 15 daqiqa o'tgach yana 1 marta xato qilish (2-BOSQICH: 1 soatga qat'iy bloklash)...");
    // Blok vaqtini o'tmishga suramiz (15 daqiqa o'tgan deb simulyatsiya qilamiz)
    await prisma.user.update({
      where: { id: testUser.id },
      data: { lockedUntil: new Date(Date.now() - 1000) },
    });

    try {
      await authService.login({ username: testUsername, password: wrongPassword });
      assert(false, "2-bosqichda blok xatosi berishi kerak edi");
    } catch (err: any) {
      assert(err instanceof UnauthorizedException, 'UnauthorizedException tashlandi');
      const resp = err.response;
      assert(resp?.isLocked === true, 'Response isLocked === true');
      assert(resp?.remainingSeconds === 60 * 60, 'Response remainingSeconds === 3600 (1 soat)');
      assert(resp?.message.includes('1 soat muddatga'), `1 soatlik bloklash xabari chiqdi: "${resp?.message}"`);
    }

    const userAfterStage2 = await prisma.user.findUnique({ where: { id: testUser.id } });
    assert(userAfterStage2?.failedLoginAttempts === 4, 'Bazada failedLoginAttempts == 4');

    // 7. Admin tomonidan blokdan chiqarish (Unlock)
    console.log("\n🔓 7. Admin tomonidan blokdan chiqarish (Unlock)...");
    const unlockResult = await usersService.unlockUser(testUser.id, testUser.id);
    assert(unlockResult.message === 'Xodim blokdan muvaffaqiyatli chiqarildi', 'Unlock javobi muvaffaqiyatli');

    const userAfterUnlock = await prisma.user.findUnique({ where: { id: testUser.id } });
    assert(userAfterUnlock?.failedLoginAttempts === 0, 'Unlockdan so\'ng failedLoginAttempts == 0');
    assert(userAfterUnlock?.lockedUntil === null, 'Unlockdan so\'ng lockedUntil == null');

    // 8. Blokdan chiqqandan so'ng to'g'ri parol bilan muvaffaqiyatli kirish
    console.log("\n✅ 8. To'g'ri parol bilan tizimga kirish...");
    const loginSuccess = await authService.login({ username: testUsername, password: testPassword });
    assert(Boolean(loginSuccess.accessToken), 'AccessToken muvaffaqiyatli berildi');
    assert(Boolean(loginSuccess.refreshToken), 'RefreshToken muvaffaqiyatli berildi');
    assert(loginSuccess.user.username === testUsername, 'Foydalanuvchi ma\'lumotlari to\'g\'ri qaytdi');

    const finalUser = await prisma.user.findUnique({ where: { id: testUser.id } });
    assert(finalUser?.failedLoginAttempts === 0, 'Muvaffaqiyatli logindan so\'ng hisoblagich 0 bo\'lib qoldi');

  } finally {
    // 9. Test ma'lumotlarini tozalash
    console.log('\n🧹 9. Test foydalanuvchisini tozalash...');
    await prisma.refreshToken.deleteMany({ where: { userId: testUser.id } });
    await prisma.auditLog.deleteMany({ where: { userId: testUser.id } });
    await prisma.auditLog.deleteMany({ where: { resourceId: testUser.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
    console.log('  Tozalandi.');
  }

  console.log('\n====================================================');
  console.log(`📊 TEST NATIJALARI: Jami: ${passed + failed} | O'tdi: ${passed} ✅ | Yiqildi: ${failed} ❌`);
  console.log('====================================================');

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  prisma.$disconnect();
  process.exit(1);
});
