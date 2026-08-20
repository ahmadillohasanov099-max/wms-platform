import type { ReactNode } from 'react';
import Card from './card';
import { cn } from '../../lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtext?: string | ReactNode;
  icon: ReactNode;
  iconBgColor?: string;
  iconTextColor?: string;
  onClick?: () => void;
  className?: string;
  tooltip?: string;
}

export default function StatsCard({
  title,
  value,
  subtext,
  icon,
  iconBgColor = 'bg-primary-50 dark:bg-primary-950/40',
  iconTextColor = 'text-primary-600 dark:text-primary-400',
  onClick,
  className,
  tooltip,
}: StatsCardProps) {
  return (
    <Card
      onClick={onClick}
      title={tooltip}
      className={cn(
        'transition-all duration-200',
        onClick && 'cursor-pointer hover:shadow-md hover:-translate-y-0.5',
        className
      )}
    >
      <div className="p-4 sm:p-5 flex items-center justify-between gap-3" title={tooltip}>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
            {title}
          </p>
          <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1 truncate" title={tooltip}>
            {value}
          </h3>
          {subtext && (
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
              {subtext}
            </div>
          )}
        </div>
        <div
          className={cn(
            'w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-800',
            iconBgColor,
            iconTextColor
          )}
        >
          {icon}
        </div>
      </div>
    </Card>
  );
}
