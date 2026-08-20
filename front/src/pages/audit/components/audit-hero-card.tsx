import React from 'react';
import { Badge } from '../../../components/ui';
import type { AuditActionDetails } from '../../../lib/audit-utils';

interface AuditHeroCardProps {
  action: string;
  method: string;
  statusCode: number;
  actionMeta: AuditActionDetails;
}

export const AuditHeroCard: React.FC<AuditHeroCardProps> = ({
  action,
  method,
  statusCode,
  actionMeta,
}) => {
  const getMethodBadge = (m: string) => {
    switch (m?.toUpperCase()) {
      case 'POST':
        return <Badge variant="success">POST</Badge>;
      case 'PUT':
      case 'PATCH':
        return <Badge variant="warning">{m}</Badge>;
      case 'DELETE':
        return <Badge variant="danger">DELETE</Badge>;
      default:
        return <Badge variant="info">{m}</Badge>;
    }
  };

  const getStatusBadge = (code: number) => {
    if (code >= 200 && code < 300) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-mono font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          {code} SUCCESS
        </span>
      );
    }
    if (code >= 400 && code < 500) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-mono font-extrabold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          {code} BAD REQUEST
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-mono font-extrabold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30">
        <span className="w-2 h-2 rounded-full bg-rose-500" />
        {code} SERVER ERROR
      </span>
    );
  };

  return (
    <div className="rounded-2xl border border-teal-500/20 dark:border-teal-500/30 bg-gradient-to-r from-teal-50/70 via-slate-50 to-white dark:from-teal-950/40 dark:via-slate-900 dark:to-slate-900 p-5 sm:p-6 shadow-xs relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 relative z-10">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2.5 flex-wrap">
            <Badge variant={actionMeta.badgeVariant}>{actionMeta.category}</Badge>
            <span className="text-2xs font-mono font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wide bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
              {action}
            </span>
          </div>

          <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white leading-snug">
            {actionMeta.title}
          </h3>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
            {actionMeta.description}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {getMethodBadge(method)}
          {getStatusBadge(statusCode)}
        </div>
      </div>
    </div>
  );
};
