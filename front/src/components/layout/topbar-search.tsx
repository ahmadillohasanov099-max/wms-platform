import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  X,
  Loader2,
  Package,
  Boxes,
  ArrowRight,
  AlertCircle,
  Hash,
} from 'lucide-react';
import { inventoryApi } from '../../api';
import { useAuthStore } from '../../store/auth.store';
import { useTranslation } from '../../hooks/useTranslation';
import { useDebounce } from '../../hooks/useDebounce';
import ProductDetailModal from '../../pages/products/product-detail-modal';
import type { Inventory } from '../../types/inventory.types';

export default function TopbarSearch() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebounce(searchQuery, 250);

  // Close dropdown on click outside or escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Fetch search results strictly within user's organization context
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['topbar-search', user?.organizationId, debouncedQuery],
    queryFn: () =>
      inventoryApi.getAll({
        organizationId: user?.organizationId || undefined,
        search: debouncedQuery.trim(),
      }),
    enabled: debouncedQuery.trim().length >= 1,
    staleTime: 10000,
  });

  const results: Inventory[] = useMemo(() => {
    if (!Array.isArray(data)) return [];
    return data;
  }, [data]);

  const hasQuery = debouncedQuery.trim().length >= 1;
  const isSearching = isLoading || isFetching;

  const handleSelectProduct = (productId: string) => {
    setSelectedProductId(productId);
    setIsOpen(false);
  };

  const handleNavigateToInventory = () => {
    setIsOpen(false);
    navigate(`/inventory?search=${encodeURIComponent(debouncedQuery.trim())}`);
  };

  const getMatchedAsset = (item: Inventory) => {
    if (!debouncedQuery.trim() || !item.product?.assets?.length) return null;
    const q = debouncedQuery.toLowerCase().trim();
    return item.product.assets.find(
      (a) =>
        a.inventoryNumber?.toLowerCase().includes(q) ||
        a.serialNumber?.toLowerCase().includes(q)
    );
  };

  return (
    <>
      <div className="relative" ref={containerRef}>
        {/* Search Input Box */}
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => {
              if (searchQuery.trim().length >= 1) setIsOpen(true);
            }}
            placeholder={t('topbar.searchPlaceholderFull') || 'Qidiruv (nomi yoki INV)...'}
            className="w-40 sm:w-56 lg:w-72 pl-8 pr-7 py-1.5 text-xs rounded-xl border border-gray-200/80 dark:border-slate-800 bg-gray-50/80 dark:bg-slate-900/80 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all duration-150"
          />

          {/* Right Action: Loading Spinner or Clear Button */}
          {isSearching ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600 dark:text-teal-400 absolute right-2.5" />
          ) : searchQuery ? (
            <button
              onClick={() => {
                setSearchQuery('');
                setIsOpen(false);
              }}
              className="p-0.5 rounded-full hover:bg-gray-200 dark:hover:bg-slate-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 absolute right-2 transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          ) : null}
        </div>

        {/* Live Search Results Dropdown */}
        {isOpen && hasQuery && (
          <div className="absolute left-0 sm:right-auto sm:w-[380px] w-[calc(100vw-32px)] max-w-[420px] mt-2 bg-white dark:bg-slate-900 border border-gray-200/90 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-3.5 py-2.5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gray-50/50 dark:bg-slate-900/50">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                {t('topbar.foundProducts')}
              </span>
              <span className="text-xs font-bold text-teal-600 dark:text-teal-400 font-mono">
                {results.length} {t('common.pcs')}
              </span>
            </div>

            {/* Results List */}
            <div className="max-h-[340px] overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800/60">
              {isSearching && results.length === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <Loader2 className="w-5 h-5 animate-spin text-teal-600 mx-auto" />
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
                </div>
              ) : results.length === 0 ? (
                <div className="py-8 px-4 text-center space-y-2">
                  <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-400 flex items-center justify-center mx-auto">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                    {t('topbar.noProductsFound', { query: debouncedQuery })}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
                    {t('topbar.checkSearchQuery')}
                  </p>
                </div>
              ) : (
                results.slice(0, 15).map((item) => {
                  const matchedAsset = getMatchedAsset(item);
                  const isEquipment = item.product?.productType === 'BERILADIGAN';

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectProduct(item.productId)}
                      className="p-3 hover:bg-teal-50/60 dark:hover:bg-teal-950/30 cursor-pointer transition-colors flex items-start gap-3 group"
                    >
                      <div className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-teal-100 dark:group-hover:bg-teal-900/50 group-hover:text-teal-700 dark:group-hover:text-teal-300 transition-colors">
                        {isEquipment ? (
                          <Package className="w-4 h-4" />
                        ) : (
                          <Boxes className="w-4 h-4" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                            {item.product?.name || t('topbar.unnamedProduct') || 'Nomsiz mahsulot'}
                          </p>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${
                              isEquipment
                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/80 dark:border-blue-900/60'
                                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-900/60'
                            }`}
                          >
                            {isEquipment ? (t('topbar.equipmentBadge') || 'Jihoz') : (t('topbar.tmzBadge') || 'TMZ')}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                            {t('topbar.stockBalanceShort') || 'Qoldiq:'} <strong className="text-gray-800 dark:text-gray-200">{item.quantity}</strong> {item.product?.unit || 'dona'}
                          </span>

                          {matchedAsset && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-teal-50 text-teal-700 dark:bg-teal-950/80 dark:text-teal-300 border border-teal-200/60">
                              <Hash className="w-2.5 h-2.5" />
                              {matchedAsset.inventoryNumber}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Action */}
            {results.length > 0 && (
              <div className="p-2 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50">
                <button
                  onClick={handleNavigateToInventory}
                  className="w-full py-1.5 px-3 text-xs font-bold text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/50 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>{t('topbar.viewAllInWarehouse')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Product Detail Modal */}
      {selectedProductId && (
        <ProductDetailModal
          open={!!selectedProductId}
          onClose={() => setSelectedProductId(null)}
          productId={selectedProductId}
        />
      )}
    </>
  );
}
