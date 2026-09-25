import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Check, X, Search, Clock, CheckCircle2, XCircle, FileSpreadsheet, FileText } from 'lucide-react';
import { Card, Button, Table, PageHeader, Pagination, type Column } from '../../components/ui';
import RejectReasonModal from '../../components/modals/reject-reason-modal';
import ApproveSupplyModal from '../../components/modals/approve-supply-modal';
import RequestsReportModal from '../../components/documents/requests-report-modal';
import { requestsApi, operationsApi, departmentsApi } from '../../api';
import { useAuthStore } from '../../store/auth.store';
import { useTranslation } from '../../hooks/useTranslation';
import { useDebounce } from '../../hooks/useDebounce';
import { formatDate } from '../../lib/utils';
import { exportToStyledExcel } from '../../lib/export';
import type { RequestItem, RequestStatus } from '../../types';

export default function RequestsPage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [selectedStatus, setSelectedStatus] = useState<RequestStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const limit = 15;
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 250);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [approvingSupplyItem, setApprovingSupplyItem] = useState<RequestItem | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const canManage =
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'VAZIRLIK_OMBORCHI' ||
    user?.role === 'ORG_ADMIN' ||
    user?.role === 'ORG_OMBORCHI';

  const canViewAll = canManage || user?.role === 'KADR';

  const isMinistry =
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'VAZIRLIK_OMBORCHI' ||
    user?.organization?.type === 'MINISTRY' ||
    !user?.organizationId;

  const userDeptId = (user as any)?.departmentId || (user as any)?.department?.id;
  const { data: departmentData } = useQuery({
    queryKey: ['requests-dept-detail', userDeptId],
    queryFn: () => departmentsApi.getOne(userDeptId!),
    enabled: !!userDeptId,
  });

  const isDeptLeader =
    departmentData?.leaderId === user?.id ||
    (departmentData?.leader as any)?.id === user?.id;

  // Fetch requests: Admins/Moderators/Leaders fetch all, regular users fetch their own
  const { data: requestsData, isLoading, refetch } = useQuery({
    queryKey: ['requests', selectedStatus, canViewAll ? 'all' : 'my'],
    queryFn: () =>
      canViewAll
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
        const matchesRecipient = String(item.recipientName || '').toLowerCase().includes(q);
        return matchesEntity || matchesReason || matchesRejection || matchesRequester || matchesRecipient;
      }

      return true;
    });
  }, [rawListAll, selectedStatus, debouncedSearch]);

  useEffect(() => {
    setPage(1);
  }, [selectedStatus, debouncedSearch]);

  const totalPages = Math.ceil(filteredList.length / limit) || 1;
  const paginatedList = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredList.slice(start, start + limit);
  }, [filteredList, page, limit]);

  const handleApprove = async (id: string, isAssignment?: boolean) => {
    if (isAssignment) {
      setActionLoading(id);
      try {
        await operationsApi.acceptAssignment(id);
        toast.success(t('requests.toastAssetAccepted'));
        refetch();
      } catch (error: any) {
        toast.error(error?.message || t('common.error'));
      } finally {
        setActionLoading(null);
      }
      return;
    }

    const target = rawListAll.find((x) => x.id === id);
    const isSupply =
      target?.requestType === 'SUPPLY' ||
      (target as any)?.isSupply ||
      String(target?.reason || '').includes('[TALABNOMA]');

    if (isSupply) {
      setApprovingSupplyItem(target || null);
      return;
    }

    setActionLoading(id);
    try {
      const normReason = String(target?.reason || '').toLowerCase().replace(/['ʼ’`ʻ]/g, '');
      const isRepair =
        target?.requestType === 'REPAIR' ||
        normReason.includes('tamirlash') ||
        normReason.includes('servis') ||
        normReason.includes('remont') ||
        normReason.includes('nosoz');
      const isReturn = target?.requestType === 'RETURN' || normReason.includes('qaytarish');

      await requestsApi.approve(id);

      if (isRepair) {
        toast.success(t('requests.toastRepairApproved'));
      } else if (isReturn) {
        toast.success(t('requests.toastReturnApproved'));
      } else {
        toast.success(t('requests.approveSuccess'));
      }
      refetch();
    } catch (error: any) {
      toast.error(error?.message || t('common.error'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmApproveSupply = async (comment: string) => {
    if (!approvingSupplyItem) return;
    setActionLoading(approvingSupplyItem.id);
    try {
      await requestsApi.approve(approvingSupplyItem.id, { reviewComment: comment });
      toast.success("Talabnoma tasdiqlandi va bo'lim boshlig'iga xabar yuborildi!");
      setApprovingSupplyItem(null);
      refetch();
    } catch (error: any) {
      toast.error(error?.message || t('common.error'));
    } finally {
      setActionLoading(null);
    }
  };

  const rejectingItem = useMemo(() => {
    return rawListAll.find((x) => x.id === rejectingId) || null;
  }, [rawListAll, rejectingId]);

  const isRejectingSupply = Boolean(
    rejectingItem &&
      (rejectingItem.requestType === 'SUPPLY' ||
        (rejectingItem as any).isSupply ||
        String(rejectingItem.reason || '').includes('[TALABNOMA]'))
  );

  const handleConfirmReject = async (rejectionReason: string) => {
    if (!rejectingId) return;
    try {
      const targetItem = rawListAll.find((x) => x.id === rejectingId);
      if (targetItem?.requestType === 'ASSIGNMENT') {
        await operationsApi.rejectAssignment(rejectingId, { reason: rejectionReason });
      } else {
        await requestsApi.reject(rejectingId, { rejectionReason, reviewComment: rejectionReason });
      }
      toast.success(t('requests.rejectSuccess'));
      setRejectingId(null);
      refetch();
    } catch (error: any) {
      toast.error(error?.message || t('common.error'));
    }
  };

  const handleExportExcel = async () => {
    try {
      setExportLoading(true);
      const exportData = filteredList.length > 0 ? filteredList : rawListAll;
      if (exportData.length === 0) {
        toast.error(t('requests.emptyTitle') || "Eksport qilish uchun so'rovlar mavjud emas");
        return;
      }

      const getRequestTypeLabel = (item: RequestItem) => {
        const normReason = String(item.reason || '').toLowerCase().replace(/['ʼ’`ʻ]/g, '');
        if (item.requestType === 'ASSIGNMENT') return 'Biriktirish';
        if (
          item.requestType === 'SUPPLY' ||
          (item as any).isSupply ||
          String(item.reason || '').includes('[TALABNOMA]')
        ) {
          return "Moddiy ta'minot (Talabnoma)";
        }
        if (item.requestType === 'REPAIR' || normReason.includes('tamirlash') || normReason.includes('servis')) return "Ta'mirlash";
        if (item.requestType === 'RETURN' || normReason.includes('qaytarish')) return 'Qaytarish';
        return "Hisobdan chiqarish";
      };

      const getStatusText = (status: string) => {
        if (status === 'APPROVED') return 'Tasdiqlangan';
        if (status === 'REJECTED') return 'Rad etilgan';
        return 'Kutilmoqda';
      };

      const headers = [
        '№',
        'Tashkilot',
        "So'rov turi",
        'Obyekt / Jihoz',
        'Yuboruvchi (Tashabbuskor)',
        'Qabul qiluvchi / Bo\'lim',
        'Yuborilgan sana',
        'Holati',
        'Ko\'rib chiquvchi',
        'Ko\'rib chiqilgan sana',
        'Sabab / Izoh',
      ];

      const rows = exportData.map((row, idx) => {
        const org = row.organization?.name || user?.organization?.name || "Qurilish vazirligi";
        const entity =
          row.entityTitle ||
          row.entityName ||
          (row.requestType === 'ASSIGNMENT' ? row.recipientName || 'Jihoz' : row.entityType);
        const reason = row.reason || '—';
        const comment = row.reviewComment || row.rejectionReason;
        const fullReason = comment ? `${reason} (Izoh: ${comment})` : reason;

        return [
          idx + 1,
          org,
          getRequestTypeLabel(row),
          entity,
          row.requestedBy?.fullName || row.requestedBy?.username || '—',
          row.recipientName || '—',
          formatDate(row.createdAt),
          getStatusText(row.status),
          row.reviewedBy?.fullName || '—',
          row.reviewedAt ? formatDate(row.reviewedAt) : '—',
          fullReason,
        ];
      });

      const todayStr = new Date().toLocaleDateString('uz-UZ', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      const todayFullStr = new Date().toLocaleString('uz-UZ', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const orgName =
        user?.organization?.name ||
        "O'ZBEKISTON RESPUBLIKASI QURILISH VA UY-JOY KOMMUNAL XO'JALIGI VAZIRLIGI";

      await exportToStyledExcel({
        filename: `sorovlar_tarixi_${new Date().toISOString().slice(0, 10)}`,
        sheetName: "So'rovlar Tarixi",
        titleBlock: {
          organizationName: orgName,
          title: "MODDIY AKTIVLAR HARAKATI VA SO'ROVLAR JURNALI (HISOBOTI)",
          dateText: `Shakllantirildi: ${todayFullStr}`,
          responsibleText: `Mas'ul: ${user?.fullName || user?.username || 'Mas\'ul xodim'}`,
        },
        headers,
        rows,
        colWidths: [7, 34, 22, 34, 28, 28, 18, 18, 26, 18, 52],
        centerColIndexes: [0, 2, 6, 7, 9],
        statusColIndex: 7,
        minRowHeight: 28,
        signatures: {
          creatorName: user?.fullName || user?.username || 'Mas\'ul xodim',
          approverTitle: "Mas'ul rahbar",
          dateStr: todayStr,
        },
      });

      toast.success("Excel hisoboti muvaffaqiyatli yuklab olindi!");
    } catch (err: any) {
      console.error("Excel eksport xatoligi:", err);
      toast.error(t('common.error') || "Eksportda xatolik yuz berdi");
    } finally {
      setExportLoading(false);
    }
  };

  const getStatusBadge = (status: RequestStatus) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5" />
            {t('requests.pendingBadge')}
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {t('requests.approvedBadge')}
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" />
            {t('requests.rejectedBadge')}
          </span>
        );
      default:
        return null;
    }
  };

  const getEntityTypeLabel = (type: string) => {
    switch (type) {
      case 'ASSET':
        return t('requests.entityAsset');
      case 'PRODUCT':
        return t('requests.entityProduct');
      case 'USER':
        return t('requests.entityUser');
      case 'DEPARTMENT':
        return t('requests.entityDept');
      default:
        return type;
    }
  };

  const columns: Column<RequestItem>[] = [
    {
      key: 'entity',
      title: t('requests.colEntity'),
      render: (_: any, row: RequestItem) => {
        const normReason = String(row.reason || '').toLowerCase().replace(/['ʼ’`ʻ]/g, '');
        const isSupply =
          row.requestType === 'SUPPLY' ||
          (row as any).isSupply ||
          String(row.reason || '').includes('[TALABNOMA]');
        const isRepairedComplete =
          String(row.reason || '').includes("[TA'MIRLANDI]") ||
          normReason.includes('tamirlandi') ||
          normReason.includes('tuzatildi');
        const isRepair =
          row.requestType === 'REPAIR' ||
          isRepairedComplete ||
          normReason.includes('tamir') ||
          normReason.includes('servis') ||
          normReason.includes('remont') ||
          normReason.includes('tuzat') ||
          normReason.includes('nosoz');
        const isReturn = row.requestType === 'RETURN' || normReason.includes('qaytarish');

        return (
          <div>
            <div className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1.5 flex-wrap">
              <span>{row.entityName || row.entityTitle || `ID: ${row.entityId.slice(0, 8)}...`}</span>
              {row.requestType === 'ASSIGNMENT' ? (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  {t('requests.assignmentBadge')}
                </span>
              ) : isSupply ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-500/20">
                  📋 Talabnoma (Moddiy ta'minot)
                </span>
              ) : isRepairedComplete ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-500/20">
                  🛠️ {t('requests.typeRepaired')}
                </span>
              ) : isRepair ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                  🛠️ {t('requests.typeRepair')}
                </span>
              ) : isReturn ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-500/20">
                  📦 {t('requests.typeReturn')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
                  🗑️ {t('requests.typeDeletion')}
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {row.requestType === 'ASSIGNMENT'
                ? row.recipientName || t('requests.assignmentDefault')
                : isSupply
                ? 'Mahsulot talabnomasi'
                : getEntityTypeLabel(row.entityType)}
            </div>
          </div>
        );
      },
    },
    {
      key: 'reason',
      title: t('requests.colReason'),
      render: (_: any, row: RequestItem) => (
        <div className="max-w-xs text-sm text-slate-700 dark:text-slate-300">
          <p className="line-clamp-2">{row.reason || '—'}</p>
        </div>
      ),
    },
    {
      key: 'requestedBy',
      title: t('requests.colSender'),
      render: (_: any, row: RequestItem) => (
        <div>
          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
            {row.requestedBy?.fullName || row.requestedBy?.username || t('requests.unknown')}
          </div>
          <div className="text-xs text-slate-500">
            {formatDate(row.createdAt)}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      title: t('requests.colStatus'),
      render: (_: any, row: RequestItem) => getStatusBadge(row.status),
    },
    {
      key: 'reviewComment',
      title: t('requests.colComment'),
      render: (_: any, row: RequestItem) => {
        const comment = row.reviewComment || row.rejectionReason;
        if (!comment) return <span className="text-xs text-slate-400">—</span>;
        return (
          <div className="text-xs text-slate-600 dark:text-slate-400 max-w-xs">
            <span className="font-medium">{row.reviewedBy?.fullName || t('requests.responsible')}: </span>
            {comment}
          </div>
        );
      },
    },
    {
      key: 'actions',
      title: t('requests.colActions'),
      render: (_: any, row: RequestItem) => {
        if (row.status !== 'PENDING') {
          return <span className="text-xs text-slate-400 font-medium">{t('requests.reviewed')}</span>;
        }

        const isLoadingThis = actionLoading === row.id;

        // A) If this is an ASSIGNMENT:
        if (row.requestType === 'ASSIGNMENT') {
          const isUserRecipient = Boolean(row.recipientUserId && row.recipientUserId === user?.id);
          const isDeptRecipient = Boolean(row.recipientDeptId && userDeptId === row.recipientDeptId && isDeptLeader);
          const isRecipient = isUserRecipient || isDeptRecipient;

          // Only the recipient sees [Qabul qilish] and [Rad etish]
          if (isRecipient) {
            return (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-2.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border-emerald-500/30 cursor-pointer"
                  onClick={() => handleApprove(row.id, true)}
                  disabled={Boolean(actionLoading)}
                >
                  {isLoadingThis ? (
                    <span className="text-xs">{t('common.loading')}</span>
                  ) : (
                    <span className="flex items-center">
                      <Check className="w-3.5 h-3.5 mr-1" />
                      {t('requests.accept')}
                    </span>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-2.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-500/30 cursor-pointer"
                  onClick={() => setRejectingId(row.id)}
                  disabled={Boolean(actionLoading)}
                >
                  <X className="w-3.5 h-3.5 mr-1" />
                  {t('requests.reject')}
                </Button>
              </div>
            );
          }

          // Assigner / Admin / Super Admin who gave the asset:
          // NEVER sees Qabul/Rad buttons! Only shows waiting indicator
          return (
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium italic">
              {row.recipientDeptId ? t('requests.waitingDeptConfirm') : t('requests.waitingUserConfirm')}
            </span>
          );
        }

        // B) Standard Deletion / Return Request:
        if (row.requestedById === user?.id) {
          return (
            <span className="text-xs text-amber-600 dark:text-amber-400 italic">
              {t('requests.waitingConfirm')}
            </span>
          );
        }

        const isSupply =
          row.requestType === 'SUPPLY' ||
          (row as any).isSupply ||
          String(row.reason || '').includes('[TALABNOMA]');

        const canUserApproveThis =
          canManage &&
          (isMinistry ||
            (row.entityType === 'ASSET' && (!row.organizationId || row.organizationId === user?.organizationId)) ||
            (isSupply && (!row.organizationId || row.organizationId === user?.organizationId)));

        if (canUserApproveThis) {
          return (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-2.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border-emerald-500/30 cursor-pointer"
                onClick={() => handleApprove(row.id, false)}
                disabled={Boolean(actionLoading)}
              >
                {isLoadingThis ? (
                  <span className="text-xs">{t('common.loading')}</span>
                ) : (
                  <span className="flex items-center">
                    <Check className="w-3.5 h-3.5 mr-1" />
                    {t('requests.accept')}
                  </span>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-2.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-500/30 cursor-pointer"
                onClick={() => setRejectingId(row.id)}
                disabled={Boolean(actionLoading)}
              >
                <X className="w-3.5 h-3.5 mr-1" />
                {t('requests.reject')}
              </Button>
            </div>
          );
        }

        if (canManage && !isMinistry) {
          return (
            <span className="text-xs text-slate-400 italic">
              {t('requests.waitingMinistryConfirm')}
            </span>
          );
        }

        return <span className="text-xs text-slate-400">—</span>;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('requests.title')}
        subtitle={t('requests.subtitle')}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-emerald-600 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 cursor-pointer"
              onClick={handleExportExcel}
              loading={exportLoading}
              disabled={exportLoading}
              icon={<FileSpreadsheet className="w-4 h-4 text-emerald-600" />}
            >
              Excel (.xlsx)
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 cursor-pointer"
              onClick={() => setPdfModalOpen(true)}
              icon={<FileText className="w-4 h-4 text-blue-600" />}
            >
              PDF / Chop etish
            </Button>
          </div>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="p-4 bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500 dark:text-slate-400">{t('requests.totalRequests')}</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {stats.total}
          </div>
        </Card>
        <Card className="p-4 bg-amber-500/5 border-amber-500/20">
          <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">{t('requests.pending')}</div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            {stats.pending}
          </div>
        </Card>
        <Card className="p-4 bg-emerald-500/5 border-emerald-500/20">
          <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{t('requests.approved')}</div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {stats.approved}
          </div>
        </Card>
        <Card className="p-4 bg-rose-500/5 border-rose-500/20">
          <div className="text-xs text-rose-600 dark:text-rose-400 font-medium">{t('requests.rejected')}</div>
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
              {t('requests.all')} ({stats.total})
            </button>
            <button
              onClick={() => setSelectedStatus('PENDING')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedStatus === 'PENDING'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {t('requests.pendingBadge')} ({stats.pending})
            </button>
            <button
              onClick={() => setSelectedStatus('APPROVED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedStatus === 'APPROVED'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {t('requests.approvedBadge')} ({stats.approved})
            </button>
            <button
              onClick={() => setSelectedStatus('REJECTED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedStatus === 'REJECTED'
                  ? 'bg-rose-600 text-white shadow-sm'
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
              placeholder={t('requests.searchPlaceholder')}
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
          data={paginatedList}
          columns={columns}
          loading={isLoading}
          rowKey={(item: RequestItem) => item.id}
          emptyTitle={t('requests.emptyTitle')}
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
      </Card>

      {/* Reject Modal */}
      {rejectingId && (
        <RejectReasonModal
          open={Boolean(rejectingId)}
          onClose={() => setRejectingId(null)}
          onConfirm={handleConfirmReject}
          title={isRejectingSupply ? t('supplyRequests.rejectSupplyTitle') : undefined}
          itemTitle={rejectingItem?.entityTitle || rejectingItem?.entityName}
          initialReason={
            isRejectingSupply
              ? t('supplyRequests.rejectReason1')
              : undefined
          }
          quickOptions={
            isRejectingSupply
              ? [
                  t('supplyRequests.rejectReason1'),
                  t('supplyRequests.rejectReason2'),
                  t('supplyRequests.rejectReason3'),
                ]
              : undefined
          }
        />
      )}

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

      {/* Requests History PDF & Print Report Modal */}
      <RequestsReportModal
        open={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        items={filteredList.length > 0 ? filteredList : rawListAll}
        currentUserName={user?.fullName || user?.username}
        organizationName={user?.organization?.name}
      />
    </div>
  );
}
