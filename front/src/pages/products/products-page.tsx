import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi } from '../../api';
import type { ProductType } from '../../types';
import toast from 'react-hot-toast';
import { Select, Table, ConfirmDialog, ProductTypeBadge, PageHeader, SearchFilterCard, Pagination } from '../../components/ui';
import { formatCurrency, invalidateAppQueries } from '../../lib/utils';
import RoleGuard from '../../components/shared/role-guard';
import ProductFormModal from './product-form-modal';
import ProductHistoryModal from './product-history-modal';
import { useTranslation } from '../../hooks/useTranslation';

export default function ProductsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [productType, setProductType] = useState('');

  const [formModal, setFormModal] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);
  const [historyModal, setHistoryModal] = useState(false);
  const [historyProduct, setHistoryProduct] = useState<any>(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteProduct, setDeleteProduct] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['products', page, search, productType],
    queryFn: () =>
      productsApi.getAll({
        page,
        limit: 20,
        search: search || undefined,
        productType: (productType as ProductType) || undefined,
      }),
    staleTime: 30000,
  });

  const { mutate: deleteProduct_, isPending: deleteLoading } = useMutation({
    mutationFn: (id: string) => productsApi.remove(id),
    onSuccess: () => {
      toast.success(t('inventory.productDeleted'));
      invalidateAppQueries(queryClient);
      setDeleteDialog(false);
    },
    onError: (err: any) => {
      toast.error(err?.message || t('common.error'));
    },
  });

  const products = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const columns = [
    {
      key: 'name',
      title: t('inventory.productName'),
      className: 'min-w-[200px] max-w-xs',
      render: (_: any, row: any) => (
        <div className="min-w-0">
          <p className="font-bold text-slate-900 dark:text-white">{row.name}</p>
          {row.code && (
            <p className="text-2xs text-slate-400 font-mono">{row.code}</p>
          )}
        </div>
      ),
    },
    {
      key: 'productType',
      title: t('products.type'),
      render: (value: any) => <ProductTypeBadge type={value} />,
    },
    {
      key: 'quantity',
      title: t('profile.statusLabels.IN_STOCK'),
      render: (_: any, row: any) => {
        const isLow = (row.inventory?.quantity ?? 0) <= (row.inventory?.minLevel ?? 0);
        return (
          <span className={isLow ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-700 dark:text-slate-300 font-semibold'}>
            {row.inventory?.quantity ?? 0} {row.unit ? row.unit.toLowerCase() : t('common.pcs')}
          </span>
        );
      },
    },
    {
      key: 'minLevel',
      title: t('inventory.minLevel') || 'Minimal miqdor',
      render: (_: any, row: any) => (
        <span className="text-slate-500 dark:text-slate-400 text-xs">
          {row.inventory?.minLevel ?? 0} {row.unit ? row.unit.toLowerCase() : t('common.pcs')}
        </span>
      ),
    },
    {
      key: 'unitPrice',
      title: t('operations.price'),
      render: (_: any, row: any) => (
        <span className="text-slate-700 dark:text-slate-300 font-medium text-xs">
          {row.inventory?.unitPrice ? formatCurrency(row.inventory.unitPrice) : '—'}
        </span>
      ),
    },
    {
      key: 'totalPrice',
      title: t('stats.totalValue') || 'Jami Summasi',
      render: (_: any, row: any) => {
        const totalVal = (row.inventory?.quantity || 0) * (row.inventory?.unitPrice || 0);
        return (
          <span className="text-teal-600 dark:text-teal-400 font-bold text-xs">
            {totalVal > 0 ? formatCurrency(totalVal) : '—'}
          </span>
        );
      },
    },
    {
      key: 'actions',
      title: t('common.actions'),
      render: (_: any, row: any) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setHistoryProduct(row);
              setHistoryModal(true);
            }}
            className="px-2.5 py-1 text-xs font-semibold text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/30 rounded-lg transition-all"
            title={t('products.history')}
          >
            {t('products.history')}
          </button>
          <RoleGuard roles={['ADMIN']}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditProduct(row);
                setFormModal(true);
              }}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
              title={t('common.edit')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeleteProduct(row);
                setDeleteDialog(true);
              }}
              className="p-1.5 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-all"
              title={t('common.delete')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </RoleGuard>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('products.catalog')}
        subtitle={t('products.totalProducts', { count: total })}
      />

      <SearchFilterCard
        searchPlaceholder={t('products.searchPlaceholder')}
        searchValue={search}
        onSearchChange={(val) => {
          setSearch(val);
          setPage(1);
        }}
        filters={
          <div className="w-48">
            <Select
              options={[
                { value: 'BERILADIGAN', label: t('inventory.typeAsset') },
                { value: 'SARFLANADIGAN', label: t('inventory.typeConsumable') },
              ]}
              placeholder={t('products.allTypes')}
              value={productType}
              onChange={(e) => {
                setProductType(e.target.value);
                setPage(1);
              }}
            />
          </div>
        }
      />

      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden">
        <Table
          columns={columns}
          data={products}
          loading={isLoading}
          rowKey={(row) => row.id}
          emptyTitle={t('products.emptyTitle')}
          emptyDescription={t('products.emptyDescription')}
        />
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50">
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            limit={20}
            onPageChange={setPage}
          />
        </div>
      </div>

      <ProductFormModal
        open={formModal}
        onClose={() => {
          setFormModal(false);
          setEditProduct(null);
        }}
        product={editProduct}
      />

      {historyProduct && (
        <ProductHistoryModal
          open={historyModal}
          onClose={() => {
            setHistoryModal(false);
            setHistoryProduct(null);
          }}
          product={historyProduct}
        />
      )}

      <ConfirmDialog
        open={deleteDialog}
        onClose={() => setDeleteDialog(false)}
        onConfirm={() => deleteProduct_(deleteProduct?.id)}
        title={t('inventory.deleteConfirmTitle')}
        description={t('inventory.deleteConfirmDesc', { name: deleteProduct?.name })}
        confirmText={t('common.delete')}
        loading={deleteLoading}
      />
    </div>
  );
}