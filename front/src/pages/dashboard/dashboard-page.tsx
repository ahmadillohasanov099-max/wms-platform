import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  Package,
  Users,
  AlertTriangle,
  Boxes,
  Wallet,
  TrendingUp,
  ArrowRight,
  Clock,
  Activity,
} from 'lucide-react';
import { historyApi, statsApi } from '../../api';
import { Card, CardContent, CardHeader, StatCard, TableSkeleton, OperationTypeBadge, CopyableInventoryNumber } from '../../components/ui';

import { formatCompactCurrency, formatCurrency, formatDate } from '../../lib/utils';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuthStore } from '../../store/auth.store';

export default function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['stats-overview'],
    queryFn: () => statsApi.getOverview(),
    refetchInterval: 60000,
  });

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['history-recent'],
    queryFn: () =>
      historyApi.getAll({
        limit: 10,
        page: 1,
      }),
    refetchInterval: 60000,
  });

  const stats = statsData;
  const history = historyData?.items ?? [];

  const quickActions = [
    { label: t('dashboard.giveAsset'), icon: '📦', path: '/operations' },
    { label: t('dashboard.returnAsset'), icon: '↩️', path: '/operations' },
    { label: t('dashboard.stockIn'), icon: '📥', path: '/inventory' },
    { label: t('dashboard.addUser'), icon: '👤', path: '/users' },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Welcome Mobile / Desktop Greeting Banner */}
      <div className="p-4 sm:p-6 rounded-2xl bg-gradient-to-r from-teal-600/10 via-teal-500/5 to-transparent border border-gray-200/90 dark:border-white/15 backdrop-blur-xl shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/25">
              🏢 {user?.organization?.name || 'Vazirlik Markaziy Boshqarmasi'}
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            {t('dashboard.welcomeUser', { name: user?.fullName || 'Foydalanuvchi' })}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {user?.organization?.name 
              ? `${user.organization.name} moddiy aktivlari va ombor boshqaruv paneli`
              : t('dashboard.welcomeSubtitle')}
          </p>
        </div>
      </div>

      {/* 6 Key Stat Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        <StatCard
          label={t('dashboard.totalProducts')}
          value={statsLoading ? '...' : stats?.totalProducts ?? 0}
          icon={<Boxes className="w-5 h-5" />}
          color="green"
          onClick={() => navigate('/inventory')}
        />
        <StatCard
          label={t('dashboard.activeUsers')}
          value={statsLoading ? '...' : stats?.totalUsers ?? 0}
          icon={<Users className="w-5 h-5" />}
          color="blue"
          onClick={() => navigate('/users')}
        />
        <StatCard
          label={t('dashboard.lowStock')}
          value={statsLoading ? '...' : stats?.lowStockCount ?? 0}
          icon={<AlertTriangle className="w-5 h-5" />}
          color="red"
          onClick={() => navigate('/inventory')}
        />
        <StatCard
          label={t('dashboard.assignedAssets')}
          value={statsLoading ? '...' : `${stats?.activeAssignments ?? stats?.activeAssets ?? 0} ${t('common.pcs')}`}
          icon={<Package className="w-5 h-5" />}
          color="yellow"
          onClick={() => navigate('/assigned-assets')}
        />
        <StatCard
          label={t('dashboard.inventoryValue')}
          value={
            statsLoading
              ? '...'
              : formatCompactCurrency(stats?.totalInventoryValue ?? 0)
          }
          icon={<Wallet className="w-5 h-5" />}
          color="purple"
          title={stats?.totalInventoryValue !== undefined ? formatCurrency(stats.totalInventoryValue) : undefined}
          onClick={() => navigate('/stats')}
        />
        <StatCard
          label={t('dashboard.assignedValue')}
          value={
            statsLoading
              ? '...'
              : formatCompactCurrency(stats?.totalAssignedValue ?? 0)
          }
          icon={<TrendingUp className="w-5 h-5" />}
          color="green"
          title={stats?.totalAssignedValue !== undefined ? formatCurrency(stats.totalAssignedValue) : undefined}
          onClick={() => navigate('/stats')}
        />
      </div>

      {/* Main Grid: Recent Operations & Quick Actions */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: Recent Operations */}
        <div className="xl:col-span-2">
          <Card className="rounded-2xl border-gray-200/90 dark:border-white/15 shadow-2xs overflow-hidden">
            <CardHeader
              title={
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                    <span className="font-bold">{t('dashboard.recentOperations')}</span>
                  </div>
                  <Link
                    to="/history"
                    className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
                  >
                    <span>{t('common.viewAll')}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              }
              className="border-b border-gray-100 dark:border-slate-800/60 pb-3.5"
            />
            <CardContent className="p-0">
              {historyLoading ? (
                <div className="p-5">
                  <TableSkeleton rows={5} cols={4} />
                </div>
              ) : history.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                  {t('dashboard.noOperations')}
                </div>
              ) : (
                <>
                  {/* Mobile Feed View (screens < 768px) */}
                  <div className="md:hidden p-3.5 space-y-3">
                    {history.map((item: any) => (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-xl bg-white dark:bg-slate-900/90 border border-gray-200/80 dark:border-slate-800 shadow-2xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <OperationTypeBadge type={item.type} />
                          <span className="text-[11px] font-mono text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-gray-400" />
                            {formatDate(item.createdAt)}
                          </span>
                        </div>
                        <div className="pt-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                              {item.product?.name ?? '—'}
                            </h4>
                            {item.asset?.inventoryNumber && (
                              <CopyableInventoryNumber
                                value={item.asset.inventoryNumber}
                                size="2xs"
                              />
                            )}
                          </div>
                          <p className="text-xs text-teal-600 dark:text-teal-400 font-medium mt-0.5">
                            {item.user?.fullName ?? item.department?.name ?? '—'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View (screens >= 768px) */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-slate-800/80 bg-gray-50/70 dark:bg-slate-800/40">
                          <th className="px-5 py-3 text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">
                            {t('history.operation')}
                          </th>
                          <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">
                            {t('history.product')}
                          </th>
                          <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">
                            {t('operations.employee')}
                          </th>
                          <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">
                            {t('common.date')}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-slate-800/50">
                        {history.map((item: any) => (
                          <tr
                            key={item.id}
                            className="hover:bg-teal-50/30 dark:hover:bg-teal-950/20 transition-colors duration-200"
                          >
                            <td className="px-5 py-3.5 text-center">
                              <OperationTypeBadge type={item.type} />
                            </td>
                            <td className="px-5 py-3.5 font-bold text-gray-900 dark:text-gray-100">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span>{item.product?.name ?? '—'}</span>
                                {item.asset?.inventoryNumber && (
                                  <CopyableInventoryNumber
                                    value={item.asset.inventoryNumber}
                                    size="2xs"
                                  />
                                )}
                              </div>
                            </td>

                            <td className="px-5 py-3.5 font-medium text-gray-600 dark:text-gray-300">
                              {item.user?.fullName ?? item.department?.name ?? '—'}
                            </td>
                            <td className="px-5 py-3.5 text-xs text-gray-500 font-mono">
                              {formatDate(item.createdAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Quick Actions & Indicators */}
        <div className="space-y-6">
          <Card className="rounded-2xl border-gray-200/90 dark:border-white/15 shadow-2xs">
            <CardHeader title={t('dashboard.quickActions')} />
            <CardContent>
              <div className="grid grid-cols-2 gap-2.5">
                {quickActions.map((action) => (
                  <Link
                    key={action.label}
                    to={action.path}
                    className="group flex items-center gap-2.5 rounded-xl bg-gray-50 dark:bg-slate-800/60 p-3 text-xs sm:text-sm font-bold text-gray-800 dark:text-gray-200 border border-gray-200/80 dark:border-slate-700/80 hover:bg-teal-50 dark:hover:bg-teal-950/40 hover:border-teal-300 dark:hover:border-teal-800/80 transition-all duration-200"
                  >
                    <span className="text-base group-hover:scale-110 transition-transform duration-200">
                      {action.icon}
                    </span>
                    <span className="truncate">{action.label}</span>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-gray-200/90 dark:border-white/15 shadow-2xs">
            <CardHeader title={t('dashboard.general')} />
            <CardContent>
              <div className="space-y-3 text-xs sm:text-sm">
                <div className="flex justify-between items-center p-2.5 rounded-xl bg-gray-50 dark:bg-slate-800/60">
                  <span className="text-gray-600 dark:text-gray-300 font-medium">{t('dashboard.departments')}</span>
                  <span className="font-extrabold text-gray-900 dark:text-white">
                    {stats?.totalDepartments ?? 0} {t('common.pcs')}
                  </span>
                </div>
                <div className="flex justify-between items-center p-2.5 rounded-xl bg-gray-50 dark:bg-slate-800/60">
                  <span className="text-gray-600 dark:text-gray-300 font-medium">{t('dashboard.totalOperations')}</span>
                  <span className="font-extrabold text-gray-900 dark:text-white">
                    {stats?.totalOperations ?? 0} {t('common.pcs')}
                  </span>
                </div>
                <div
                  onClick={() => navigate('/assigned-assets')}
                  className="flex justify-between items-center p-2.5 rounded-xl bg-gray-50 dark:bg-slate-800/60 cursor-pointer hover:bg-yellow-50/50 dark:hover:bg-yellow-950/20 transition-colors"
                >
                  <span className="text-gray-600 dark:text-gray-300 font-medium">{t('dashboard.assignedAssets')}</span>
                  <span className="font-extrabold text-teal-600 dark:text-teal-400">
                    {stats?.activeAssets ?? 0} {t('common.pcs')}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}