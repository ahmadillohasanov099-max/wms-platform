import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidateAppQueries } from '../../lib/utils';
import {
  ArrowLeft,
  Search,
  ShieldAlert,
  Loader2,
  Trash2,
  FileX,
  X,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Package,
  Plus,
  Minus,
  RotateCcw,
  Sparkles,
  FileText,
  Boxes
} from 'lucide-react';
import toast from 'react-hot-toast';
import { operationsApi, inventoryApi, authApi } from '../../api';
import Card, { CardContent } from '../../components/ui/card';
import Input from '../../components/ui/input';
import Button from '../../components/ui/button';
import CopyableInventoryNumber from '../../components/ui/copyable-inventory-number';
import { useTranslation } from '../../hooks/useTranslation';


const QUICK_REASONS = [
  { label: "Buzilgan / Singan", icon: "🔨" },
  { label: "Eskirgan / Yaroqsiz", icon: "⏳" },
  { label: "Yo'qolgan / Kamchilik", icon: "🔍" },
  { label: "Muddati o'tgan", icon: "📅" },
  { label: "Taqsimot xatoligi", icon: "⚠️" },
];

export default function WriteOffPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
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
    queryKey: ['inventory-list-for-write-off-page'],
    queryFn: () => inventoryApi.getAll(),
  });

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
        setExpandedProducts((prev) => ({ ...prev, [productId]: true }));
        loadAssets(productId);
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

  const toggleExpand = (productId: string, productType: string) => {
    const isExpanded = !expandedProducts[productId];
    setExpandedProducts((prev) => ({ ...prev, [productId]: isExpanded }));
    if (isExpanded && productType === 'BERILADIGAN') {
      loadAssets(productId);
    }
  };

  const handleQtyChange = (productId: string, val: number, max: number) => {
    const qty = Math.max(1, Math.min(max, val));
    setQuantities((prev) => ({ ...prev, [productId]: qty }));
  };

  const generateDocNumber = () => {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomNum = Math.floor(100 + Math.random() * 900);
    setDocumentNumber(`AKT-${dateStr}-${randomNum}`);
  };

  const resetAllSelections = () => {
    setCheckedProducts({});
    setQuantities({});
    setCheckedAssets({});
    setPassword('');
    setNote('');
  };

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const items: any[] = [];
      const selectedProductIds = Object.keys(checkedProducts).filter(id => checkedProducts[id]);

      selectedProductIds.forEach((productId) => {
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

      const requirePassword = items.length > 1;
      if (requirePassword) {
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
      invalidateAppQueries(queryClient);
      navigate('/inventory');
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

  const checkedCount = Object.keys(checkedProducts).filter(id => checkedProducts[id]).length;

  const stagedSummaryList = useMemo(() => {
    const result: Array<{
      productId: string;
      name: string;
      productType: string;
      unit: string;
      qty: number;
      assets?: Array<{ id: string; inventoryNumber: string; serialNumber?: string }>;
    }> = [];

    Object.keys(checkedProducts).forEach((productId) => {
      if (!checkedProducts[productId]) return;
      const inventoryItem = (inventoryList ?? []).find((item: any) => item.productId === productId);
      if (!inventoryItem) return;

      const pType = inventoryItem.product?.productType;
      const unit = inventoryItem.product?.unit || 'dona';

      if (pType === 'SARFLANADIGAN') {
        result.push({
          productId,
          name: inventoryItem.product?.name || 'Noma\'lum',
          productType: pType,
          unit,
          qty: quantities[productId] || 1,
        });
      } else {
        const productAssets = assetsCache[productId] ?? [];
        const selectedAssets = productAssets.filter((a) => checkedAssets[a.id]);
        if (selectedAssets.length > 0) {
          result.push({
            productId,
            name: inventoryItem.product?.name || 'Noma\'lum',
            productType: pType || 'BERILADIGAN',
            unit,
            qty: selectedAssets.length,
            assets: selectedAssets,
          });
        } else {
          result.push({
            productId,
            name: inventoryItem.product?.name || 'Noma\'lum',
            productType: pType || 'BERILADIGAN',
            unit,
            qty: 0,
            assets: [],
          });
        }
      }
    });

    return result;
  }, [checkedProducts, inventoryList, quantities, assetsCache, checkedAssets]);

  const totalWriteOffRowsCount = stagedSummaryList.reduce((acc, curr) => acc + (curr.qty || 0), 0);
  const requirePassword = totalWriteOffRowsCount > 1;

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/inventory')}
            className="p-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl transition-colors shrink-0"
            title="Ortga qaytish"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 shadow-inner">
              <FileX className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  Hisobdan chiqarish
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-800">
                  Ommaviy hujjat
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Ombordan foydalanishga yaroqsiz yoki yo'qolgan mahsulot va jihozlarni chiqim qilish
              </p>
            </div>
          </div>
        </div>

        {checkedCount > 0 && (
          <button
            onClick={resetAllSelections}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 bg-gray-100 dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors self-start sm:self-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Tanlovni tozalash ({checkedCount})
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Product selection list */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="shadow-xs border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
            <CardContent className="p-5 space-y-4">
              {/* Header and Filter Tabs */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-150 dark:border-gray-800 pb-4">
                <div className="flex items-center gap-2">
                  <Boxes className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                    Ombordagi mahsulotlar
                  </h3>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    {filteredInventory.length} ta
                  </span>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800/80 rounded-xl text-xs">
                  <button
                    onClick={() => setActiveTab('all')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                      activeTab === 'all'
                        ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-xs'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                  >
                    Barchasi
                  </button>
                  <button
                    onClick={() => setActiveTab('asset')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                      activeTab === 'asset'
                        ? 'bg-white dark:bg-gray-900 text-purple-700 dark:text-purple-400 shadow-xs'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                  >
                    Jihozlar
                  </button>
                  <button
                    onClick={() => setActiveTab('consumable')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                      activeTab === 'consumable'
                        ? 'bg-white dark:bg-gray-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                  >
                    Sarflanadigan
                  </button>
                  <button
                    onClick={() => setActiveTab('selected')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all relative ${
                      activeTab === 'selected'
                        ? 'bg-white dark:bg-gray-900 text-red-600 dark:text-red-400 shadow-xs'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                  >
                    Tanlanganlar
                    {checkedCount > 0 && (
                      <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-red-500 text-white text-2xs font-bold">
                        {checkedCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Mahsulot nomi yoki kodi bo'yicha qidirish..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 pr-9 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 py-2.5 px-3 transition-colors"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Inventory items scrollable list */}
              <div className="divide-y divide-gray-100 dark:divide-gray-800 border border-gray-200 dark:border-gray-800 rounded-xl max-h-[62vh] overflow-y-auto bg-white dark:bg-gray-900">
                {listLoading ? (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                    <Loader2 className="w-7 h-7 animate-spin text-primary-500 mb-2" />
                    <span className="text-sm">Mahsulotlar yuklanmoqda...</span>
                  </div>
                ) : filteredInventory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
                    <Package className="w-10 h-10 mb-2 stroke-1 text-gray-300 dark:text-gray-600" />
                    <p className="text-sm font-medium">Hech qanday mahsulot topilmadi</p>
                    <p className="text-xs text-gray-400 mt-1">Qidiruv parametrlarini o'zgartirib ko'ring</p>
                  </div>
                ) : (
                  filteredInventory.map((item: any) => {
                    const isChecked = !!checkedProducts[item.productId];
                    const isExpanded = !!expandedProducts[item.productId];
                    const isAssetsLoading = !!loadingAssets[item.productId];
                    const productAssets = assetsCache[item.productId] ?? [];
                    const unit = item.product?.unit;
                    const translatedUnit = unit ? (t(`common.units.${unit}`) || unit) : t('common.pcs');
                    const productType = item.product?.productType;
                    const isAssetType = productType === 'BERILADIGAN';

                    const selectedProductAssetsCount = productAssets.filter((a) => checkedAssets[a.id]).length;

                    return (
                      <div key={item.productId} className="flex flex-col transition-colors">
                        <div
                          className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 transition-colors ${
                            isChecked
                              ? 'bg-red-50/20 dark:bg-red-950/10'
                              : 'hover:bg-gray-50/80 dark:hover:bg-gray-800/40'
                          }`}
                        >
                          {/* Item Left Info */}
                          <div className="flex items-start gap-3.5 min-w-0 flex-1">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleProduct(item.productId, productType)}
                              className="mt-0.5 rounded border-gray-300 dark:border-gray-700 text-red-600 focus:ring-red-500 w-4 h-4 cursor-pointer shrink-0"
                            />

                            {/* Expand icon for assets */}
                            {isAssetType ? (
                              <button
                                onClick={() => toggleExpand(item.productId, productType)}
                                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-500 shrink-0 mt-0.5"
                                title={isExpanded ? "Yopish" : "Inventar raqamlarni ko'rish"}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-gray-400" />
                                )}
                              </button>
                            ) : (
                              <div className="w-6 shrink-0" />
                            )}

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4
                                  onClick={() => toggleProduct(item.productId, productType)}
                                  className="text-sm font-semibold text-gray-900 dark:text-gray-100 hover:text-red-600 dark:hover:text-red-400 cursor-pointer whitespace-normal break-words"
                                >
                                  {item.product?.name}
                                </h4>
                                <span
                                  className={`text-2xs font-bold px-2 py-0.5 rounded-md border ${
                                    isAssetType
                                      ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                                      : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                  }`}
                                >
                                  {isAssetType ? 'Jihoz (Aktiv)' : 'Sarflanadigan'}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Qoldiq: <span className="font-semibold text-gray-700 dark:text-gray-300">{item.quantity} {translatedUnit}</span>
                                {isAssetType && isChecked && (
                                  <span className="ml-2 text-red-600 dark:text-red-400 font-medium">
                                    • Tanlandi: {selectedProductAssetsCount} ta jihoz
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>

                          {/* Consumable Quantity Stepper */}
                          {!isAssetType && isChecked && (
                            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-1 shadow-2xs self-end sm:self-center">
                              <span className="text-xs text-gray-500 dark:text-gray-400 px-2 font-medium">
                                Chiqarish:
                              </span>
                              <button
                                type="button"
                                onClick={() => handleQtyChange(item.productId, (quantities[item.productId] || 1) - 1, item.quantity)}
                                className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <input
                                type="number"
                                min={1}
                                max={item.quantity}
                                value={quantities[item.productId] || 1}
                                onChange={(e) => handleQtyChange(item.productId, Number(e.target.value), item.quantity)}
                                className="w-12 text-center text-xs font-bold bg-transparent border-0 focus:outline-none focus:ring-0 p-0 text-gray-900 dark:text-gray-100"
                              />
                              <button
                                type="button"
                                onClick={() => handleQtyChange(item.productId, (quantities[item.productId] || 1) + 1, item.quantity)}
                                className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                              <span className="text-2xs text-gray-400 dark:text-gray-500 pr-2">
                                {translatedUnit}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Expandable Asset Sub-list */}
                        {isAssetType && (isExpanded || isChecked) && (
                          <div className="pl-12 pr-4 py-3 bg-gray-50/80 dark:bg-gray-950/40 border-t border-gray-150 dark:border-gray-800 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-purple-500" />
                                Hisobdan chiqariladigan inventar raqamlar:
                              </span>
                              {productAssets.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => selectAllAssetsForProduct(item.productId)}
                                  className="text-2xs font-semibold text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 hover:underline"
                                >
                                  {productAssets.every((a) => checkedAssets[a.id]) ? "Hammasini bekor qilish" : "Hammasini tanlash"}
                                </button>
                              )}
                            </div>

                            {isAssetsLoading ? (
                              <div className="flex items-center text-xs text-gray-500 py-2">
                                <Loader2 className="w-3.5 h-3.5 animate-spin mr-2 text-purple-500" />
                                Jihozlar ro'yxati yuklanmoqda...
                              </div>
                            ) : productAssets.length === 0 ? (
                              <div className="text-xs text-gray-400 py-1 italic">
                                Omborda mavjud bo'lgan erkin jihozlar topilmadi
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {productAssets.map((asset) => {
                                  const isAssetChecked = !!checkedAssets[asset.id];
                                  return (
                                    <label
                                      key={asset.id}
                                      className={`flex items-start gap-2.5 p-2 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                                        isAssetChecked
                                          ? 'bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800/80 text-red-700 dark:text-red-300 shadow-2xs'
                                          : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-700'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isAssetChecked}
                                        onChange={() => toggleAsset(asset.id, item.productId)}
                                        className="rounded border-gray-300 dark:border-gray-700 text-red-600 focus:ring-red-500 w-3.5 h-3.5 mt-0.5"
                                      />
                                      <div className="flex flex-col min-w-0">
                                        <div className="flex items-center gap-1">
                                          <CopyableInventoryNumber
                                            value={asset.inventoryNumber}
                                            size="2xs"
                                            variant={isAssetChecked ? 'red' : 'slate'}
                                          />
                                        </div>
                                        {asset.serialNumber ? (
                                          <span className="text-2xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                            SN: {asset.serialNumber}
                                          </span>
                                        ) : (
                                          <span className="text-2xs text-gray-400 dark:text-gray-500 italic mt-0.5">
                                            Seriya raqamsiz
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
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column: Document Details and staged summary */}
        <div className="space-y-4">
          <Card className="shadow-xs border-gray-200 dark:border-gray-800 rounded-2xl sticky top-6">
            <CardContent className="p-5 space-y-5">
              <div className="flex items-center justify-between border-b border-gray-150 dark:border-gray-800 pb-3">
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-red-500" />
                  Hujjat va Tasdiqlash
                </h3>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300">
                  Jami: {totalWriteOffRowsCount} ta
                </span>
              </div>

              {/* Document Number with auto generator */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Hujjat / Akt raqami
                  </label>
                  <button
                    type="button"
                    onClick={generateDocNumber}
                    className="text-2xs font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    Avto raqam
                  </button>
                </div>
                <Input
                  placeholder="Masalan: AKT-2026-001"
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  className="rounded-xl"
                />
              </div>

              {/* Quick Reasons Chips & Note */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Hisobdan chiqarish sababi
                </label>

                {/* Quick Chips */}
                <div className="flex flex-wrap gap-1.5">
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

                <textarea
                  rows={3}
                  placeholder="Hisobdan chiqarish sababini batafsilroq izohlang..."
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 px-3 py-2 resize-none"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              {/* Staged Items Preview List */}
              <div className="space-y-2 pt-1">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                  <span>Chiqarilayotgan mahsulotlar:</span>
                  <span className="text-2xs text-gray-500">{stagedSummaryList.length} xil</span>
                </span>

                {stagedSummaryList.length === 0 ? (
                  <div className="p-3 text-center rounded-xl border border-dashed border-gray-200 dark:border-gray-800 text-xs text-gray-400">
                    Hali hech qanday mahsulot tanlanmadi
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 divide-y divide-gray-100 dark:divide-gray-800/60 border border-gray-150 dark:border-gray-800 rounded-xl p-2 bg-gray-50/50 dark:bg-gray-950/20">
                    {stagedSummaryList.map((item) => (
                      <div key={item.productId} className="pt-1.5 first:pt-0 flex flex-col gap-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-gray-900 dark:text-gray-100 truncate pr-2">
                            {item.name}
                          </span>
                          <span className="font-bold text-red-600 dark:text-red-400 shrink-0">
                            {item.qty} {t(`common.units.${item.unit}`) || item.unit}
                          </span>
                        </div>
                        {item.assets && item.assets.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {item.assets.map((a) => (
                              <CopyableInventoryNumber
                                key={a.id}
                                value={a.inventoryNumber}
                                prefix="#"
                                size="2xs"
                                variant="red"
                              />
                            ))}

                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Password requirement alert & input */}
              {requirePassword && (
                <div className="border border-red-200 dark:border-red-900/40 rounded-xl p-3.5 bg-red-50/40 dark:bg-red-950/20 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-red-800 dark:text-red-300">
                        Ommaviy chiqarish tasdig'i
                      </h4>
                      <p className="text-2xs text-gray-600 dark:text-gray-400 mt-0.5">
                        Xavfsizlik maqsadida 1 tadan ko'p mahsulotni hisobdan chiqarish uchun parolingiz bilan tasdiqlang.
                      </p>
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Parolingizni kiriting"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3 py-2 pr-9 text-xs border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Submit Action button */}
              <Button
                className="w-full justify-center bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold py-3 rounded-xl shadow-md transition-all mt-2 disabled:opacity-50"
                onClick={() => mutate()}
                loading={isPending}
                disabled={totalWriteOffRowsCount === 0 || (requirePassword && !password)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Hisobdan chiqarish ({totalWriteOffRowsCount})
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
