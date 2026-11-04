import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { operationsApi, departmentsApi, productsApi, inventoryApi } from '../../api';
import Modal from '../../components/ui/modal';
import Input from '../../components/ui/input';
import Button from '../../components/ui/button';
import TalabnomaModal, {
  type TalabnomaData,
} from '../../components/documents/talabnoma-modal';
import OverLimitNoticeModal from '../../components/modals/over-limit-notice-modal';
import type { LimitStatusResponse } from '../../api/endpoints/limits.api';
import { useAuthStore } from '../../store/auth.store';
import { invalidateAppQueries } from '../../lib/utils';
import { useTranslation } from '../../hooks/useTranslation';
import { formatProductQuantity, roundQuantity, getUnitLabel } from '../../lib/quantity-utils';
import {
  Plus,
  Trash2,
  Search,
  Building2,
  Package,
  X,
  Loader2,
} from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface ProductRow {
  rowId: string;
  productId: string;
  productName: string;
  unit: string;
  packageSize?: number | null;
  availableQty: number;
  inputMode: 'PACHKA' | 'DONA';
  rawInputValue: number | string;
  quantity: number;
  searchInput: string;
}

export default function GiveToDeptModal({ open, onClose }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  // Department Selection State
  const [selectedDept, setSelectedDept] = useState<any | null>(null);
  const [deptSearch, setDeptSearch] = useState<string>('');
  const [isDeptSearching, setIsDeptSearching] = useState<boolean>(false);
  const [note, setNote] = useState<string>('');

  // TMZ Product Rows State
  const [rows, setRows] = useState<ProductRow[]>([
    {
      rowId: '1',
      productId: '',
      productName: '',
      unit: 'dona',
      packageSize: null,
      availableQty: 0,
      inputMode: 'PACHKA',
      rawInputValue: 1,
      quantity: 1,
      searchInput: '',
    },
  ]);

  const [activeSearchRowId, setActiveSearchRowId] = useState<string | null>(null);
  const [talabnomaData, setTalabnomaData] = useState<TalabnomaData | null>(null);
  const [overLimitState, setOverLimitState] = useState<{
    open: boolean;
    limitStatus: LimitStatusResponse | null;
    requestedQuantity: number;
    fallbackMessage?: string;
  }>({
    open: false,
    limitStatus: null,
    requestedQuantity: 1,
  });

  // Normalize helper for flexible Uzbek text search (apostrophes, case, spaces)
  const normalizeSearchText = (str: string): string => {
    return (str || '')
      .toLowerCase()
      .replace(/[\u2018\u2019\u02BC\u02BB'`]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Fetch Departments
  const { data: deptsData, isLoading: isDeptsLoading } = useQuery({
    queryKey: ['departments-give-to-dept'],
    queryFn: () => departmentsApi.getAll(),
    enabled: open,
  });

  // Fetch Products (up to 1000 items)
  const { data: productsData, isLoading: isProductsLoading } = useQuery({
    queryKey: ['products-consumable-give-to-dept'],
    queryFn: () =>
      productsApi.getAll({ productType: 'SARFLANADIGAN', limit: 1000 }),
    enabled: open,
  });

  // Fetch Inventory (all warehouse stock for current organization)
  const { data: inventoryData } = useQuery({
    queryKey: ['inventory-all-give-to-dept'],
    queryFn: () => inventoryApi.getAll(),
    enabled: open,
  });

  // Parse Departments List
  const rawDeptsData = deptsData as any;
  const deptList: any[] = Array.isArray(rawDeptsData)
    ? rawDeptsData
    : Array.isArray(rawDeptsData?.items)
      ? rawDeptsData.items
      : Array.isArray(rawDeptsData?.data)
        ? rawDeptsData.data
        : [];

  // Parse Products & Inventory List
  const rawProductsData = productsData as any;
  const rawProductArray: any[] = Array.isArray(rawProductsData)
    ? rawProductsData
    : Array.isArray(rawProductsData?.items)
      ? rawProductsData.items
      : Array.isArray(rawProductsData?.data)
        ? rawProductsData.data
        : Array.isArray(rawProductsData?.data?.items)
          ? rawProductsData.data.items
          : [];

  const rawInventoryArray: any[] = Array.isArray(inventoryData)
    ? inventoryData
    : Array.isArray((inventoryData as any)?.data)
      ? (inventoryData as any).data
      : [];

  const productMap = new Map<string, any>();

  // 1. Inventorydagi barcha ombor yozuvlarini olish (limit cheklovisiz)
  if (Array.isArray(rawInventoryArray)) {
    for (const inv of rawInventoryArray) {
      const p = inv.product;
      if (!p || (p.productType && p.productType !== 'SARFLANADIGAN')) continue;
      productMap.set(p.id, {
        id: p.id,
        name: p.name,
        unit: p.unit || 'dona',
        packageSize: p.packageSize || null,
        quantity: inv.quantity ?? 0,
      });
    }
  }

  // 2. Mahsulotlar ro'yxatidan ham to'ldirish
  if (Array.isArray(rawProductArray)) {
    for (const p of rawProductArray) {
      if (p.productType && p.productType !== 'SARFLANADIGAN') continue;
      const existing = productMap.get(p.id);
      if (existing) {
        if (!existing.packageSize && p.packageSize) {
          existing.packageSize = p.packageSize;
        }
      } else {
        const invMatch = rawInventoryArray.find(
          (inv: any) => inv.productId === p.id || inv.product?.id === p.id,
        );
        productMap.set(p.id, {
          id: p.id,
          name: p.name,
          unit: p.unit || 'dona',
          packageSize: p.packageSize || invMatch?.product?.packageSize || null,
          quantity: invMatch?.quantity ?? p.inventory?.quantity ?? 0,
        });
      }
    }
  }

  const productList: any[] = Array.from(productMap.values());

  // Filtered Departments matching deptSearch
  const filteredDepts = deptList.filter((d: any) => {
    const q = normalizeSearchText(deptSearch);
    if (!q) return true;
    const name = normalizeSearchText(d.name || '');
    return name.includes(q);
  });

  // Handlers for Row Operations
  const handleAddRow = () => {
    setRows((prev) => [
      ...prev,
      {
        rowId: Date.now().toString(),
        productId: '',
        productName: '',
        unit: 'dona',
        packageSize: null,
        availableQty: 0,
        inputMode: 'PACHKA',
        rawInputValue: 1,
        quantity: 1,
        searchInput: '',
      },
    ]);
  };

  const handleRemoveRow = (rowId: string) => {
    if (rows.length === 1) return;
    setRows((prev) => prev.filter((r) => r.rowId !== rowId));
  };

  const handleSelectProduct = (rowId: string, prod: any) => {
    const pkgSize = prod.packageSize && prod.packageSize > 1 ? prod.packageSize : null;
    setRows((prev) =>
      prev.map((r) => {
        if (r.rowId === rowId) {
          return {
            ...r,
            productId: prod.id,
            productName: prod.name,
            unit: prod.unit || 'dona',
            packageSize: pkgSize,
            availableQty: prod.quantity ?? 0,
            inputMode: 'PACHKA',
            rawInputValue: 1,
            quantity: 1,
            searchInput: prod.name,
          };
        }
        return r;
      }),
    );
    setActiveSearchRowId(null);
  };

  const handleToggleMode = (rowId: string, newMode: 'PACHKA' | 'DONA') => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.rowId === rowId && r.packageSize) {
          if (newMode === 'DONA') {
            const currentPacks = Number(r.quantity) || 1;
            const donaVal = Math.round(currentPacks * r.packageSize);
            return {
              ...r,
              inputMode: 'DONA',
              rawInputValue: donaVal,
              quantity: roundQuantity(donaVal / r.packageSize, 4),
            };
          } else {
            const currentPacks = roundQuantity(Number(r.quantity) || 1, 4);
            return {
              ...r,
              inputMode: 'PACHKA',
              rawInputValue: currentPacks,
              quantity: currentPacks,
            };
          }
        }
        return r;
      }),
    );
  };

  const handleRowQtyChange = (rowId: string, valStr: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.rowId === rowId) {
          const num = parseFloat(valStr) || 0;
          if (r.inputMode === 'DONA' && r.packageSize && r.packageSize > 1) {
            return {
              ...r,
              rawInputValue: valStr,
              quantity: roundQuantity(num / r.packageSize, 4),
            };
          } else {
            return {
              ...r,
              rawInputValue: valStr,
              quantity: roundQuantity(num, 4),
            };
          }
        }
        return r;
      }),
    );
  };

  const handleClearProduct = (rowId: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.rowId === rowId
          ? {
              ...r,
              productId: '',
              productName: '',
              unit: 'dona',
              packageSize: null,
              availableQty: 0,
              inputMode: 'PACHKA',
              rawInputValue: 1,
              quantity: 1,
              searchInput: '',
            }
          : r,
      ),
    );
  };

  // Submit Mutation
  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      if (!selectedDept) {
        throw new Error(t('operations.selectDeptFirst'));
      }

      const validRows = rows.filter((r) => r.productId && r.quantity > 0);
      if (validRows.length === 0) {
        throw new Error(t('operations.selectMaterialFirst'));
      }

      // Check stock limits
      for (const r of validRows) {
        if (r.quantity > r.availableQty) {
          const availStr = formatProductQuantity(r.availableQty, r.unit, r.packageSize, t);
          throw new Error(
            `"${r.productName}" bo'yicha omborda yetarli qoldiq yo'q! Mavjud: ${availStr}`,
          );
        }
      }

      const sharedDocNum = `TLB-${Date.now().toString().slice(-6)}`;

      for (const r of validRows) {
        await operationsApi.giveToDept({
          departmentId: selectedDept.id,
          productId: r.productId,
          quantity: r.quantity,
          documentNumber: sharedDocNum,
          note: note || undefined,
        });
      }

      return {
        sharedDocNum,
        validRows,
      };
    },
    onSuccess: (data) => {
      const recipientName = `Bo'lim: ${selectedDept.name}`;

      const tData: TalabnomaData = {
        documentNumber: data.sharedDocNum,
        date: new Date(),
        fromUser: user?.fullName || 'Xo‘jalik mudiri',
        toRecipient: recipientName,
        items: data.validRows.map((r) => {
          const isDonaMode = r.inputMode === 'DONA' && r.packageSize && r.packageSize > 1;
          return {
            name: r.productName,
            unit: isDonaMode ? 'dona' : getUnitLabel(r.unit, t),
            quantity: isDonaMode ? Number(r.rawInputValue) || 1 : r.quantity,
          };
        }),
        note: note || undefined,
      };

      toast.success(t('operations.giveToDeptSuccess'));
      invalidateAppQueries(queryClient);
      handleCloseModal();
      setTalabnomaData(tData);
    },
    onError: (err: any) => {
      const errData = err?.response?.data || err;
      const isOverLimit =
        errData?.errorCode === 'OVER_MONTHLY_LIMIT' ||
        !!errData?.limitStatus ||
        (typeof errData?.message === 'string' &&
          (errData.message.includes('OVER_MONTHLY_LIMIT') ||
            errData.message.includes('Oylik meʼyor') ||
            errData.message.includes('limitdan oshib')));

      if (isOverLimit) {
        setOverLimitState({
          open: true,
          limitStatus: errData?.limitStatus || null,
          requestedQuantity: errData?.requestedQuantity || 1,
          fallbackMessage: errData?.message,
        });
        return;
      }
      toast.error(errData?.message || err?.message || t('common.error'));
    },
  });

  const handleCloseModal = () => {
    setSelectedDept(null);
    setDeptSearch('');
    setIsDeptSearching(false);
    setNote('');
    setRows([
      {
        rowId: '1',
        productId: '',
        productName: '',
        unit: 'dona',
        packageSize: null,
        availableQty: 0,
        inputMode: 'PACHKA',
        rawInputValue: 1,
        quantity: 1,
        searchInput: '',
      },
    ]);
    setActiveSearchRowId(null);
    onClose();
  };

  return (
    <>
      <Modal
        open={open && !overLimitState.open}
        onClose={handleCloseModal}
        title={`🏢 ${t('operations.giveToDept')}`}
        subtitle={t('operations.giveToDeptSubtitle')}
        size="2xl"
      >
        <div className="space-y-4">
          {/* STEP 1: DEPARTMENT LIVE SEARCH */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              {t('operations.validationDept')}
            </label>

            {selectedDept ? (
              <div className="flex items-center justify-between bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-300/80 dark:border-emerald-800/80 px-3 py-2 rounded-xl shadow-2xs">
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate block">
                      {selectedDept.name}
                    </span>
                    {selectedDept.leader && (
                      <span className="text-3xs text-gray-500 dark:text-gray-400 truncate block">
                        Mas'ul: {selectedDept.leader.fullName}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedDept(null);
                    setDeptSearch('');
                  }}
                  className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 px-2 py-1 rounded-md transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-900/30 shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                  {t('common.change')}
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder={t('operations.searchDeptPlaceholder')}
                    value={deptSearch}
                    onFocus={() => setIsDeptSearching(true)}
                    onChange={(e) => {
                      setDeptSearch(e.target.value);
                      setIsDeptSearching(true);
                    }}
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50/80 dark:bg-gray-800/60 focus:bg-white dark:focus:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all"
                  />
                </div>

                {isDeptSearching && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setIsDeptSearching(false)}
                    />
                    <div className="absolute left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-30 divide-y divide-gray-100 dark:divide-gray-800">
                      {isDeptsLoading ? (
                        <div className="p-3 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                          {t('common.loading')}
                        </div>
                      ) : filteredDepts.length === 0 ? (
                        <div className="p-3 text-center text-xs text-gray-400">
                          {t('departments.emptyTitle')}
                        </div>
                      ) : (
                        filteredDepts.slice(0, 20).map((d: any) => (
                          <div
                            key={d.id}
                            onClick={() => {
                              setSelectedDept(d);
                              setDeptSearch(d.name);
                              setIsDeptSearching(false);
                            }}
                            className="p-2 px-3 hover:bg-emerald-50/80 dark:hover:bg-emerald-950/40 cursor-pointer flex items-center justify-between transition-colors text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                              <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span className="font-bold text-gray-900 dark:text-gray-100 truncate">
                                {d.name}
                              </span>
                            </div>
                            <span className="text-3xs font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-100/90 dark:bg-emerald-900/60 px-2 py-0.5 rounded-md shrink-0">
                              {t('common.select')}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* STEP 2: MULTI-ROW PRODUCT SEARCH & SELECTION */}
          <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                {t('operations.giveToUserMaterialSubtitle')}
              </label>
            </div>

            <div className="space-y-2.5">
              {rows.map((row, idx) => {
                const cleanQuery = normalizeSearchText(row.searchInput);
                const matchingProducts = productList.filter((p: any) => {
                  if (!cleanQuery) return true;
                  const cleanName = normalizeSearchText(p.name || '');
                  if (cleanName.includes(cleanQuery)) return true;
                  const queryWords = cleanQuery.split(' ').filter(Boolean);
                  return (
                    queryWords.length > 0 &&
                    queryWords.every((w) => cleanName.includes(w))
                  );
                });

                const sortedMatchingProducts = [...matchingProducts].sort(
                  (a, b) => {
                    const aInStock = (a.quantity ?? 0) > 0 ? 1 : 0;
                    const bInStock = (b.quantity ?? 0) > 0 ? 1 : 0;
                    if (aInStock !== bInStock) return bInStock - aInStock;
                    return (a.name || '').localeCompare(b.name || '');
                  },
                );

                return (
                  <div
                    key={row.rowId}
                    className="p-3 bg-gray-50/80 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/80 rounded-xl space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs font-extrabold text-gray-500">
                      <span>#{idx + 1}</span>
                      {rows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(row.rowId)}
                          className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 flex items-center gap-0.5 text-xs font-bold"
                          title={t('common.delete')}
                        >
                          <Trash2 className="w-3.5 h-3.5" /> {t('common.delete')}
                        </button>
                      )}
                    </div>

                    {/* MAHSULOT VA MIQDOR BLOKI */}
                    {!row.productId ? (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                        <div className="sm:col-span-2 relative">
                          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                          <input
                            type="text"
                            placeholder={t('operations.materialSearchPlaceholder')}
                            value={row.searchInput}
                            onFocus={() => setActiveSearchRowId(row.rowId)}
                            onChange={(e) => {
                              const val = e.target.value;
                              setRows((prev) =>
                                prev.map((r) =>
                                  r.rowId === row.rowId
                                    ? { ...r, searchInput: val }
                                    : r,
                                ),
                              );
                              setActiveSearchRowId(row.rowId);
                            }}
                            className="w-full pl-7 pr-2.5 py-1.5 text-xs border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all"
                          />

                          {activeSearchRowId === row.rowId && (
                            <>
                              <div
                                className="fixed inset-0 z-20"
                                onClick={() => setActiveSearchRowId(null)}
                              />
                              <div className="absolute left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-30 divide-y divide-gray-100 dark:divide-gray-800">
                                {isProductsLoading ? (
                                  <div className="p-3 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                                    {t('common.loading')}
                                  </div>
                                ) : sortedMatchingProducts.length === 0 ? (
                                  <div className="p-3 text-xs text-gray-400 text-center">
                                    {t('operations.materialNotFound')}
                                  </div>
                                ) : (
                                  sortedMatchingProducts
                                    .slice(0, 30)
                                    .map((p: any) => {
                                      const qty = p.quantity ?? 0;
                                      const isOutOfStock = qty <= 0;
                                      return (
                                        <div
                                          key={p.id}
                                          onClick={() => {
                                            if (isOutOfStock) {
                                              toast.error(
                                                `"${p.name}" omborda mavjud emas! Mavjud qoldiq: 0`,
                                              );
                                              return;
                                            }
                                            handleSelectProduct(row.rowId, p);
                                          }}
                                          className={`p-2.5 px-3 flex items-center justify-between gap-3 text-xs transition-colors ${
                                            isOutOfStock
                                              ? 'opacity-60 bg-gray-50 dark:bg-gray-800/40 cursor-not-allowed select-none'
                                              : 'hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer'
                                          }`}
                                        >
                                          <div className="min-w-0 flex-1 pr-2">
                                            <p
                                              className={`font-bold leading-relaxed whitespace-normal break-words text-xs ${
                                                isOutOfStock
                                                  ? 'text-gray-500 line-through'
                                                  : 'text-gray-900 dark:text-gray-100'
                                              }`}
                                            >
                                              {p.name}
                                            </p>
                                          </div>
                                          {isOutOfStock ? (
                                            <span className="text-3xs font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950 px-2 py-0.5 rounded-md shrink-0">
                                              {t('operations.outOfStockBadge')}
                                            </span>
                                          ) : (
                                            <span className="text-3xs font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-md shrink-0 whitespace-nowrap">
                                              {formatProductQuantity(
                                                qty,
                                                p.unit,
                                                p.packageSize,
                                                t,
                                              )}
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })
                                )}
                              </div>
                            </>
                          )}
                        </div>

                        <div>
                          <Input
                            type="number"
                            disabled
                            placeholder={t('operations.quantity')}
                          />
                        </div>
                      </div>
                    ) : (
                      /* Mahsulot tanlangan holat */
                      <div className="space-y-2">
                        {/* Tanlangan mahsulot kartasi */}
                        <div className="flex items-center justify-between bg-white dark:bg-gray-900 border border-emerald-300 dark:border-emerald-800 px-3 py-2.5 rounded-xl shadow-2xs text-xs">
                          <div className="min-w-0 pr-2 flex items-center gap-2 flex-1">
                            <Package className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span className="font-bold text-gray-900 dark:text-gray-100 leading-snug whitespace-normal break-words">
                              {row.productName}
                            </span>
                            <span className="text-3xs font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-md shrink-0 whitespace-nowrap">
                              Mavjud: {formatProductQuantity(row.availableQty, row.unit, row.packageSize, t)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleClearProduct(row.rowId)}
                            className="text-xs font-bold text-rose-500 hover:underline shrink-0 ml-2"
                          >
                            {t('common.change')}
                          </button>
                        </div>

                        {/* Pachkali yoki donali qolip */}
                        {row.packageSize && row.packageSize > 1 && (row.unit === 'PACHKA' || row.unit === 'PACK') ? (
                          <div className="space-y-2 p-2.5 bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/80 rounded-xl">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                {t('common.units.giveMode')}
                              </span>
                              <div className="flex items-center gap-1 bg-gray-200 dark:bg-gray-700 p-0.5 rounded-lg">
                                <button
                                  type="button"
                                  onClick={() => handleToggleMode(row.rowId, 'PACHKA')}
                                  className={`px-2.5 py-1 text-3xs font-bold rounded-md transition-colors ${
                                    row.inputMode === 'PACHKA'
                                      ? 'bg-emerald-600 text-white shadow-2xs'
                                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                                  }`}
                                >
                                  {t('common.units.pachkaMode')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleMode(row.rowId, 'DONA')}
                                  className={`px-2.5 py-1 text-3xs font-bold rounded-md transition-colors ${
                                    row.inputMode === 'DONA'
                                      ? 'bg-emerald-600 text-white shadow-2xs'
                                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                                  }`}
                                >
                                  {t('common.units.donaMode')}
                                </button>
                              </div>
                            </div>

                            {row.inputMode === 'DONA' ? (
                              <div>
                                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                                  Donalar soni (1 pachka = {row.packageSize} dona)
                                </label>
                                <Input
                                  type="number"
                                  min={1}
                                  value={row.rawInputValue}
                                  onChange={(e) => handleRowQtyChange(row.rowId, e.target.value)}
                                  placeholder="Masalan: 200"
                                />
                                <span className="text-3xs text-emerald-700 dark:text-emerald-400 font-semibold block mt-1">
                                  = {row.quantity} pachka ombordan chiqariladi
                                </span>
                              </div>
                            ) : (
                              <div>
                                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                                  Pachkalar soni (1 pachka = {row.packageSize} dona)
                                </label>
                                <Input
                                  type="number"
                                  step="any"
                                  min={0.001}
                                  value={row.rawInputValue}
                                  onChange={(e) => handleRowQtyChange(row.rowId, e.target.value)}
                                  placeholder="Masalan: 2"
                                />
                                <span className="text-3xs text-slate-500 font-medium block mt-1">
                                  = {Math.round((Number(row.rawInputValue) || 0) * row.packageSize)} dona
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                              {t('operations.quantity')} ({getUnitLabel(row.unit, t)})
                            </label>
                            <Input
                              type="number"
                              step={row.unit === 'DONA' ? '1' : 'any'}
                              min={row.unit === 'DONA' ? 1 : 0.001}
                              value={row.rawInputValue}
                              onChange={(e) => handleRowQtyChange(row.rowId, e.target.value)}
                              placeholder={getUnitLabel(row.unit, t)}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* PLUS (+) BUTTON TO ADD MORE PRODUCT ROWS */}
            <div className="pt-0.5">
              <Button
                type="button"
                variant="outline"
                onClick={handleAddRow}
                icon={<Plus className="w-3.5 h-3.5 text-emerald-500" />}
                className="w-full py-1.5 border-dashed border-emerald-300 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-xs font-bold rounded-xl"
              >
                {t('operations.addMoreMaterials')}
              </Button>
            </div>
          </div>

          <div className="pt-1">
            <Input
              label={t('common.note')}
              placeholder={t('inventory.notePlaceholder')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {/* FOOTER ACTIONS */}
          <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-100 dark:border-gray-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCloseModal}
              disabled={isPending}
            >
              {t('common.cancel')}
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => mutate()}
              loading={isPending}
              disabled={!selectedDept || isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              {t('operations.give')}
            </Button>
          </div>
        </div>
      </Modal>

      {talabnomaData && (
        <TalabnomaModal
          open={!!talabnomaData}
          onClose={() => setTalabnomaData(null)}
          data={talabnomaData}
        />
      )}

      <OverLimitNoticeModal
        open={overLimitState.open}
        onClose={() => {
          setOverLimitState({ open: false, limitStatus: null, requestedQuantity: 1 });
          handleCloseModal();
        }}
        limitStatus={overLimitState.limitStatus}
        requestedQuantity={overLimitState.requestedQuantity}
        targetName={selectedDept?.name}
        isDepartment={true}
        fallbackMessage={overLimitState.fallbackMessage}
      />
    </>
  );
}
