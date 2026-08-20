import React, { useState, useRef, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../hooks/useTranslation';

export type CopyableVariant = 'teal' | 'slate' | 'red' | 'outline' | 'ghost' | 'plain';
export type CopyableSize = '2xs' | 'xs' | 'sm' | 'md';

interface CopyableInventoryNumberProps {
  value?: string | number | null;
  copyValue?: string | number; // optional override for text to copy
  prefix?: string;
  suffix?: string;
  variant?: CopyableVariant;
  size?: CopyableSize;
  showIcon?: boolean;
  className?: string;
  iconClassName?: string;
  title?: string;
}


export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
}

export default function CopyableInventoryNumber({
  value,
  copyValue,
  prefix,
  suffix,
  variant = 'teal',
  size = 'xs',
  showIcon = true,
  className,
  iconClassName,
  title,
}: CopyableInventoryNumberProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const stringVal = value !== undefined && value !== null ? String(value).trim() : '';

  if (!stringVal || stringVal === '—' || stringVal === '-') {
    return <span className="text-slate-400 font-mono select-none">—</span>;
  }

  const textToCopy = copyValue !== undefined ? String(copyValue).trim() : stringVal;

  const handleCopy = async (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const success = await copyToClipboard(textToCopy);
    if (success) {
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    }
  };


  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleCopy(e);
    }
  };

  const defaultTitle = copied
    ? t('common.copied') || 'Nusxalandi!'
    : `${t('common.copyInvTitle') || "Nusxalash uchun bosing"} (${textToCopy})`;

  const sizeClasses: Record<CopyableSize, { badge: string; text: string; icon: string }> = {
    '2xs': {
      badge: 'px-1.5 py-0.5 text-2xs gap-1 rounded-md',
      text: 'text-2xs',
      icon: 'w-2.5 h-2.5',
    },
    xs: {
      badge: 'px-2 py-0.5 text-xs gap-1.5 rounded-lg',
      text: 'text-xs',
      icon: 'w-3 h-3',
    },
    sm: {
      badge: 'px-2.5 py-1 text-xs gap-1.5 rounded-lg',
      text: 'text-xs',
      icon: 'w-3.5 h-3.5',
    },
    md: {
      badge: 'px-3 py-1.5 text-sm gap-2 rounded-xl',
      text: 'text-sm',
      icon: 'w-4 h-4',
    },
  };

  const variantClasses: Record<CopyableVariant, string> = {
    teal: cn(
      'bg-teal-50/90 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300',
      'border border-teal-200/90 dark:border-teal-800/80',
      'hover:bg-teal-100 hover:border-teal-400 dark:hover:bg-teal-900/70 dark:hover:border-teal-600',
      'shadow-2xs active:scale-95'
    ),
    slate: cn(
      'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200',
      'border border-slate-200 dark:border-slate-700',
      'hover:bg-slate-200 hover:border-slate-300 dark:hover:bg-slate-750 dark:hover:border-slate-600',
      'shadow-2xs active:scale-95'
    ),
    red: cn(
      'bg-rose-50/90 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300',
      'border border-rose-200/90 dark:border-rose-800/80',
      'hover:bg-rose-100 hover:border-rose-400 dark:hover:bg-rose-900/70 dark:hover:border-rose-600',
      'shadow-2xs active:scale-95'
    ),
    outline: cn(
      'bg-transparent text-slate-800 dark:text-slate-200',
      'border border-slate-300 dark:border-slate-700',
      'hover:bg-slate-50 hover:border-teal-500 dark:hover:bg-slate-800/60 dark:hover:border-teal-400 dark:hover:text-teal-300',
      'shadow-2xs active:scale-95'
    ),
    ghost: cn(
      'bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300',
      'hover:text-teal-600 dark:hover:text-teal-400',
      'border border-transparent hover:border-slate-200 dark:hover:border-slate-700'
    ),
    plain: cn(
      'bg-transparent text-slate-900 dark:text-slate-100 hover:text-teal-600 dark:hover:text-teal-400',
      'p-0 border-0 shadow-none'
    ),
  };

  const { badge, text, icon } = sizeClasses[size];

  return (
    <button
      type="button"
      onClick={handleCopy}
      onKeyDown={handleKeyDown}
      title={title || defaultTitle}
      className={cn(
        'inline-flex items-center font-mono font-bold tracking-tight cursor-pointer transition-all duration-150 select-none group',
        badge,
        variantClasses[variant],
        className
      )}
    >
      <span className={cn('truncate', text)}>
        {prefix}
        {stringVal}
        {suffix}
      </span>

      {showIcon && (
        <span
          className={cn(
            'inline-flex items-center justify-center shrink-0 transition-transform duration-200',
            copied ? 'text-emerald-600 dark:text-emerald-400 scale-110' : 'text-slate-400 dark:text-slate-500 group-hover:text-teal-600 dark:group-hover:text-teal-300',
            iconClassName
          )}
        >
          {copied ? (
            <Check className={cn(icon, 'stroke-[2.5] animate-in zoom-in-50 duration-200')} />
          ) : (
            <Copy className={cn(icon, 'opacity-70 group-hover:opacity-100 transition-opacity')} />
          )}
        </span>
      )}
    </button>
  );
}
