/**
 * WMS Enterprise - Avtomatlashtirilgan PostgreSQL Zaxira (Backup) Skripti
 * 
 * Ishga tushirish: npm run db:backup
 * Vazifasi:
 *  1. .env faylidan DATABASE_URL ni o'qiydi
 *  2. backups/ papkasiga sana va vaqt bilan dump yaratadi
 *  3. 14 kundan eski zaxira fayllarini disk to'lib ketmasligi uchun avtomatik tozalaydi
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 1. .env faylini o'qish
function loadEnv() {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [key, ...values] = trimmed.split('=');
      if (key && values.length > 0 && !process.env[key.trim()]) {
        process.env[key.trim()] = values.join('=').trim().replace(/^["']|["']$/g, '');
      }
    }
  }
}

loadEnv();

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('❌ Xatolik: DATABASE_URL topilmadi. .env faylini tekshiring.');
  process.exit(1);
}

// 2. DATABASE_URL ni tahlil qilish
// Format: postgresql://USER:PASSWORD@HOST:PORT/DBNAME?schema=...
const urlMatch = dbUrl.match(/postgres(?:ql)?:\/\/([^:]+):([^@]+)@([^:/]+)(?::(\d+))?\/([^?]+)/);
if (!urlMatch) {
  console.error('❌ Xatolik: DATABASE_URL formati noto‘g‘ri yoki qo‘llab-quvvatlanmaydi.');
  process.exit(1);
}

const [, user, password, host, portStr, dbName] = urlMatch;
const port = portStr || '5432';

// 3. backups/ papkasini yaratish
const backupDir = path.join(__dirname, '../backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

// Sana formati: YYYY-MM-DD_HH-mm-ss
const now = new Date();
const timestamp = now.toISOString().replace(/[:T]/g, '-').slice(0, 19);
const filename = `wms_backup_${dbName}_${timestamp}.dump`;
const targetFile = path.join(backupDir, filename);

console.log('====================================================');
console.log('💾 WMS MAʼLUMOTLAR BAZASI ZAXIRA (BACKUP) JARAYONI');
console.log('====================================================');
console.log(`Baza nomi: ${dbName}`);
console.log(`Server: ${host}:${port}`);
console.log(`Foydalanuvchi: ${user}`);
console.log(`Fayl manzili: ${targetFile}\n`);

// 4. pg_dump ni ishga tushirish
try {
  process.env.PGPASSWORD = decodeURIComponent(password);
  
  // Format: Custom compressed binary (-F c)
  const dumpCmd = `pg_dump -h ${host} -p ${port} -U ${user} -F c -b -v -f "${targetFile}" ${dbName}`;
  console.log('⏳ Zaxira olinmoqda (pg_dump)...');
  
  execSync(dumpCmd, { stdio: 'inherit' });

  const stats = fs.statSync(targetFile);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`\n✅ Zaxira muvaffaqiyatli saqlandi! Hajmi: ${sizeMB} MB`);
} catch (err) {
  console.error('\n⚠️ pg_dump buyrug‘ida xatolik yuz berdi.');
  console.error('Eslatma: Tizimingizda PostgreSQL "pg_dump" utilitasi o‘rnatilgan va PATH muhitiga qo‘shilgan bo‘lishi lozim.');
  console.error('Xatolik tafsiloti:', err.message);
  process.exit(1);
}

// 5. 14 kundan eski zaxiralarni avtomatik tozalash (Retention Policy)
try {
  console.log('\n🧹 Eski zaxiralarni tozalash tekshiruvi (14 kunlik meʼyor)...');
  const files = fs.readdirSync(backupDir);
  const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
  let deletedCount = 0;

  for (const file of files) {
    if (file.startsWith('wms_backup_') && (file.endsWith('.dump') || file.endsWith('.sql'))) {
      const filePath = path.join(backupDir, file);
      const fStat = fs.statSync(filePath);
      if (Date.now() - fStat.mtimeMs > fourteenDaysMs) {
        fs.unlinkSync(filePath);
        console.log(`  🗑️ Eski zaxira o‘chirildi: ${file}`);
        deletedCount++;
      }
    }
  }

  if (deletedCount === 0) {
    console.log('  Eski zaxira fayllari yo‘q.');
  }
} catch (cleanErr) {
  console.warn('Eski fayllarni tozalashda ogohlantirish:', cleanErr.message);
}

console.log('\n🎉 JARAYON TUGADI.');
console.log('====================================================\n');
