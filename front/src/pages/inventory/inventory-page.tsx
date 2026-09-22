import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, AlertTriangle, History as HistoryIcon, Edit2, Trash2, Boxes, PackageCheck, TrendingUp, Sparkles, Wrench, CheckCircle2 } from 'lucide-react';
import { inventoryApi, productsApi, operationsApi } from '../../api';
import { Card, Button, Select, Table, Pagination, ConfirmDialog, ProductTypeBadge, PageHeader, SearchFilterCard, StatsCard } from '../../components/ui';
import { formatCurrency, formatCompactCurrency, formatDate, invalidateAppQueries } from '../../lib/utils';
import toast from 'react-hot-toast';
import StockInModal from './stock-in-modal';
import ExcelImportModal from './excel-import-modal';
import WriteOffModal from '../operations/write-off-modal';
import ProductFormModal from '../products/product-form-modal';
import ProductHistoryModal from '../products/product-history-modal';
import ProductDetailModal from '../products/product-detail-modal';
import RepairCompleteModal from '../../components/modals/repair-complete-modal';
import CopyableInventoryNumber from '../../components/ui/copyable-inventory-number';
import { useAuthStore } from '../../store/auth.store';
import { useTranslation } from '../../hooks/useTranslation';
import { useDebounce } from '../../hooks/useDebounce';
import { downloadExport } from '../../lib/export';

