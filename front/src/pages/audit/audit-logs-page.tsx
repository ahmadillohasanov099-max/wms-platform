import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Download, Eye, RefreshCw } from 'lucide-react';
import { auditApi } from '../../api';
import {
  Card,
  CardContent,
  Button,
  Table,
  Pagination,
  PageHeader,
  Badge,
  type Column,
} from '../../components/ui';
import { formatDate } from '../../lib/utils';
import { useDebounce } from '../../hooks/useDebounce';
import { exportToStyledExcel } from '../../lib/export';
import { getActionDetails, getResourceLabel } from '../../lib/audit-utils';
import { useTranslation } from '../../hooks/useTranslation';
import type { AuditLog } from '../../types';
import { AuditLogsStatsGrid } from './components/audit-logs-stats-grid';
import { AuditLogsFilterBar } from './components/audit-logs-filter-bar';

export default function AuditLogsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const limit = 20;

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const [selectedMethod, setSelectedMethod] = useState<string>('ALL');
  const [selectedResource, setSelectedResource] = useState<string>('ALL');

  // Fetch stats overview
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['audit-stats'],
    queryFn: () => auditApi.getStats(),
    staleTime: 15000,
  });

  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    data: logsData,
    isLoading: logsLoading,
    isFetching: logsFetching,
    refetch,
  } = useQuery({
    queryKey: ['audit-logs', page, limit, debouncedSearch, selectedMethod, selectedResource],
    queryFn: () =>
      auditApi.getAll({
        page,
        limit,
        search: debouncedSearch || undefined,
        method: selectedMethod !== 'ALL' ? selectedMethod : undefined,
        resource: selectedResource !== 'ALL' ? selectedResource : undefined,
      }),
    staleTime: 10000,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  const isSpinning = logsFetching || isRefreshing;

  const logsList = logsData?.items ?? [];
  const totalLogs = logsData?.total ?? 0;
  const totalPages = logsData?.totalPages ?? 1;

  const handleExport = () => {
    const headers = [
      '№',
      t('auditLogs.user'),
      'Roli',
      t('auditLogs.action'),
      'Metod',
      t('auditLogs.resource'),
      'Endpoint Path',
      t('auditLogs.statusCode'),
      t('auditLogs.ipAddress'),
      t('auditLogs.time'),
    ];

    const rows = logsList.map((log, index) => [
      index + 1,
      log.userName || log.user?.fullName || 'Noma\'lum',
      log.userRole || log.user?.role || 'GUEST',
      log.action,
      log.method,
      log.resource || 'SYSTEM',
      log.endpoint,
      log.statusCode,
      log.ipAddress || '127.0.0.1',
      formatDate(log.createdAt),
    ]);

    exportToStyledExcel({
      filename: `audit_logs_${new Date().toISOString().split('T')[0]}`,
      sheetName: t('auditLogs.title'),
      headers,
      rows,
      centerColIndexes: [0, 4, 7, 8, 9],
    });
  };

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

  const methodOptions = [
    { value: 'ALL', label: t('auditLogs.allMethods') },
    { value: 'POST', label: 'POST (Yangi)' },
    { value: 'PUT', label: 'PUT (Tahrirlash)' },
    { value: 'PATCH', label: 'PATCH (Qisman)' },
    { value: 'DELETE', label: 'DELETE (O\'chirish)' },
  ];

  const resourceOptions = [
    { value: 'ALL', label: t('auditLogs.allResources') },
    { value: 'USER', label: t('common.actions') + ' (User)' },
    { value: 'PRODUCT', label: t('inventory.productName') },
    { value: 'DEPARTMENT', label: t('dashboard.departments') },
    { value: 'INVENTORY', label: t('menu.inventory') },
    { value: 'REQUEST', label: "So'rovlar va Bildirishnomalar" },
    { value: 'DELETION_REQUEST', label: t('menu.deletionRequests') },
  ];

  const columns: Column<AuditLog>[] = [
    {
      key: 'user',
      title: t('auditLogs.user'),
      render: (_: any, row: AuditLog) => (
        <div className="space-y-0.5">
          <p className="font-bold text-gray-900 dark:text-gray-100 text-xs">
            {row.userName || row.user?.fullName || 'Noma\'lum'}
          </p>
          <div className="flex items-center gap-1.5 text-2xs text-gray-400 font-mono">
            <span className="font-semibold text-teal-600 dark:text-teal-400">
              {row.userRole || row.user?.role || 'GUEST'}
            </span>
            <span>•</span>
            <span>IP: {row.ipAddress || '127.0.0.1'}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'action',
      title: t('auditLogs.action'),
      render: (_: any, row: AuditLog) => {
        const meta = getActionDetails(row.action, row.payload, row.resource, row.endpoint);
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {getMethodBadge(row.method)}
              <span className="font-bold text-xs text-gray-900 dark:text-gray-100">
                {meta.title}
              </span>
            </div>
            <p className="text-2xs text-gray-500 dark:text-gray-400 font-medium truncate max-w-xs" title={meta.description}>
              {meta.description}
            </p>
          </div>
        );
      },
    },
    {
      key: 'endpoint',
      title: t('auditLogs.resource'),
      render: (_: any, row: AuditLog) => (
        <div className="space-y-0.5 max-w-xs truncate">
          <span className="inline-block px-2 py-0.5 rounded text-3xs font-extrabold bg-teal-50 text-teal-700 dark:bg-teal-950/80 dark:text-teal-300 border border-teal-200/60">
            {getResourceLabel(row.resource)}
          </span>
          <p className="text-xs font-mono text-gray-500 dark:text-gray-400 truncate" title={row.endpoint}>
            {row.endpoint}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      title: t('auditLogs.statusCode'),
      render: (_: any, row: AuditLog) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold ${
            row.statusCode >= 200 && row.statusCode < 300
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
              : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
          }`}
        >
          {row.statusCode}
        </span>
      ),
    },
    {
      key: 'createdAt',
      title: t('auditLogs.time'),
      render: (_: any, row: AuditLog) => (
        <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
          {formatDate(row.createdAt)}
        </span>
      ),
    },
    {
      key: 'actions',
      title: t('userView.details'),
      render: (_: any, row: AuditLog) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate(`/audit-logs/${row.id}`)}
          className="flex items-center gap-1 text-xs px-2.5 py-1 font-bold"
        >
          <Eye className="w-3.5 h-3.5 text-teal-600" />
          <span>{t('userView.details')}</span>
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title={t('auditLogs.title')}
        subtitle={t('auditLogs.subtitle')}
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={handleRefresh}
              variant="outline"
              size="sm"
              disabled={isSpinning}
              className="flex items-center gap-1.5 text-xs font-bold transition-all duration-200 active:scale-95 border-gray-300 dark:border-gray-700 hover:bg-teal-50 dark:hover:bg-teal-950/30"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-teal-600 dark:text-teal-400 transition-transform duration-500 ${isSpinning ? 'animate-spin' : ''}`} />
              <span>{t('auditLogs.refresh')}</span>
            </Button>
            <Button
              onClick={handleExport}
              variant="outline"
              size="sm"
              disabled={logsList.length === 0}
              className="flex items-center gap-1.5 text-xs font-bold"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t('auditLogs.exportExcel')}</span>
            </Button>
          </div>
        }
      />

      {/* Modular Stats Grid */}
      <AuditLogsStatsGrid
        statsLoading={statsLoading}
        statsData={statsData}
        t={t}
      />

      {/* Main Table Card */}
      <Card className="rounded-2xl border-gray-200/90 dark:border-white/15 shadow-2xs overflow-hidden">
        <CardContent className="p-5 space-y-4">
          {/* Modular Filter Bar */}
          <AuditLogsFilterBar
            search={search}
            onSearchChange={(val) => {
              setSearch(val);
              setPage(1);
            }}
            selectedMethod={selectedMethod}
            onMethodChange={(val) => {
              setSelectedMethod(val);
              setPage(1);
            }}
            selectedResource={selectedResource}
            onResourceChange={(val) => {
              setSelectedResource(val);
              setPage(1);
            }}
            methodOptions={methodOptions}
            resourceOptions={resourceOptions}
            t={t}
          />

          {/* Results count info */}
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-1">
            <span>
              {t('auditLogs.totalLogs')}: <strong className="text-gray-900 dark:text-gray-100">{totalLogs} {t('common.pcs')}</strong>
            </span>
          </div>

          {/* Desktop Table View */}
          <div className="overflow-x-auto rounded-xl border border-gray-200/80 dark:border-gray-800">
            <Table
              columns={columns}
              data={logsList}
              loading={logsLoading}
              rowKey={(row) => row.id}
              emptyTitle={t('auditLogs.noLogsFound')}
            />
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pt-2 flex justify-end">
              <Pagination
                page={page}
                totalPages={totalPages}
                total={totalLogs}
                limit={limit}
                onPageChange={setPage}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
