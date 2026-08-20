import Modal from '../../../components/ui/modal';
import Button from '../../../components/ui/button';
import { Badge } from '../../../components/ui';
import { formatDate } from '../../../lib/utils';
import { Terminal, User, Globe, Clock, Server } from 'lucide-react';
import type { AuditLog } from '../../../types';

interface AuditDetailModalProps {
  log: AuditLog | null;
  onClose: () => void;
}

export default function AuditDetailModal({ log, onClose }: AuditDetailModalProps) {
  if (!log) return null;

  const getMethodBadge = (method: string) => {
    switch (method?.toUpperCase()) {
      case 'POST':
        return <Badge variant="success">POST</Badge>;
      case 'PUT':
      case 'PATCH':
        return <Badge variant="warning">{method}</Badge>;
      case 'DELETE':
        return <Badge variant="danger">DELETE</Badge>;
      default:
        return <Badge variant="info">{method}</Badge>;
    }
  };

  const getStatusBadge = (code: number) => {
    if (code >= 200 && code < 300) {
      return (
        <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/50">
          {code} OK
        </span>
      );
    }
    if (code >= 400 && code < 500) {
      return (
        <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/50">
          {code} BAD REQUEST
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300/50">
        {code} SERVER ERROR
      </span>
    );
  };

  return (
    <Modal
      open={!!log}
      onClose={onClose}
      title="🛡️ Audit Log Tafsilotlari"
      subtitle="Foydalanuvchining tizimda bajargan muayyan amali bo'yicha to'liq ma'lumot"
      size="lg"
      footer={
        <div className="flex justify-end w-full">
          <Button variant="outline" onClick={onClose}>
            Yopish
          </Button>
        </div>
      }
    >
      <div className="space-y-5 text-xs sm:text-sm">
        {/* Top Info Header Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800">
          <div>
            <span className="text-2xs uppercase text-slate-400 font-bold block mb-1">Harakat Turi</span>
            <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white truncate">
              {getMethodBadge(log.method)}
              <span className="truncate">{log.action}</span>
            </div>
          </div>

          <div>
            <span className="text-2xs uppercase text-slate-400 font-bold block mb-1">Javob Kodi</span>
            {getStatusBadge(log.statusCode)}
          </div>

          <div>
            <span className="text-2xs uppercase text-slate-400 font-bold block mb-1">Ijro Vaqti</span>
            <span className="font-mono font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-teal-500" />
              {log.durationMs ? `${log.durationMs} ms` : '—'}
            </span>
          </div>

          <div>
            <span className="text-2xs uppercase text-slate-400 font-bold block mb-1">Sana va Vaqt</span>
            <span className="font-mono text-xs font-semibold text-slate-600 dark:text-slate-400">
              {formatDate(log.createdAt)}
            </span>
          </div>
        </div>

        {/* User & Request Environment Box */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl space-y-2">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
              <User className="w-4 h-4 text-teal-600" />
              <span>Bajaruvchi Xodim</span>
            </h4>
            <div className="space-y-1 text-xs">
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                {log.userName || log.user?.fullName || 'Noma\'lum'}
              </p>
              <p className="text-2xs text-slate-400 font-mono">
                Roli: <span className="font-bold text-teal-600">{log.userRole || log.user?.role || '—'}</span>
              </p>
              {log.organization?.name && (
                <p className="text-2xs text-slate-400">
                  Tashkilot: <span className="font-medium text-slate-700 dark:text-slate-300">{log.organization.name}</span>
                </p>
              )}
            </div>
          </div>

          <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl space-y-2">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
              <Globe className="w-4 h-4 text-blue-600" />
              <span>Tarmoq va Brauzer Metadatalari</span>
            </h4>
            <div className="space-y-1 text-xs">
              <p className="font-mono font-bold text-slate-800 dark:text-slate-200">
                IP: {log.ipAddress || '127.0.0.1'}
              </p>
              <p className="text-2xs text-slate-400 font-mono line-clamp-2" title={log.userAgent}>
                UA: {log.userAgent || '—'}
              </p>
            </div>
          </div>
        </div>

        {/* API Endpoint path */}
        <div className="p-3 bg-slate-950 text-slate-100 rounded-xl font-mono text-xs space-y-1 overflow-x-auto">
          <div className="flex items-center gap-2 text-2xs text-slate-400 font-bold uppercase">
            <Server className="w-3.5 h-3.5 text-emerald-400" />
            <span>API Endpoint Url</span>
          </div>
          <p className="font-bold text-emerald-400">{log.method} {log.endpoint}</p>
        </div>

        {/* JSON Payload Inspection */}
        {log.payload && Object.keys(log.payload).length > 0 && (
          <div className="space-y-1.5">
            <h4 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-purple-600" />
              <span>So'rov Parametrlari va Body (JSON Payload)</span>
            </h4>
            <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-xs max-h-60 overflow-y-auto overflow-x-auto leading-relaxed border border-slate-800">
              {JSON.stringify(log.payload, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </Modal>
  );
}
