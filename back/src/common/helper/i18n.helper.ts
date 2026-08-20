import { I18nContext } from 'nestjs-i18n';

/**
 * Global helper to translate strings using the current request's i18n context.
 * If there is no active request context (e.g. seeding, cron jobs), it returns the fallback or key.
 */
export function t(key: string, args?: Record<string, any>, fallback?: string): string {
  const ctx = I18nContext.current();
  if (!ctx) return fallback || key;
  return ctx.t(key, { args }) as string;
}
