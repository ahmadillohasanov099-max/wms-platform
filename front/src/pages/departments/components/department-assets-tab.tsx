import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import Card, { CardContent } from '../../../components/ui/card';
import Table from '../../../components/ui/table';
import CopyableInventoryNumber from '../../../components/ui/copyable-inventory-number';
import RejectReasonModal from '../../../components/modals/reject-reason-modal';
import { operationsApi } from '../../../api';
import { formatDate } from '../../../lib/utils';
import { useTranslation } from '../../../hooks/useTranslation';
import { CheckCircle2, XCircle } from 'lucide-react';

interface DepartmentAssetsTabProps {
  assetsData?: any;
  assignments?: any[];
  isLoading: boolean;
  isAdmin?: boolean;
  isLeader?: boolean;
  onReturnClick?: (item: any) => void;
}

export default function DepartmentAssetsTab({
  assetsData,
  assignments,
  isLoading,
  isAdmin,
  isLeader,
  onReturnClick,
}: DepartmentAssetsTabProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [rejectingItem, setRejectingItem] = useState<any | null>(null);

  const canManage = isAdmin || isLeader;

  const acceptMutation = useMutation({
    mutationFn: (assignmentId: string) => operationsApi.acceptAssignment(assignmentId),
    onSuccess: (res: any) => {
      toast.success(res?.message || "Bo'lim jihozi muvaffaqiyatli qabul qilindi!");
      queryClient.invalidateQueries({ queryKey: ['department-detail'] });
      queryClient.invalidateQueries({ queryKey: ['profile-department-detail'] });
      queryClient.invalidateQueries({ queryKey: ['deletion-requests'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || "Qabul qilishda xatolik yuz berdi");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ assignmentId, reason }: { assignmentId: string; reason: string }) =>
      operationsApi.rejectAssignment(assignmentId, { reason }),
    onSuccess: (res: any) => {
      toast.success(res?.message || "Jihoz rad etildi va omborga qaytarildi");
      queryClient.invalidateQueries({ queryKey: ['department-detail'] });
      queryClient.invalidateQueries({ queryKey: ['profile-department-detail'] });
      queryClient.invalidateQueries({ queryKey: ['deletion-requests'] });
      setRejectingItem(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || "Rad etishda xatolik yuz berdi");
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
      title: 'Holati',
      render: (_: any, row: any) => {
        const status = row.status || (row.returnedAt ? 'RETURNED' : 'ACCEPTED');
        if (status === 'PENDING') {
          return (
            <span className="inline-flex items-center gap-1.5 text-2xs font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300">
              <span className="w-2 h-2 rounded-full bg-amber-500 shadow-2xs animate-pulse ring-2 ring-amber-400/40" />
              <span>Kutilmoqda</span>
            </span>
          );
        }
        if (status === 'REJECTED') {
          return (
            <span className="inline-flex items-center gap-1.5 text-2xs font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300">
              <span className="w-2 h-2 rounded-full bg-rose-500 shadow-2xs ring-2 ring-rose-400/40" />
              <span>Rad etilgan</span>
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1.5 text-2xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-2xs ring-2 ring-emerald-400/40" />
            <span>Qabul qilingan</span>
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
        return (
          <div className="flex items-center gap-1.5 justify-end">
            {isPending && canManage && (
              <>
                <button
                  type="button"
                  onClick={() => acceptMutation.mutate(row.id)}
                  disabled={acceptMutation.isPending}
                  className="px-2 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer transition-colors shadow-2xs flex items-center gap-1"
                  title="Bo'lim nomidan jihozni qabul qilish"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Qabul
                </button>
                <button
                  type="button"
                  onClick={() => setRejectingItem(row)}
                  className="px-2 py-1 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg cursor-pointer transition-colors shadow-2xs flex items-center gap-1"
                  title="Bo'lim nomidan jihozni rad etish"
                >
                  <XCircle className="w-3.5 h-3.5" /> Rad
                </button>
              </>
            )}
            {isAdmin && onReturnClick && !isPending && (
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
        itemTitle={rejectingItem?.asset?.product?.name || rejectingItem?.product?.name || 'Jihoz'}
        isLoading={rejectMutation.isPending}
      />
    </>
  );
}

