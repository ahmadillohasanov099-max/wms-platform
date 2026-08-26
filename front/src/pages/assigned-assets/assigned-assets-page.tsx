import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  PackageCheck,
  Users,
  Building2,
  Wallet,
  Download,
  Search,
} from 'lucide-react';
import { inventoryApi, departmentsApi } from '../../api';
import {
  Card,
  CardContent,
  Button,
  Select,
  Table,
  Pagination,
  PageHeader,
  StatCard,
  CopyableInventoryNumber,
  type Column,
} from '../../components/ui';

import { formatCurrency, formatDate, cn } from '../../lib/utils';
import { useDebounce } from '../../hooks/useDebounce';
import { exportToStyledExcel } from '../../lib/export';
import { useTranslation } from '../../hooks/useTranslation';

export default function AssignedAssetsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [page, setPage] = useState(1);
  const limit = 20;

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 250);
  const [holderTypeFilter, setHolderTypeFilter] = useState<'ALL' | 'USER' | 'DEPARTMENT'>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');

  // Fetch all active assigned assets directly from backend
  const { data: assignedAssetsData, isLoading: assetsLoading } = useQuery({
    queryKey: ['assigned-assets'],
    queryFn: () => inventoryApi.getAssignedAssets(),
    staleTime: 30000,
  });

  const { data: departmentsData, isLoading: departmentsLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.getAll(),
    staleTime: 30000,
  });

  const isLoading = assetsLoading || departmentsLoading;
  const allAssignedItems = useMemo(() => assignedAssetsData ?? [], [assignedAssetsData]);

  // Overall Statistics
  const stats = useMemo(() => {
    let totalCount = 0;
    let userCount = 0;
    let deptCount = 0;
    let totalValue = 0;

    allAssignedItems.forEach((item) => {
      totalCount++;
      totalValue += Number(item.purchasePrice || 0);
      if (item.holderType === 'USER') {
        userCount++;
      } else {
        deptCount++;
      }
    });

    return { totalCount, userCount, deptCount, totalValue };
  }, [allAssignedItems]);

  // Filtered items based on search, holder type, and department
  const filteredItems = useMemo(() => {
    return allAssignedItems.filter((item) => {
      // 1. Holder Type filter
      if (holderTypeFilter !== 'ALL' && item.holderType !== holderTypeFilter) {
        return false;
      }

      // 2. Department filter
      if (departmentFilter !== 'ALL' && item.departmentId !== departmentFilter) {
        return false;
      }

      // 3. Search filter
      if (debouncedSearch.trim()) {
        const query = debouncedSearch.toLowerCase().trim();
        const matchesName = String(item.productName || '').toLowerCase().includes(query);
        const matchesInv = String(item.inventoryNumber || '').toLowerCase().includes(query);
        const matchesSerial = String(item.serialNumber || '').toLowerCase().includes(query);
        const matchesHolder = String(item.holderName || '').toLowerCase().includes(query);
        const matchesDept = String(item.departmentName || '').toLowerCase().includes(query);
        const matchesDoc = String(item.documentNumber || '').toLowerCase().includes(query);
        return matchesName || matchesInv || matchesSerial || matchesHolder || matchesDept || matchesDoc;
      }

      return true;
    });
  }, [allAssignedItems, holderTypeFilter, departmentFilter, debouncedSearch]);

  // Paginated items
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredItems.slice(start, start + limit);
  }, [filteredItems, page, limit]);

  const totalPages = Math.ceil(filteredItems.length / limit) || 1;

  // Reset page when filters change
  useMemo(() => {
    setPage(1);
  }, [debouncedSearch, holderTypeFilter, departmentFilter]);

  // Department options for filter dropdown
  const departmentOptions = useMemo(() => {
    const depts = departmentsData ?? [];
    return [
      { value: 'ALL', label: t('assignedAssets.allDepts') },
      ...depts.map((d: any) => ({ value: d.id, label: d.name })),
    ];
  }, [departmentsData, t]);

  const handleExport = () => {
    const headers = [
      '№',
      t('assignedAssets.productName'),
      'Inventar raqami',
      'Seriya raqami',
      t('assignedAssets.holder'),
      t('assignedAssets.department'),
      t('assignedAssets.assignedAt'),
      t('assignedAssets.issuer'),
      t('assignedAssets.docNo'),
      t('assignedAssets.cost'),
    ];

    const rows = filteredItems.map((item, index) => [
      index + 1,
      item.productName || '—',
      item.inventoryNumber || '—',
      item.serialNumber || '—',
      `${item.holderType === 'USER' ? t('assignedAssets.user') : t('assignedAssets.dept')}: ${item.holderName || '—'}`,
      item.departmentName || '—',
      item.assignedAt ? formatDate(item.assignedAt) : '—',
      item.performedBy || "Mas'ul",
      item.documentNumber || '—',
      formatCurrency(item.purchasePrice || 0),
    ]);

    exportToStyledExcel({
      filename: `berilgan_jihozlar_${new Date().toISOString().split('T')[0]}`,
      sheetName: t('assignedAssets.title'),
      headers,
      rows,
      colWidths: [6, 35, 22, 22, 32, 26, 18, 22, 18, 20],
      centerColIndexes: [0, 2, 3, 6, 8],
    });
  };

  // Table columns definition
  const columns: Column<any>[] = [
    {
      key: 'index',
      title: '№',
      className: 'w-12 text-center text-xs text-gray-400 font-medium',
      render: (_: any, row: any) => (page - 1) * limit + paginatedItems.indexOf(row) + 1,
    },
    {
      key: 'productName',
      title: t('assignedAssets.productName'),
      render: (_: any, row: any) => (
        <div>
          <p className="font-bold text-gray-900 dark:text-gray-100 text-sm">
            {row.productName}
          </p>
        </div>
      ),
    },
    {
      key: 'inventoryNumber',
      title: t('assignedAssets.invSerialNo'),
      render: (_: any, row: any) => (
        <div className="space-y-1">
          <CopyableInventoryNumber value={row.inventoryNumber} />
          {row.serialNumber && row.serialNumber !== '—' && (
            <p className="text-2xs text-gray-400 font-mono">S/N: {row.serialNumber}</p>
          )}
        </div>
      ),

    },
    {
      key: 'holder',
      title: t('assignedAssets.holder'),
      render: (_: any, row: any) => {
        const isUser = row.holderType === 'USER';
        return (
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                isUser
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-900/60'
                  : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-900/60'
              }`}
            >
              {isUser ? <Users className="w-3.5 h-3.5" /> : <Building2 className="w-3.5 h-3.5" />}
              {isUser ? t('assignedAssets.user') : t('assignedAssets.dept')}
            </span>
            <div>
              <p
                onClick={() => {
                  if (isUser && row.holderUser?.id) {
                    navigate(`/users/${row.holderUser.id}`);
                  }
                }}
                className={`font-bold text-xs ${
                  isUser && row.holderUser?.id
                    ? 'text-blue-600 dark:text-blue-400 hover:underline cursor-pointer'
                    : 'text-gray-900 dark:text-gray-100'
                }`}
              >
                {row.holderName}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'department',
      title: t('assignedAssets.department'),
      render: (_: any, row: any) => (
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
          {row.departmentName}
        </span>
      ),
    },
    {
      key: 'assignedAt',
      title: t('assignedAssets.assignedAt'),
      render: (_: any, row: any) => (
        <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
          {row.assignedAt ? formatDate(row.assignedAt) : '—'}
        </span>
      ),
    },
    {
      key: 'performedBy',
      title: t('assignedAssets.issuer'),
      render: (_: any, row: any) => (
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
          {row.performedBy || '—'}
        </span>
      ),
    },
    {
      key: 'documentNumber',
      title: t('assignedAssets.docNo'),
      render: (_: any, row: any) => {
        const isPending = row.status === 'PENDING';
        const isRejected = row.status === 'REJECTED';
        return (
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "w-2 h-2 rounded-full shrink-0",
                isPending
                  ? "bg-amber-500 animate-pulse ring-2 ring-amber-400/40"
                  : isRejected
                  ? "bg-rose-500 ring-2 ring-rose-400/40"
                  : "bg-emerald-500 ring-2 ring-emerald-400/30"
              )}
              title={
                isPending
                  ? "Xodim tasdiqlashi kutilmoqda (Sariq)"
                  : isRejected
                  ? "Xodim tomonidan rad etilgan (Qizil)"
                  : "Xodim tomonidan qabul qilingan (Yashil)"
              }
            />
            <span className="font-mono text-xs font-bold text-gray-700 dark:text-gray-300">
              {row.documentNumber || '—'}
            </span>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <PageHeader
        title={t('assignedAssets.title')}
        subtitle={t('assignedAssets.subtitle')}
        actions={
          <Button
            onClick={handleExport}
            variant="outline"
            disabled={filteredItems.length === 0}
            className="flex items-center gap-2 font-bold"
          >
            <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{t('assignedAssets.exportExcel')}</span>
          </Button>
        }
      />

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t('assignedAssets.totalAssignedItems')}
          value={isLoading ? '...' : `${stats.totalCount} ${t('common.pcs')}`}
          icon={<PackageCheck className="w-5 h-5" />}
          color="yellow"
        />
        <StatCard
          label={t('assignedAssets.userAssignments')}
          value={isLoading ? '...' : `${stats.userCount} ${t('common.pcs')}`}
          icon={<Users className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          label={t('assignedAssets.deptAssignments')}
          value={isLoading ? '...' : `${stats.deptCount} ${t('common.pcs')}`}
          icon={<Building2 className="w-5 h-5" />}
          color="purple"
        />
        <StatCard
          label={t('assignedAssets.totalAssignedValue')}
          value={isLoading ? '...' : formatCurrency(stats.totalValue)}
          icon={<Wallet className="w-5 h-5" />}
          color="green"
        />
      </div>

      {/* Filters and Table Card */}
      <Card className="rounded-2xl border-gray-200/90 dark:border-white/15 shadow-2xs overflow-hidden">
        <CardContent className="p-5 space-y-4">
          {/* Search & Filter Controls */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={t('assignedAssets.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>

            {/* Holder Filter Tabs */}
            <div className="flex items-center bg-gray-100 dark:bg-slate-800/80 p-1 rounded-xl gap-1 shrink-0">
              <button
                onClick={() => setHolderTypeFilter('ALL')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  holderTypeFilter === 'ALL'
                    ? 'bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-xs'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {t('common.viewAll')} ({stats.totalCount})
              </button>
              <button
                onClick={() => setHolderTypeFilter('USER')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  holderTypeFilter === 'USER'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {t('assignedAssets.holderUser')} ({stats.userCount})
              </button>
              <button
                onClick={() => setHolderTypeFilter('DEPARTMENT')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  holderTypeFilter === 'DEPARTMENT'
                    ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {t('assignedAssets.holderDepartment')} ({stats.deptCount})
              </button>
            </div>

            {/* Department Filter */}
            <div className="w-full md:w-56 shrink-0">
              <Select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                options={departmentOptions}
              />
            </div>
          </div>

          {/* Results count info */}
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-1">
            <span>
              {t('common.total')}: <strong className="text-gray-900 dark:text-gray-100">{filteredItems.length} {t('common.pcs')}</strong>
            </span>
          </div>

          {/* Table Component */}
          <Table
            data={paginatedItems}
            columns={columns}
            loading={isLoading}
            emptyTitle={t('assignedAssets.noItems')}
          />

          {/* Pagination */}
          {!isLoading && filteredItems.length > limit && (
            <div className="pt-2 flex justify-end">
              <Pagination
                page={page}
                totalPages={totalPages}
                total={filteredItems.length}
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