export default function InventoryPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const isAdmin =
    user?.role !== 'XODIM' &&
    user?.role !== 'KADR' &&
    user?.role !== 'RAHBAR';

  const [page, setPage] = useState(1);
  const limit = 20;

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 250);
  const [typeFilter, setTypeFilter] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [stockStatus, setStockStatus] = useState<'ALL' | 'IN_REPAIR'>('ALL');
  const [selectedRepairAsset, setSelectedRepairAsset] = useState<any | null>(null);

  const [stockInModal, setStockInModal] = useState(false);
  const [excelModal, setExcelModal] = useState(false);
  const [writeOffModal, setWriteOffModal] = useState(false);
  const [historyModal, setHistoryModal] = useState(false);
  const [selectedHistoryProduct, setSelectedHistoryProduct] = useState<any>(null);
  const [detailProductId, setDetailProductId] = useState<string | null>(null);
  const [formModal, setFormModal] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteProduct, setDeleteProduct] = useState<any>(null);
  const [minLevelEdit, setMinLevelEdit] = useState<string | null>(null);
  const [minLevelValue, setMinLevelValue] = useState('');
  const [exportLoading, setExportLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', debouncedSearch],
    queryFn: () => inventoryApi.getAll({ search: debouncedSearch || undefined }),
    staleTime: 30000,
  });

  const { mutate: setMinLevel, isPending: minLevelLoading } = useMutation({
    mutationFn: ({ productId, minLevel }: { productId: string; minLevel: number }) =>
      inventoryApi.setMinLevel({ productId, minLevel }),
    onSuccess: () => {
      toast.success(t('inventory.minLevelUpdated'));
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setMinLevelEdit(null);
    },
    onError: (err: any) => {
      toast.error(err?.message || err?.response?.data?.message || t('common.error'));
    },
  });

  const { mutate: removeProduct, isPending: deleteLoading } = useMutation({
    mutationFn: (id: string) => productsApi.remove(id),
    onSuccess: () => {
      toast.success(t('inventory.productDeleted'));
      invalidateAppQueries(queryClient);
      setDeleteDialog(false);
    },
    onError: (err: any) => {
      toast.error(err?.message || err?.response?.data?.message || t('common.error'));
    },
  });

  const inventory = useMemo(() => data ?? [], [data]);

  const { data: repairData, isLoading: repairLoading } = useQuery({
    queryKey: ['in-repair-assets'],
    queryFn: () => inventoryApi.getInRepairAssets(),
    staleTime: 15000,
  });
  const repairAssets = useMemo(() => repairData ?? [], [repairData]);

  const completeRepairMutation = useMutation({
    mutationFn: ({ assetId, note }: { assetId: string; note?: string }) =>
      operationsApi.completeRepair({ assetId, note }),
    onSuccess: (res: any) => {
      toast.success(res?.message || 'Jihoz ta\'mirlanib, omborga/xodimga qaytarildi');
      invalidateAppQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: ['in-repair-assets'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setSelectedRepairAsset(null);
    },
    onError: (err: any) => {
      toast.error(err?.message || err?.response?.data?.message || t('common.error'));
    },
  });

  const repairCount = useMemo(() => {
    if (!typeFilter) return repairAssets.length;
    return repairAssets.filter((a: any) => a.product?.productType === typeFilter).length;
  }, [repairAssets, typeFilter]);

  const { totalValue, lowStockCount, totalCount } = useMemo(() => {
    let sum = 0;
    let low = 0;
    let total = 0;
    for (let i = 0; i < inventory.length; i++) {
      const item = inventory[i];
      if (typeFilter && item.product?.productType !== typeFilter) continue;
      total++;
      sum += Number(item.totalValue ?? 0);
      if (item.quantity <= item.minLevel) low++;
    }
    return { totalValue: sum, lowStockCount: low, totalCount: total };
  }, [inventory, typeFilter]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, typeFilter, lowStockOnly, stockStatus]);

  const filtered = useMemo(() => {
    const s = debouncedSearch.toLowerCase().trim();
    return inventory.filter((item: any) => {
      const matchSearch =
        !s ||
        item.product?.name?.toLowerCase().includes(s) ||
        item.product?.code?.toLowerCase().includes(s) ||
        (item.product?.year && String(item.product.year).includes(s)) ||
        item.product?.assets?.some(
          (a: any) =>
            a.inventoryNumber?.toLowerCase().includes(s) ||
            a.serialNumber?.toLowerCase().includes(s)
        );
      const matchType = !typeFilter || item.product?.productType === typeFilter;
      const matchLowStock = !lowStockOnly || item.quantity <= item.minLevel;
      return matchSearch && matchType && matchLowStock;
    });
  }, [inventory, debouncedSearch, typeFilter, lowStockOnly]);

  const filteredRepairAssets = useMemo(() => {
    const s = debouncedSearch.toLowerCase().trim();
    return repairAssets.filter((a: any) => {
      const matchType = !typeFilter || a.product?.productType === typeFilter;
      const matchSearch =
        !s ||
        a.product?.name?.toLowerCase().includes(s) ||
        a.product?.code?.toLowerCase().includes(s) ||
        a.inventoryNumber?.toLowerCase().includes(s) ||
        a.serialNumber?.toLowerCase().includes(s) ||
        a.holderName?.toLowerCase().includes(s);
      return matchType && matchSearch;
    });
  }, [repairAssets, debouncedSearch, typeFilter]);

  const totalItemsCount = stockStatus === 'IN_REPAIR' ? filteredRepairAssets.length : filtered.length;
  const totalPages = Math.ceil(totalItemsCount / limit) || 1;

  const paginatedData = useMemo(() => {
    const start = (page - 1) * limit;
    if (stockStatus === 'IN_REPAIR') {
      return filteredRepairAssets.slice(start, start + limit);
    }
    return filtered.slice(start, start + limit);
  }, [filtered, filteredRepairAssets, stockStatus, page, limit]);

  const unitLabel = (unit: string) => {
    if (unit === 'DONA') return t('common.units.DONA');
    if (unit === 'PACHKA') return t('common.units.PACHKA');
    if (unit === 'KOMPLEKT') return t('common.units.KOMPLEKT');
    return unit || t('common.pcs');
  };

  const handleExport = async () => {
    try {
      setExportLoading(true);
      const exportParams: Record<string, any> = {};
      if (user?.organizationId) {
        exportParams.organizationId = user.organizationId;
      }
      if (typeFilter) {
        exportParams.type = typeFilter;
        exportParams.productType = typeFilter;
      }
      if (debouncedSearch && debouncedSearch.trim()) {
        exportParams.search = debouncedSearch.trim();
      }
      if (lowStockOnly) {
        exportParams.lowStock = 'true';
      }

      let typeSuffix = '';
      if (typeFilter === 'BERILADIGAN') {
        typeSuffix = '_asosiy_vositalar';
      } else if (typeFilter === 'SARFLANADIGAN') {
        typeSuffix = '_tmz';
      }

      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `ombor${typeSuffix}_${dateStr}.xlsx`;

      await downloadExport(
        '/inventory/export',
        filename,
        Object.keys(exportParams).length > 0 ? exportParams : undefined,
      );
      toast.success(t('common.success'));
    } catch {
      toast.error(t('common.error'));
    } finally {
      setExportLoading(false);
    }
  };

  const columns = [
    {
      key: 'product',
      title: t('inventory.productName'),
      className: 'whitespace-normal break-words min-w-[220px] max-w-md',
      render: (_: any, row: any) => (
        <div className="flex flex-col min-w-0 break-words">
          <button
            type="button"
            onClick={() => setDetailProductId(row.productId)}
            className="font-bold text-slate-900 dark:text-white hover:text-teal-600 dark:hover:text-teal-400 text-left transition-colors text-sm whitespace-normal break-words"
            title={t('inventory.assetsBtn')}
          >
            {row.product?.name}
          </button>
          <div className="flex flex-wrap items-center gap-2 text-2xs text-gray-500 dark:text-gray-400 mt-0.5">
            {row.product?.code && (
              <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-gray-700 dark:text-gray-300 break-all">
                {row.product.code}
              </span>
            )}
            {row.product?.year && (
              <span>{row.product.year}-yil</span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'productType',
      title: t('inventory.productType'),
      render: (_: any, row: any) => (
        <ProductTypeBadge type={row.product?.productType} />
      ),
    },
    {
      key: 'quantity',
      title: t('inventory.quantity'),
      render: (value: any, row: any) => {
        const isAsset = row.product?.productType === 'BERILADIGAN';
        if (isAsset && value === 0) {
          const activeAssignments = (row.product?.assets || [])
            .flatMap((a: any) => a.assignments || [])
            .filter((asgn: any) => !asgn.returnedAt);

          const hasUser = activeAssignments.some((a: any) => a.user?.id);
          const hasDept = activeAssignments.some((a: any) => a.department?.id);

          return (
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span className="font-bold text-gray-900 dark:text-gray-100 text-xs">
                0 {unitLabel(row.product?.unit)}
              </span>
              <span className="text-3xs font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900/40">
                {hasUser ? t('inventory.onEmployeeShort') : hasDept ? t('inventory.onDeptShort') : t('inventory.assignedShort')}
              </span>
            </div>
          );
        }

        return (
          <div className="flex items-center gap-1.5 font-bold">
            <span
              className={
                value <= row.minLevel
                  ? 'text-red-600 dark:text-red-400 font-bold'
                  : 'text-gray-900 dark:text-gray-100 font-bold'
              }
            >
              {value} {unitLabel(row.product?.unit)}
            </span>
            {value <= row.minLevel && (
              <span className="inline-flex items-center gap-1 text-2xs px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 font-medium" title={t('inventory.lowStock')}>
                <AlertTriangle className="w-3 h-3 text-red-500" />
                {t('inventory.lowStockBadge')}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'minLevel',
      title: t('inventory.minLevel'),
      render: (value: any, row: any) => {
        if (!isAdmin) {
          return <span className="text-gray-700 dark:text-gray-300 font-medium">{value} {unitLabel(row.product?.unit)}</span>;
        }
        if (minLevelEdit === row.productId) {
          return (
            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <input
                type="number"
                min="0"
                value={minLevelValue}
                onChange={(e) => setMinLevelValue(e.target.value)}
                className="w-16 px-2 py-1 text-xs border rounded bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 font-bold"
                autoFocus
              />
              <button
                type="button"
                disabled={minLevelLoading}
                onClick={() =>
                  setMinLevel({
                    productId: row.productId,
                    minLevel: parseInt(minLevelValue, 10) || 0,
                  })
                }
                className="text-xs text-primary-600 dark:text-primary-400 font-bold hover:underline"
              >
                {t('common.save')}
              </button>
              <button
                type="button"
                onClick={() => setMinLevelEdit(null)}
                className="text-xs text-gray-400 hover:underline"
              >
                {t('common.cancel')}
              </button>
            </div>
          );
        }
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMinLevelEdit(row.productId);
              setMinLevelValue(String(value));
            }}
            className="text-gray-700 dark:text-gray-300 hover:text-primary-600 font-medium hover:underline flex items-center gap-1"
          >
            <span>{value} {unitLabel(row.product?.unit)}</span>
            <Edit2 className="w-3 h-3 text-gray-400" />
          </button>
        );
      },
    },
    {
      key: 'unitPrice',
      title: t('inventory.unitPrice'),
      render: (value: any) => (
        <span className="font-mono text-gray-700 dark:text-gray-300 text-xs">
          {value ? formatCurrency(value) : '—'}
        </span>
      ),
    },
    {
      key: 'totalValue',
      title: t('inventory.totalValue'),
      render: (value: any) => (
        <span className="font-bold font-mono text-teal-600 dark:text-teal-400 text-xs">
          {value ? formatCurrency(value) : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      title: t('common.actions'),
      className: 'text-right whitespace-nowrap',
      headerClassName: 'text-right',
      render: (_: any, row: any) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setDetailProductId(row.productId)}
            className="p-1.5 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/40 rounded-lg transition-colors"
            title={t('inventory.assetsBtn')}
          >
            <Boxes className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setSelectedHistoryProduct(row.product);
              setHistoryModal(true);
            }}
            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors"
            title={t('products.history')}
          >
            <HistoryIcon className="w-4 h-4" />
          </button>
          {isAdmin && (
            <>
              <button
                onClick={() => {
                  setEditProduct(row.product);
                  setFormModal(true);
                }}
                className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition-colors"
                title={t('common.edit')}
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setDeleteProduct(row.product);
                  setDeleteDialog(true);
                }}
                className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors cursor-pointer"
                title={t('common.delete')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  const repairColumns = [
    {
      key: 'product',
      title: t('inventory.productName'),
      className: 'whitespace-normal break-words min-w-[200px]',
      render: (_: any, row: any) => (
        <div className="flex flex-col min-w-0 break-words">
          <span className="font-bold text-gray-900 dark:text-white text-sm">
            {row.product?.name}
          </span>
          {row.product?.code && (
            <span className="text-2xs text-gray-400 font-mono">{row.product.code}</span>
          )}
        </div>
      ),
    },
    {
      key: 'inventoryNumber',
      title: t('inventory.invNumber'),
      render: (_: any, row: any) => (
        <CopyableInventoryNumber value={row.inventoryNumber} />
      ),
    },
    {
      key: 'serialNumber',
      title: t('inventory.serialNumber'),
      render: (val: any) => (
        <span className="text-xs text-gray-500 font-mono">{val || '—'}</span>
      ),
    },
    {
      key: 'holder',
      title: t('inventory.repairHolder'),
      render: (_: any, row: any) => (
        <div className="flex flex-col text-xs">
          <span className="font-bold text-gray-900 dark:text-gray-100">{row.holderName}</span>
          {row.holderDepartment && row.holderDepartment !== '—' && (
            <span className="text-gray-400 text-2xs">{row.holderDepartment}</span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      title: t('common.status'),
      render: () => (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-bold text-xs border border-amber-200 dark:border-amber-800/60">
          <Wrench className="w-3.5 h-3.5 text-amber-500" />
          {t('inventory.inRepairDamaged')}
        </span>
      ),
    },
    {
      key: 'date',
      title: t('common.date'),
      render: (_: any, row: any) => (
        <span className="text-xs text-gray-500 font-mono">
          {formatDate(row.updatedAt || row.createdAt)}
        </span>
      ),
    },
    {
      key: 'actions',
      title: t('common.actions'),
      className: 'text-right',
      headerClassName: 'text-right',
      render: (_: any, row: any) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          {isAdmin && (
            <Button
              size="sm"
              onClick={() => setSelectedRepairAsset(row)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{t('inventory.btnRepaired')}</span>
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('inventory.title')}
        subtitle={t('inventory.subtitle')}
        actions={
          <>
            <Button
              variant="outline"
              className="border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/20"
              onClick={handleExport}
              loading={exportLoading}
              disabled={exportLoading}
            >
              {t('common.excel')}
            </Button>
            {isAdmin && (
              <>
                <Button
                  variant="outline"
                  className="border-indigo-500 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 font-bold"
                  icon={<Sparkles className="w-4 h-4 text-indigo-500" />}
                  onClick={() => setExcelModal(true)}
                >
                  {t('inventory.masterImportBtn')}
                </Button>
                <Button
                  icon={<Plus className="w-4 h-4" />}
                  onClick={() => setStockInModal(true)}
                >
                  {t('inventory.stockInBtn')}
                </Button>
                <Button
                  variant="danger"
                  icon={<Trash2 className="w-4 h-4" />}
                  onClick={() => setWriteOffModal(true)}
                >
                  {t('inventory.writeOffBtn')}
                </Button>
              </>
            )}
          </>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title={
            typeFilter === 'BERILADIGAN'
              ? t('inventory.totalFixedAssets')
              : typeFilter === 'SARFLANADIGAN'
              ? t('inventory.totalConsumables')
              : t('inventory.totalProducts')
          }
          value={`${totalCount} ${t('common.pcs')}`}
          icon={<PackageCheck className="w-5 h-5" />}
          iconBgColor="bg-sky-500/10 dark:bg-sky-950/20"
          iconTextColor="text-sky-600 dark:text-sky-400"
          onClick={() => {
            setStockStatus('ALL');
            setLowStockOnly(false);
            setPage(1);
          }}
          className={stockStatus === 'ALL' && !lowStockOnly ? 'border-sky-500 dark:border-sky-500 ring-2 ring-sky-500/20' : ''}
        />
        <StatsCard
          title={t('inventory.totalValueStat')}
          value={formatCompactCurrency(totalValue)}
          tooltip={formatCurrency(totalValue)}
          icon={<TrendingUp className="w-5 h-5" />}
          iconBgColor="bg-teal-500/10 dark:bg-teal-950/20"
          iconTextColor="text-teal-600 dark:text-teal-400"
        />
        <StatsCard
          title={t('inventory.lowStockStat')}
          value={`${lowStockCount} ${t('common.pcs')}`}
          icon={<AlertTriangle className="w-5 h-5" />}
          iconBgColor="bg-red-500/10 dark:bg-red-950/20"
          iconTextColor="text-red-600 dark:text-red-400"
          onClick={() => {
            setStockStatus('ALL');
            setLowStockOnly(!lowStockOnly);
            setPage(1);
          }}
          className={lowStockOnly && stockStatus !== 'IN_REPAIR' ? 'border-red-500 dark:border-red-500 ring-2 ring-red-500/20' : ''}
        />
        <StatsCard
          title={t('inventory.statInRepairDamaged')}
          value={`${repairCount} ${t('common.pcs')}`}
          icon={<Wrench className="w-5 h-5" />}
          iconBgColor="bg-amber-500/10 dark:bg-amber-950/20"
          iconTextColor="text-amber-600 dark:text-amber-400"
          onClick={() => {
            setLowStockOnly(false);
            setStockStatus(stockStatus === 'IN_REPAIR' ? 'ALL' : 'IN_REPAIR');
            setPage(1);
          }}
          className={stockStatus === 'IN_REPAIR' ? 'border-amber-500 dark:border-amber-500 ring-2 ring-amber-500/20' : ''}
        />
      </div>

      <SearchFilterCard
        searchPlaceholder={t('inventory.searchPlaceholder')}
        searchValue={search}
        onSearchChange={setSearch}
        filters={
          <div className="w-48">
            <Select
              options={[
                { value: 'BERILADIGAN', label: t('inventory.typeAsset') },
                { value: 'SARFLANADIGAN', label: t('inventory.typeConsumable') },
              ]}
              placeholder={t('products.allTypes')}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            />
          </div>
        }
      />

      <Card className="rounded-2xl border-gray-200/90 dark:border-white/15 shadow-2xs overflow-hidden min-h-[480px]">
        {/* Mobile Inventory Cards View (screens < 768px) */}
        <div className="md:hidden p-3.5 space-y-3">
          {(isLoading || (stockStatus === 'IN_REPAIR' && repairLoading)) ? (
            <div className="p-6 text-center text-sm text-gray-500">{t('common.loading')}</div>
          ) : paginatedData.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
              {stockStatus === 'IN_REPAIR' ? t('inventory.emptyInRepair') : t('inventory.emptyTitle')}
            </div>
          ) : stockStatus === 'IN_REPAIR' ? (
            paginatedData.map((row: any) => (
              <div
                key={row.id}
                className="p-4 rounded-xl bg-white dark:bg-slate-900/90 border border-amber-200 dark:border-amber-900/50 shadow-2xs space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                      {row.product?.name}
                    </h4>
                    <span className="text-xs font-mono text-gray-500">#{row.inventoryNumber}</span>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-2xs font-bold border border-amber-200 dark:border-amber-800/60">
                    <Wrench className="w-3 h-3 text-amber-500" />
                    {t('inventory.inRepair')}
                  </span>
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-300 pt-2 border-t border-gray-100 dark:border-slate-800 flex justify-between items-center">
                  <div>
                    <span className="text-gray-400 block text-2xs">{t('inventory.submittedByShort')}:</span>
                    <span className="font-semibold">{row.holderName}</span>
                  </div>
                  {row.serialNumber && (
                    <div className="text-right">
                      <span className="text-gray-400 block text-2xs">{t('inventory.serialShort')}:</span>
                      <span className="font-mono text-gray-500">{row.serialNumber}</span>
                    </div>
                  )}
                </div>
                {isAdmin && (
                  <Button
                    size="sm"
                    onClick={() => setSelectedRepairAsset(row)}
                    className="w-full justify-center bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{t('inventory.btnRepaired')}</span>
                  </Button>
                )}
              </div>
            ))
          ) : (
            paginatedData.map((row: any) => (
              <div
                key={row.productId}
                onClick={() => setDetailProductId(row.productId)}
                className="p-4 rounded-xl bg-white dark:bg-slate-900/90 border border-gray-200/80 dark:border-slate-800 shadow-2xs space-y-3 hover:border-teal-500 transition-all duration-200 cursor-pointer active:scale-[0.99]"
              >
                {/* Header: Product Name & Type */}
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                    {row.product?.name}
                  </h4>
                  <ProductTypeBadge type={row.product?.productType} />
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-gray-100 dark:border-slate-800">
                  <div>
                    <span className="text-gray-400 block">{t('inventory.quantity')}:</span>
                    <span className="font-extrabold text-gray-900 dark:text-white">
                      {row.quantity} {unitLabel(row.product?.unit)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">{t('inventory.totalValue')}:</span>
                    <span className="font-extrabold text-teal-600 dark:text-teal-400">
                      {row.totalValue ? formatCurrency(row.totalValue) : '—'}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDetailProductId(row.productId);
                    }}
                    className="flex-1 justify-center text-xs font-bold text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-800/80 hover:bg-teal-50 dark:hover:bg-teal-950/40 rounded-xl"
                  >
                    <Boxes className="w-3.5 h-3.5 mr-1" />
                    <span>{t('inventory.assetsBtn')}</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedHistoryProduct(row.product);
                      setHistoryModal(true);
                    }}
                    className="flex-1 justify-center text-xs font-bold text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/80 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-xl"
                  >
                    <HistoryIcon className="w-3.5 h-3.5 mr-1" />
                    <span>{t('products.history')}</span>
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table View (screens >= 768px) */}
        <div className="hidden md:block">
          {stockStatus === 'IN_REPAIR' ? (
            <Table
              columns={repairColumns}
              data={paginatedData}
              loading={repairLoading}
              rowKey={(row) => row.id}
              emptyTitle={t('inventory.emptyInRepair')}
              emptyDescription={t('inventory.emptyInRepairDesc')}
            />
          ) : (
            <Table
              columns={columns}
              data={paginatedData}
              loading={isLoading}
              rowKey={(row) => row.productId}
              emptyTitle={t('inventory.emptyTitle')}
              emptyDescription={t('inventory.emptyDescription')}
            />
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800">
          <Pagination
            page={page}
            totalPages={totalPages}
            total={totalItemsCount}
            limit={limit}
            onPageChange={setPage}
          />
        </div>
      </Card>

      <StockInModal
        open={stockInModal}
        onClose={() => setStockInModal(false)}
      />

      <ExcelImportModal
        open={excelModal}
        onClose={() => setExcelModal(false)}
      />

      <WriteOffModal
        open={writeOffModal}
        onClose={() => setWriteOffModal(false)}
      />

      {detailProductId && (
        <ProductDetailModal
          open={!!detailProductId}
          onClose={() => setDetailProductId(null)}
          productId={detailProductId}
        />
      )}

      {selectedHistoryProduct && (
        <ProductHistoryModal
          open={historyModal}
          onClose={() => {
            setHistoryModal(false);
            setSelectedHistoryProduct(null);
          }}
          product={selectedHistoryProduct}
        />
      )}

      <ProductFormModal
        open={formModal}
        onClose={() => {
          setFormModal(false);
          setEditProduct(null);
        }}
        product={editProduct}
      />

      <ConfirmDialog
        open={deleteDialog}
        onClose={() => setDeleteDialog(false)}
        onConfirm={() => removeProduct(deleteProduct?.id)}
        title={t('inventory.deleteConfirmTitle')}
        description={t('inventory.deleteConfirmDesc', { name: deleteProduct?.name })}
        confirmText={t('common.delete')}
        loading={deleteLoading}
      />

      <RepairCompleteModal
        open={!!selectedRepairAsset}
        onClose={() => setSelectedRepairAsset(null)}
        assetItem={selectedRepairAsset}
        isLoading={completeRepairMutation.isPending}
        onConfirm={async (note) => {
          if (!selectedRepairAsset) return;
          await completeRepairMutation.mutateAsync({
            assetId: selectedRepairAsset.id,
            note,
          });
        }}
      />
    </div>
  );
}