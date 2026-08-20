import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Check, X, Clock, Building2, Layers, CheckCircle2, XCircle, MessageSquare } from 'lucide-react';
import { Card, Button, Badge, Spinner, Table, PageHeader, type Column } from '../../components/ui';
import RejectReasonModal from '../../components/modals/reject-reason-modal';
import { deletionRequestsApi } from '../../api';
import { useAuthStore } from '../../store/auth.store';
import { useTranslation } from '../../hooks/useTranslation';
import type { DeletionRequest, DeletionStatus } from '../../types';

export default function DeletionRequestsPage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [selectedStatus, setSelectedStatus] = useState<DeletionStatus | 'ALL' | 'MUROJAAT'>('ALL');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const canManage =
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'VAZIRLIK_OMBORCHI' ||
    user?.role === 'ADMIN' ||
    user?.role === 'OMBORCHI' ||
    user?.role === 'ORG_OMBORCHI';

  const { data: requestsData, isLoading, refetch } = useQuery({
    queryKey: ['deletion-requests', selectedStatus],
    queryFn: () =>
      deletionRequestsApi.getAll({
        status: ['ALL', 'MUROJAAT'].includes(selectedStatus) ? undefined : (selectedStatus as DeletionStatus),
      }),
    refetchInterval: 5000,
  });

  const rawListAll: DeletionRequest[] = Array.isArray(requestsData)
    ? requestsData
    : Array.isArray((requestsData as any)?.data)
    ? (requestsData as any).data
    : [];

  const filteredList = rawListAll.filter((item) => {
    if (selectedStatus === 'MUROJAAT') {
      return item.reason?.startsWith('[BOT MUROJAAT]') || item.entityType === 'USER';
    }
    return true;
  });

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      await deletionRequestsApi.approve(id);
      toast.success(t('deletionRequests.approveSuccess'));
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
      toast.success(t('deletionRequests.rejectSuccess'));
      refetch();
    } catch (error: any) {
      toast.error(error?.message || t('common.error'));
      throw error;
    }
  };

  const getStatusBadge = (status: DeletionStatus) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/50">
            <Clock className="w-3.5 h-3.5" /> Kutilmoqda
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/50">
            <CheckCircle2 className="w-3.5 h-3.5" /> Tasdiqlangan
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300/50">
            <XCircle className="w-3.5 h-3.5" /> Rad etilgan
          </span>
        );
      default:
        return <Badge variant="gray">{status}</Badge>;
    }
  };

  const filterTabs = [
    { key: 'ALL' as const, label: "Barcha so'rovlar", icon: <Layers className="w-4 h-4" />, activeClass: "bg-teal-600 text-white shadow-xs" },
    { key: 'PENDING' as const, label: "Kutilmoqda", icon: <Clock className="w-4 h-4 text-amber-500" />, activeClass: "bg-amber-600 text-white shadow-xs" },
    { key: 'APPROVED' as const, label: "Tasdiqlangan", icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />, activeClass: "bg-emerald-600 text-white shadow-xs" },
    { key: 'REJECTED' as const, label: "Rad etilgan", icon: <XCircle className="w-4 h-4 text-rose-500" />, activeClass: "bg-rose-600 text-white shadow-xs" },
    { key: 'MUROJAAT' as const, label: "💬 Bot Murojaatlari", icon: <MessageSquare className="w-4 h-4 text-purple-500" />, activeClass: "bg-purple-600 text-white shadow-xs" },
  ];

  const columns: Column<DeletionRequest>[] = [
    {
      key: 'organization',
      title: t('deletionRequests.organization'),
      render: (_: any, row: DeletionRequest) => (
        <div className="flex items-center gap-2 font-medium text-gray-900 dark:text-gray-100">
          <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span>{row.organization?.name || 'Tashkilot'}</span>
        </div>
      ),
    },
    {
      key: 'entityType',
      title: "So'rov Turi va Nomi",
      render: (_: any, row: DeletionRequest) => {
        const isBotMurojaat = row.reason?.startsWith('[BOT MUROJAAT]');
        return (
          <div className="space-y-0.5">
            <span className={`inline-block font-extrabold text-[10px] px-2 py-0.5 rounded-md ${
              isBotMurojaat
                ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-300/40'
                : row.entityType === 'ASSET'
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                : row.entityType === 'PRODUCT'
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300'
                : 'bg-teal-100 text-teal-800 dark:bg-teal-950/50 dark:text-teal-300'
            }`}>
              {isBotMurojaat
                ? "💬 Bot Murojaati (Telegram)"
                : row.entityType === 'ASSET'
                ? "🛠️ Jihoz Qaytarish / Ta'mirlash"
                : row.entityType === 'USER'
                ? t('menu.users')
                : row.entityType === 'DEPARTMENT'
                ? t('menu.departments')
                : t('history.product')}
            </span>
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
              {row.entityName || row.entityTitle || row.requestedBy?.fullName || row.entityId}
            </p>
          </div>
        );
      },
    },
    {
      key: 'reason',
      title: "So'rov Izohi va Sababi",
      render: (_: any, row: DeletionRequest) => {
        const cleanReason = row.reason?.replace('[BOT MUROJAAT]', '').trim() || row.reason;
        return (
          <div className="max-w-xs space-y-1">
            <p className="text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-slate-800/60 p-2 rounded-lg border border-gray-200/50 dark:border-slate-700/50">
              {cleanReason}
            </p>
            {row.rejectionReason && (
              <p className="text-[11px] text-red-600 dark:text-red-400 font-medium">
                {t('deletionRequests.rejected')}: {row.rejectionReason}
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: 'requestedBy',
      title: "So'rov Yuboruvchi",
      render: (_: any, row: DeletionRequest) => (
        <div className="text-xs text-gray-600 dark:text-gray-400">
          <p className="font-bold text-gray-900 dark:text-gray-100">
            {row.requestedBy?.fullName || 'Xodim'}
          </p>
          <p className="text-[10px] text-gray-400 font-mono">
            {new Date(row.createdAt).toLocaleString('uz-UZ')}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      title: t('deletionRequests.status'),
      render: (_: any, row: DeletionRequest) => getStatusBadge(row.status),
    },
    {
      key: 'actions',
      title: t('common.actions'),
      render: (_: any, row: DeletionRequest) => {
        if (!canManage || row.status !== 'PENDING') return null;
        const isLoadingThis = actionLoading === row.id;
        return (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="primary"
              loading={isLoadingThis}
              onClick={() => handleApprove(row.id)}
              className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-2.5 py-1"
            >
              <Check className="w-3.5 h-3.5" />
              Tasdiqlash
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={isLoadingThis}
              onClick={() => setRejectingId(row.id)}
              className="flex items-center gap-1 text-xs px-2.5 py-1"
            >
              <X className="w-3.5 h-3.5" />
              {t('deletionRequests.rejected')}
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="So'rovlar va Murojaatlar Boshqaruvi"
        subtitle="Xodimlardan Telegram bot va tizim orqali kelgan murojaatlar, jihozlarni omborga qaytarish hamda resurslar bo'yicha so'rovlarni tahlil qilish"
      />

      <div className="p-3.5 bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-800/50 rounded-xl text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-bold text-purple-600 dark:text-purple-400">⚡ Real-time integratsiya:</span>
          <span>Telegram botdan yuborilgan har bir murojaat zudlik bilan ushbu veb-sahifaga va bildirishnomalarga kelib tushadi.</span>
        </div>
      </div>

      <Card className="p-2 rounded-2xl border-gray-200/90 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="flex items-center gap-2 overflow-x-auto p-1 relative">
          {filterTabs.map((tab) => {
            const isActive = selectedStatus === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setSelectedStatus(tab.key)}
                className={`relative flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl whitespace-nowrap select-none cursor-pointer border-none outline-none transition-colors duration-200 ${
                  isActive
                    ? 'text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100/70 dark:hover:bg-slate-800/60'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeFilterTabPill"
                    className={`absolute inset-0 rounded-xl ${tab.activeClass} shadow-xs`}
                    transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <span className={isActive ? 'text-white' : ''}>{tab.icon}</span>
                  <span>{tab.label}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : filteredList.length === 0 ? (
          <div className="p-12 text-center">
            <Clock className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {t('deletionRequests.emptyTitle')}
            </p>
          </div>
        ) : (
          <Table data={filteredList} columns={columns} />
        )}
      </Card>

      <RejectReasonModal
        open={!!rejectingId}
        onClose={() => setRejectingId(null)}
        onConfirm={handleConfirmReject}
      />
    </div>
  );
}
