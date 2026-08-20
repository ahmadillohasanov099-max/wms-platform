import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { operationsApi, inventoryApi, authApi } from '../../api';
import Modal from '../../components/ui/modal';
import Input from '../../components/ui/input';
import Button from '../../components/ui/button';
import CopyableInventoryNumber from '../../components/ui/copyable-inventory-number';
import { useTranslation } from '../../hooks/useTranslation';

import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Search,
  X,
  Eye,
  EyeOff,
  Sparkles,
  ShieldAlert,
  Trash2,
  Plus,
  Minus
} from 'lucide-react';

const QUICK_REASONS = [
  { label: "Buzilgan / Singan", icon: "🔨" },
  { label: "Eskirgan / Yaroqsiz", icon: "⏳" },
  { label: "Yo'qolgan / Kamchilik", icon: "🔍" },
  { label: "Muddati o'tgan", icon: "📅" },
  { label: "Taqsimot xatoligi", icon: "⚠️" },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function WriteOffModal({ open, onClose }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'asset' | 'consumable' | 'selected'>('all');
  const [documentNumber, setDocumentNumber] = useState('');
  const [note, setNote] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [checkedProducts, setCheckedProducts] = useState<Record<string, boolean>>({});
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [checkedAssets, setCheckedAssets] = useState<Record<string, boolean>>({});

  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});
  const [assetsCache, setAssetsCache] = useState<Record<string, any[]>>({});
  const [loadingAssets, setLoadingAssets] = useState<Record<string, boolean>>({});

  const { data: inventoryList, isLoading: listLoading } = useQuery({
    queryKey: ['inventory-list-for-write-off'],
    queryFn: () => inventoryApi.getAll(),
    enabled: open,
  });

  useEffect(() => {
    if (!open) {
      setSearch('');
      setActiveTab('all');
      setDocumentNumber('');
      setNote('');
      setCheckedProducts({});
      setQuantities({});
      setCheckedAssets({});
      setExpandedProducts({});
      setAssetsCache({});
      setLoadingAssets({});
      setPassword('');
      setShowPassword(false);
    }
  }, [open]);

  const loadAssets = async (productId: string) => {
    if (assetsCache[productId] || loadingAssets[productId]) return;

    setLoadingAssets((prev) => ({ ...prev, [productId]: true }));
    try {
      const details = await inventoryApi.getOne(productId);
      const assets = (details?.product as any)?.assets ?? [];
      setAssetsCache((prev) => ({ ...prev, [productId]: assets }));
    } catch (err) {
      console.error('Failed to load assets:', err);
      toast.error('Jihozlarni yuklashda xatolik yuz berdi');
    } finally {
      setLoadingAssets((prev) => ({ ...prev, [productId]: false }));
    }
  };

  const toggleProduct = (productId: string, productType: string) => {
    const isChecked = !checkedProducts[productId];
    setCheckedProducts((prev) => ({ ...prev, [productId]: isChecked }));

    if (isChecked) {
      if (productType === 'SARFLANADIGAN') {
        setQuantities((prev) => ({ ...prev, [productId]: 1 }));
      } else {
        loadAssets(productId);
        setExpandedProducts((prev) => ({ ...prev, [productId]: true }));
      }
    } else {
      setQuantities((prev) => {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      });
      const productAssets = assetsCache[productId] ?? [];
      setCheckedAssets((prev) => {
        const copy = { ...prev };
        productAssets.forEach((asset) => {
          delete copy[asset.id];
        });
        return copy;
      });
    }
  };

  const toggleAsset = (assetId: string, productId: string) => {
    const isChecked = !checkedAssets[assetId];
    setCheckedAssets((prev) => ({ ...prev, [assetId]: isChecked }));

    if (isChecked && !checkedProducts[productId]) {
      setCheckedProducts((prev) => ({ ...prev, [productId]: true }));
    }
  };

  const selectAllAssetsForProduct = (productId: string) => {
    const productAssets = assetsCache[productId] ?? [];
    if (productAssets.length === 0) return;

    const allChecked = productAssets.every((a) => checkedAssets[a.id]);
    const nextState = !allChecked;

    setCheckedAssets((prev) => {
      const copy = { ...prev };
      productAssets.forEach((a) => {
        copy[a.id] = nextState;
      });
      return copy;
    });

    if (nextState && !checkedProducts[productId]) {
      setCheckedProducts((prev) => ({ ...prev, [productId]: true }));
    }
  };

  const handleQtyChange = (productId: string, val: number, max: number) => {
    const qty = Math.max(1, Math.min(max, val));
    setQuantities((prev) => ({ ...prev, [productId]: qty }));
  };

  const toggleExpand = (productId: string, productType: string) => {
    const isExpanded = !expandedProducts[productId];
    setExpandedProducts((prev) => ({ ...prev, [productId]: isExpanded }));
    if (isExpanded && productType === 'BERILADIGAN') {
      loadAssets(productId);
    }
  };

  const generateDocNumber = () => {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomNum = Math.floor(100 + Math.random() * 900);
    setDocumentNumber(`AKT-${dateStr}-${randomNum}`);
  };

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const items: any[] = [];

      Object.keys(checkedProducts).forEach((productId) => {
        if (!checkedProducts[productId]) return;

        const inventoryItem = (inventoryList ?? []).find((item: any) => item.productId === productId);
        if (!inventoryItem) return;

        if (inventoryItem.product?.productType === 'SARFLANADIGAN') {
          items.push({
            productId,
            quantity: quantities[productId] || 1,
          });
        } else {
          const productAssets = assetsCache[productId] ?? [];
          const checkedProductAssets = productAssets.filter((a) => checkedAssets[a.id]);

          if (checkedProductAssets.length === 0) {
            throw new Error(`"${inventoryItem.product?.name}" jihozi uchun kamida 1 ta inventar raqam belgilanishi shart!`);
          }

          checkedProductAssets.forEach((asset) => {
            items.push({
              productId,
              assetId: asset.id,
              quantity: 1,
            });
          });
        }
      });

      if (items.length === 0) {
        throw new Error('Hisobdan chiqarish uchun kamida 1 ta mahsulot belgilang!');
      }

      if (items.length > 1) {
        if (!password) {
          throw new Error("Shaxsni tasdiqlash uchun parolingizni kiriting!");
        }
        const verification = await authApi.verifyPassword(password);
        if (!verification || !verification.success) {
          throw new Error("Kiritilgan parol noto'g'ri!");
        }
      }

      return operationsApi.bulkWriteOff({
        items,
        documentNumber: documentNumber || undefined,
        note: note || undefined,
      });
    },
    onSuccess: (res: any) => {
      toast.success(res?.message || t('operations.writeOffSuccess'));
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-list-for-write-off'] });
      queryClient.invalidateQueries({ queryKey: ['history-recent'] });
      queryClient.invalidateQueries({ queryKey: ['stats-overview'] });
      onClose();
    },
    onError: (err: any) => {
      toast.error(err?.message || t('common.error'));
    },
  });

  const filteredInventory = useMemo(() => {
    return (inventoryList ?? []).filter((item: any) => {
      if (item.quantity <= 0) return false;

      const nameMatch = !search || item.product?.name?.toLowerCase().includes(search.toLowerCase());
      if (!nameMatch) return false;

      const isChecked = !!checkedProducts[item.productId];
      if (activeTab === 'selected' && !isChecked) return false;
      if (activeTab === 'asset' && item.product?.productType !== 'BERILADIGAN') return false;
      if (activeTab === 'consumable' && item.product?.productType !== 'SARFLANADIGAN') return false;

      return true;
    });
  }, [inventoryList, search, activeTab, checkedProducts]);

  const checkedCount = Object.values(checkedProducts).filter(Boolean).length;

  const totalWriteOffRowsCount = useMemo(() => {
    let count = 0;
    Object.keys(checkedProducts).forEach((productId) => {
      if (!checkedProducts[productId]) return;
      const inventoryItem = (inventoryList ?? []).find((item: any) => item.productId === productId);
      if (!inventoryItem) return;
      if (inventoryItem.product?.productType === 'SARFLANADIGAN') {
        count += 1;
      } else {
        const productAssets = assetsCache[productId] ?? [];
        count += productAssets.filter((a) => checkedAssets[a.id]).length;
      }
    });
    return count;
  }, [checkedProducts, inventoryList, quantities, assetsCache, checkedAssets]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('operations.bulkWriteOffTitle')}
      subtitle={t('operations.bulkWriteOffSubtitle')}
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            {t('common.cancel')}
          </Button>
          <Button
            className="bg-red-600 hover:bg-red-700 text-white"
            onClick={() => mutate()}
            loading={isPending}
            disabled={totalWriteOffRowsCount === 0 || (totalWriteOffRowsCount > 1 && !password)}
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            {t('operations.writeOffBtn')} {totalWriteOffRowsCount > 0 ? `(${totalWriteOffRowsCount})` : ''}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                {t('common.documentNumber')}
              </label>
              <button
                type="button"
                onClick={generateDocNumber}
                className="text-2xs font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                {t('operations.autoDocNumber')}
              </button>
            </div>
            <Input
              placeholder="AKT-2026-001"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              {t('operations.reason')}
            </label>
            <textarea
              rows={1}
              placeholder={t('operations.reasonPlaceholder')}
              className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 px-3 py-2 resize-none"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        {}
        <div className="flex flex-wrap gap-1.5">
          <span className="text-2xs font-medium text-gray-400 dark:text-gray-500 self-center mr-1">
            {t('operations.quickReasonsLabel')}
          </span>
          {QUICK_REASONS.map((reason) => (
            <button
              key={reason.label}
              type="button"
              onClick={() => {
                setNote((prev) => (prev ? `${prev}, ${reason.label}` : reason.label));
              }}
              className="inline-flex items-center gap-1 text-2xs px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
            >
              <span>{reason.icon}</span>
              <span>{reason.label}</span>
            </button>
          ))}
        </div>

        {}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={t('inventory.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-8 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 py-2 px-3"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800/80 rounded-xl text-xs shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                activeTab === 'all'
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-2xs'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              {t('common.viewAll')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('asset')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                activeTab === 'asset'
                  ? 'bg-white dark:bg-gray-900 text-purple-700 dark:text-purple-400 shadow-2xs'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              {t('inventory.assetsBtn')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('consumable')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                activeTab === 'consumable'
                  ? 'bg-white dark:bg-gray-900 text-emerald-700 dark:text-emerald-400 shadow-2xs'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              {t('inventory.typeConsumable')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('selected')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                activeTab === 'selected'
                  ? 'bg-white dark:bg-gray-900 text-red-600 dark:text-red-400 shadow-2xs'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              {t('operations.selectedCount', { count: checkedCount })}
            </button>
          </div>
        </div>

        {}
        <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden max-h-[45vh] overflow-y-auto bg-white dark:bg-gray-900">
          {listLoading ? (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin mr-2 text-primary-500" />
              {t('common.loading')}
            </div>
          ) : filteredInventory.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              {t('inventory.noProductsFound')}
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-800">
              {filteredInventory.map((item: any) => {
                const isProductChecked = !!checkedProducts[item.productId];
                const isExpanded = !!expandedProducts[item.productId];
                const productType = item.product?.productType;
                const unit = item.product?.unit;
                const translatedUnit = unit ? (t(`common.units.${unit}`) || unit) : t('common.pcs');
                const productAssets = assetsCache[item.productId] ?? [];
                const isAssetsLoading = !!loadingAssets[item.productId];
                const isAssetType = productType === 'BERILADIGAN';

                return (
                  <div key={item.productId} className="flex flex-col">
                    {}
                    <div
                      className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors ${
                        isProductChecked ? 'bg-red-50/20 dark:bg-red-950/10' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isProductChecked}
                        onChange={() => toggleProduct(item.productId, productType)}
                        className="rounded border-gray-300 dark:border-gray-700 text-red-600 focus:ring-red-500 w-4 h-4 cursor-pointer"
                      />

                      {isAssetType ? (
                        <button
                          type="button"
                          onClick={() => toggleExpand(item.productId, productType)}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded transition-colors text-gray-500"
                        >
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-purple-600" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      ) : (
                        <div className="w-6" />
                      )}

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {item.product?.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {isAssetType ? 'Jihoz (Aktiv)' : 'Sarflanadigan material'}
                        </p>
                      </div>

                      <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                        Qoldiq: <span className="font-semibold text-gray-900 dark:text-gray-100">{item.quantity} {translatedUnit}</span>
                      </div>

                      {!isAssetType && isProductChecked && (
                        <div className="flex items-center gap-1.5 ml-4 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                          <button
                            type="button"
                            onClick={() => handleQtyChange(item.productId, (quantities[item.productId] || 1) - 1, item.quantity)}
                            className="w-5 h-5 flex items-center justify-center rounded text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={item.quantity}
                            value={quantities[item.productId] || 1}
                            onChange={(e) => handleQtyChange(item.productId, Number(e.target.value), item.quantity)}
                            className="w-10 text-center text-xs font-bold bg-transparent border-0 focus:outline-none p-0 text-gray-900 dark:text-gray-100"
                          />
                          <button
                            type="button"
                            onClick={() => handleQtyChange(item.productId, (quantities[item.productId] || 1) + 1, item.quantity)}
                            className="w-5 h-5 flex items-center justify-center rounded text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    {}
                    {isAssetType && (isExpanded || isProductChecked) && (
                      <div className="pl-12 pr-4 py-2.5 bg-gray-50/70 dark:bg-gray-950/30 border-t border-gray-100 dark:border-gray-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Hisobdan chiqarish uchun jihozlarni belgilang:
                          </span>
                          {productAssets.length > 0 && (
                            <button
                              type="button"
                              onClick={() => selectAllAssetsForProduct(item.productId)}
                              className="text-2xs font-semibold text-purple-600 hover:underline"
                            >
                              {productAssets.every((a) => checkedAssets[a.id]) ? "Hammasini bekor qilish" : "Hammasini tanlash"}
                            </button>
                          )}
                        </div>

                        {isAssetsLoading ? (
                          <div className="flex items-center text-xs text-gray-500 py-1">
                            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5 text-primary-500" />
                            Jihozlar yuklanmoqda...
                          </div>
                        ) : productAssets.length === 0 ? (
                          <div className="text-xs text-gray-500 py-1 italic">
                            Omborda erkin faol jihozlar topilmadi
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {productAssets.map((asset) => {
                              const isAssetChecked = !!checkedAssets[asset.id];
                              return (
                                <label
                                  key={asset.id}
                                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                                    isAssetChecked
                                      ? 'bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-800 text-red-700 dark:text-red-400'
                                      : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isAssetChecked}
                                    onChange={() => toggleAsset(asset.id, item.productId)}
                                    className="rounded border-gray-300 dark:border-gray-700 text-red-600 focus:ring-red-500 w-3.5 h-3.5"
                                  />
                                  <div className="flex flex-col min-w-0">
                                    <div className="flex items-center gap-1">
                                      <CopyableInventoryNumber
                                        value={asset.inventoryNumber}
                                        size="2xs"
                                        variant={isAssetChecked ? 'red' : 'slate'}
                                      />
                                    </div>
                                    {asset.serialNumber && (
                                      <span className="text-2xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
                                        SN: {asset.serialNumber}
                                      </span>
                                    )}
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {}
        {totalWriteOffRowsCount > 1 && (
          <div className="border border-red-200 dark:border-red-900/40 rounded-xl p-3.5 bg-red-50/30 dark:bg-red-950/20 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-red-800 dark:text-red-300 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-red-600" />
                Shaxsni tasdiqlash uchun parolingizni kiriting:
              </label>
              <span className="text-2xs text-gray-500">
                Ommaviy chiqarish ({totalWriteOffRowsCount} ta)
              </span>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Tasdiqlash paroli"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 pr-9 text-xs border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
