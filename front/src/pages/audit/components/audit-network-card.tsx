import React, { useState } from 'react';
import { Globe, Layers, Smartphone, Copy, Check } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../../components/ui';
import { getResourceLabel } from '../../../lib/audit-utils';

interface AuditNetworkCardProps {
  method: string;
  endpoint: string;
  ipAddress?: string;
  resource?: string;
  resourceId?: string;
  userAgent?: string;
  t: (key: string) => string;
}

export const AuditNetworkCard: React.FC<AuditNetworkCardProps> = ({
  method,
  endpoint,
  ipAddress,
  resource,
  resourceId,
  userAgent,
  t,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyEndpoint = () => {
    navigator.clipboard.writeText(`${method} ${endpoint}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="rounded-2xl border-gray-200/90 dark:border-white/10 shadow-2xs">
      <CardHeader
        title={
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <Globe className="w-4 h-4 text-blue-600" />
            <span>{t('auditLogs.ipAddress')} & {t('auditLogs.userAgent')}</span>
          </div>
        }
      />
      <CardContent className="space-y-3 text-xs">
        <div className="p-3.5 rounded-xl bg-slate-950 text-slate-100 font-mono space-y-1.5 border border-slate-800 relative group">
          <div className="flex items-center justify-between text-2xs text-slate-400 uppercase font-bold">
            <span>{t('auditLogs.endpoint')}</span>
            <button
              onClick={handleCopyEndpoint}
              className="text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? t('auditLogs.copied') : t('auditLogs.copy')}</span>
            </button>
          </div>
          <p className="font-bold text-emerald-400 text-sm break-all">{method} {endpoint}</p>
        </div>

        <div className="flex justify-between items-center p-3 rounded-xl bg-gray-50 dark:bg-slate-800/40">
          <span className="text-slate-500 font-medium">{t('auditLogs.ipAddress')}:</span>
          <span className="font-mono font-bold text-slate-900 dark:text-white bg-slate-200 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
            {ipAddress || '127.0.0.1'}
          </span>
        </div>

        {resource && (
          <div className="flex justify-between items-center p-3 rounded-xl bg-gray-50 dark:bg-slate-800/40">
            <span className="text-slate-500 font-medium flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-400" /> {t('auditLogs.resource')}:
            </span>
            <span className="font-bold text-teal-600 dark:text-teal-400">
              {getResourceLabel(resource)} ({resource})
            </span>
          </div>
        )}

        {resourceId && (
          <div className="flex justify-between items-center p-3 rounded-xl bg-gray-50 dark:bg-slate-800/40">
            <span className="text-slate-500 font-medium">Ta'sirlangan Obyekt ID:</span>
            <span
              className="font-mono font-bold text-slate-700 dark:text-slate-300 text-2xs truncate max-w-[200px]"
              title={resourceId}
            >
              {resourceId}
            </span>
          </div>
        )}

        <div className="space-y-1.5 p-3 rounded-xl bg-gray-50 dark:bg-slate-800/40">
          <span className="text-slate-500 font-medium flex items-center gap-1.5">
            <Smartphone className="w-3.5 h-3.5 text-slate-400" /> {t('auditLogs.userAgent')}:
          </span>
          <p
            className="font-mono text-2xs text-slate-600 dark:text-slate-400 break-all leading-relaxed"
            title={userAgent}
          >
            {userAgent || '—'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
