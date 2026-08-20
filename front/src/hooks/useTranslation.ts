import { useUiStore } from '../store/ui.store';
import { translations } from '../lib/translations';

function getNestedValue(obj: any, keys: string[]) {
  let curr = obj;
  for (const k of keys) {
    if (curr && typeof curr === 'object' && curr[k] !== undefined) {
      curr = curr[k];
    } else {
      return undefined;
    }
  }
  return curr;
}

export function useTranslation() {
  const language = useUiStore((state) => state.language);

  const t = (key: string, replacements?: Record<string, string | number>): string => {
    if (!key) return '';
    const keys = key.split('.');

    // 1. Try selected language
    let val = getNestedValue((translations as any)[language], keys);

    // 2. Fallback to default language 'uz'
    if (val === undefined && language !== 'uz') {
      val = getNestedValue((translations as any)['uz'], keys);
    }

    // 3. Fallback to 'ru'
    if (val === undefined && language !== 'ru') {
      val = getNestedValue((translations as any)['ru'], keys);
    }

    // 4. Fallback to 'en'
    if (val === undefined && language !== 'en') {
      val = getNestedValue((translations as any)['en'], keys);
    }

    if (val === undefined) {
      return key;
    }

    if (typeof val === 'string' && replacements) {
      return Object.entries(replacements).reduce(
        (str, [k, v]) => str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
        val
      );
    }

    return typeof val === 'string' ? val : key;
  };

  return { t, language };
}

