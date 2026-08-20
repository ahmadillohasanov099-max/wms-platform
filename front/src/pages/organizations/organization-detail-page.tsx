import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  ArrowLeft,
  Phone,
  MapPin,
  Boxes,
  Package,
  AlertTriangle,
  TrendingUp,
  PackageCheck,
  FileSpreadsheet,
} from 'lucide-react';
import Card from '../../components/ui/card';
import Button from '../../components/ui/button';
import Badge, { ProductTypeBadge } from '../../components/ui/badge';
import Spinner from '../../components/ui/spinner';
import Table, { type Column } from '../../components/ui/table';
import { organizationsApi, inventoryApi } from '../../api';
import type { Organization, Inventory } from '../../types';
import { formatCurrency, formatCompactCurrency } from '../../lib/utils';
import { useDebounce } from '../../hooks/useDebounce';
import ProductDetailModal from '../products/product-detail-modal';
import toast from 'react-hot-toast';

export default function OrganizationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 250);
  const [typeFilter, setTypeFilter] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [detailProductId, setDetailProductId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const { data: orgData, isLoading: orgLoading } = useQuery({
    queryKey: ['organization', id],
    queryFn: () => organizationsApi.getById(id!),
    enabled: !!id,
  });

  const org: Organization | null = (orgData as any)?.data || orgData || null;

  const { data: inventoryData, isLoading: inventoryLoading } = useQuery({
    queryKey: ['org-inventory', id],
    queryFn: () => inventoryApi.getAll({ organizationId: id }),
    enabled: !!id,
  });

  const inventoryList: Inventory[] = Array.isArray(inventoryData)
    ? inventoryData
    : (inventoryData as any)?.data || [];

  // Ombor ko'rsatkichlari (Summary Metrics)
  const summary = useMemo(() => {
    let totalItems = inventoryList.length;
    let beriladiganCount = 0;
    let sarflanadiganCount = 0;
    let lowStockCount = 0;
    let totalValue = 0;

    inventoryList.forEach((item) => {
      if (item.product?.productType === 'BERILADIGAN') {
        beriladiganCount++;
      } else {
        sarflanadiganCount++;
      }
      if (item.isLowStock) {
        lowStockCount++;
      }
      totalValue += Number(item.totalValue || 0);
    });

    return {
      totalItems,
      beriladiganCount,
      sarflanadiganCount,
      lowStockCount,
      totalValue,
    };
  }, [inventoryList]);

  // Qidiruv va Filtr
  const filteredInventory = useMemo(() => {
    return inventoryList.filter((item) => {
      const matchSearch =
        !debouncedSearch ||
        item.product?.name?.toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchType =
        !typeFilter || item.product?.productType === typeFilter;
      const matchLowStock = !lowStockOnly || item.isLowStock;
      return matchSearch && matchType && matchLowStock;
    });
  }, [inventoryList, debouncedSearch, typeFilter, lowStockOnly]);

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      await inventoryApi.exportCsv(id);
      toast.success('Boshqarma ombor hisoboti yuklab olindi');
    } catch {
      toast.error('Eksport qilishda xatolik yuz berdi');
    } finally {
      setExporting(false);
    }
  };

  if (orgLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Boshqarma topilmadi</p>
        <Button variant="outline" onClick={() => navigate('/organizations')} className="mt-4">
          Boshqarmalar ro'yxatiga qaytish
        </Button>
      </div>
    );
  }

  const columns: Column<Inventory>[] = [
    {
      key: 'product',
      title: 'Mahsulot nomi',
      render: (_, row) => (
        <div>
          <p className="font-bold text-gray-900 dark:text-gray-100">{row.product?.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <ProductTypeBadge type={row.product?.productType || ''} />
            <span className="text-2xs text-gray-400">
              O'lchov: {row.product?.unit || 'dona'}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'quantity',
      title: 'Ombordagi mavjud miqdor',
      render: (val, row) => (
        <div className="flex items-center gap-2">
          <span
            className={`font-bold text-sm ${
              row.isLowStock
                ? 'text-red-600 dark:text-red-400'
                : 'text-gray-900 dark:text-gray-100'
            }`}
          >
            {val} {row.product?.unit || 'dona'}
          </span>
          {row.isLowStock && (
            <span className="inline-flex items-center gap-1 text-2xs px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 font-medium">
              <AlertTriangle className="w-3 h-3 text-red-500" />
              Kam qolgan
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'minLevel',
      title: 'Minimal chegara',
      render: (val, row) => (
        <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">
          {val || 0} {row.product?.unit || 'dona'}
        </span>
      ),
    },
    {
      key: 'unitPrice',
      title: 'Birlik narxi',
      render: (val) => (
        <span className="text-xs font-mono font-medium text-gray-700 dark:text-gray-300">
          {val ? formatCurrency(Number(val)) : '—'}
        </span>
      ),
    },
    {
      key: 'totalValue',
      title: 'Jami qiymati',
      render: (val) => (
        <span className="text-xs font-mono font-bold text-teal-600 dark:text-teal-400">
          {val ? formatCurrency(Number(val)) : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      title: 'Jihozlar',
      className: 'text-right',
      headerClassName: 'text-right',
      render: (_, row) => (
        <div className="flex items-center justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDetailProductId(row.productId)}
            className="flex items-center gap-1 text-xs text-teal-600 border-teal-200 hover:bg-teal-50 dark:hover:bg-teal-950/40"
          >
            <Boxes className="w-3.5 h-3.5" />
            Jihozlar / Inventar №
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Back Button */}
      <div className="flex items-center justify-between gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate('/organizations')}>
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Boshqarmalar ro'yxatiga qaytish
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCsv}
          loading={exporting}
          className="border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/20"
        >
          <FileSpreadsheet className="w-4 h-4 mr-1.5" />
          Ombor hisobotini yuklab olish (CSV)
        </Button>
      </div>

      {/* Organization Header Card */}
      <Card className="p-6 bg-gradient-to-r from-teal-600/10 via-teal-500/5 to-transparent border border-gray-200/90 dark:border-white/15">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-2xs">
                <Building2 className="w-7 h-7 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-950 dark:text-gray-50">
                  {org.name}
                </h1>
                {org.code && (
                  <span className="inline-block mt-0.5 text-xs font-mono px-2 py-0.5 rounded bg-white/80 dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-gray-300 font-bold">
                    KOD: {org.code}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600 dark:text-gray-400 pt-1">
              {org.address && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span>{org.address}</span>
                </div>
              )}
              {org.phone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span>{org.phone}</span>
                </div>
              )}
            </div>
          </div>

          <Badge variant={org.type === 'MINISTRY' ? 'info' : 'gray'} className="self-start md:self-auto text-xs px-3 py-1">
            {org.type === 'MINISTRY' ? 'Bosh Vazirlik' : 'Viloyat Boshqarmasi'}
          </Badge>
        </div>

        {/* 5 Warehouse Summary Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-6 pt-6 border-t border-gray-200/60 dark:border-gray-800">
          <div className="p-3.5 bg-white/90 dark:bg-slate-900/90 rounded-xl border border-gray-200/80 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-gray-500 text-xs font-medium">
              <Boxes className="w-4 h-4 text-teal-500" />
              Jami Mahsulotlar
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {summary.totalItems} ta
            </p>
          </div>

          <div className="p-3.5 bg-white/90 dark:bg-slate-900/90 rounded-xl border border-gray-200/80 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-gray-500 text-xs font-medium">
              <PackageCheck className="w-4 h-4 text-blue-500" />
              Asosiy Vositalar
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {summary.beriladiganCount} tur
            </p>
          </div>

          <div className="p-3.5 bg-white/90 dark:bg-slate-900/90 rounded-xl border border-gray-200/80 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-gray-500 text-xs font-medium">
              <Package className="w-4 h-4 text-emerald-500" />
              Sarflanadigan (TMZ)
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {summary.sarflanadiganCount} tur
            </p>
          </div>

          <div className="p-3.5 bg-white/90 dark:bg-slate-900/90 rounded-xl border border-gray-200/80 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-gray-500 text-xs font-medium">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Kam Qolganlar
            </div>
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
              {summary.lowStockCount} ta
            </p>
          </div>

          <div className="p-3.5 bg-white/90 dark:bg-slate-900/90 rounded-xl border border-gray-200/80 dark:border-slate-800 col-span-2 sm:col-span-1">
            <div className="flex items-center gap-1.5 text-gray-500 text-xs font-medium">
              <TrendingUp className="w-4 h-4 text-indigo-500" />
              Jami Qiymati
            </div>
            <p className="text-base font-bold font-mono text-teal-600 dark:text-teal-400 mt-1 truncate" title={formatCurrency(summary.totalValue)}>
              {formatCompactCurrency(summary.totalValue)}
            </p>
          </div>
        </div>
      </Card>

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="w-full sm:w-80">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Mahsulot nomi bo'yicha qidirish..."
              className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-700 dark:text-gray-300 font-medium focus:outline-none"
            >
              <option value="">Barcha tovar turlari</option>
              <option value="BERILADIGAN">Asosiy vositalar (Jihozlar)</option>
              <option value="SARFLANADIGAN">Sarflanadigan (TMZ)</option>
            </select>

            <button
              type="button"
              onClick={() => setLowStockOnly(!lowStockOnly)}
              className={`px-3 py-2 text-xs font-medium rounded-xl border transition-colors flex items-center gap-1.5 ${
                lowStockOnly
                  ? 'bg-amber-500 text-white border-amber-500 font-bold'
                  : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Kam qolganlar ({summary.lowStockCount})
            </button>
          </div>
        </div>
      </Card>

      {/* Complete Warehouse Table */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm flex items-center gap-2">
            <Boxes className="w-4 h-4 text-teal-600" />
            <span>Boshqarmaning Ombordagi Mahsulotlari Ro'yxati ({filteredInventory.length})</span>
          </h3>
        </div>

        <Table
          data={filteredInventory}
          columns={columns}
          loading={inventoryLoading}
          emptyTitle="Ushbu boshqarma omborida mahsulotlar mavjud emas"
        />
      </Card>

      {/* Asset / Product Details Modal */}
      {detailProductId && (
        <ProductDetailModal
          open={!!detailProductId}
          productId={detailProductId}
          disableLinks={true}
          onClose={() => setDetailProductId(null)}
        />
      )}
    </div>
  );
}
