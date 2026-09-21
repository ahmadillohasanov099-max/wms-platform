import { useState, useMemo, memo, useEffect, useLayoutEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Area, AreaChart,
} from 'recharts';
import {
  Package, Users, AlertTriangle, Boxes, Wallet, TrendingUp,
  ArrowUpRight, ArrowDownRight, Search,
} from 'lucide-react';
import { statsApi } from '../../api';
import Card, { CardHeader, CardContent } from '../../components/ui/card';
import { PageLoader } from '../../components/ui/spinner';
import Pagination from '../../components/ui/pagination';
import { formatCurrency, formatCompactCurrency, cn } from '../../lib/utils';
import { useTranslation } from '../../hooks/useTranslation';
import { useDebounce } from '../../hooks/useDebounce';
import PageHeader from '../../components/ui/page-header';

const PIE_COLORS = {
  ASSET: '#3b82f6',
  CONSUMABLE: '#10b981',
  SHARED: '#f59e0b',
};

const DEPT_COLORS = ['#3b82f6', '#10b981', '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b'];

const CustomTooltip = memo(({ active, payload, label, pcsLabel }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 shadow-xl text-white max-w-[240px]">
        <p className="text-xs text-slate-400 mb-1.5 font-medium truncate">{label}</p>
        {payload.map((entry: any, i: number) => (
          <p key={i} className="text-xs sm:text-sm font-semibold text-slate-100 flex items-center justify-between gap-2">
            <span className="truncate">{entry.name}:</span>
            <span className="shrink-0 font-mono">{entry.value} {pcsLabel}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
});

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: number;
  monthlySuffix: string;
  tooltip?: string;
}

const StatCard = memo(({ label, value, icon, trend, monthlySuffix, tooltip }: StatCardProps) => {
  return (
    <div
      className="group/card relative p-3.5 xs:p-4 sm:p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs hover:shadow-md transition-shadow duration-150"
      title={tooltip}
    >
      <div className="flex items-start justify-between gap-2.5 min-w-0">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 sm:mb-2 truncate" title={label}>
            {label}
          </p>
          <div className="relative inline-block max-w-full">
            <p
              className={cn(
                'text-lg xs:text-xl sm:text-2xl xl:text-3xl font-black text-gray-900 dark:text-gray-100 tracking-tight break-words sm:break-normal transition-colors',
                tooltip && 'cursor-help hover:text-teal-600 dark:hover:text-teal-400'
              )}
              title={tooltip || (typeof value === 'string' ? value : undefined)}
            >
              {value}
            </p>
            {tooltip && (
              <div className="pointer-events-none opacity-0 group-hover/card:opacity-100 transition-opacity duration-150 absolute -top-9 left-0 z-50 px-2.5 py-1 bg-gray-900 dark:bg-gray-800 text-white text-xs font-mono font-medium rounded-lg shadow-xl border border-gray-700 whitespace-nowrap hidden sm:flex items-center gap-1.5">
                <span className="text-gray-400 text-[10px] uppercase font-sans font-bold">{label}:</span>
                <span className="text-emerald-400 font-bold">{tooltip}</span>
                <div className="absolute -bottom-1 left-4 w-2 h-2 bg-gray-900 dark:bg-gray-800 border-b border-r border-gray-700 rotate-45" />
              </div>
            )}
          </div>
          {trend !== undefined && (
            <div
              className={cn(
                'flex items-center gap-1 mt-1 sm:mt-2 text-[10.5px] sm:text-xs font-bold whitespace-nowrap',
                trend >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              )}
            >
              {trend >= 0 ? (
                <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className="truncate">{Math.abs(trend)}% {monthlySuffix}</span>
            </div>
          )}
        </div>
        <div className="p-2.5 sm:p-3 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 shrink-0 mt-0.5">
          {icon}
        </div>
      </div>
    </div>
  );
});

export default function StatsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(0);

  const tabs = [
    t('stats.tabs.general'),
    t('stats.tabs.depts'),
    t('stats.tabs.users'),
    t('stats.tabs.monthly'),
  ];

  const tabListRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  useLayoutEffect(() => {
    if (!tabListRef.current) return;
    const buttons = tabListRef.current.querySelectorAll<HTMLButtonElement>('button[data-tab-index]');
    const target = buttons[activeTab];
    if (target) {
      setIndicatorStyle({
        left: target.offsetLeft,
        width: target.offsetWidth,
      });
    }
  }, [activeTab]);

  useEffect(() => {
    const handleResize = () => {
      if (!tabListRef.current) return;
      const buttons = tabListRef.current.querySelectorAll<HTMLButtonElement>('button[data-tab-index]');
      const target = buttons[activeTab];
      if (target) {
        setIndicatorStyle({
          left: target.offsetLeft,
          width: target.offsetWidth,
        });
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeTab]);

  // Parallel concurrent queries: all 5 queries execute in ~10-20ms total on backend
  const { data: overviewData, isLoading: overviewLoading } = useQuery({
    queryKey: ['stats-overview'],
    queryFn: () => statsApi.getOverview(),
    staleTime: 1000 * 60 * 5,
  });

  const { data: comparisonData } = useQuery({
    queryKey: ['stats-comparison'],
    queryFn: () => statsApi.getComparison(),
    staleTime: 1000 * 60 * 5,
  });

  const { data: deptData, isLoading: deptLoading } = useQuery({
    queryKey: ['stats-by-dept'],
    queryFn: () => statsApi.getByDepartment(),
    staleTime: 1000 * 60 * 5,
  });

  const { data: userData, isLoading: userLoading } = useQuery({
    queryKey: ['stats-by-user'],
    queryFn: () => statsApi.getByUser(),
    staleTime: 1000 * 60 * 5,
  });

  const { data: monthlyData, isLoading: monthlyLoading } = useQuery({
    queryKey: ['stats-monthly'],
    queryFn: () => statsApi.getMonthly(),
    staleTime: 1000 * 60 * 5,
  });

  const overview = overviewData;
  const comparison = comparisonData?.comparison;

  const depts = useMemo(() => (deptData ?? []).map((dept: any) => {
    if (dept.assetCount !== undefined && dept.consumableCount !== undefined) {
      return dept;
    }
    const assets = dept.assets ?? [];
    const assetCount = assets.filter((a: any) => a.productType === 'BERILADIGAN').reduce((sum: number, a: any) => sum + Number(a.quantity ?? 0), 0);
    const consumableCount = assets.filter((a: any) => a.productType === 'SARFLANADIGAN').reduce((sum: number, a: any) => sum + Number(a.quantity ?? 0), 0);
    return {
      ...dept,
      assetCount,
      consumableCount,
      sharedCount: 0,
    };
  }), [deptData]);

  const users = userData ?? [];

  const [userSearch, setUserSearch] = useState('');
  const debouncedUserSearch = useDebounce(userSearch, 200);

  const filteredUsers = useMemo(() => {
    if (!debouncedUserSearch.trim()) return users;
    const q = debouncedUserSearch.toLowerCase().trim();
    return users.filter((u: any) =>
      String(u.fullName || '').toLowerCase().includes(q) ||
      String(u.username || '').toLowerCase().includes(q) ||
      String(u.position || '').toLowerCase().includes(q) ||
      String(u.department?.name || '').toLowerCase().includes(q)
    );
  }, [users, debouncedUserSearch]);

  const [userPage, setUserPage] = useState(1);
  const userLimit = 15;
  const userTotalPages = Math.ceil(filteredUsers.length / userLimit) || 1;
  const paginatedUsers = useMemo(() => {
    const start = (userPage - 1) * userLimit;
    return filteredUsers.slice(start, start + userLimit);
  }, [filteredUsers, userPage, userLimit]);

  useEffect(() => {
    setUserPage(1);
  }, [debouncedUserSearch]);

  const topUsers = useMemo(() => {
    return [...users]
      .filter((u: any) => (u.assetCount ?? 0) > 0)
      .sort((a: any, b: any) => (b.assetCount ?? 0) - (a.assetCount ?? 0))
      .slice(0, 10);
  }, [users]);

  const maxUserAssetCount = useMemo(() => {
    return users.reduce((max: number, u: any) => Math.max(max, Number(u.assetCount ?? 0)), 1);
  }, [users]);

  const monthly = useMemo(() => (monthlyData ?? []).map((m: any) => ({
    month: m.month,
    stockIn: m.stockIn ?? 0,
    stockOut: m.stockOut ?? 0,
    total: (m.stockIn ?? 0) + (m.stockOut ?? 0),
  })), [monthlyData]);

  const productTypeData = useMemo(() => {
    const dist = overview?.productTypeDistribution;
    const assetVal = dist?.assetCount ?? 0;
    const consumableVal = dist?.consumableCount ?? 0;
    return [
      {
        name: t('inventory.typeAsset') || 'Jihozlar (BERILADIGAN)',
        value: assetVal,
        color: PIE_COLORS.ASSET,
      },
      {
        name: t('inventory.typeConsumable') || 'Sarflanadigan (SARFLANADIGAN)',
        value: consumableVal,
        color: PIE_COLORS.CONSUMABLE,
      },
    ];
  }, [overview?.productTypeDistribution, t]);

  const statCards = [
    {
      label: t('dashboard.totalProducts'),
      value: overview?.totalProducts ?? 0,
      icon: <Boxes className="w-5 h-5" />,
      color: 'text-green-500',
      bg: 'bg-green-100 dark:bg-green-900/30',
      trend: overview?.trends?.products,
    },
    {
      label: t('dashboard.activeUsers'),
      value: overview?.totalUsers ?? 0,
      icon: <Users className="w-5 h-5" />,
      color: 'text-blue-500',
      bg: 'bg-blue-100 dark:bg-blue-900/30',
    },
    {
      label: t('dashboard.lowStock'),
      value: overview?.lowStockCount ?? 0,
      icon: <AlertTriangle className="w-5 h-5" />,
      color: 'text-red-500',
      bg: 'bg-red-100 dark:bg-red-900/30',
    },
    {
      label: t('dashboard.assignedAssets'),
      value: overview?.activeAssignments ?? 0,
      icon: <Package className="w-5 h-5" />,
      color: 'text-yellow-500',
      bg: 'bg-yellow-100 dark:bg-yellow-900/30',
      trend: overview?.trends?.assignments,
    },
    {
      label: t('dashboard.inventoryValue'),
      value: formatCompactCurrency(overview?.totalInventoryValue ?? 0),
      tooltip: formatCurrency(overview?.totalInventoryValue ?? 0),
      icon: <Wallet className="w-5 h-5" />,
      color: 'text-purple-500',
      bg: 'bg-purple-100 dark:bg-purple-900/30',
      trend: comparison?.stockInValue?.changePercent,
    },
    {
      label: t('dashboard.assignedValue'),
      value: formatCompactCurrency(overview?.totalAssignedValue ?? 0),
      tooltip: formatCurrency(overview?.totalAssignedValue ?? 0),
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'text-green-500',
      bg: 'bg-green-100 dark:bg-green-900/30',
      trend: comparison?.stockOutValue?.changePercent,
    },
  ];

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title={t('stats.title')}
        subtitle={t('stats.subtitle')}
      />

      {/* Tabs */}
      <div
        ref={tabListRef}
        className="relative flex items-center bg-gray-100 dark:bg-gray-800/80 p-1.5 rounded-2xl w-full sm:w-fit overflow-x-auto max-w-full border border-gray-200 dark:border-gray-700 scrollbar-none select-none touch-manipulation"
      >
        {/* Hardware-accelerated sliding pill */}
        <div
          className="absolute top-1.5 bottom-1.5 rounded-xl bg-gray-900 dark:bg-gray-100 shadow-sm pointer-events-none transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{
            transform: `translateX(${indicatorStyle.left}px)`,
            width: `${indicatorStyle.width}px`,
            left: 0,
          }}
        />

        {tabs.map((tab, i) => (
          <button
            key={tab}
            type="button"
            data-tab-index={i}
            onClick={() => setActiveTab(i)}
            className={cn(
              'relative z-10 px-3.5 sm:px-5 py-2 sm:py-2.5 text-[11px] sm:text-xs font-bold rounded-xl uppercase tracking-wider whitespace-nowrap cursor-pointer select-none touch-manipulation transition-colors duration-200',
              activeTab === i
                ? 'text-white dark:text-gray-900'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* TAB 0: Umumiy */}
      {activeTab === 0 && (
        overviewLoading ? <PageLoader /> : (
          <div key="tab-0" className="space-y-4 sm:space-y-5 animate-in fade-in duration-200 ease-out">
            {/* Stat Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {statCards.map((card) => (
                <StatCard
                  key={card.label}
                  {...card}
                  monthlySuffix={t('stats.monthlySuffix')}
                />
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
              {/* Product Type Pie Chart */}
              <Card className="h-full flex flex-col justify-between">
                <CardHeader title={t('stats.typesDistribution')} />
                <CardContent className="flex-1 flex flex-col justify-center">
                  <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-6">
                    <div className="w-[180px] h-[180px] sm:w-[200px] sm:h-[200px] shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={productTypeData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={78}
                            dataKey="value"
                            paddingAngle={3}
                            isAnimationActive={false}
                          >
                            {productTypeData.map((entry, index) => (
                              <Cell
                                key={index}
                                fill={entry.color}
                                strokeWidth={0}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: any) => [`${value} ${t('common.pcs')}`, '']}
                            contentStyle={{
                              backgroundColor: '#111827',
                              border: '1px solid #374151',
                              borderRadius: '10px',
                              fontSize: '12px',
                              color: '#f9fafb',
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-3 sm:space-y-4 flex-1 w-full min-w-0">
                      {productTypeData.map((item) => {
                        const maxVal = Math.max(...productTypeData.map((d) => d.value), 1);
                        return (
                          <div
                            key={item.name}
                            className="p-2.5 sm:p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800"
                          >
                            <div className="flex items-center justify-between gap-2 mb-1.5 min-w-0">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <div
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: item.color }}
                                />
                                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate" title={item.name}>
                                  {item.name}
                                </span>
                              </div>
                              <span className="text-xs font-black text-gray-900 dark:text-gray-100 shrink-0">
                                {item.value} {t('common.pcs')}
                              </span>
                            </div>
                            <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{
                                  width: `${(item.value / maxVal) * 100}%`,
                                  backgroundColor: item.color,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* System Indicators */}
              <Card className="h-full">
                <CardHeader title={t('stats.systemIndicators')} />
                <CardContent>
                  <div className="space-y-2.5 sm:space-y-3">
                    {[
                      { label: t('dashboard.departments'), value: `${overview?.totalDepartments ?? 0} ${t('common.pcs')}`, color: 'bg-green-500' },
                      { label: t('dashboard.totalOperations'), value: `${overview?.totalOperations ?? 0} ${t('common.pcs')}`, color: 'bg-blue-500' },
                      { label: t('dashboard.assignedAssets'), value: `${overview?.activeAssignments ?? 0} ${t('common.pcs')}`, color: 'bg-yellow-500' },
                      {
                        label: t('dashboard.inventoryValue'),
                        value: formatCompactCurrency(overview?.totalInventoryValue ?? 0),
                        tooltip: formatCurrency(overview?.totalInventoryValue ?? 0),
                        color: 'bg-purple-500',
                      },
                      {
                        label: t('dashboard.assignedValue'),
                        value: formatCompactCurrency(overview?.totalAssignedValue ?? 0),
                        tooltip: formatCurrency(overview?.totalAssignedValue ?? 0),
                        color: 'bg-teal-500',
                      },
                    ].map((item: any) => (
                      <div
                        key={item.label}
                        title={item.tooltip}
                        className="group/ind relative flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 transition-colors"
                      >
                        <div className={`w-1.5 h-6 sm:h-7 rounded-full shrink-0 ${item.color}`} />
                        <div className="flex-1 min-w-0 flex flex-col xs:flex-row xs:items-center justify-between gap-0.5 xs:gap-2">
                          <span className="text-xs sm:text-sm font-semibold text-gray-600 dark:text-gray-300 truncate" title={item.label}>
                            {item.label}
                          </span>
                          <span
                            className={cn(
                              "text-xs sm:text-sm font-black text-gray-900 dark:text-gray-100 shrink-0 xs:text-right transition-colors",
                              item.tooltip && "cursor-help hover:text-teal-600 dark:hover:text-teal-400"
                            )}
                            title={item.tooltip || item.value}
                          >
                            {item.value}
                          </span>
                        </div>
                        {item.tooltip && (
                          <div className="pointer-events-none opacity-0 group-hover/ind:opacity-100 transition-opacity duration-150 absolute -top-8 right-2 z-50 px-2 py-0.5 bg-gray-900 text-white text-[11px] font-mono rounded-md shadow-lg border border-gray-700 whitespace-nowrap hidden sm:flex items-center gap-1">
                            <span className="text-emerald-400 font-bold">{item.tooltip}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )
      )}

      {/* TAB 1: Bo'limlar */}
      {activeTab === 1 && (
        deptLoading ? <PageLoader /> : (
          <div key="tab-1" className="space-y-5 animate-in fade-in duration-200 ease-out">
            {/* Dept Comparison Chart */}
            <Card>
              <CardHeader title={t('stats.deptComparison')} />
              <CardContent>
                <div className="w-full h-[280px] sm:h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={depts} margin={{ top: 5, right: 15, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip content={<CustomTooltip pcsLabel={t('common.pcs')} />} />
                      <Legend
                        wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }}
                      />
                      <Bar dataKey="userCount" name={t('menu.users')} fill="#1D9E75" radius={[6, 6, 0, 0]} maxBarSize={36} isAnimationActive={false} />
                      <Bar dataKey="assetCount" name={t('stats.headers.assets')} fill="#3B82F6" radius={[6, 6, 0, 0]} maxBarSize={36} isAnimationActive={false} />
                      <Bar dataKey="consumableCount" name={t('products.consumable')} fill="#F59E0B" radius={[6, 6, 0, 0]} maxBarSize={36} isAnimationActive={false} />
                      <Bar dataKey="sharedCount" name={t('dashboard.general')} fill="#8B5CF6" radius={[6, 6, 0, 0]} maxBarSize={36} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Dept Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {depts.map((dept: any, i: number) => (
                <Card key={dept.id} className="p-3.5 sm:p-5">
                  <div className="flex items-start gap-2.5 sm:gap-3 mb-3 sm:mb-4 min-w-0">
                    <div
                      className="w-3 h-3 rounded-full mt-1 shrink-0"
                      style={{ backgroundColor: DEPT_COLORS[i % DEPT_COLORS.length] }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100 truncate" title={dept.name}>
                        {dept.name}
                      </p>
                      {dept.code && (
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">
                          {dept.code}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    {[
                      { label: t('menu.users'), value: dept.userCount, color: '#1D9E75' },
                      { label: t('stats.headers.assets'), value: dept.assetCount, color: '#3B82F6' },
                      { label: t('products.consumable'), value: dept.consumableCount, color: '#F59E0B' },
                      { label: t('dashboard.general'), value: dept.sharedCount, color: '#8B5CF6' },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-2.5 sm:p-3 min-w-0"
                      >
                        <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mb-0.5 sm:mb-1 truncate" title={item.label}>
                          {item.label}
                        </p>
                        <p
                          className="text-base sm:text-xl font-bold truncate"
                          style={{ color: item.color }}
                        >
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )
      )}

      {/* TAB 2: Xodimlar */}
      {activeTab === 2 && (
        userLoading ? <PageLoader /> : (
          <div key="tab-2" className="space-y-4 sm:space-y-5 animate-in fade-in duration-200 ease-out">
            {/* Top Users Chart */}
            <Card>
              <CardHeader
                title={t('stats.topUsers')}
                subtitle={t('stats.top10')}
              />
              <CardContent>
                <div className="w-full h-[260px] sm:h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={topUsers}
                      margin={{ top: 5, right: 20, left: 0, bottom: 20 }}
                      layout="vertical"
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="fullName"
                        tick={{ fontSize: 11, fill: '#9ca3af' }}
                        tickLine={false}
                        axisLine={false}
                        width={110}
                      />
                      <Tooltip content={<CustomTooltip pcsLabel={t('common.pcs')} />} />
                      <Bar
                        dataKey="assetCount"
                        name={t('stats.headers.assets')}
                        fill="#1D9E75"
                        radius={[0, 6, 6, 0]}
                        maxBarSize={22}
                        isAnimationActive={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* All Users Table */}
            <Card>
              <CardHeader
                title={t('stats.allUsers')}
                subtitle={`${filteredUsers.length} ${t('operations.employee') || 'xodim'}`}
                action={
                  <div className="relative w-48 sm:w-64">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder={t('common.search') || 'Qidirish...'}
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                }
              />
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800">
                      {['#', t('operations.employee'), t('stats.headers.dept'), t('stats.headers.position'), t('stats.headers.assets'), t('stats.headers.debtValue')].map((h) => (
                        <th key={h} className="px-3.5 sm:px-5 py-2.5 sm:py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-8 text-center text-sm text-gray-400">
                          {t('common.noData') || 'Ma’lumot topilmadi'}
                        </td>
                      </tr>
                    ) : (
                      paginatedUsers.map((u: any, i: number) => {
                        const globalIdx = (userPage - 1) * userLimit + i + 1;
                        return (
                          <tr
                            key={u.id}
                            className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                          >
                            <td className="px-3.5 sm:px-5 py-2.5 sm:py-3 text-gray-400 text-xs">{globalIdx}</td>
                            <td className="px-3.5 sm:px-5 py-2.5 sm:py-3">
                              <div className="flex items-center gap-2.5 sm:gap-3 min-w-[140px]">
                                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center shrink-0">
                                  <span className="text-xs font-bold text-teal-600 dark:text-teal-400">
                                    {u.fullName?.slice(0, 2).toUpperCase()}
                                  </span>
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{u.fullName}</p>
                                  <p className="text-[11px] text-gray-500 truncate">@{u.username}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3.5 sm:px-5 py-2.5 sm:py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                              {u.department?.name ?? '—'}
                            </td>
                            <td className="px-3.5 sm:px-5 py-2.5 sm:py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                              {u.position ?? '—'}
                            </td>
                            <td className="px-3.5 sm:px-5 py-2.5 sm:py-3 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span className="text-gray-900 dark:text-gray-100 font-bold">
                                  {u.assetCount}
                                </span>
                                {u.assetCount > 0 && (
                                  <div className="hidden xs:block flex-1 max-w-16 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-teal-500 rounded-full"
                                      style={{
                                        width: `${(u.assetCount / maxUserAssetCount) * 100}%`
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-3.5 sm:px-5 py-2.5 sm:py-3 whitespace-nowrap">
                              <span
                                className={cn(
                                  'font-bold transition-colors',
                                  u.totalValue > 0 ? 'text-teal-600 dark:text-teal-400 cursor-help hover:underline' : 'text-gray-400'
                                )}
                                title={u.totalValue > 0 ? formatCurrency(u.totalValue) : undefined}
                              >
                                {u.totalValue > 0 ? formatCompactCurrency(u.totalValue) : '—'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {filteredUsers.length > userLimit && (
                <div className="px-4 pb-3">
                  <Pagination
                    page={userPage}
                    totalPages={userTotalPages}
                    total={filteredUsers.length}
                    limit={userLimit}
                    onPageChange={setUserPage}
                  />
                </div>
              )}
            </Card>
          </div>
        )
      )}

      {/* TAB 3: Oylik dinamika */}
      {activeTab === 3 && (
        monthlyLoading ? <PageLoader /> : (
          <div key="tab-3" className="space-y-4 sm:space-y-5 animate-in fade-in duration-200 ease-out">
            {/* Monthly Dynamics Chart */}
            <Card>
              <CardHeader
                title={t('stats.monthlyDynamics')}
                subtitle={t('stats.last6Months')}
              />
              <CardContent>
                <div className="w-full h-[260px] sm:h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthly} margin={{ top: 5, right: 15, left: -10, bottom: 5 }}>
                      <defs>
                        <linearGradient id="colorStockIn" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1D9E75" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#1D9E75" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorStockOut" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip content={<CustomTooltip pcsLabel={t('common.pcs')} />} />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }} />
                      <Area
                        type="monotone"
                        dataKey="stockIn"
                        name={t('stats.headers.stockIn')}
                        stroke="#1D9E75"
                        strokeWidth={2.5}
                        fill="url(#colorStockIn)"
                        dot={{ r: 3.5, fill: '#1D9E75', strokeWidth: 0 }}
                        activeDot={{ r: 5 }}
                        isAnimationActive={false}
                      />
                      <Area
                        type="monotone"
                        dataKey="stockOut"
                        name={t('stats.headers.stockOut')}
                        stroke="#EF4444"
                        strokeWidth={2.5}
                        fill="url(#colorStockOut)"
                        dot={{ r: 3.5, fill: '#EF4444', strokeWidth: 0 }}
                        activeDot={{ r: 5 }}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Monthly Totals Bar Chart */}
            <Card>
              <CardHeader title={t('stats.monthlyTotals')} />
              <CardContent>
                <div className="w-full h-[200px] sm:h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthly} margin={{ top: 5, right: 15, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip content={<CustomTooltip pcsLabel={t('common.pcs')} />} />
                      <Bar
                        dataKey="total"
                        name={t('dashboard.totalOperations')}
                        radius={[6, 6, 0, 0]}
                        maxBarSize={44}
                        isAnimationActive={false}
                      >
                        {monthly.map((_: any, index: number) => (
                          <Cell
                            key={index}
                            fill={DEPT_COLORS[index % DEPT_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Monthly Details Table */}
            <Card>
              <CardHeader title={t('stats.monthlyDetails')} />
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800">
                      {[t('stats.headers.month'), t('stats.headers.stockIn'), t('stats.headers.stockOut'), t('stats.headers.total')].map((h) => (
                        <th key={h} className="px-3.5 sm:px-5 py-2.5 sm:py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {monthly.map((m: any) => (
                      <tr
                        key={m.month}
                        className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30"
                      >
                        <td className="px-3.5 sm:px-5 py-2.5 sm:py-3 font-semibold text-gray-900 dark:text-gray-100">{m.month}</td>
                        <td className="px-3.5 sm:px-5 py-2.5 sm:py-3 text-emerald-600 font-bold">{m.stockIn}</td>
                        <td className="px-3.5 sm:px-5 py-2.5 sm:py-3 text-rose-600 font-bold">{m.stockOut}</td>
                        <td className="px-3.5 sm:px-5 py-2.5 sm:py-3 font-black text-gray-900 dark:text-gray-100">{m.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )
      )}
    </div>
  );
}