export function numberToWordsUz(num: number): string {
  if (!num || num <= 0) return '';

  const ones = ['', 'bir', 'ikki', 'uch', 'to‘rt', 'besh', 'olti', 'yetti', 'sakkiz', 'to‘qqiz'];
  const tens = ['', 'o‘n', 'yigirma', 'o‘ttiz', 'qirq', 'ellik', 'oltmish', 'yetmish', 'sakkson', 'to‘qson'];

  if (num < 10) return ones[num].charAt(0).toUpperCase() + ones[num].slice(1);
  if (num < 100) {
    const t = Math.floor(num / 10);
    const o = num % 10;
    const res = (tens[t] + (o ? ' ' + ones[o] : '')).trim();
    return res.charAt(0).toUpperCase() + res.slice(1);
  }
  if (num < 1000) {
    const h = Math.floor(num / 100);
    const rem = num % 100;
    const res = ((h === 1 ? 'yuz' : ones[h] + ' yuz') + (rem ? ' ' + numberToWordsUz(rem).toLowerCase() : '')).trim();
    return res.charAt(0).toUpperCase() + res.slice(1);
  }
  if (num < 1000000) {
    const th = Math.floor(num / 1000);
    const rem = num % 1000;
    const res = ((th === 1 ? 'ming' : numberToWordsUz(th).toLowerCase() + ' ming') + (rem ? ' ' + numberToWordsUz(rem).toLowerCase() : '')).trim();
    return res.charAt(0).toUpperCase() + res.slice(1);
  }

  return num.toString();
}
