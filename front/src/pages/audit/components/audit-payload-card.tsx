import React from 'react';
import { FileText, Activity, Info, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../../components/ui';
import { formatPayloadKey } from '../../../lib/audit-utils';

interface AuditPayloadCardProps {
  payload?: any;
  oldData?: any;
  newData?: any;
  t: (key: string) => string;
}

export const AuditPayloadCard: React.FC<AuditPayloadCardProps> = ({
  payload,
  oldData,
  newData,
  t,
}) => {
  const payloadEntries = payload && typeof payload === 'object' ? Object.entries(payload) : [];

  const renderValue = (val: any) => {
    if (val === null || val === undefined) return <span className="text-slate-400 italic">—</span>;
    if (typeof val === 'boolean') {
      return val ? (
        <span className="inline-flex items-center gap-1 text-emerald-600 font-bold"><CheckCircle2 className="w-3.5 h-3.5" /> {t('common.yes')}</span>
      ) : (
        <span className="inline-flex items-center gap-1 text-rose-500 font-bold"><XCircle className="w-3.5 h-3.5" /> {t('common.no')}</span>
      );
    }
    if (typeof val === 'object') {
      return (
        <pre className="text-2xs font-mono text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 p-2 rounded-lg break-all whitespace-pre-wrap max-h-40 overflow-auto">
          {JSON.stringify(val, null, 2)}
        </pre>
      );
    }
    return String(val);
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-gray-200/90 dark:border-white/10 shadow-2xs">
        <CardHeader
          title={
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <FileText className="w-4 h-4 text-purple-600" />
              <span>{t('auditLogs.payload')}</span>
            </div>
          }
        />
        <CardContent className="space-y-4 text-xs">
          {payloadEntries.length > 0 ? (
            <div className="space-y-2">
              {payloadEntries.map(([key, val]) => (
                <div
                  key={key}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-800/40 gap-1.5 sm:gap-4 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <span className="text-slate-500 font-medium shrink-0">
                    {formatPayloadKey(key)}:
                  </span>
                  <div className="font-bold text-slate-900 dark:text-white break-all text-right font-mono">
                    {renderValue(val)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 space-y-2">
              <Info className="w-8 h-8 mx-auto opacity-40 text-slate-400" />
              <p className="text-xs font-medium">Ushbu amaliyotda qo'shimcha parametrlar uzatilmadi.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {(oldData || newData) && (
        <Card className="rounded-2xl border-gray-200/90 dark:border-white/10 shadow-2xs">
          <CardHeader
            title={
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <Activity className="w-4 h-4 text-amber-500" />
                <span>Ma'lumotlar O'zgarishi Tarixi (History)</span>
              </div>
            }
          />
          <CardContent className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {oldData && (
                <div className="p-3.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 space-y-1.5">
                  <span className="text-2xs font-extrabold text-amber-800 dark:text-amber-300 uppercase block">
                    {t('auditLogs.oldData')}
                  </span>
                  <pre className="text-2xs font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-all leading-relaxed max-h-56 overflow-auto">
                    {JSON.stringify(oldData, null, 2)}
                  </pre>
                </div>
              )}

              {newData && (
                <div className="p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/50 space-y-1.5">
                  <span className="text-2xs font-extrabold text-emerald-800 dark:text-emerald-300 uppercase block">
                    {t('auditLogs.newData')}
                  </span>
                  <pre className="text-2xs font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-all leading-relaxed max-h-56 overflow-auto">
                    {JSON.stringify(newData, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
