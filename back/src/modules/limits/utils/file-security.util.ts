import { BadRequestException } from '@nestjs/common';
import * as path from 'path';

export const MAX_DECREE_FILE_SIZE = 5 * 1024 * 1024; // 5 MB max (Buyruq hujjati va skaner uchun optimal)

export const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.doc',
  '.docx',
]);

export const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export const DANGEROUS_EXTENSIONS = new Set([
  '.exe',
  '.bat',
  '.cmd',
  '.sh',
  '.bash',
  '.php',
  '.phtml',
  '.php3',
  '.php4',
  '.php5',
  '.js',
  '.vbs',
  '.vbe',
  '.wsf',
  '.wsh',
  '.msi',
  '.dll',
  '.com',
  '.scr',
  '.pif',
  '.jar',
  '.py',
  '.apk',
  '.bin',
  '.app',
  '.deb',
  '.rpm',
  '.iso',
  '.ps1',
]);

/**
 * Fayl xavfsizligini qat'iy tekshirish:
 * 1. Hajm chegarasi (Max 20MB)
 * 2. Kengaytma (Whitelist: faqat PDF, rasm, Word)
 * 3. MIME turi
 * 4. Magic Bytes (Antivirus: Zararli EXE/DLL/Script yoki soxtalashtirilgan kengaytmalarni aniqlash)
 */
export function validateDecreeFile(file: any): { safeExtension: string } {
  if (!file) {
    throw new BadRequestException('Fayl yuborilmadi!');
  }

  // 1. Hajm tekshiruvi (Max 5 MB)
  const size = file.size || file.buffer?.length || 0;
  if (size <= 0) {
    throw new BadRequestException('Fayl bo‘sh (0 bayt)!');
  }
  if (size > MAX_DECREE_FILE_SIZE) {
    throw new BadRequestException(
      `Fayl hajmi ruxsat etilgan meʼyordan katta (${(size / 1024 / 1024).toFixed(1)} MB). 1 dona buyruq hujjati uchun maksimal 5 MB gacha ruxsat berilgan!`,
    );
  }

  // 2. Kengaytma tekshiruvi
  const originalName = file.originalname || '';
  const ext = path.extname(originalName).toLowerCase();

  if (DANGEROUS_EXTENSIONS.has(ext)) {
    throw new BadRequestException(
      `Xavfsizlik ogohlantirishi: Ijro etiluvchi yoki skript fayllarni (${ext}) yuklash qat'iyan taqiqlangan!`,
    );
  }

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new BadRequestException(
      `Ruxsat berilmagan fayl formati (${ext})! Faqat PDF (.pdf), Rasm (.jpg, .jpeg, .png) yoki Word (.doc, .docx) hujjatlarini yuklash mumkin.`,
    );
  }

  // 3. MIME turi tekshiruvi
  if (file.mimetype && !ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
    throw new BadRequestException(
      `Fayl MIME turi noto‘g‘ri (${file.mimetype}). Haqiqiy hujjat yuklang!`,
    );
  }

  // 4. Binar imzo (Magic Bytes) orqali chuqur tekshiruv (Antivirus & Anti-spoofing)
  const buffer: Buffer = file.buffer;
  if (buffer && buffer.length >= 4) {
    // A) DOS / Windows Executable (MZ header)
    if (buffer[0] === 0x4d && buffer[1] === 0x5a) {
      throw new BadRequestException(
        'Xavfsizlik xatosi: Zararli dastur yoki ijro etiluvchi fayl (EXE/DLL) aniqlandi!',
      );
    }

    // B) Linux Executable (ELF header)
    if (
      buffer[0] === 0x7f &&
      buffer[1] === 0x45 &&
      buffer[2] === 0x4c &&
      buffer[3] === 0x46
    ) {
      throw new BadRequestException(
        'Xavfsizlik xatosi: Linux binar fayli (ELF) aniqlandi!',
      );
    }

    // C) Skript / Web-shell boshlanishi (<?php, <script, #!/bin)
    const headerAscii = buffer.subarray(0, 100).toString('ascii').toLowerCase();
    if (
      headerAscii.includes('<?php') ||
      headerAscii.includes('<script') ||
      headerAscii.includes('#!/bin') ||
      headerAscii.includes('powershell')
    ) {
      throw new BadRequestException(
        'Xavfsizlik xatosi: Fayl ichida shubhali skript kodi aniqlandi!',
      );
    }

    // D) Formatga muvofiqlik (Fayl soxtalashtirilmaganmi?)
    if (ext === '.pdf') {
      const isRealPdf = buffer.subarray(0, 1024).toString('ascii').includes('%PDF-');
      if (!isRealPdf) {
        throw new BadRequestException(
          'Fayl soxtalashtirilgan: Kengaytmasi .pdf bo‘lsa-da, haqiqiy PDF standarti aniqlanmadi!',
        );
      }
    } else if (ext === '.png') {
      const isPng =
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47;
      if (!isPng) {
        throw new BadRequestException('Fayl haqiqiy PNG rasm emas!');
      }
    } else if (ext === '.jpg' || ext === '.jpeg') {
      const isJpg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
      if (!isJpg) {
        throw new BadRequestException('Fayl haqiqiy JPEG rasm emas!');
      }
    } else if (ext === '.docx') {
      // DOCX - bu ZIP konteyner (boshi PK / 0x50, 0x4B)
      const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b;
      if (!isZip) {
        throw new BadRequestException('Fayl haqiqiy DOCX hujjati emas!');
      }
    } else if (ext === '.doc') {
      // DOC - bu Compound File Binary Format (0xD0, 0xCF, 0x11, 0xE0)
      const isOle =
        buffer[0] === 0xd0 &&
        buffer[1] === 0xcf &&
        buffer[2] === 0x11 &&
        buffer[3] === 0xe0;
      if (!isOle) {
        throw new BadRequestException('Fayl haqiqiy DOC hujjati emas!');
      }
    }
  }

  return { safeExtension: ext };
}
