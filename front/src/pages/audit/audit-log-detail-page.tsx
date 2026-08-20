import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ShieldCheck, Clock, Zap, AlertTriangle, RefreshCw } from 'lucide-react';
import { auditApi } from '../../api';
import { Card, Button } from '../../components/ui';
import { formatDate } from '../../lib/utils';
import { getActionDetails, getResourceLabel } from '../../lib/audit-utils';
import { useTranslation } from '../../hooks/useTranslation';
import { AuditHeroCard } from './components/audit-hero-card';
import { AuditUserCard } from './components/audit-user-card';
import { AuditNetworkCard } from './components/audit-network-card';
import { AuditPayloadCard } from './components/audit-payload-card';

export default function AuditLogDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { data: log, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['audit-log-detail', id],
    queryFn: () => auditApi.getById(id!),
    enabled: !!id,
    staleTime: 60000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse p-2">
        <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-xl w-1/3" />
        <div className="h-28 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (isError || !log) {
    return (
      <div className="py-20 text-center space-y-4 max-w-md mx-auto">
        <div className="w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-500 flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-900">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t('auditLogs.noLogsFound')}</h3>
        <p className="text-sm text-slate-500">So'ralgan audit yozuvi o'chirilgan yoki sizda unga kirish huquqi yo'q.</p>
        <Button variant="outline" onClick={() => navigate('/audit-logs')} className="rounded-xl font-bold">
          <ArrowLeft className="w-4 h-4 mr-2" /> {t('auditLogs.backToList')}
        </Button>
      </div>
    );
  }

  const actionMeta = getActionDetails(log.action, log.payload, log.resource, log.endpoint);

  const getDurationSpeed = (ms?: number) => {
    if (!ms) return { label: '—', color: 'text-slate-400' };
    if (ms < 200) return { label: `${ms} ms (Tezkor ⚡)`, color: 'text-emerald-600 dark:text-emerald-400' };
    if (ms < 600) return { label: `${ms} ms (Me'yorda)`, color: 'text-amber-600 dark:text-amber-400' };
    return { label: `${ms} ms (Sekin 🐢)`, color: 'text-rose-600 dark:text-rose-400' };
  };

  const speedInfo = getDurationSpeed(log.durationMs);

  return (
    <div className="space-y-6 pb-16 transition-opacity duration-150">
      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1.5">
            <Link to="/audit-logs" className="hover:underline flex items-center gap-1 font-medium transition-colors">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
              <span>{t('auditLogs.title')}</span>
            </Link>
            <span>/</span>
            <span className="font-mono font-bold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-md border border-teal-200/50">
              #{log.id.slice(-8).toUpperCase()}
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <ShieldCheck className="w-7 h-7 text-teal-600 dark:text-teal-400 shrink-0" />
            <span>{t('auditLogs.detailTitle')}</span>
          </h2>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/audit-logs')}
            className="flex items-center gap-1.5 text-xs font-bold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('auditLogs.backToList')}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 text-xs font-bold rounded-xl"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-teal-600 ${isFetching ? 'animate-spin' : ''}`} />
            <span>{t('auditLogs.refresh')}</span>
          </Button>
        </div>
      </div>

      {/* Hero Action Card */}
      <AuditHeroCard
        action={log.action}
        method={log.method}
        statusCode={log.statusCode}
        actionMeta={actionMeta}
      />

      {/* 4 Summary Micro-Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 rounded-2xl border-gray-200/90 dark:border-white/10 shadow-2xs hover:shadow-xs transition-all">
          <p className="text-2xs font-extrabold text-slate-400 uppercase tracking-wider mb-1">
            {t('auditLogs.user')}
          </p>
          <p className="font-bold text-sm text-slate-900 dark:text-white truncate">
            {log.userName || log.user?.fullName || 'Noma\'lum Foydalanuvchi'}
          </p>
        </Card>

        <Card className="p-4 rounded-2xl border-gray-200/90 dark:border-white/10 shadow-2xs hover:shadow-xs transition-all">
          <p className="text-2xs font-extrabold text-slate-400 uppercase tracking-wider mb-1">
            {t('auditLogs.resource')}
          </p>
          <p className="font-bold text-sm text-teal-600 dark:text-teal-400 truncate">
            {getResourceLabel(log.resource)}
          </p>
        </Card>

        <Card className="p-4 rounded-2xl border-gray-200/90 dark:border-white/10 shadow-2xs hover:shadow-xs transition-all">
          <p className="text-2xs font-extrabold text-slate-400 uppercase tracking-wider mb-1">
            {t('auditLogs.latency')}
          </p>
          <p className={`text-sm font-mono font-bold flex items-center gap-1.5 ${speedInfo.color}`}>
            <Zap className="w-4 h-4 fill-current animate-pulse" />
            {speedInfo.label}
          </p>
        </Card>

        <Card className="p-4 rounded-2xl border-gray-200/90 dark:border-white/10 shadow-2xs hover:shadow-xs transition-all">
          <p className="text-2xs font-extrabold text-slate-400 uppercase tracking-wider mb-1">
            {t('auditLogs.time')}
          </p>
          <p className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-teal-600" />
            {formatDate(log.createdAt)}
          </p>
        </Card>
      </div>

      {/* Main Grid: Left User & Network Cards, Right Payload Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <AuditUserCard
            userName={log.userName}
            userRole={log.userRole}
            user={log.user}
            organization={log.organization}
            t={t}
          />
          <AuditNetworkCard
            method={log.method}
            endpoint={log.endpoint}
            ipAddress={log.ipAddress}
            resource={log.resource}
            resourceId={log.resourceId}
            userAgent={log.userAgent}
            t={t}
          />
        </div>

        <div>
          <AuditPayloadCard
            payload={log.payload}
            oldData={log.oldData}
            newData={log.newData}
            t={t}
          />
        </div>
      </div>
    </div>
  );
}
