import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import Card, { CardContent } from '../../../components/ui/card';
import Table from '../../../components/ui/table';
import CopyableInventoryNumber from '../../../components/ui/copyable-inventory-number';
import RejectReasonModal from '../../../components/modals/reject-reason-modal';
import { operationsApi, requestsApi } from '../../../api';
import { formatDate, invalidateAppQueries } from '../../../lib/utils';
import { useTranslation } from '../../../hooks/useTranslation';
import { CheckCircle2, XCircle, Wrench, Clock } from 'lucide-react';
import ProfileRequestModal from '../../profile/components/profile-request-modal';

interface DepartmentAssetsTabProps {
  assetsData?: any;
  assignments?: any[];
  isLoading: boolean;
  isAdmin?: boolean;
  isLeader?: boolean;
  isDeptMember?: boolean;
  onReturnClick?: (item: any) => void;
}

export default function DepartmentAssetsTab({
  assetsData,
  assignments,
  isLoading,
  isAdmin,
  isLeader,
  isDeptMember,
  onReturnClick,
}: DepartmentAssetsTabProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [rejectingItem, setRejectingItem] = useState<any | null>(null);
  const [requestModalItem, setRequestModalItem] = useState<any | null>(null);

  const canAccept = !!(isLeader || isDeptMember);

  // Fetch pending requests to check if any asset is currently awaiting approval for return or repair
  const { data: requestsData } = useQuery({
    queryKey: ['my-deletion-requests'],
    queryFn: () => requestsApi.getMy(),
    refetchInterval: 8000,
  });

  const pendingRequestsMap = useMemo(() => {
    const map = new Map<string, { type: 'RETURN' | 'REPAIR'; reason: string }>();
    const list: any[] = Array.isArray(requestsData)
      ? requestsData
      : (requestsData as any)?.data || [];

    list.forEach((r: any) => {
      if (r.status === 'PENDING' && r.entityType === 'ASSET' && r.entityId) {
        const isRepair = r.requestType === 'REPAIR' || String(r.reason || '').toLowerCase().includes("ta'mirlash");
        map.set(r.entityId, {
          type: isRepair ? 'REPAIR' : 'RETURN',
          reason: r.reason,
        });
      }
    });
    return map;
  }, [requestsData]);

  const acceptMutation = useMutation({
    mutationFn: (assignmentId: string) => operationsApi.acceptAssignment(assignmentId),
    onSuccess: (res: any) => {
      toast.success(res?.message || t('profile.deptAcceptSuccess'));
      invalidateAppQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product-detail'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-assets'] });
      queryClient.invalidateQueries({ queryKey: ['department-detail'] });
      queryClient.invalidateQueries({ queryKey: ['profile-department-detail'] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['my-deletion-requests'] });
      queryClient.invalidateQueries({ queryKey: ['deletion-requests'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || t('common.error'));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ assignmentId, reason }: { assignmentId: string; reason: string }) =>
      operationsApi.rejectAssignment(assignmentId, { reason }),
    onSuccess: (res: any) => {
      toast.success(res?.message || t('profile.rejectSuccess'));
      invalidateAppQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product-detail'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-assets'] });
      queryClient.invalidateQueries({ queryKey: ['department-detail'] });
      queryClient.invalidateQueries({ queryKey: ['profile-department-detail'] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['my-deletion-requests'] });
      queryClient.invalidateQueries({ queryKey: ['deletion-requests'] });
      setRejectingItem(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || t('common.error'));
    },
  });

  const items = Array.isArray(assignments)
    ? assignments
    : (assetsData?.items && assetsData.items.length > 0)
    ? assetsData.items
    : Array.isArray(assetsData)
    ? assetsData
    : assetsData?.data || [];

  const columns = [
    {
      key: 'productName',
      title: t('departments.assetsTableHeaderName'),
      className: 'whitespace-normal break-words min-w-[200px] max-w-md',
      render: (_: any, row: any) => (
        <span className="font-semibold text-gray-900 dark:text-gray-100 whitespace-normal break-words">
          {row.asset?.product?.name || row.product?.name || row.name || t('operations.asset')}
        </span>
      ),
    },
    {
      key: 'inventoryNumber',
      title: t('profile.headers.invNumber'),
      render: (_: any, row: any) => {
        const inv = row.asset?.inventoryNumber || row.inventoryNumber || row.note;
        return <CopyableInventoryNumber value={inv} />;
      },
    },
    {
      key: 'status',
      title: t('common.status'),
      render: (_: any, row: any) => {
        const assetId = row.asset?.id || row.assetId || row.id;
        const pendingReq = assetId ? pendingRequestsMap.get(assetId) : undefined;
        const isBroken = row.asset?.status === 'BROKEN' || row.status === 'BROKEN';
        const status = row.status || (row.returnedAt ? 'RETURNED' : 'ACCEPTED');

        if (status === 'PENDING') {
          return (
            <span className="inline-flex items-center gap-1.5 text-2xs font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300">
              <span className="w-2 h-2 rounded-full bg-amber-500 shadow-2xs animate-pulse ring-2 ring-amber-400/40" />
              <span>{t('profile.waitingConfirm')}</span>
            </span>
          );
        }
        if (status === 'REJECTED') {
          return (
            <span className="inline-flex items-center gap-1.5 text-2xs font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300">
              <span className="w-2 h-2 rounded-full bg-rose-500 shadow-2xs ring-2 ring-rose-400/40" />
              <span>{t('requests.rejectedBadge')}</span>
            </span>
          );
        }
        if (pendingReq?.type === 'REPAIR') {
          return (
            <span className="inline-flex items-center gap-1.5 text-2xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300">
              <Clock className="w-3 h-3 animate-pulse text-amber-600" />
              <span>{t('departments.repairRequested')}</span>
            </span>
          );
        }
        if (pendingReq?.type === 'RETURN') {
          return (
            <span className="inline-flex items-center gap-1.5 text-2xs font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300">
              <Clock className="w-3 h-3 animate-pulse text-blue-600" />
              <span>{t('departments.returnRequested')}</span>
            </span>
          );
        }
        if (isBroken) {
          return (
            <span className="inline-flex items-center gap-1.5 text-2xs font-bold px-2.5 py-1 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-300">
              <Wrench className="w-3 h-3 text-orange-600" />
              <span>{t('departments.inRepair')}</span>
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1.5 text-2xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-2xs ring-2 ring-emerald-400/40" />
            <span>{t('profile.accepted')}</span>
          </span>
        );
      },
    },
    {
      key: 'assignedUser',
      title: t('departments.assetsTableHeaderHolder'),
      render: (_: any, row: any) => (
        <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
          {row.user?.fullName || row.performedBy?.fullName || row.assignedToUser?.fullName || t('dashboard.departments')}
        </span>
      ),
    },
    {
      key: 'documentNumber',
      title: t('common.documentNumber'),
      render: (_: any, row: any) => (
        <span className="font-mono text-xs text-slate-600 dark:text-slate-400">
          {row.documentNumber || row.asset?.serialNumber || row.serialNumber || '—'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      title: t('common.date'),
      render: (_: any, row: any) => (
        <span className="text-xs text-slate-500 font-mono">
          {row.assignedAt || row.createdAt || row.updatedAt ? formatDate(row.assignedAt || row.createdAt || row.updatedAt) : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      title: t('common.actions'),
      render: (_: any, row: any) => {
        const isPending = row.status === 'PENDING';
        const assetId = row.asset?.id || row.assetId || row.id;
        const pendingReq = assetId ? pendingRequestsMap.get(assetId) : undefined;
        const isBroken = row.asset?.status === 'BROKEN' || row.status === 'BROKEN';

        return (
          <div className="flex items-center gap-1.5 justify-end">
            {isPending && canAccept && (
              <>
                <button
                  type="button"
                  onClick={() => acceptMutation.mutate(row.id)}
                  disabled={acceptMutation.isPending}
                  className="px-2.5 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer transition-colors shadow-2xs flex items-center gap-1"
                  title={t('profile.accept')}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> {t('profile.accept')}
                </button>
                <button
                  type="button"
                  onClick={() => setRejectingItem(row)}
                  className="px-2.5 py-1 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg cursor-pointer transition-colors shadow-2xs flex items-center gap-1"
                  title={t('profile.reject')}
                >
                  <XCircle className="w-3.5 h-3.5" /> {t('profile.reject')}
                </button>
              </>
            )}
            {isPending && !canAccept && (
              <span className="text-2xs text-amber-600 dark:text-amber-400 font-medium italic">
                {t('profile.deptWaitingApproval')}
              </span>
            )}
            {!isPending && pendingReq && (
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 text-2xs font-bold rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60"
                title={t('departments.requestPendingTooltip')}
              >
                <Clock className="w-3 h-3 animate-pulse" />
                <span>{pendingReq.type === 'REPAIR' ? t('departments.repairRequested') : t('departments.returnRequested')}</span>
              </span>
            )}
            {!isPending && !pendingReq && isBroken && (
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 text-2xs font-bold rounded-lg bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800/60"
                title={t('departments.inRepair')}
              >
                <Wrench className="w-3 h-3" />
                <span>{t('departments.inRepair')}</span>
              </span>
            )}
            {!isPending && !pendingReq && !isBroken && isLeader && (
              <button
                type="button"
                onClick={() => setRequestModalItem(row)}
                className="px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-300 dark:hover:bg-amber-900/40 rounded-lg border border-amber-200 dark:border-amber-800 transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                title={t('departments.requestReturnRepair')}
              >
                <Wrench className="w-3.5 h-3.5 text-amber-600" />
                <span>{t('departments.requestReturnRepair')}</span>
              </button>
            )}
            {!isPending && isAdmin && onReturnClick && (
              <button
                onClick={() => onReturnClick(row)}
                className="px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-all cursor-pointer"
              >
                {t('userView.returnBtn')}
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <Table
            columns={columns}
            data={items}
            loading={isLoading}
            rowKey={(row: any) => String(row.id || row.assetId || row.inventoryNumber || Math.random())}
            emptyTitle={t('departments.noAssignedAssets')}
          />
        </CardContent>
      </Card>

      <RejectReasonModal
        open={!!rejectingItem}
        onClose={() => setRejectingItem(null)}
        onConfirm={async (reason) => {
          if (!rejectingItem) return;
          await rejectMutation.mutateAsync({
            assignmentId: rejectingItem.id,
            reason,
          });
        }}
        itemTitle={rejectingItem?.asset?.product?.name || rejectingItem?.product?.name || t('profile.asset')}
        isLoading={rejectMutation.isPending}
      />

      {requestModalItem && (
        <ProfileRequestModal
          assetItem={requestModalItem}
          onClose={() => setRequestModalItem(null)}
          onSubmitSuccess={(_assetId, requestType) => {
            const typeStr = requestType === 'RETURN' ? t('departments.returnRequested') : t('departments.repairRequested');
            toast.success(
              `"${requestModalItem?.asset?.product?.name || requestModalItem?.product?.name || t('profile.asset')}": ${typeStr}!`
            );
            invalidateAppQueries(queryClient);
            queryClient.invalidateQueries({ queryKey: ['requests'] });
            queryClient.invalidateQueries({ queryKey: ['my-deletion-requests'] });
            queryClient.invalidateQueries({ queryKey: ['profile-department-detail'] });
            queryClient.invalidateQueries({ queryKey: ['department-detail'] });
            setRequestModalItem(null);
          }}
        />
      )}
    </>
  );
}
