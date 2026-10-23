export function numberToWordsUz(num: number): string {
  if (!num || isNaN(num) || num <= 0) return '';

  if (!Number.isInteger(num)) {
    const parts = num.toString().split('.');
    const intPart = parseInt(parts[0], 10) || 0;
    const decStr = parts[1] || '';
    const intWords = intPart > 0 ? numberToWordsUz(intPart) : 'Nol';

    if (decStr.length === 1) {
      const decVal = parseInt(decStr, 10);
      return `${intWords} butun o‘ndan ${numberToWordsUz(decVal).toLowerCase()}`;
    } else if (decStr.length === 2) {
      const decVal = parseInt(decStr, 10);
      return `${intWords} butun yuzdan ${numberToWordsUz(decVal).toLowerCase()}`;
    } else if (decStr.length === 3) {
      const decVal = parseInt(decStr, 10);
      return `${intWords} butun mingdan ${numberToWordsUz(decVal).toLowerCase()}`;
    }
    return `${num}`;
  }

  const intNum = Math.floor(num);
  const ones = ['', 'bir', 'ikki', 'uch', 'to‘rt', 'besh', 'olti', 'yetti', 'sakkiz', 'to‘qqiz'];
  const tens = ['', 'o‘n', 'yigirma', 'o‘ttiz', 'qirq', 'ellik', 'oltmish', 'yetmish', 'sakkson', 'to‘qson'];

  if (intNum < 10) {
    const w = ones[intNum] || '';
    return w ? w.charAt(0).toUpperCase() + w.slice(1) : '';
  }
  if (intNum < 100) {
    const t = Math.floor(intNum / 10);
    const o = intNum % 10;
    const res = (tens[t] + (o ? ' ' + ones[o] : '')).trim();
    return res ? res.charAt(0).toUpperCase() + res.slice(1) : '';
  }
  if (intNum < 1000) {
    const h = Math.floor(intNum / 100);
    const rem = intNum % 100;
    const res = ((h === 1 ? 'yuz' : ones[h] + ' yuz') + (rem ? ' ' + numberToWordsUz(rem).toLowerCase() : '')).trim();
    return res ? res.charAt(0).toUpperCase() + res.slice(1) : '';
  }
  if (intNum < 1000000) {
    const th = Math.floor(intNum / 1000);
    const rem = intNum % 1000;
    const res = ((th === 1 ? 'ming' : numberToWordsUz(th).toLowerCase() + ' ming') + (rem ? ' ' + numberToWordsUz(rem).toLowerCase() : '')).trim();
    return res ? res.charAt(0).toUpperCase() + res.slice(1) : '';
  }

  return intNum.toString();
}
