import { ShieldAlert, ExternalLink, Clock } from 'lucide-react';
import Modal from '../ui/modal';
import Button from '../ui/button';
import { limitsApi, type LimitStatusResponse } from '../../api/endpoints/limits.api';
import { formatProductQuantity } from '../../lib/quantity-utils';
import { useTranslation } from '../../hooks/useTranslation';
import { formatSimpleDate, formatLocalizedDateText, formatLocalizedQuarter } from '../../lib/utils';

interface OverLimitNoticeModalProps {
  open: boolean;
  onClose: () => void;
  limitStatus: LimitStatusResponse | null;
  requestedQuantity: number;
  targetName?: string;
  isDepartment?: boolean;
  fallbackMessage?: string;
}

export default function OverLimitNoticeModal({
  open,
  onClose,
  limitStatus,
  requestedQuantity,
  targetName,
  isDepartment,
}: OverLimitNoticeModalProps) {
  const { t, language } = useTranslation();

  if (!open) return null;

  const baseLimit = limitStatus?.baseLimit ?? 0;
  const totalAllowed = limitStatus?.totalAllowed ?? baseLimit;
  const spent = limitStatus?.currentQuarterSpent ?? limitStatus?.currentMonthSpent ?? 0;
  const remaining = limitStatus?.remaining ?? 0;
  const excess = Math.max(0, Math.round((requestedQuantity - remaining) * 10000) / 10000);

  const unit = limitStatus?.unit;
  const packageSize = limitStatus?.packageSize;

  const totalAllowedStr = formatProductQuantity(totalAllowed, unit, packageSize, t);
  const spentStr = formatProductQuantity(spent, unit, packageSize, t);
  const remainingStr = formatProductQuantity(remaining, unit, packageSize, t);
  const requestedStr = formatProductQuantity(requestedQuantity, unit, packageSize, t);
  const excessStr = formatProductQuantity(excess, unit, packageSize, t);

  const nextResetDateStr = formatSimpleDate(limitStatus?.nextResetDate) || '01.01.2027';
  const nextResetText = formatLocalizedDateText(limitStatus?.nextResetDate, language as any);

  const setDateStr = formatSimpleDate(limitStatus?.limitSetDate || limitStatus?.createdAt);

  const localizedQuarter = formatLocalizedQuarter(
    limitStatus?.periodCode,
    limitStatus?.periodName,
    limitStatus?.periodRange,
    language as any
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title=""
      size="md"
      footer={null}
    >
      <div className="space-y-3.5 py-1">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center shrink-0 text-rose-600 dark:text-rose-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">
              {t('limits.overLimitTitle')}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('limits.overLimitSubtitle')}
            </p>
          </div>
        </div>

        {/* Mahsulot va Qabul qiluvchi bloki */}
        <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-3 border border-slate-200 dark:border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200/60 dark:border-slate-800">
            <div className="min-w-0">
              <span className="text-[11px] text-muted-foreground block font-medium">
                {t('limits.product')}
              </span>
              <span className="font-bold text-sm text-foreground truncate block">
                {limitStatus?.productName || t('limits.defaultItemFallback')}
              </span>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[11px] text-muted-foreground block font-medium">
                {isDepartment ? t('limits.department') : t('limits.employee')}
              </span>
              <span className="font-semibold text-xs text-foreground block bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                {targetName || (isDepartment ? t('limits.department') : t('limits.employee'))}
              </span>
            </div>
          </div>

          {/* Sanalar va Davr: 3 ta aniq mini-blok */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-white dark:bg-slate-800/80 p-2 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
              <span className="text-[10px] text-muted-foreground block font-medium uppercase tracking-wider">
                {t('limits.activePeriod')}
              </span>
              <span className="font-bold text-xs text-foreground block mt-0.5 truncate">
                {localizedQuarter.name}
              </span>
              <span className="text-[10px] text-muted-foreground block truncate">
                {localizedQuarter.range}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-800/80 p-2 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
              <span className="text-[10px] text-muted-foreground block font-medium uppercase tracking-wider">
                {t('limits.established')}
              </span>
              <span className="font-bold text-xs text-foreground block mt-0.5">
                {setDateStr || '22.10.2026'}
              </span>
              <span className="text-[10px] text-muted-foreground block">
                {t('limits.limitDate')}
              </span>
            </div>

            <div className="bg-emerald-50/70 dark:bg-emerald-950/30 p-2 rounded-lg border border-emerald-200/80 dark:border-emerald-800/60">
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block font-semibold uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                {t('limits.nextLimit')}
              </span>
              <span className="font-bold text-xs text-emerald-700 dark:text-emerald-300 block mt-0.5">
                {nextResetDateStr}
              </span>
              <span className="text-[10px] text-emerald-600/90 dark:text-emerald-400/90 block truncate">
                {nextResetText || '—'}
              </span>
            </div>
          </div>
        </div>

        {/* 4 ta asosiy ko'rsatkich (Ixcham kataklar) */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
            <span className="text-muted-foreground block text-[11px]">
              {t('limits.colQuarterlyLimit')}
            </span>
            <span className="font-bold text-sm text-foreground block mt-0.5">
              {totalAllowedStr}
            </span>
          </div>

          <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
            <span className="text-muted-foreground block text-[11px]">
              {t('limits.receivedInQuarter')}
            </span>
            <span className="font-bold text-sm text-foreground block mt-0.5">
              {spentStr}
            </span>
          </div>

          <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
            <span className="text-muted-foreground block text-[11px]">
              {t('limits.colRemainingLimit')}
            </span>
            <span className={`font-bold text-sm block mt-0.5 ${remaining > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
              {remainingStr}
            </span>
          </div>

          <div className="p-2.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/60 dark:bg-rose-950/30">
            <span className="text-rose-600 dark:text-rose-400 block text-[11px] font-semibold">
              {t('limits.requestedQuantity')}
            </span>
            <span className="font-bold text-sm text-rose-600 dark:text-rose-400 block mt-0.5">
              {requestedStr}
            </span>
          </div>
        </div>

        {/* Ortiqcha miqdor qatori */}
        {excess > 0 && (
          <div className="text-xs px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 flex items-center justify-between font-medium">
            <span>{t('limits.excessQuantity')}</span>
            <span className="font-bold text-sm">+{excessStr}</span>
          </div>
        )}

        {/* Me'yoriy buyruq havolasi */}
        {(limitStatus?.decreeReference || limitStatus?.fileUrl) && (
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1 pt-0.5">
            <span className="truncate max-w-[240px]">
              {limitStatus.decreeReference || t('limits.internalDecreeBasis')}
            </span>
            {limitStatus.fileUrl && (
              <button
                type="button"
                onClick={() => limitsApi.viewDecree(limitStatus.fileUrl!)}
                className="inline-flex items-center gap-1 text-primary hover:underline font-semibold shrink-0 ml-2 cursor-pointer"
                title={t('limits.viewDecreeTooltip')}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                {t('limits.decreeFilePdf')}
              </button>
            )}
          </div>
        )}

        {/* Yagona Tushundim tugmasi */}
        <div className="pt-2">
          <Button
            onClick={onClose}
            className="w-full h-9 text-xs font-semibold"
          >
            {t('limits.understood')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
