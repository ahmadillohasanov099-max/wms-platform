import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Check, X, Search, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { Card, Button, Table, PageHeader, type Column } from '../../components/ui';
import RejectReasonModal from '../../components/modals/reject-reason-modal';
import { requestsApi } from '../../api';
import { useAuthStore } from '../../store/auth.store';
import { useTranslation } from '../../hooks/useTranslation';
import { useDebounce } from '../../hooks/useDebounce';
import { formatDate } from '../../lib/utils';
import type { RequestItem, RequestStatus } from '../../types';

export default function RequestsPage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [selectedStatus, setSelectedStatus] = useState<RequestStatus | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 250);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const canManage =
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'VAZIRLIK_OMBORCHI' ||
    user?.role === 'ADMIN' ||
    user?.role === 'OMBORCHI' ||
    user?.role === 'ORG_ADMIN' ||
    user?.role === 'ORG_OMBORCHI';

  // Fetch requests: Admins/Moderators fetch all, regular users fetch their own
  const { data: requestsData, isLoading, refetch } = useQuery({
    queryKey: ['requests', selectedStatus, canManage ? 'all' : 'my'],
    queryFn: () =>
      canManage
        ? requestsApi.getAll({
            status: selectedStatus === 'ALL' ? undefined : selectedStatus,
          })
        : requestsApi.getMy(),
    refetchInterval: 8000,
  });

  const rawListAll: RequestItem[] = Array.isArray(requestsData)
    ? requestsData
    : Array.isArray((requestsData as any)?.data)
    ? (requestsData as any).data
    : [];

  // Summary statistics
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
      if (selectedStatus !== 'ALL' && item.status !== selectedStatus) {
        return false;
      }

      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase().trim();
        const matchesEntity = String(item.entityName || item.entityTitle || item.entityId || '').toLowerCase().includes(q);
        const matchesReason = String(item.reason || '').toLowerCase().includes(q);
        const matchesRejection = String(item.rejectionReason || item.reviewComment || '').toLowerCase().includes(q);
        const matchesRequester = String(item.requestedBy?.fullName || item.requestedBy?.username || '').toLowerCase().includes(q);
        return matchesEntity || matchesReason || matchesRejection || matchesRequester;
      }

      return true;
    });
  }, [rawListAll, selectedStatus, debouncedSearch]);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      await requestsApi.approve(id);
      toast.success("So'rov muvaffaqiyatli tasdiqlandi!");
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
      await requestsApi.reject(rejectingId, { rejectionReason, reviewComment: rejectionReason });
      toast.success("So'rov rad etildi!");
      setRejectingId(null);
      refetch();
    } catch (error: any) {
      toast.error(error?.message || t('common.error'));
    }
  };

  const getStatusBadge = (status: RequestStatus) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5" />
            Kutilmoqda
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Tasdiqlangan
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" />
            Rad etilgan
          </span>
        );
      default:
        return null;
    }
  };

  const getEntityTypeLabel = (type: string) => {
    switch (type) {
      case 'ASSET':
        return 'Jihoz (Asosiy vosita)';
      case 'PRODUCT':
        return 'Mahsulot (TMZ)';
      case 'USER':
        return 'Xodim profili';
      case 'DEPARTMENT':
        return 'Bo‘lim';
      default:
        return type;
    }
  };

  const columns: Column<RequestItem>[] = [
    {
      key: 'entity',
      title: 'Obyekt / Jihoz',
      render: (_: any, row: RequestItem) => (
        <div>
          <div className="font-medium text-slate-900 dark:text-slate-100">
            {row.entityName || row.entityTitle || `ID: ${row.entityId.slice(0, 8)}...`}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {getEntityTypeLabel(row.entityType)}
          </div>
        </div>
      ),
    },
    {
      key: 'reason',
      title: "So'rov sababi",
      render: (_: any, row: RequestItem) => (
        <div className="max-w-xs text-sm text-slate-700 dark:text-slate-300">
          <p className="line-clamp-2">{row.reason || '—'}</p>
        </div>
      ),
    },
    {
      key: 'requestedBy',
      title: 'Yuboruvchi',
      render: (_: any, row: RequestItem) => (
        <div>
          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
            {row.requestedBy?.fullName || row.requestedBy?.username || "Noma'lum"}
          </div>
          <div className="text-xs text-slate-500">
            {formatDate(row.createdAt)}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      title: 'Holati',
      render: (_: any, row: RequestItem) => getStatusBadge(row.status),
    },
    {
      key: 'reviewComment',
      title: 'Izoh / Javob',
      render: (_: any, row: RequestItem) => {
        const comment = row.reviewComment || row.rejectionReason;
        if (!comment) return <span className="text-xs text-slate-400">—</span>;
        return (
          <div className="text-xs text-slate-600 dark:text-slate-400 max-w-xs">
            <span className="font-medium">{row.reviewedBy?.fullName || "Mas'ul"}: </span>
            {comment}
          </div>
        );
      },
    },
    ...(canManage
      ? [
          {
            key: 'actions',
            title: 'Amallar',
            render: (_: any, row: RequestItem) => {
              if (row.status !== 'PENDING') {
                return <span className="text-xs text-slate-400">Ko‘rib chiqilgan</span>;
              }

              const isLoadingThis = actionLoading === row.id;

              return (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-2.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border-emerald-500/30"
                    onClick={() => handleApprove(row.id)}
                    disabled={Boolean(actionLoading)}
                  >
                    {isLoadingThis ? (
                      <span className="text-xs">Yuklanmoqda...</span>
                    ) : (
                      <span className="flex items-center">
                        <Check className="w-3.5 h-3.5 mr-1" />
                        Qabul qilish
                      </span>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-2.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-500/30"
                    onClick={() => setRejectingId(row.id)}
                    disabled={Boolean(actionLoading)}
                  >
                    <X className="w-3.5 h-3.5 mr-1" />
                    Rad etish
                  </Button>
                </div>
              );
            },
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="So'rovlar va Bildirishnomalar"
        subtitle="Jihozlarni omborga qaytarish, hisobdan chiqarish va xodimlar murojaatlari markazi"
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="p-4 bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500 dark:text-slate-400">Jami so‘rovlar</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {stats.total}
          </div>
        </Card>
        <Card className="p-4 bg-amber-500/5 border-amber-500/20">
          <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">Kutilayotganlar</div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            {stats.pending}
          </div>
        </Card>
        <Card className="p-4 bg-emerald-500/5 border-emerald-500/20">
          <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Tasdiqlanganlar</div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {stats.approved}
          </div>
        </Card>
        <Card className="p-4 bg-rose-500/5 border-rose-500/20">
          <div className="text-xs text-rose-600 dark:text-rose-400 font-medium">Rad etilganlar</div>
          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
            {stats.rejected}
          </div>
        </Card>
      </div>

      {/* Filters & Search */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
            <button
              onClick={() => setSelectedStatus('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedStatus === 'ALL'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Hammasi ({stats.total})
            </button>
            <button
              onClick={() => setSelectedStatus('PENDING')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedStatus === 'PENDING'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Kutilayotgan ({stats.pending})
            </button>
            <button
              onClick={() => setSelectedStatus('APPROVED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedStatus === 'APPROVED'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Tasdiqlangan ({stats.approved})
            </button>
            <button
              onClick={() => setSelectedStatus('REJECTED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedStatus === 'REJECTED'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Rad etilgan ({stats.rejected})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Qidiruv..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <Table<RequestItem>
          data={filteredList}
          columns={columns}
          loading={isLoading}
          rowKey={(item: RequestItem) => item.id}
          emptyTitle="Hech qanday so‘rov topilmadi"
        />
      </Card>

      {/* Reject Modal */}
      {rejectingId && (
        <RejectReasonModal
          open={Boolean(rejectingId)}
          onClose={() => setRejectingId(null)}
          onConfirm={handleConfirmReject}
        />
      )}
    </div>
  );
}
