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
  console.log('🔓 ADMIN UNLOCK & COMPLETE ERROR 0-RESET TEST');
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

  const testUsername = `test_unlock_${Date.now()}`;
  const testPassword = 'CorrectPassword123!';
  const wrongPassword = 'WrongPassword999!';
  const passwordHash = await bcrypt.hash(testPassword, 10);

  // 1. Create a test admin and test user
  const adminUser = await prisma.user.findFirst({
    where: { role: UserRole.SUPER_ADMIN },
  });

  const testUser = await prisma.user.create({
    data: {
      username: testUsername,
      fullName: 'Test Unlock User',
      passwordHash,
      role: UserRole.XODIM,
      isActive: true,
      failedLoginAttempts: 3,
      lockedUntil: new Date(Date.now() + 15 * 60 * 1000), // 15 min lock
    },
  });

  console.log(`Foydalanuvchi yaratildi: ${testUser.username}`);

  try {
    // 2. Check lockout status while locked
    console.log('\n🔍 1. Bloklangan holatda checkLockoutStatus tekshirish...');
    const statusLocked = await authService.checkLockoutStatus(testUsername);
    assert(statusLocked.isLocked === true, 'isLocked === true');
    assert(statusLocked.remainingSeconds > 0, `remainingSeconds > 0 (${statusLocked.remainingSeconds}s)`);
    assert(statusLocked.lockedUntil !== null, 'lockedUntil mavjud');

    // 3. Admin unlocks user
    console.log('\n🔑 2. Admin unlockUser() amali...');
    const unlockRes = await usersService.unlockUser(testUser.id, adminUser?.id || testUser.id);
    assert(unlockRes.user.failedLoginAttempts === 0, 'failedLoginAttempts === 0');
    assert(unlockRes.user.lockedUntil === null, 'lockedUntil === null');

    // 4. Check lockout status after admin unlock
    console.log('\n🔍 3. Blokdan chiqqach checkLockoutStatus tekshirish...');
    const statusUnlocked = await authService.checkLockoutStatus(testUsername);
    assert(statusUnlocked.isLocked === false, 'isLocked === false');
    assert(statusUnlocked.remainingSeconds === 0, 'remainingSeconds === 0');
    assert(statusUnlocked.lockedUntil === null, 'lockedUntil === null');

    // 5. Check login after unlock with WRONG password:
    // Should be treated as Attempt 1 (2 attempts left), NOT 1 hour lock!
    console.log('\n🛡️ 4. Blokdan yechilgach yangi urinish (0 dan boshlanishi)...');
    try {
      await authService.login({ username: testUsername, password: wrongPassword });
      assert(false, 'Xato parolda exception berishi kerak edi');
    } catch (err: any) {
      assert(err instanceof UnauthorizedException, 'UnauthorizedException tashlandi');
      const msg = err.response?.message || err.message;
      assert(msg.includes('2 ta urinish'), `Qayta bloklanmadi, 0 dan 1-urinish hisoblandi: "${msg}"`);
    }

    // 6. Check login with CORRECT password
    console.log('\n✨ 5. To\'g\'ri parol bilan muvaffaqiyatli kirish...');
    const loginRes = await authService.login({ username: testUsername, password: testPassword });
    assert(Boolean(loginRes.accessToken), 'AccessToken berildi');
    assert(loginRes.user.username === testUsername, 'Foydalanuvchi ma\'lumotlari qaytdi');

  } finally {
    await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
  }

  console.log('\n====================================================');
  console.log(`Natija: ${passed} ta o'tdi, ${failed} ta yiqildi.`);
  console.log('====================================================');
  if (failed > 0) process.exit(1);
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
