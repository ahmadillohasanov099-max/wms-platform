import { cn } from "../../lib/utils";
interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  title?: string;
}
interface CardHeaderProps {
  title: React.ReactNode;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}
export default function Card({ children, className, onClick, title }: CardProps) {
  return (
    <div
      onClick={onClick}
      title={title}
      className={cn(
        'group bg-white border border-gray-200/80 rounded-xl shadow-xs text-gray-900 transition-all duration-200 ease-out hover:shadow-md',
        'dark:bg-slate-900/50 dark:backdrop-blur-xl dark:border-white/15 dark:text-white dark:shadow-xl',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      {children}
    </div>
  );
}
export function CardHeader({ title, subtitle, action, className }: CardHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-white/15',
        className,
      )}
    >
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white dark:font-bold">
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs text-gray-500 dark:text-slate-300 mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
export function CardContent({ children, className }: CardProps) {
  return (
    <div className={cn('px-5 py-4', className)}>
      {children}
    </div>
  );
}
export function StatCard({
  label,
  value,
  icon,
  trend,
  trendValue,
  color = 'green',
  className,
  onClick,
  title,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: 'up' | 'down';
  trendValue?: string;
  color?: 'green' | 'blue' | 'red' | 'yellow' | 'purple';
  className?: string;
  onClick?: () => void;
  title?: string;
}) {
  const colors = {
    green:  'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    blue:   'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    red:    'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    yellow: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  };
  return (
    <Card onClick={onClick} title={title} className={cn('p-5', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{label}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            {value}
          </p>
          {trend && trendValue && (
            <p
              className={cn(
                'text-xs mt-1.5 flex items-center gap-1',
                trend === 'up' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
              )}
            >
              {trend === 'up' ? '↑' : '↓'} {trendValue}
            </p>
          )}
        </div>
        <div className={cn('p-2.5 rounded-xl group-hover:scale-110 transition-transform duration-300 ease-out shadow-xs', colors[color])}>
          {icon}
        </div>
      </div>
    </Card>
  );
}