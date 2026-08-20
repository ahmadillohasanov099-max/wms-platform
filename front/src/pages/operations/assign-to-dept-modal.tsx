import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { operationsApi, departmentsApi, productsApi, inventoryApi } from '../../api';
import Modal from '../../components/ui/modal';
import Input from '../../components/ui/input';
import Select from '../../components/ui/select';
import Button from '../../components/ui/button';
import ModdiyJavobgarlikModal, { type ModdiyJavobgarlikData } from '../../components/documents/moddiy-javobgarlik-modal';
import { useAuthStore } from '../../store/auth.store';
import { useTranslation } from '../../hooks/useTranslation';
import { invalidateAppQueries } from '../../lib/utils';
import { Search, Building2, Package, Loader2, Plus, Trash2 } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface AssetRow {
  rowId: string;
  productId: string;
  productName: string;
  productCode?: string;
  selectedInventoryNumber: string;
  serialNumber: string;
  productSearch: string;
}

export default function AssignToDeptModal({ open, onClose }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  // Department Selection State
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [deptSearch, setDeptSearch] = useState<string>('');
  const [isDeptSearching, setIsDeptSearching] = useState<boolean>(false);

  // Dynamic Rows State
  const [rows, setRows] = useState<AssetRow[]>([
    {
      rowId: '1',
      productId: '',
      productName: '',
      productSearch: '',
      selectedInventoryNumber: '',
      serialNumber: '',
    },
  ]);
  const [activeSearchRowId, setActiveSearchRowId] = useState<string | null>(null);

  // Assets cache per productId
  const [assetsCache, setAssetsCache] = useState<Record<string, any[]>>({});
  const [loadingAssets, setLoadingAssets] = useState<Record<string, boolean>>({});

  // Document State
  const [documentNumber, setDocumentNumber] = useState<string>('');
  const [moddiyData, setModdiyData] = useState<ModdiyJavobgarlikData | null>(null);

  // Fetch Departments
  const { data: deptsData, isLoading: isDeptsLoading } = useQuery({
    queryKey: ['departments-assign-dept'],
    queryFn: () => departmentsApi.getAll(),
    enabled: open,
  });

  // Fetch Asset Products
  const { data: assetProductsData, isLoading: isProductsLoading } = useQuery({
    queryKey: ['products-asset-assign-dept'],
    queryFn: () => productsApi.getAll({ productType: 'BERILADIGAN', limit: 300 }),
    enabled: open,
  });

  // Fetch Inventory List to resolve stock quantities
  const { data: inventoryData } = useQuery({
    queryKey: ['inventory-all-assign-dept'],
    queryFn: () => inventoryApi.getAll(),
    enabled: open,
  });

  const deptList: any[] = deptsData ?? [];
  const selectedDeptObj = deptList.find((d) => d.id === selectedDeptId);

  const filteredDepts = deptList.filter((d: any) => {
    const q = deptSearch.toLowerCase().trim();
    if (!q) return true;
    return String(d.name || '').toLowerCase().includes(q);
  });

  // Parse Products & Inventory List
  const rawInventoryData = inventoryData as any;
  const inventoryList: any[] = Array.isArray(rawInventoryData)
    ? rawInventoryData
    : Array.isArray(rawInventoryData?.data)
    ? rawInventoryData.data
    : [];

  const inventoryMap = new Map<string, any>();
  inventoryList.forEach((inv: any) => {
    const pId = inv.productId || inv.product?.id;
    if (pId) inventoryMap.set(pId, inv);
  });

  const rawProductsData = assetProductsData as any;
  const rawProductsArray: any[] = Array.isArray(rawProductsData)
    ? rawProductsData
    : Array.isArray(rawProductsData?.items)
    ? rawProductsData.items
    : Array.isArray(rawProductsData?.data)
    ? rawProductsData.data
    : Array.isArray(rawProductsData?.data?.items)
    ? rawProductsData.data.items
    : [];

  const productList: any[] = [];
  const addedIds = new Set<string>();

  rawProductsArray.forEach((p: any) => {
    if (p.productType && p.productType !== 'BERILADIGAN') return;
    const invMatch = inventoryMap.get(p.id);
    const qty = invMatch?.quantity ?? p.inventory?.quantity ?? (invMatch?.assets ? invMatch.assets.length : 0);
    productList.push({
      ...p,
      stockQuantity: qty,
    });
    addedIds.add(p.id);
  });

  inventoryList.forEach((inv: any) => {
    const p = inv.product;
    if (p && (!p.productType || p.productType === 'BERILADIGAN') && !addedIds.has(p.id)) {
      productList.push({
        ...p,
        stockQuantity: inv.quantity ?? (inv.assets ? inv.assets.length : 0),
      });
      addedIds.add(p.id);
    }
  });

  // Load assets for a specific product
  const loadAssetsForProduct = async (productId: string) => {
    if (!productId || assetsCache[productId] || loadingAssets[productId]) return;
    setLoadingAssets((prev) => ({ ...prev, [productId]: true }));
    try {
      const invRes = await inventoryApi.getOne(productId);
      const invAssets = (invRes as any)?.product?.assets ?? (invRes as any)?.assets ?? [];
      if (invAssets.length > 0) {
        setAssetsCache((prev) => ({ ...prev, [productId]: invAssets }));
      } else {
        const prodRes = await productsApi.getOne(productId);
        const prodAssets = (prodRes as any)?.assets ?? (prodRes as any)?.data?.assets ?? [];
        setAssetsCache((prev) => ({ ...prev, [productId]: prodAssets }));
      }
    } catch (err) {
      console.error('Failed to load product assets for dept:', err);
    } finally {
      setLoadingAssets((prev) => ({ ...prev, [productId]: false }));
    }
  };

  // Get available free assets for a product (excluding inventory numbers already selected in other rows)
  const getFreeAssetsForProduct = (productId: string, currentRowId: string) => {
    if (!productId) return [];
    const rawAssets = assetsCache[productId] || [];

    const usedInOtherRows = rows
      .filter((r) => r.rowId !== currentRowId && r.productId === productId && r.selectedInventoryNumber)
      .map((r) => r.selectedInventoryNumber);

    return rawAssets.filter((asset: any) => {
      const isStock = !asset.status || asset.status === 'IN_STOCK' || asset.status === 'ACTIVE';
      const notAssigned = !asset.userId && !asset.departmentId;
      const notUsedElsewhere = !usedInOtherRows.includes(asset.inventoryNumber);

      return isStock && notAssigned && notUsedElsewhere;
    });
  };

  // Dynamic Row Handlers
  const handleAddRow = () => {
    setRows((prev) => [
      ...prev,
      {
        rowId: Date.now().toString(),
        productId: '',
        productName: '',
        productSearch: '',
        selectedInventoryNumber: '',
        serialNumber: '',
      },
    ]);
  };

  const handleRemoveRow = (rowId: string) => {
    if (rows.length === 1) return;
    setRows((prev) => prev.filter((r) => r.rowId !== rowId));
  };

  const handleSelectProduct = (rowId: string, product: any) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.rowId === rowId) {
          return {
            ...r,
            productId: product.id,
            productName: product.name,
            productCode: product.code,
            productSearch: product.name,
            selectedInventoryNumber: '',
            serialNumber: '',
          };
        }
        return r;
      })
    );
    setActiveSearchRowId(null);
    loadAssetsForProduct(product.id);
  };

  const handleClearProduct = (rowId: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.rowId === rowId
          ? {
              ...r,
              productId: '',
              productName: '',
              productCode: undefined,
              productSearch: '',
              selectedInventoryNumber: '',
              serialNumber: '',
            }
          : r
      )
    );
  };

  const handleInventoryChange = (rowId: string, invNum: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.rowId === rowId) {
          const rawAssets = assetsCache[r.productId] || [];
          const matched = rawAssets.find((a: any) => a.inventoryNumber === invNum);
          return {
            ...r,
            selectedInventoryNumber: invNum,
            serialNumber: matched?.serialNumber || r.serialNumber,
          };
        }
        return r;
      })
    );
  };

  const handleReset = () => {
    setSelectedDeptId('');
    setDeptSearch('');
    setIsDeptSearching(false);

    setRows([
      {
        rowId: '1',
        productId: '',
        productName: '',
        productSearch: '',
        selectedInventoryNumber: '',
        serialNumber: '',
      },
    ]);
    setActiveSearchRowId(null);
    setAssetsCache({});
    setLoadingAssets({});

    setDocumentNumber('');
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  // Submit Mutation
  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      if (!selectedDeptId) {
        throw new Error(t('operations.validationDept'));
      }

      const validRows = rows.filter((r) => r.productId && r.selectedInventoryNumber);
      if (validRows.length === 0) {
        throw new Error(t('operations.validationSelectAssetAndInv'));
      }

      const sharedDocNum = documentNumber.trim() || `MJSH-${Date.now().toString().slice(-6)}`;

      for (const r of validRows) {
        await operationsApi.assignToDept({
          departmentId: selectedDeptId,
          productId: r.productId,
          inventoryNumber: r.selectedInventoryNumber,
          serialNumber: r.serialNumber || undefined,
          documentNumber: sharedDocNum,
        });
      }

      return {
        sharedDocNum,
        validRows,
      };
    },
    onSuccess: (data) => {
      toast.success(t('operations.assignToDeptSuccess'));
      invalidateAppQueries(queryClient);

      const deptObj = deptList.find((d) => d.id === selectedDeptId);
      const recipientName = `Bo'lim: ${deptObj?.name || 'Bo‘lim'}`;

      const printData: ModdiyJavobgarlikData = {
        documentNumber: data.sharedDocNum,
        date: new Date(),
        fromUser: user?.fullName || "Xo'jalik mudiri",
        toRecipient: recipientName,
        recipientDepartment: deptObj?.name,
        items: data.validRows.map((r) => ({
          name: r.productName,
          inventoryNumber: r.selectedInventoryNumber,
          serialNumber: r.serialNumber || undefined,
          unit: t('common.pcs') || 'dona',
          quantity: 1,
        })),
      };

      setModdiyData(printData);
      handleReset();
    },
    onError: (err: any) => {
      toast.error(err?.message || err?.response?.data?.message || t('common.error'));
    },
  });

  const validRowsCount = rows.filter((r) => r.productId && r.selectedInventoryNumber).length;

  return (
    <>
      <Modal
        open={open}
        onClose={handleClose}
        title={`🏢 ${t('operations.assignToDept')}`}
        subtitle={t('operations.assignToDeptSubtitle')}
        size="4xl"
        footer={
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleClose} disabled={isPending}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => mutate()} loading={isPending} disabled={!selectedDeptId || validRowsCount === 0 || isPending}>
              {t('operations.assignBtn')} ({t('operations.assetsCount', { count: validRowsCount })})
            </Button>
          </div>
        }
      >
        <div className="space-y-6 py-2">
          {/* STEP 1: DEPARTMENT SELECTION */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              {t('users.department')}
            </label>

            {selectedDeptId ? (
              <div className="flex items-center justify-between bg-primary-50/90 dark:bg-primary-950/40 border border-primary-300 dark:border-primary-800 p-3.5 rounded-2xl shadow-xs">
                <div className="flex items-center gap-3.5 min-w-0 pr-2">
                  <div className="w-10 h-10 rounded-xl bg-primary-600 text-white font-extrabold text-sm flex items-center justify-center shrink-0 shadow-xs">
                    🏢
                  </div>
                  <span className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                    {selectedDeptObj?.name || 'Bo‘lim'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedDeptId('')}
                  className="text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline shrink-0 px-3 py-1 bg-white dark:bg-gray-900 border border-primary-200 dark:border-primary-800 rounded-lg shadow-2xs"
                >
                  {t('common.change')}
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    placeholder={t('operations.searchDeptPlaceholder')}
                    value={deptSearch}
                    onFocus={() => setIsDeptSearching(true)}
                    onChange={(e) => {
                      setDeptSearch(e.target.value);
                      setIsDeptSearching(true);
                    }}
                    className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-2xl bg-gray-50/80 dark:bg-gray-800/60 focus:bg-white dark:focus:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500/30 transition-all"
                  />
                </div>

                {isDeptSearching && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 max-h-56 overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl z-30 divide-y divide-gray-100 dark:divide-gray-800">
                    {isDeptsLoading ? (
                      <div className="p-4 text-center text-sm text-gray-400 flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
                        {t('common.loading')}
                      </div>
                    ) : filteredDepts.length === 0 ? (
                      <div className="p-4 text-center text-sm text-gray-400">
                        {t('departments.emptyTitle')}
                      </div>
                    ) : (
                      filteredDepts.slice(0, 20).map((d: any) => (
                        <div
                          key={d.id}
                          onClick={() => {
                            setSelectedDeptId(d.id);
                            setDeptSearch(d.name);
                            setIsDeptSearching(false);
                          }}
                          className="p-3 px-4 hover:bg-primary-50/80 dark:hover:bg-primary-950/40 cursor-pointer flex items-center justify-between transition-colors text-sm font-bold text-gray-900 dark:text-gray-100"
                        >
                          <div className="flex items-center gap-3">
                            <Building2 className="w-4 h-4 text-primary-600" />
                            <span>{d.name}</span>
                          </div>
                          <span className="text-xs font-bold text-primary-700 dark:text-primary-300 bg-primary-100/90 dark:bg-primary-900/60 px-2.5 py-1 rounded-lg">
                            {t('common.select')}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* STEP 2: MULTI-ROW ASSETS SELECTION */}
          <div className="space-y-4 pt-3 border-t border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <Package className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                {t('operations.multiAssetsLabel')}
              </label>
            </div>

            <div className="space-y-3.5">
              {rows.map((row, idx) => {
                const matchingProducts = productList.filter((p: any) => {
                  const q = row.productSearch.toLowerCase().trim();
                  if (!q) return true;
                  const name = String(p.name || '').toLowerCase();
                  const code = String(p.code || '').toLowerCase();
                  const cat = String(p.category?.name || p.category || '').toLowerCase();
                  const brand = String(p.brand || '').toLowerCase();
                  const model = String(p.model || '').toLowerCase();
                  return name.includes(q) || code.includes(q) || cat.includes(q) || brand.includes(q) || model.includes(q);
                });

                const freeAssets = getFreeAssetsForProduct(row.productId, row.rowId);
                const isRowAssetsLoading = !!loadingAssets[row.productId];

                const inventoryOptions = freeAssets.map((asset: any) => ({
                  value: asset.inventoryNumber,
                  label: asset.inventoryNumber + (asset.serialNumber ? ` (${asset.serialNumber})` : ''),
                }));

                return (
                  <div
                    key={row.rowId}
                    className="p-4 bg-gray-50/90 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/80 rounded-2xl space-y-3 shadow-xs"
                  >
                    <div className="flex items-center justify-between text-xs font-extrabold text-gray-500 dark:text-gray-400">
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{t('operations.assetItemNum', { num: idx + 1 })}</span>
                      {rows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(row.rowId)}
                          className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 flex items-center gap-1 font-bold text-xs px-2 py-0.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                          title={t('common.delete')}
                        >
                          <Trash2 className="w-3.5 h-3.5" /> {t('common.delete')}
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                      {/* Product Selection */}
                      <div className="relative md:col-span-5">
                        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                          {t('operations.selectAssetStep')}
                        </label>
                        {row.productId ? (
                          <div className="flex items-center justify-between bg-white dark:bg-gray-900 border border-primary-300 dark:border-primary-800 px-3 py-2.5 rounded-xl shadow-xs text-sm">
                            <div className="min-w-0 pr-2 flex items-center gap-2">
                              <Package className="w-4 h-4 text-primary-600 shrink-0" />
                              <span className="font-bold text-gray-900 dark:text-gray-100 truncate">
                                {row.productName}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleClearProduct(row.rowId)}
                              className="text-xs font-bold text-rose-500 hover:underline shrink-0"
                            >
                              {t('common.change')}
                            </button>
                          </div>
                        ) : (
                          <div className="relative">
                            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                            <input
                              type="text"
                              placeholder={t('operations.productSearchPlaceholder')}
                              value={row.productSearch}
                              onFocus={() => setActiveSearchRowId(row.rowId)}
                              onChange={(e) => {
                                const val = e.target.value;
                                setRows((prev) =>
                                  prev.map((r) =>
                                    r.rowId === row.rowId ? { ...r, productSearch: val } : r
                                  )
                                );
                                setActiveSearchRowId(row.rowId);
                              }}
                              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500/30 transition-all"
                            />

                            {activeSearchRowId === row.rowId && (
                              <div className="absolute left-0 right-0 top-full mt-1.5 max-h-56 overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl z-30 divide-y divide-gray-100 dark:divide-gray-800">
                                {isProductsLoading ? (
                                  <div className="p-3 text-sm text-gray-400 text-center flex items-center justify-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
                                    {t('operations.searchingProducts')}
                                  </div>
                                ) : matchingProducts.length === 0 ? (
                                  <div className="p-3 text-sm text-gray-400 text-center">
                                    {t('operations.productNotFound')}
                                  </div>
                                ) : (
                                  matchingProducts.slice(0, 20).map((p: any) => {
                                    const qty = p.stockQuantity ?? p.inventory?.quantity ?? 0;
                                    const freeAssetsCount = assetsCache[p.id] ? getFreeAssetsForProduct(p.id, row.rowId).length : qty;
                                    const displayQty = assetsCache[p.id] ? freeAssetsCount : qty;
                                    const isOutOfStock = displayQty <= 0;
                                    return (
                                      <div
                                        key={p.id}
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          if (isOutOfStock) {
                                            toast.error(`"${p.name}" omborda mavjud emas! Qayta biriktirish uchun avval amaldagi xodimidan qaytarish lozim.`);
                                            return;
                                          }
                                          handleSelectProduct(row.rowId, p);
                                        }}
                                        className={`p-3 px-3.5 flex items-center justify-between text-sm transition-colors ${
                                          isOutOfStock
                                            ? 'opacity-60 bg-gray-50 dark:bg-gray-800/40 cursor-not-allowed select-none'
                                            : 'hover:bg-primary-50 dark:hover:bg-primary-950/40 cursor-pointer'
                                        }`}
                                      >
                                        <div className="flex flex-col min-w-0 pr-2">
                                          <span className={`font-bold ${isOutOfStock ? 'text-gray-500 line-through' : 'text-gray-900 dark:text-gray-100'} truncate`}>
                                            {p.name}
                                          </span>
                                          {p.code && (
                                            <span className="text-xs text-gray-400 font-mono">
                                              {t('operations.code')}: {p.code}
                                            </span>
                                          )}
                                        </div>
                                        {isOutOfStock ? (
                                          <span className="text-xs font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950 px-2 py-0.5 rounded shrink-0">
                                            {t('operations.outOfStockBadge')}
                                          </span>
                                        ) : (
                                          <span className="text-xs font-mono font-bold text-primary-700 dark:text-primary-300 bg-primary-100 dark:bg-primary-900/60 px-2.5 py-1 rounded-lg shrink-0">
                                            {t('operations.availableQtyLabel', { count: displayQty, unit: p.unit || t('common.pcs') })}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Inventory Number Select */}
                      <div className="md:col-span-4">
                        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                          {t('operations.invNumStep')}
                        </label>
                        {!row.productId ? (
                          <div className="text-xs text-gray-400 p-2.5 bg-gray-100 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-center">
                            {t('operations.selectAssetFirst')}
                          </div>
                        ) : isRowAssetsLoading ? (
                          <div className="flex items-center justify-center gap-2 text-xs text-gray-400 py-2.5">
                            <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
                            {t('operations.loadingInvNumbers')}
                          </div>
                        ) : freeAssets.length === 0 ? (
                          <div className="text-xs text-rose-600 dark:text-rose-400 font-bold p-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-center">
                            {t('operations.noFreeInvNumbers')}
                          </div>
                        ) : (
                          <Select
                            options={inventoryOptions}
                            value={row.selectedInventoryNumber}
                            onChange={(e) => handleInventoryChange(row.rowId, e.target.value)}
                            placeholder={t('operations.selectInvNumPlaceholder')}
                            required
                          />
                        )}
                      </div>

                      {/* Serial Number Input */}
                      <div className="md:col-span-3">
                        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                          {t('operations.serialNumStep')}
                        </label>
                        <Input
                          placeholder={t('operations.serialNumPlaceholder')}
                          value={row.serialNumber}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRows((prev) =>
                              prev.map((r) => (r.rowId === row.rowId ? { ...r, serialNumber: val } : r))
                            );
                          }}
                          disabled={!row.productId}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddRow}
              className="w-full py-2.5 border-dashed border-primary-400 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/30 flex items-center justify-center gap-2 font-bold text-sm rounded-xl"
            >
              <Plus className="w-4.5 h-4.5" /> {t('operations.addMoreAssets')}
            </Button>
          </div>

          {/* STEP 3: DOCUMENT NUMBER */}
          <div className="pt-3 border-t border-gray-200 dark:border-gray-800">
            <Input
              label={t('common.documentNumber')}
              placeholder="MJSH-2026-001"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      <ModdiyJavobgarlikModal
        open={!!moddiyData}
        onClose={() => {
          setModdiyData(null);
          onClose();
        }}
        data={moddiyData}
      />
    </>
  );
}
