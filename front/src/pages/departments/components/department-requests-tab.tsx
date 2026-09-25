import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { requestsApi } from '../../../api';
import Card, { CardContent } from '../../../components/ui/card';
import Table from '../../../components/ui/table';
import Button from '../../../components/ui/button';
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

  const canManage =
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'ORG_ADMIN' ||
    user?.role === 'VAZIRLIK_OMBORCHI' ||
    user?.role === 'ORG_OMBORCHI';

  const canSubmit = isLeader || canManage;

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
  const supplyRequests = rawList.filter((item) => {
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

        {canSubmit ? (
          <Button
            onClick={() => setSupplyModalOpen(true)}
            className="bg-teal-600 hover:bg-teal-700 text-white font-bold flex items-center gap-1.5 shadow-2xs shrink-0 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            {t('supplyRequests.newSupplyBtn')}
          </Button>
        ) : (
          <div className="text-2xs text-gray-400 italic px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
            ℹ️ {t('supplyRequests.onlyLeaderCanSubmit')}
          </div>
        )}
      </div>

      {/* Requests Table */}
      <Card>
        <CardContent className="p-0">
          <Table
            columns={columns}
            data={supplyRequests}
            loading={isLoading}
            rowKey={(row: any) => String(row.id || Math.random())}
            emptyTitle={t('supplyRequests.emptyTitle')}
          />
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
          initialReason={t('supplyRequests.rejectReason1')}
          quickOptions={[
            t('supplyRequests.rejectReason1'),
            t('supplyRequests.rejectReason2'),
            t('supplyRequests.rejectReason3'),
          ]}
        />
      )}
    </div>
  );
}
