import { BadRequestException } from '@nestjs/common';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

/**
 * Telefon raqamni xalqaro va milliy standart (UZ, RU, xalqaro) bo'yicha tekshiradi
 * va E.164 standartiga (masalan: +998901234567) keltiradi.
 */
export function validateAndFormatPhone(
  phone?: string | null,
  required = false,
): string | undefined {
  if (!phone || !phone.trim()) {
    if (required) {
      throw new BadRequestException("Telefon raqami kiritilishi shart");
    }
    return undefined;
  }

  const rawPhone = phone.trim();

  // libphonenumber orqali tekshirish (default mamlakat: UZ)
  const phoneNumber = parsePhoneNumberFromString(rawPhone, 'UZ');

  if (!phoneNumber || !phoneNumber.isValid()) {
    throw new BadRequestException(
      `Noto'g'ri telefon raqami formati: "${rawPhone}". Masalan: +998 90 123-45-67`,
    );
  }

  return phoneNumber.format('E.164');
}

/**
 * Pasport seriyasi va raqamini tekshiradi (2 ta harf + 7 ta raqam)
 */
export function validateAndFormatPassport(
  passport?: string | null,
  required = false,
): string | undefined {
  if (!passport || !passport.trim()) {
    if (required) {
      throw new BadRequestException("Pasport seriyasi va raqami kiritilishi shart");
    }
    return undefined;
  }

  const cleaned = passport.trim().toUpperCase().replace(/\s+/g, '');
  const passportRegex = /^[A-Z]{2}\d{7}$/;

  if (!passportRegex.test(cleaned)) {
    throw new BadRequestException(
      `Pasport seriyasi va raqami noto'g'ri: "${passport}". Format: AA1234567 yoki FA1234567 (2 ta lotin harfi va 7 ta raqam)`,
    );
  }

  return cleaned;
}

/**
 * JSHSHIR (PINFL) ni tekshiradi (Qat'iy 14 ta raqam)
 */
export function validateAndFormatPinfl(
  pinfl?: string | null,
  required = false,
): string | undefined {
  if (!pinfl || !pinfl.trim()) {
    if (required) {
      throw new BadRequestException("JSHSHIR (PINFL) kiritilishi shart");
    }
    return undefined;
  }

  const cleaned = pinfl.trim().replace(/\s+/g, '');
  const pinflRegex = /^\d{14}$/;

  if (!pinflRegex.test(cleaned)) {
    throw new BadRequestException(
      `JSHSHIR (PINFL) noto'g'ri: "${pinfl}". JSHSHIR qat'iy 14 ta raqamdan iborat bo'lishi shart`,
    );
  }

  return cleaned;
}
