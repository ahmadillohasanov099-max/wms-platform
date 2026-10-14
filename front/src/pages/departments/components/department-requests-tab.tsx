import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { requestsApi } from '../../../api';
import Card, { CardContent } from '../../../components/ui/card';
import Table from '../../../components/ui/table';
import Button from '../../../components/ui/button';
import Pagination from '../../../components/ui/pagination';
import { formatDate } from '../../../lib/utils';
import { useTranslation } from '../../../hooks/useTranslation';
import { useAuthStore } from '../../../store/auth.store';
import toast from 'react-hot-toast';
import {
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  Package,
  MessageSquare,
  Sparkles,
  Check,
  X,
  Search,
} from 'lucide-react';
import DepartmentSupplyRequestModal from './department-supply-request-modal';
import ApproveSupplyModal from '../../../components/modals/approve-supply-modal';
import RejectReasonModal from '../../../components/modals/reject-reason-modal';

interface Props {
  departmentId?: string;
  departmentName?: string;
  isLeader?: boolean;
}

export default function DepartmentRequestsTab({
  departmentId,
  departmentName,
  isLeader = false,
}: Props) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [supplyModalOpen, setSupplyModalOpen] = useState(false);
  const [approvingSupplyItem, setApprovingSupplyItem] = useState<any | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const limit = 10;

  const canManage =
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'ORG_ADMIN' ||
    user?.role === 'VAZIRLIK_OMBORCHI' ||
    user?.role === 'ORG_OMBORCHI';

  // Admin va Omborchi so'rov yubormaydi, faqat bo'lim boshlig'i yubora oladi
  const canSubmit = Boolean(isLeader && !canManage);

  // Fetch requests: managers get all, department members get their department's requests
  const { data: requestsData, isLoading, refetch } = useQuery({
    queryKey: canManage ? ['department-all-requests', departmentId] : ['my-deletion-requests'],
    queryFn: () => (canManage ? requestsApi.getAll() : requestsApi.getMy()),
    refetchInterval: 10000,
  });

  const rawList: any[] = Array.isArray(requestsData)
    ? requestsData
    : Array.isArray((requestsData as any)?.data)
    ? (requestsData as any).data
    : [];

  // Filter to supply requests (and by department if viewing as manager)
  const supplyRequests = useMemo(() => {
    return rawList.filter((item) => {
      const isSupply =
        item.requestType === 'SUPPLY' ||
        item.isSupply ||
        item.reason?.includes('[TALABNOMA]') ||
        item.reason?.includes("[MAHSULOT SO'ROVI]");

      if (!isSupply) return false;
      if (departmentId && canManage) {
        return (
          item.requestedBy?.departmentId === departmentId ||
          item.recipientDeptId === departmentId
        );
      }
      return true;
    });
  }, [rawList, departmentId, canManage]);

  // Statistics for status filter pills
  const stats = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    supplyRequests.forEach((item) => {
      if (item.status === 'PENDING') pending++;
      else if (item.status === 'APPROVED') approved++;
      else if (item.status === 'REJECTED') rejected++;
    });
    return { total: supplyRequests.length, pending, approved, rejected };
  }, [supplyRequests]);

  // Filtered requests by status and search keyword
  const filteredList = useMemo(() => {
    return supplyRequests.filter((item) => {
      if (selectedStatus !== 'ALL' && item.status !== selectedStatus) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesProduct = String(item.entityName || item.entityTitle || '').toLowerCase().includes(q);
        const matchesReason = String(item.reason || '').toLowerCase().includes(q);
        const matchesSender = String(item.requestedBy?.fullName || item.requestedBy?.username || '').toLowerCase().includes(q);
        const matchesComment = String(item.reviewComment || item.rejectionReason || '').toLowerCase().includes(q);
        return matchesProduct || matchesReason || matchesSender || matchesComment;
      }
      return true;
    });
  }, [supplyRequests, selectedStatus, search]);

  useEffect(() => {
    setPage(1);
  }, [selectedStatus, search]);

  const totalPages = Math.ceil(filteredList.length / limit) || 1;

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [totalPages, page]);

  const paginatedList = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredList.slice(start, start + limit);
  }, [filteredList, page, limit]);

  const handleConfirmApproveSupply = async (comment: string) => {
    if (!approvingSupplyItem) return;
    setActionLoading(approvingSupplyItem.id);
    try {
      await requestsApi.approve(approvingSupplyItem.id, { reviewComment: comment });
      toast.success(t('supplyRequests.sendSuccess') || "Talabnoma tasdiqlandi!");
      setApprovingSupplyItem(null);
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
      toast.success(t('requests.rejectSuccess') || "Talabnoma rad etildi!");
      setRejectingId(null);
      refetch();
    } catch (error: any) {
      toast.error(error?.message || t('common.error'));
    }
  };

  const columns = [
    {
      key: 'product',
      title: t('supplyRequests.colProduct'),
      className: 'min-w-[200px]',
      render: (_: any, row: any) => (
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <Package className="w-4 h-4 text-teal-600 shrink-0" />
            <span className="font-bold text-gray-900 dark:text-gray-100 text-xs sm:text-sm">
              {row.entityName || row.entityTitle || t('supplyRequests.productLabel')}
            </span>
          </div>
          <span className="text-2xs text-gray-500 font-mono pl-5.5">
            {t('supplyRequests.colSender')}: {row.requestedBy?.fullName || '—'}
          </span>
        </div>
      ),
    },
    {
      key: 'reason',
      title: t('supplyRequests.colQtyReason'),
      className: 'min-w-[240px] max-w-md',
      render: (_: any, row: any) => {
        let cleanText = (row.reason || '').trim();
        cleanText = cleanText
          .replace(/^\[TALABNOMA\]\s*/i, '')
          .replace(/^\[MAHSULOT SO'ROVI\]\s*/i, '')
          .trim();

        return (
          <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-normal break-words line-clamp-3">
            {cleanText || '—'}
          </p>
        );
      },
    },
    {
      key: 'createdAt',
      title: t('supplyRequests.colSentDate'),
      className: 'min-w-[130px]',
      render: (_: any, row: any) => (
        <span className="text-xs text-gray-500 font-mono">
          {formatDate(row.createdAt)}
        </span>
      ),
    },
    {
      key: 'status',
      title: t('supplyRequests.colStatus'),
      className: 'min-w-[120px]',
      render: (_: any, row: any) => {
        if (row.status === 'APPROVED') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{t('supplyRequests.statusApproved')}</span>
            </span>
          );
        }
        if (row.status === 'REJECTED') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300">
              <XCircle className="w-3.5 h-3.5" />
              <span>{t('supplyRequests.statusRejected')}</span>
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300">
            <Clock className="w-3.5 h-3.5 animate-pulse" />
            <span>{t('supplyRequests.statusPending')}</span>
          </span>
        );
      },
    },
    {
      key: 'reviewComment',
      title: t('supplyRequests.colWarehouseComment'),
      className: 'min-w-[220px] max-w-sm',
      render: (_: any, row: any) => {
        const comment = row.reviewComment || row.rejectionReason;
        if (!comment) {
          return (
            <span className="text-xs text-gray-400 italic">
              {row.status === 'PENDING' ? t('supplyRequests.waitingReview') : '—'}
            </span>
          );
        }

        const isApproved = row.status === 'APPROVED';
        return (
          <div
            className={`p-2 rounded-xl text-xs space-y-0.5 border ${
              isApproved
                ? 'bg-emerald-50/80 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800/60'
                : 'bg-rose-50/80 text-rose-900 border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800/60'
            }`}
          >
            <div className="flex items-center gap-1 font-bold text-2xs uppercase tracking-wider">
              <MessageSquare className="w-3 h-3" />
              <span>{row.reviewedBy?.fullName || 'Omborchi'} izohi:</span>
            </div>
            <p className="italic font-medium leading-relaxed">{comment}</p>
          </div>
        );
      },
    },
    ...(canManage
      ? [
          {
            key: 'actions',
            title: t('requests.colActions'),
            className: 'min-w-[140px]',
            render: (_: any, row: any) => {
              if (row.status !== 'PENDING') {
                return (
                  <span className="text-xs text-gray-400 font-medium italic">
                    {t('requests.reviewed')}
                  </span>
                );
              }
              return (
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border-emerald-500/30 cursor-pointer"
                    onClick={() => setApprovingSupplyItem(row)}
                    disabled={Boolean(actionLoading)}
                  >
                    <Check className="w-3.5 h-3.5 mr-1" />
                    {t('requests.accept')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-500/30 cursor-pointer"
                    onClick={() => setRejectingId(row.id)}
                    disabled={Boolean(actionLoading)}
                  >
                    <X className="w-3.5 h-3.5 mr-1" />
                    {t('requests.reject')}
                  </Button>
                </div>
              );
            },
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-teal-500/10 via-emerald-500/5 to-transparent border border-gray-200/90 dark:border-white/10">
        <div>
          <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-teal-600" />
            {t('supplyRequests.deptSupplyTitle')}
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {t('supplyRequests.deptSupplyDesc')}
          </p>
        </div>

        {canSubmit && (
          <Button
            onClick={() => setSupplyModalOpen(true)}
            className="bg-teal-600 hover:bg-teal-700 text-white font-bold flex items-center gap-1.5 shadow-2xs shrink-0 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            {t('supplyRequests.newSupplyBtn')}
          </Button>
        )}
        {!canManage && !isLeader && (
          <div className="text-2xs text-gray-400 italic px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
            ℹ️ {t('supplyRequests.onlyLeaderCanSubmit')}
          </div>
        )}
      </div>

      {/* Filters & Search */}
      <Card className="p-3.5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setSelectedStatus('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                selectedStatus === 'ALL'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {t('requests.all')} ({stats.total})
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus('PENDING')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                selectedStatus === 'PENDING'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {t('requests.pendingBadge')} ({stats.pending})
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus('APPROVED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                selectedStatus === 'APPROVED'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {t('requests.approvedBadge')} ({stats.approved})
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus('REJECTED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                selectedStatus === 'REJECTED'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {t('requests.rejectedBadge')} ({stats.rejected})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={t('requests.searchPlaceholder') || "Qidirish..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>
      </Card>

      {/* Requests Table */}
      <Card>
        <CardContent className="p-0">
          <Table
            columns={columns}
            data={paginatedList}
            loading={isLoading}
            rowKey={(row: any) => String(row.id || Math.random())}
            emptyTitle={t('supplyRequests.emptyTitle')}
          />
          {filteredList.length > limit && (
            <div className="px-4 pb-3">
              <Pagination
                page={page}
                totalPages={totalPages}
                total={filteredList.length}
                limit={limit}
                onPageChange={setPage}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Supply Request Modal */}
      <DepartmentSupplyRequestModal
        open={supplyModalOpen}
        onClose={() => setSupplyModalOpen(false)}
        departmentName={departmentName}
        onSuccess={() => refetch()}
      />

      {/* Approve Supply Modal */}
      {approvingSupplyItem && (
        <ApproveSupplyModal
          open={Boolean(approvingSupplyItem)}
          onClose={() => setApprovingSupplyItem(null)}
          onConfirm={handleConfirmApproveSupply}
          productName={approvingSupplyItem.entityTitle || approvingSupplyItem.entityName || "Mahsulot"}
          requesterName={approvingSupplyItem.requestedBy?.fullName || approvingSupplyItem.requestedBy?.username}
          isLoading={Boolean(actionLoading)}
        />
      )}

      {/* Reject Modal */}
      {rejectingId && (
        <RejectReasonModal
          open={Boolean(rejectingId)}
          onClose={() => setRejectingId(null)}
          onConfirm={handleConfirmReject}
          title={t('supplyRequests.rejectSupplyTitle')}
          quickOptions={[t('supplyRequests.rejectReason1')]}
        />
      )}
    </div>
  );
}
