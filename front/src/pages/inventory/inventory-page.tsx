import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, AlertTriangle, History as HistoryIcon, Edit2, Trash2, Boxes, PackageCheck, TrendingUp, Sparkles } from 'lucide-react';
import { inventoryApi, productsApi } from '../../api';
import { Card, Button, Select, Table, Pagination, ConfirmDialog, ProductTypeBadge, PageHeader, SearchFilterCard, StatsCard } from '../../components/ui';
import { formatCurrency, formatCompactCurrency, invalidateAppQueries } from '../../lib/utils';
import toast from 'react-hot-toast';
import StockInModal from './stock-in-modal';
import ExcelImportModal from './excel-import-modal';
import WriteOffModal from '../operations/write-off-modal';
import ProductFormModal from '../products/product-form-modal';
import ProductHistoryModal from '../products/product-history-modal';
import ProductDetailModal from '../products/product-detail-modal';
import { useAuthStore } from '../../store/auth.store';
import { useTranslation } from '../../hooks/useTranslation';
import { useDebounce } from '../../hooks/useDebounce';
import { downloadExport } from '../../lib/export';

export default function InventoryPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const isAdmin = user?.role !== 'XODIM' && user?.role !== 'KADR';

  const [page, setPage] = useState(1);
  const limit = 20;

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 250);
  const [typeFilter, setTypeFilter] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

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

  const { data, isLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => inventoryApi.getAll(),
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

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, typeFilter, lowStockOnly]);

  const filtered = useMemo(() => {
    const s = debouncedSearch.toLowerCase().trim();
    return inventory.filter((item: any) => {
      const matchSearch =
        !s ||
        item.product?.name?.toLowerCase().includes(s) ||
        item.product?.code?.toLowerCase().includes(s) ||
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

  const { totalValue, lowStockCount } = useMemo(() => {
    let sum = 0;
    let low = 0;
    for (let i = 0; i < inventory.length; i++) {
      const item = inventory[i];
      sum += Number(item.totalValue ?? 0);
      if (item.quantity <= item.minLevel) low++;
    }
    return { totalValue: sum, lowStockCount: low };
  }, [inventory]);

  const totalPages = Math.ceil(filtered.length / limit) || 1;

  const paginatedData = useMemo(() => {
    const start = (page - 1) * limit;
    return filtered.slice(start, start + limit);
  }, [filtered, page, limit]);

  const unitLabel = (unit: string) => {
    if (unit === 'DONA') return t('common.units.DONA');
    if (unit === 'PACHKA') return t('common.units.PACHKA');
    if (unit === 'KOMPLEKT') return t('common.units.KOMPLEKT');
    return unit || t('common.pcs');
  };

  const handleExport = async () => {
    try {
      await downloadExport(
        '/inventory/export',
        `ombor_${new Date().toISOString().split('T')[0]}.xlsx`
      );
      toast.success(t('common.success'));
    } catch {
      toast.error(t('common.error'));
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
                {hasUser ? "Xodimda" : hasDept ? "Bo'limda" : "Biriktirilgan"}
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
                  Yagona Master Kirim
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard
          title={t('inventory.totalProducts')}
          value={`${inventory.length} ${t('common.pcs')}`}
          icon={<PackageCheck className="w-5 h-5" />}
          iconBgColor="bg-sky-500/10 dark:bg-sky-950/20"
          iconTextColor="text-sky-600 dark:text-sky-400"
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
          onClick={() => setLowStockOnly(!lowStockOnly)}
          className={lowStockOnly ? 'border-red-500 dark:border-red-500' : ''}
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
          {isLoading ? (
            <div className="p-6 text-center text-sm text-gray-500">{t('common.loading')}</div>
          ) : paginatedData.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
              {t('inventory.emptyTitle')}
            </div>
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
                    <span className="text-gray-400 block">Miqdori:</span>
                    <span className="font-extrabold text-gray-900 dark:text-white">
                      {row.quantity} {unitLabel(row.product?.unit)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Jami qiymati:</span>
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
          <Table
            columns={columns}
            data={paginatedData}
            loading={isLoading}
            rowKey={(row) => row.productId}
            emptyTitle={t('inventory.emptyTitle')}
            emptyDescription={t('inventory.emptyDescription')}
          />
        </div>

        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800">
          <Pagination
            page={page}
            totalPages={totalPages}
            total={filtered.length}
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
    </div>
  );
}