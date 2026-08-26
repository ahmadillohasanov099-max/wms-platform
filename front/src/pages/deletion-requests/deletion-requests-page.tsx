import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Check, X, Search, Inbox } from 'lucide-react';
import { Card, Button, Spinner, Table, PageHeader, type Column } from '../../components/ui';
import RejectReasonModal from '../../components/modals/reject-reason-modal';
import { deletionRequestsApi } from '../../api';
import { useAuthStore } from '../../store/auth.store';
import { useTranslation } from '../../hooks/useTranslation';
import { useDebounce } from '../../hooks/useDebounce';
import { formatDate } from '../../lib/utils';
import type { DeletionRequest, DeletionStatus } from '../../types';

export default function DeletionRequestsPage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [selectedStatus, setSelectedStatus] = useState<DeletionStatus | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 250);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const canManage =
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'VAZIRLIK_OMBORCHI' ||
    user?.role === 'ADMIN' ||
    user?.role === 'OMBORCHI' ||
    user?.role === 'ORG_OMBORCHI';

  // Fetch requests: Admins fetch all, regular users fetch their own
  const { data: requestsData, isLoading, refetch } = useQuery({
    queryKey: ['deletion-requests', selectedStatus, canManage ? 'all' : 'my'],
    queryFn: () =>
      canManage
        ? deletionRequestsApi.getAll({
            status: selectedStatus === 'ALL' ? undefined : selectedStatus,
          })
        : deletionRequestsApi.getMy(),
    refetchInterval: 8000,
  });

  const rawListAll: DeletionRequest[] = Array.isArray(requestsData)
    ? requestsData
    : Array.isArray((requestsData as any)?.data)
    ? (requestsData as any).data
    : [];

  // Summary statistics for Admins
  const stats = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;

    rawListAll.forEach((item) => {
      if (item.status === 'PENDING') pending++;
      if (item.status === 'APPROVED') approved++;
      if (item.status === 'REJECTED') rejected++;
    });

    return { total: rawListAll.length, pending, approved, rejected };
  }, [rawListAll]);

  // Filtered list
  const filteredList = useMemo(() => {
    return rawListAll.filter((item) => {
      // 1. Status Filter
      if (selectedStatus !== 'ALL' && item.status !== selectedStatus) {
        return false;
      }

      // 2. Search query
      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase().trim();
        const matchesEntity = String(item.entityName || item.entityTitle || item.entityId || '').toLowerCase().includes(q);
        const matchesReason = String(item.reason || '').toLowerCase().includes(q);
        const matchesRejection = String(item.rejectionReason || '').toLowerCase().includes(q);
        const matchesRequester = String(item.requestedBy?.fullName || item.requestedBy?.username || '').toLowerCase().includes(q);
        return matchesEntity || matchesReason || matchesRejection || matchesRequester;
      }

      return true;
    });
  }, [rawListAll, selectedStatus, debouncedSearch]);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      await deletionRequestsApi.approve(id);
      toast.success("So'rov tasdiqlandi!");
      refetch();
    } catch (error: any) {
      toast.error(error?.message || t('common.error'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmReject = async (rejectionReason: string) => {
    if (!rejectingId) return;
    try {
      await deletionRequestsApi.reject(rejectingId, { rejectionReason });
      toast.success("So'rov rad etildi!");
      refetch();
    } catch (error: any) {
      toast.error(error?.message || t('common.error'));
      throw error;
    }
  };

  const filterTabs = [
    {
      key: 'ALL' as const,
      label: "Barchasi",
      count: stats.total,
    },
    {
      key: 'PENDING' as const,
      label: "Kutilmoqda",
      count: stats.pending,
    },
    {
      key: 'APPROVED' as const,
      label: "Tasdiqlangan",
      count: stats.approved,
    },
    {
      key: 'REJECTED' as const,
      label: "Rad etilgan",
      count: stats.rejected,
    },
  ];

  // Columns for Admin View
  const adminColumns: Column<DeletionRequest>[] = [
    {
      key: 'status',
      title: 'Holati',
      className: 'w-32 whitespace-nowrap',
      render: (_: any, row: DeletionRequest) => {
        if (row.status === 'PENDING') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300/80">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span>Kutilmoqda</span>
            </span>
          );
        }
        if (row.status === 'APPROVED') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300/80">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Tasdiqlangan</span>
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300/80">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <span>Rad etilgan</span>
          </span>
        );
      },
    },
    {
      key: 'entityType',
      title: "Jihoz / Mahsulot",
      render: (_: any, row: DeletionRequest) => {
        const isRejectionNotice = row.reason?.toLowerCase().includes('rad etildi');
        let title = (row.entityName || row.entityTitle || row.requestedBy?.fullName || row.entityId || 'Jihoz').trim();
        let invNumber: string | undefined;
        const invMatch = title.match(/\(Inv:\s*([^\)]+)\)/i);
        if (invMatch) {
          invNumber = invMatch[1].trim();
          title = title.replace(/\(Inv:\s*[^\)]+\)/i, '').trim();
        }
        const commaIndex = title.indexOf(',');
        if (title.length > 50 && commaIndex > 10) {
          title = title.substring(0, commaIndex).trim();
        } else if (title.length > 60) {
          title = title.substring(0, 57) + '...';
        }

        return (
          <div className="space-y-0.5 py-0.5">
            <div className="flex items-center gap-1.5">
              <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                {title}
              </p>
              {invNumber && (
                <span className="text-[10px] font-mono text-gray-400 shrink-0">
                  № {invNumber}
                </span>
              )}
            </div>
            <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${
              isRejectionNotice
                ? 'text-rose-700 bg-rose-50 dark:text-rose-300 dark:bg-rose-950/60'
                : 'text-gray-500 dark:text-gray-400'
            }`}>
              {isRejectionNotice ? '❌ Qabul rad etilgan' : row.entityType === 'ASSET' ? '🛠️ Jihoz' : '📦 Mahsulot'}
            </span>
          </div>
        );
      },
    },
    {
      key: 'reason',
      title: "Sababi",
      render: (_: any, row: DeletionRequest) => {
        const isRejected = row.status === 'REJECTED';
        let cleanReason = (row.reason || '').trim();
        const dotIndex = cleanReason.lastIndexOf('. ');
        if (dotIndex !== -1 && (cleanReason.startsWith('[') || cleanReason.includes('Jihoz:'))) {
          cleanReason = cleanReason.substring(dotIndex + 2).trim();
        }
        cleanReason = cleanReason
          .replace(/^[❌\s]*Jihozni qabul qilish rad etildi:\s*"?/i, '')
          .replace(/^\[OMBORGA QAYTARISH\]\s*/i, '')
          .replace(/^\[TA'MIRLASH\/SERVIS\]\s*/i, '')
          .replace(/^Qaytarish:\s*/i, '')
          .replace(/^Ta'mirlash:\s*/i, '')
          .replace(/"?$/, '')
          .trim();

        return (
          <div className="space-y-1 py-0.5 max-w-md">
            {cleanReason ? (
              <p className="text-xs text-slate-700 dark:text-slate-300">
                "{cleanReason}"
              </p>
            ) : (
              <span className="text-2xs text-gray-400 italic">Sabab ko'rsatilmagan</span>
            )}

            {isRejected && row.rejectionReason && (
              <p className="text-2xs font-semibold text-rose-600 dark:text-rose-400">
                Rad sababi: {row.rejectionReason}
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: 'requester',
      title: "Xodim & Sana",
      className: 'w-44 whitespace-nowrap',
      render: (_: any, row: DeletionRequest) => (
        <div className="space-y-0.5 text-xs">
          <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
            {row.requestedBy?.fullName || row.requestedBy?.username || 'Xodim'}
          </p>
          <p className="text-2xs text-gray-400 font-mono">
            {formatDate(row.createdAt)}
          </p>
        </div>
      ),
    },
    {
      key: 'actions',
      title: t('common.actions'),
      className: 'w-32 text-right whitespace-nowrap',
      render: (_: any, row: DeletionRequest) => {
        if (row.status !== 'PENDING') return null;
        const isLoadingThis = actionLoading === row.id;
        const isRejectionNotice = row.reason?.toLowerCase().includes('rad etildi');

        if (isRejectionNotice) {
          return (
            <div className="flex items-center justify-end">
              <Button
                size="sm"
                variant="secondary"
                loading={isLoadingThis}
                onClick={() => handleApprove(row.id)}
                className="h-7 px-2.5 text-2xs font-bold"
              >
                <Check className="w-3 h-3 mr-1" />
                O'qildi
              </Button>
            </div>
          );
        }

        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              size="sm"
              variant="primary"
              loading={isLoadingThis}
              onClick={() => handleApprove(row.id)}
              className="h-7 px-2 text-2xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Check className="w-3 h-3 mr-0.5" />
              Qabul
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={isLoadingThis}
              onClick={() => setRejectingId(row.id)}
              className="h-7 px-2 text-2xs font-bold"
            >
              <X className="w-3 h-3 mr-0.5" />
              Rad
            </Button>
          </div>
        );
      },
    },
  ];

  // Compact Minimalist Columns for Employee / Department Leader View
  const userColumns: Column<DeletionRequest>[] = [
    {
      key: 'status',
      title: 'Holati',
      className: 'w-28 whitespace-nowrap',
      render: (_: any, row: DeletionRequest) => {
        if (row.status === 'PENDING') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300/80">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span>Kutilmoqda</span>
            </span>
          );
        }
        if (row.status === 'APPROVED') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300/80">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Qabul qilindi</span>
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300/80">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <span>Rad etildi</span>
          </span>
        );
      },
    },
    {
      key: 'entityType',
      title: "Jihoz Nomi",
      render: (_: any, row: DeletionRequest) => (
        <div className="space-y-0.5 py-0.5">
          <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
            {row.entityName || row.entityTitle || row.entityId}
          </p>
        </div>
      ),
    },
    {
      key: 'reason',
      title: "So'rov Sababi & Javob",
      render: (_: any, row: DeletionRequest) => {
        const isRejected = row.status === 'REJECTED';
        return (
          <div className="space-y-1 py-0.5 max-w-md">
            {row.reason ? (
              <p className="text-xs text-slate-700 dark:text-slate-300">
                "{row.reason}"
              </p>
            ) : (
              <span className="text-2xs text-gray-400 italic">Sabab ko'rsatilmagan</span>
            )}

            {isRejected && row.rejectionReason && (
              <p className="text-2xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-1 rounded border border-rose-200 dark:border-rose-900/60">
                Rad etish sababi: <strong>{row.rejectionReason}</strong>
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: 'createdAt',
      title: "Yuborilgan Vaqt",
      className: 'w-36 text-right whitespace-nowrap',
      render: (_: any, row: DeletionRequest) => (
        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
          {formatDate(row.createdAt)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5 pb-12">
      {/* Header */}
      <PageHeader
        title={canManage ? "So'rovlar Boshqaruvi" : "Mening So'rovlarim Tarixi"}
        subtitle={
          canManage
            ? "Xodimlardan kelgan jihozlarni qaytarish va o'chirish so'rovlarini ko'rib chiqish"
            : "Jihozlarni omborga qaytarish yoki ta'mirlash bo'yicha yuborgan so'rovlaringiz holati"
        }
      />

      {/* Admin Stat Metrics (Only visible for Admins & Warehousemen) */}
      {canManage && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800 shadow-2xs">
            <span className="text-2xs font-bold text-gray-400 uppercase">Jami</span>
            <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mt-0.5">
              {stats.total} ta
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-amber-900/40 shadow-2xs">
            <span className="text-2xs font-bold text-amber-600 dark:text-amber-400 uppercase">Kutilmoqda</span>
            <p className="text-lg sm:text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">
              {stats.pending} ta
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-emerald-900/40 shadow-2xs">
            <span className="text-2xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">Tasdiqlangan</span>
            <p className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {stats.approved} ta
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-rose-200/80 dark:border-rose-900/40 shadow-2xs">
            <span className="text-2xs font-bold text-rose-600 dark:text-rose-400 uppercase">Rad etilgan</span>
            <p className="text-lg sm:text-xl font-bold text-rose-600 dark:text-rose-400 mt-0.5">
              {stats.rejected} ta
            </p>
          </div>
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <Card className="p-2.5 rounded-xl border-gray-200/80 dark:border-slate-800 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto p-0.5">
            {filterTabs.map((tab) => {
              const isActive = selectedStatus === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setSelectedStatus(tab.key)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-teal-600 text-white shadow-2xs'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>{tab.label}</span>
                  {canManage && (
                    <span className="ml-1.5 opacity-80 text-[10px] font-mono">
                      ({tab.count})
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[200px] sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Qidirish..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 text-gray-900 dark:text-white"
            />
          </div>
        </div>
      </Card>

      {/* Table Content */}
      <Card className="rounded-xl border-gray-200/80 dark:border-slate-800 shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="py-12 flex items-center justify-center">
            <Spinner size="md" />
          </div>
        ) : filteredList.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-400 flex flex-col items-center gap-2">
            <Inbox className="w-8 h-8 text-gray-300 dark:text-slate-700 stroke-1" />
            <span className="font-medium">So'rovlar topilmadi</span>
          </div>
        ) : (
          <Table<DeletionRequest>
            columns={canManage ? adminColumns : userColumns}
            data={filteredList}
          />
        )}
      </Card>

      {/* Reject Reason Modal for Admins */}
      <RejectReasonModal
        open={!!rejectingId}
        onClose={() => setRejectingId(null)}
        onConfirm={handleConfirmReject}
        itemTitle="So'rovni rad etish"
        isLoading={false}
      />
    </div>
  );
}
