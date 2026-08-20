import { RoleBadge } from '../../../components/ui/badge';
import Card from '../../../components/ui/card';
import { PageLoader } from '../../../components/ui/spinner';
import { useTranslation } from '../../../hooks/useTranslation';

interface EmployeesTabProps {
  employees: any[];
  isLoading: boolean;
  onSelectUser: (userId: string) => void;
}

export default function EmployeesTab({ employees, isLoading, onSelectUser }: EmployeesTabProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return <PageLoader />;
  }

  if (employees.length === 0) {
    return (
      <Card className="text-center py-12 text-gray-500 dark:text-gray-400">
        {t('departments.noEmployees')}
      </Card>
    );
  }

  return (
    <div className="space-y-1 sm:space-y-1.5">
      {employees.map((emp: any) => (
        <div
          key={emp.id}
          onClick={() => onSelectUser(emp.id)}
          className="group relative flex flex-col sm:flex-row sm:items-center sm:justify-between p-3.5 sm:p-4 rounded-2xl bg-transparent border border-transparent transition-colors duration-150 cursor-pointer gap-4 hover:bg-white dark:hover:bg-slate-900/90 hover:border-slate-200/90 dark:hover:border-slate-800 shadow-2xs"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-200/80 dark:border-teal-900/40 flex items-center justify-center font-bold text-sm shrink-0">
              {emp.fullName?.slice(0, 2).toUpperCase() || 'US'}
            </div>
            <div className="min-w-0 space-y-0.5">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                {emp.fullName}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                @{emp.username} {emp.position ? `• ${emp.position}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
            <div className="flex items-center gap-2">
              <RoleBadge role={emp.role} />
              <span
                className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold border ${
                  emp.isActive
                    ? 'bg-emerald-500/10 border-emerald-200/80 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-500/10 border-rose-200/80 dark:border-rose-900/40 text-rose-600 dark:text-rose-400'
                }`}
              >
                {emp.isActive ? t('users.active') : t('users.blocked')}
              </span>
            </div>

            <div className="flex items-center gap-1 text-xs font-bold text-teal-600 dark:text-teal-400 bg-slate-100/80 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 group-hover:bg-teal-600 group-hover:text-white dark:group-hover:bg-teal-600 dark:group-hover:text-white group-hover:border-teal-600 transition-all">
              <span>{t('userView.details')}</span>
              <span className="group-hover:translate-x-0.5 transition-transform">→</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
