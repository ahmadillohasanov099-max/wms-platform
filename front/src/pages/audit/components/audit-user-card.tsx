import React from 'react';
import { User, Building2, Briefcase, Phone } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../../components/ui';

interface AuditUserCardProps {
  userName?: string;
  userRole?: string;
  user?: any;
  organization?: any;
  t: (key: string) => string;
}

export const AuditUserCard: React.FC<AuditUserCardProps> = ({
  userName,
  userRole,
  user,
  organization,
  t,
}) => {
  const name = userName || user?.fullName || 'Noma\'lum Foydalanuvchi';
  const role = userRole || user?.role || 'GUEST';

  return (
    <Card className="rounded-2xl border-gray-200/90 dark:border-white/10 shadow-2xs">
      <CardHeader
        title={
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <User className="w-4 h-4 text-teal-600" />
            <span>{t('auditLogs.user')}</span>
          </div>
        }
      />
      <CardContent className="space-y-4 text-xs">
        <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 text-white font-extrabold flex items-center justify-center text-base flex-shrink-0 shadow-md">
            {name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-extrabold text-slate-900 dark:text-white text-base truncate">
              {name}
            </h4>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-2xs font-extrabold px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-950/80 dark:text-teal-300 border border-teal-300/60">
                {role}
              </span>
              {user?.username && (
                <span className="text-xs font-mono text-slate-400 font-semibold">@{user.username}</span>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2 pt-1">
          {organization?.name && (
            <div className="flex justify-between items-center p-3 rounded-xl bg-gray-50 dark:bg-slate-800/40">
              <span className="text-slate-500 font-medium flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-400" /> Tashkilot:
              </span>
              <span className="font-bold text-slate-900 dark:text-white truncate max-w-[240px]">
                {organization.name} ({organization.code})
              </span>
            </div>
          )}

          {user?.position && (
            <div className="flex justify-between items-center p-3 rounded-xl bg-gray-50 dark:bg-slate-800/40">
              <span className="text-slate-500 font-medium flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-slate-400" /> Lavozim:
              </span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {user.position}
              </span>
            </div>
          )}

          {user?.phone && (
            <div className="flex justify-between items-center p-3 rounded-xl bg-gray-50 dark:bg-slate-800/40">
              <span className="text-slate-500 font-medium flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-400" /> Telefon:
              </span>
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                {user.phone}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
