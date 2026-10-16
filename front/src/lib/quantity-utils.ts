/**
 * Quantity and Unit formatting utilities with package-to-piece conversions
 * and fractional measurement support (Litr, Kg, Metr, Pachka, Dona).
 */

export function roundQuantity(val: number, decimals: number = 4): number {
  const factor = Math.pow(10, decimals);
  return Math.round((Number(val) || 0) * factor) / factor;
}

export function formatQuantityNumber(val: number): string {
  const rounded = roundQuantity(val, 3);
  // Remove unnecessary trailing zeroes e.g. 3.60 -> 3.6
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(3).replace(/\.?0+$/, '');
}

export function getUnitLabel(
  unit?: string | null,
  t?: (key: string, params?: any) => string,
): string {
  if (!unit) return t ? t('common.pcs') : 'dona';
  const upper = unit.toUpperCase().trim();
  if (t) {
    if (upper === 'DONA' || upper === 'PIECE') return t('common.units.DONA');
    if (upper === 'PACHKA' || upper === 'PACK') return t('common.units.PACHKA');
    if (upper === 'KOMPLEKT') return t('common.units.KOMPLEKT');
    if (upper === 'LITR' || upper === 'LITER') return t('common.units.LITR');
    if (upper === 'KG') return t('common.units.KG');
    if (upper === 'METR') return t('common.units.METR');
  }
  switch (upper) {
    case 'PACHKA':
    case 'PACK':
      return 'pachka';
    case 'KOMPLEKT':
      return 'komplekt';
    case 'LITR':
    case 'LITER':
      return 'litr';
    case 'KG':
      return 'kg';
    case 'METR':
      return 'metr';
    case 'DONA':
    case 'PIECE':
      return 'dona';
    default:
      return unit.toLowerCase();
  }
}

/**
 * Formats product quantity cleanly:
 * - When unit is PACHKA and packageSize > 1:
 *   e.g. qty=19.6, packageSize=500 -> "19 pachka, 300 dona"
 *   e.g. qty=20, packageSize=500 -> "20 pachka"
 *   e.g. qty=0.4, packageSize=500 -> "200 dona"
 * - When unit is LITR / KG / METR:
 *   e.g. qty=3.6 -> "3.6 litr"
 * - When unit is DONA:
 *   e.g. qty=5 -> "5 dona"
 */
export function formatProductQuantity(
  quantity: number,
  unit?: string | null,
  packageSize?: number | null,
  t?: (key: string, params?: any) => string,
): string {
  const qty = Number(quantity) || 0;
  const upperUnit = (unit || 'DONA').toUpperCase().trim();
  const unitText = getUnitLabel(upperUnit, t);
  const donaText = getUnitLabel('DONA', t);

  if ((upperUnit === 'PACHKA' || upperUnit === 'PACK') && packageSize && packageSize > 1) {
    const totalPieces = Math.round(qty * packageSize);
    const wholePacks = Math.floor(totalPieces / packageSize);
    const remainderPieces = totalPieces % packageSize;

    if (remainderPieces === 0) {
      return `${wholePacks} ${unitText}`;
    }
    if (wholePacks === 0) {
      return `${remainderPieces} ${donaText}`;
    }
    return `${wholePacks} ${unitText}, ${remainderPieces} ${donaText}`;
  }

  return `${formatQuantityNumber(qty)} ${unitText}`;
}

/**
 * Converts pieces (dona) to packages (pachka)
 * e.g. 200 dona of A4 (500 per pack) -> 0.4 pachka
 */
export function convertPiecesToPackages(pieces: number, packageSize: number): number {
  if (!packageSize || packageSize <= 0) return pieces;
  return roundQuantity(pieces / packageSize, 4);
}

/**
 * Converts packages (pachka) to total pieces (dona)
 * e.g. 19.6 pachka of A4 (500 per pack) -> 9800 dona
 */
export function convertPackagesToPieces(packages: number, packageSize: number): number {
  if (!packageSize || packageSize <= 0) return packages;
  return Math.round(packages * packageSize);
}
