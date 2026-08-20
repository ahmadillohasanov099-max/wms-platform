import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Area, AreaChart,
} from 'recharts';
import { motion } from 'framer-motion';
import {
  Package, Users, AlertTriangle, Boxes, Wallet, TrendingUp,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { statsApi } from '../../api';
import Card, { CardHeader, CardContent } from '../../components/ui/card';
import { PageLoader } from '../../components/ui/spinner';
import { formatCurrency } from '../../lib/utils';
import { useTranslation } from '../../hooks/useTranslation';
import PageHeader from '../../components/ui/page-header';

const PIE_COLORS = {
  ASSET: '#3b82f6',
  CONSUMABLE: '#10b981',
  SHARED: '#f59e0b',
};

const DEPT_COLORS = ['#3b82f6', '#10b981', '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b'];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function StatsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(0);

  const tabs = [
    t('stats.tabs.general'),
    t('stats.tabs.depts'),
    t('stats.tabs.users'),
    t('stats.tabs.monthly'),
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 shadow-xl text-white">
          <p className="text-xs text-slate-400 mb-2 font-medium">{label}</p>
          {payload.map((entry: any, i: number) => (
            <p key={i} className="text-sm font-semibold text-slate-100">
              {entry.name}: {entry.value} {t('common.pcs')}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  function StatCard({ label, value, icon, trend }: any) {
    return (
      <motion.div variants={itemVariants}>
        <div className="p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-all duration-200">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{label}</p>
              <p className="text-3xl font-black text-gray-900 dark:text-gray-100">
                {value}
              </p>
              {trend !== undefined && (
                <div className={`flex items-center gap-1 mt-2 text-xs font-bold ${trend >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {trend >= 0
                    ? <ArrowUpRight className="w-3.5 h-3.5" />
                    : <ArrowDownRight className="w-3.5 h-3.5" />
                  }
                  <span>{Math.abs(trend)}% {t('stats.monthlySuffix')}</span>
                </div>
              )}
            </div>
            <div className="p-3.5 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200">
              {icon}
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

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

  const { data: productData } = useQuery({
    queryKey: ['stats-by-product'],
    queryFn: () => statsApi.getByProduct(),
    staleTime: 1000 * 60 * 5,
  });

  const overview = overviewData;
  const comparison = comparisonData?.comparison;

  const depts = useMemo(() => (deptData ?? []).map((dept: any) => {
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

  const monthly = useMemo(() => (monthlyData ?? []).map((m: any) => ({
    month: m.month,
    stockIn: m.stockIn ?? 0,
    stockOut: m.stockOut ?? 0,
    total: (m.stockIn ?? 0) + (m.stockOut ?? 0),
  })), [monthlyData]);

  const products = productData ?? [];

  const productTypeData = useMemo(() => [
    {
      name: t('inventory.typeAsset') || 'Jihozlar (BERILADIGAN)',
      value: products.filter((p: any) => p.productType === 'BERILADIGAN').length,
      color: PIE_COLORS.ASSET,
    },
    {
      name: t('inventory.typeConsumable') || 'Sarflanadigan (SARFLANADIGAN)',
      value: products.filter((p: any) => p.productType === 'SARFLANADIGAN').length,
      color: PIE_COLORS.CONSUMABLE,
    },
  ], [products, t]);

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
      value: formatCurrency(overview?.totalInventoryValue ?? 0),
      icon: <Wallet className="w-5 h-5" />,
      color: 'text-purple-500',
      bg: 'bg-purple-100 dark:bg-purple-900/30',
      trend: comparison?.stockInValue?.changePercent,
    },
    {
      label: t('dashboard.assignedValue'),
      value: formatCurrency(overview?.totalAssignedValue ?? 0),
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'text-green-500',
      bg: 'bg-green-100 dark:bg-green-900/30',
      trend: comparison?.stockOutValue?.changePercent,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('stats.title')}
        subtitle={t('stats.subtitle')}
      />

      {/* Tabs */}
      <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800/80 p-1.5 rounded-2xl w-full sm:w-fit overflow-x-auto max-w-full border border-gray-200 dark:border-gray-700">
        {tabs.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={`relative px-4 sm:px-5 py-2.5 text-xs font-bold rounded-xl transition-all duration-200 uppercase tracking-wider whitespace-nowrap cursor-pointer ${
              activeTab === i
                ? 'text-white'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-white/50 dark:hover:bg-gray-700/50'
            }`}
          >
            {activeTab === i && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute inset-0 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-xl shadow-sm"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
              />
            )}
            <span className={`relative z-10 ${activeTab === i ? 'text-white dark:text-gray-900' : ''}`}>{tab}</span>
          </button>
        ))}
      </div>

      {/* TAB 0: Umumiy */}
      {activeTab === 0 && (
        overviewLoading ? <PageLoader /> : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-5"
          >
            {/* Stat Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {statCards.map((card) => (
                <StatCard key={card.label} {...card} />
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Product Type Pie Chart */}
              <motion.div variants={itemVariants}>
                <Card>
                  <CardHeader title={t('stats.typesDistribution')} />
                  <CardContent>
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                      <ResponsiveContainer width={200} height={200}>
                        <PieChart>
                          <Pie
                            data={productTypeData}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={85}
                            dataKey="value"
                            paddingAngle={3}
                            animationBegin={0}
                            animationDuration={800}
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
                      <div className="space-y-4 flex-1">
                        {productTypeData.map((item) => (
                          <div key={item.name} className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2.5 h-2.5 rounded-full"
                                  style={{ backgroundColor: item.color }}
                                />
                                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                  {item.name}
                                </span>
                              </div>
                              <span className="text-xs font-black text-gray-900 dark:text-gray-100">
                                {item.value} {t('common.pcs')}
                              </span>
                            </div>
                            <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{
                                  width: `${(item.value / Math.max(...productTypeData.map(d => d.value))) * 100}%`
                                }}
                                transition={{ duration: 0.8, delay: 0.2 }}
                                className="h-full rounded-full"
                                style={{ backgroundColor: item.color }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {}
              <motion.div variants={itemVariants}>
                <Card className="h-full">
                  <CardHeader title={t('stats.systemIndicators')} />
                  <CardContent>
                    <div className="space-y-3">
                      {[
                        { label: t('dashboard.departments'), value: `${overview?.totalDepartments ?? 0} ${t('common.pcs')}`, color: 'bg-green-500' },
                        { label: t('dashboard.totalOperations'), value: `${overview?.totalOperations ?? 0} ${t('common.pcs')}`, color: 'bg-blue-500' },
                        { label: t('dashboard.assignedAssets'), value: `${overview?.activeAssignments ?? 0} ${t('common.pcs')}`, color: 'bg-yellow-500' },
                        { label: t('dashboard.inventoryValue'), value: formatCurrency(overview?.totalInventoryValue ?? 0), color: 'bg-purple-500' },
                        { label: t('dashboard.assignedValue'), value: formatCurrency(overview?.totalAssignedValue ?? 0), color: 'bg-primary-500' },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                          <div className={`w-1.5 h-7 rounded-full ${item.color}`} />
                          <div className="flex-1 flex items-center justify-between">
                            <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                              {item.label}
                            </span>
                            <span className="text-sm font-black text-gray-900 dark:text-gray-100">
                              {item.value}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </motion.div>
        )
      )}

      {}
      {activeTab === 1 && (
        deptLoading ? <PageLoader /> : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-5"
          >
            {}
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader title={t('stats.deptComparison')} />
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={depts} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        wrapperStyle={{ fontSize: '12px', paddingTop: '16px' }}
                      />
                      <Bar dataKey="userCount" name={t('menu.users')} fill="#1D9E75" radius={[6, 6, 0, 0]} maxBarSize={40} />
                      <Bar dataKey="assetCount" name={t('stats.headers.assets')} fill="#3B82F6" radius={[6, 6, 0, 0]} maxBarSize={40} />
                      <Bar dataKey="consumableCount" name={t('products.consumable')} fill="#F59E0B" radius={[6, 6, 0, 0]} maxBarSize={40} />
                      <Bar dataKey="sharedCount" name={t('dashboard.general')} fill="#8B5CF6" radius={[6, 6, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>

            {}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {depts.map((dept: any, i: number) => (
                <motion.div key={dept.id} variants={itemVariants}>
                  <Card className="p-5">
                    <div className="flex items-start gap-3 mb-4">
                      <div
                        className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
                        style={{ backgroundColor: DEPT_COLORS[i % DEPT_COLORS.length] }}
                      />
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {dept.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {dept.code}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: t('menu.users'), value: dept.userCount, color: '#1D9E75' },
                        { label: t('stats.headers.assets'), value: dept.assetCount, color: '#3B82F6' },
                        { label: t('products.consumable'), value: dept.consumableCount, color: '#F59E0B' },
                        { label: t('dashboard.general'), value: dept.sharedCount, color: '#8B5CF6' },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-3"
                        >
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                            {item.label}
                          </p>
                          <p
                            className="text-xl font-bold"
                            style={{ color: item.color }}
                          >
                            {item.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )
      )}

      {}
      {activeTab === 2 && (
        userLoading ? <PageLoader /> : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-5"
          >
            {}
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader
                  title={t('stats.topUsers')}
                  subtitle={t('stats.top10')}
                />
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={[...users]
                        .filter((u: any) => u.assetCount > 0)
                        .sort((a: any, b: any) => b.assetCount - a.assetCount)
                        .slice(0, 10)}
                      margin={{ top: 5, right: 20, left: 0, bottom: 40 }}
                      layout="vertical"
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="fullName"
                        tick={{ fontSize: 11, fill: '#9ca3af' }}
                        tickLine={false}
                        axisLine={false}
                        width={120}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar
                        dataKey="assetCount"
                        name={t('stats.headers.assets')}
                        fill="#1D9E75"
                        radius={[0, 6, 6, 0]}
                        maxBarSize={24}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>

            {}
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader title={t('stats.allUsers')} />
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-800">
                        {['#', t('operations.employee'), t('stats.headers.dept'), t('stats.headers.position'), t('stats.headers.assets'), t('stats.headers.debtValue')].map((h) => (
                          <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u: any, i: number) => (
                        <tr
                          key={u.id}
                          className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                        >
                          <td className="px-5 py-3 text-gray-400 text-xs">{i + 1}</td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-bold text-primary-600 dark:text-primary-400">
                                  {u.fullName?.slice(0, 2).toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 dark:text-gray-100">{u.fullName}</p>
                                <p className="text-xs text-gray-500">@{u.username}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-gray-600 dark:text-gray-400">
                            {u.department?.name ?? '—'}
                          </td>
                          <td className="px-5 py-3 text-gray-600 dark:text-gray-400">
                            {u.position ?? '—'}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-900 dark:text-gray-100 font-medium">
                                {u.assetCount}
                              </span>
                              {u.assetCount > 0 && (
                                <div className="flex-1 max-w-16 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-primary-500 rounded-full"
                                    style={{
                                      width: `${(u.assetCount / Math.max(...users.map((x: any) => x.assetCount))) * 100}%`
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`font-semibold ${u.totalValue > 0 ? 'text-primary-500' : 'text-gray-400'}`}>
                              {u.totalValue > 0 ? formatCurrency(u.totalValue) : '—'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        )
      )}

      {}
      {activeTab === 3 && (
        monthlyLoading ? <PageLoader /> : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-5"
          >
            {}
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader
                  title={t('stats.monthlyDynamics')}
                  subtitle={t('stats.last6Months')}
                />
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={monthly} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '16px' }} />
                      <Area
                        type="monotone"
                        dataKey="stockIn"
                        name={t('stats.headers.stockIn')}
                        stroke="#1D9E75"
                        strokeWidth={2.5}
                        fill="url(#colorStockIn)"
                        dot={{ r: 4, fill: '#1D9E75', strokeWidth: 0 }}
                        activeDot={{ r: 6 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="stockOut"
                        name={t('stats.headers.stockOut')}
                        stroke="#EF4444"
                        strokeWidth={2.5}
                        fill="url(#colorStockOut)"
                        dot={{ r: 4, fill: '#EF4444', strokeWidth: 0 }}
                        activeDot={{ r: 6 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>

            {}
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader title={t('stats.monthlyTotals')} />
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={monthly} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar
                        dataKey="total"
                        name={t('dashboard.totalOperations')}
                        radius={[8, 8, 0, 0]}
                        maxBarSize={50}
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
                </CardContent>
              </Card>
            </motion.div>

            {}
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader title={t('stats.monthlyDetails')} />
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-800">
                        {[t('stats.headers.month'), t('stats.headers.stockIn'), t('stats.headers.stockOut'), t('stats.headers.total')].map((h) => (
                          <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
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
                          <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">{m.month}</td>
                          <td className="px-5 py-3 text-green-500 font-medium">{m.stockIn}</td>
                          <td className="px-5 py-3 text-red-500 font-medium">{m.stockOut}</td>
                          <td className="px-5 py-3 font-bold text-gray-900 dark:text-gray-100">{m.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        )
      )}
    </div>
  );
}