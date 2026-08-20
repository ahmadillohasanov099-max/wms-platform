import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../../../api';
import { useAuthStore } from '../../../store/auth.store';
import { useTranslation } from '../../../hooks/useTranslation';
import { formatCurrency, formatDate, invalidateAppQueries, cn } from '../../../lib/utils';
import VerifyIdentityModal from '../../../components/shared/verify-identity-modal';
import toast from 'react-hot-toast';
import ModdiyJavobgarlikModal from '../../../components/documents/moddiy-javobgarlik-modal';
import {
  Package,
  Phone,
  Briefcase,
  History,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Building2,
  Layers,
  FileText,
} from 'lucide-react';
import Card, { CardContent } from '../../../components/ui/card';
import Button from '../../../components/ui/button';
import { RoleBadge, OperationTypeBadge } from '../../../components/ui/badge';
import CopyableInventoryNumber from '../../../components/ui/copyable-inventory-number';
import { PageLoader } from '../../../components/ui/spinner';

interface UserDetailSubViewProps {
  selectedUser: any;
  selectedUserId: string;
  isAdmin: boolean;
  handleReturnClick: (assetId: string) => void;
}

export default function UserDetailSubView({
  selectedUser,
  selectedUserId,
  isAdmin,
  handleReturnClick,
}: UserDetailSubViewProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user: loggedInUser } = useAuthStore();
  const isStaff = loggedInUser?.role === 'ADMIN' || loggedInUser?.role === 'OMBORCHI' || loggedInUser?.role === 'SUPER_ADMIN' || loggedInUser?.role === 'ORG_ADMIN';
  const passportVal = selectedUser?.passport || selectedUser?.passportSeries || '';
  const pinflVal = selectedUser?.pinfl || '';
  const addressVal = selectedUser?.address || '';

  const [tab, setTab] = useState<'assets' | 'tmz' | 'history'>('assets');
  const [bulkReturnModalOpen, setBulkReturnModalOpen] = useState(false);
  const [moddiyModalOpen, setModdiyModalOpen] = useState(false);
  const [moddiyContractData, setModdiyContractData] = useState<any>(null);

  const { data: assignmentsData, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['user-assignments', selectedUserId],
    queryFn: () => usersApi.getAssignments(selectedUserId),
    enabled: !!selectedUserId,
  });

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['user-history', selectedUserId],
    queryFn: () => usersApi.getHistory(selectedUserId),
    enabled: !!selectedUserId,
  });

  const assignments = assignmentsData ?? [];
  const historyList = historyData ?? [];

  const groupedAssignmentBatches = useMemo(() => {
    const groups: Record<string, {
      key: string;
      documentNumber?: string;
      assignedAt: string;
      items: any[];
      totalPrice: number;
    }> = {};

    assignments.forEach((item: any) => {
      let key = item.operationId || item.documentNumber;
      if (!key) {
        const dateStr = item.assignedAt || item.createdAt;
        const d = new Date(dateStr);
        key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}-${d.getHours()}-${d.getMinutes()}`;
      }

      if (!groups[key]) {
        groups[key] = {
          key,
          documentNumber: item.documentNumber || item.asset?.inventoryNumber || '1',
          assignedAt: item.assignedAt || item.createdAt,
          items: [],
          totalPrice: 0,
        };
      }

      groups[key].items.push(item);
      groups[key].totalPrice += Number(item.asset?.purchasePrice ?? item.asset?.product?.unitPrice ?? 0);
    });

    return Object.values(groups);
  }, [assignments]);

  const handleOpenBatchContract = (batch: any) => {
    const pass = selectedUser?.passport || selectedUser?.passportSeries || passportVal || '';
    const addr = selectedUser?.address || addressVal || '';

    setModdiyContractData({
      documentNumber: batch.documentNumber || `MJSH-2026-${batch.key?.slice(-4) || '001'}`,
      date: batch.assignedAt,
      fromUser: 'Алиматов Таир Наматуллаевич',
      toRecipient: selectedUser?.fullName,
      recipientPosition: selectedUser?.position,
      recipientDepartment: selectedUser?.department?.name,
      recipientPassport: pass,
      recipientAddress: addr,
      items: batch.items.map((b: any) => ({
        name: b.asset?.product?.name || b.product?.name || '—',
        inventoryNumber: b.asset?.inventoryNumber || '—',
        serialNumber: b.asset?.serialNumber || '',
      })),
    });
    setModdiyModalOpen(true);
  };

  const returnOperations = historyList.filter((op: any) => op.type === 'RETURN_FROM_USER');
  const lastReturnOp = returnOperations[0];

  // Filter TMZ material operations given to this user (strictly SARFLANADIGAN / no assetId)
  const tmzOperations = historyList.filter(
    (op: any) =>
      op.product?.productType === 'SARFLANADIGAN' ||
      (!op.assetId && !op.asset && op.product?.productType !== 'BERILADIGAN' && op.type === 'GIVE_TO_USER')
  );

  // Group TMZ operations by documentNumber
  const groupedTmzOperations: any[] = [];
  const mapTmzDoc = new Map<string, any>();
  for (const item of tmzOperations) {
    const docNum = item.documentNumber;
    if (docNum && docNum.startsWith('TLB-')) {
      if (mapTmzDoc.has(docNum)) {
        mapTmzDoc.get(docNum).groupItems.push(item);
      } else {
        const newGroup = { ...item, groupItems: [item] };
        mapTmzDoc.set(docNum, newGroup);
        groupedTmzOperations.push(newGroup);
      }
    } else {
      groupedTmzOperations.push({ ...item, groupItems: [item] });
    }
  }

  const totalAssetValue = assignments.reduce(
    (sum: number, a: any) => sum + Number(a.asset?.purchasePrice ?? 0),
    0
  );

  const totalReturnedValue = returnOperations.reduce((sum: number, op: any) => {
    const price = op.asset?.purchasePrice
      ? Number(op.asset.purchasePrice)
      : op.product?.inventory?.unitPrice
      ? Number(op.product.inventory.unitPrice) * op.quantity
      : 0;
    return sum + price;
  }, 0);

  const handleConfirmBulkReturn = async () => {
    try {
      const res = await usersApi.bulkReturn(selectedUserId);
      toast.success(res?.message || t('operations.returnFromUserSuccess'));
      invalidateAppQueries(queryClient);
    } catch (err: any) {
      toast.error(err?.message || err?.response?.data?.message || t('common.error'));
    } finally {
      setBulkReturnModalOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Profile Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-teal-600/10 via-teal-500/5 to-transparent border border-gray-200/90 dark:border-white/15 backdrop-blur-xl shadow-2xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-center text-lg font-bold shadow-sm flex-shrink-0 border border-slate-700/50">
              {selectedUser.fullName?.slice(0, 2).toUpperCase() || 'US'}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {selectedUser.fullName}
                </h3>
                <RoleBadge role={selectedUser.role} />
                <span
                  className={cn(
                    'px-2.5 py-0.5 rounded-md text-[11px] font-semibold border',
                    selectedUser.isActive
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                  )}
                >
                  {selectedUser.isActive ? t('users.active') : t('users.blocked')}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                <span className="font-medium text-slate-700 dark:text-slate-300">@{selectedUser.username}</span>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <span className="flex items-center gap-1 font-medium">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  {selectedUser.department?.name || t('userView.noDept')}
                </span>
                {passportVal && (
                  <>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <span className="flex items-center gap-1 font-mono font-medium text-slate-700 dark:text-slate-300">
                      <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                      {t('userView.passportLabel', { value: passportVal })}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl border border-gray-200/90 dark:border-white/15 rounded-2xl p-4 shadow-2xs flex items-center gap-3.5 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300">
          <div className="p-3 bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 rounded-xl border border-teal-200/50 dark:border-teal-800/40">
            <Briefcase className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {t('profile.position')}
            </p>
            <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 truncate">
              {selectedUser.position ?? '—'}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl border border-gray-200/90 dark:border-white/15 rounded-2xl p-4 shadow-2xs flex items-center gap-3.5 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300">
          <div className="p-3 bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 rounded-xl border border-teal-200/50 dark:border-teal-800/40">
            <Phone className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {t('profile.phone')}
            </p>
            <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 truncate">
              {selectedUser.phone ?? '—'}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl border border-gray-200/90 dark:border-white/15 rounded-2xl p-4 shadow-2xs flex items-center gap-3.5 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300">
          <div className="p-3 bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 rounded-xl border border-teal-200/50 dark:border-teal-800/40">
            <Phone className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {t('userView.internalPhone')}
            </p>
            <p className="text-sm font-bold font-mono text-teal-600 dark:text-teal-400 mt-0.5 truncate">
              {selectedUser.internalPhone ?? '—'}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl border border-gray-200/90 dark:border-white/15 rounded-2xl p-4 shadow-2xs flex items-center gap-3.5 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300">
          <div className="p-3 bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 rounded-xl border border-teal-200/50 dark:border-teal-800/40">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {t('users.department')}
            </p>
            <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 truncate">
              {selectedUser.department?.name ?? '—'}
            </p>
          </div>
        </div>

        {/* PASSPORT CARD */}
        <div className="bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl border border-gray-200/90 dark:border-white/15 rounded-2xl p-4 shadow-2xs flex items-center gap-3.5 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-200/50 dark:border-emerald-800/40">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {t('userView.passportSeriesNo')}
            </p>
            <p className="text-sm font-bold font-mono text-slate-900 dark:text-white mt-0.5 truncate">
              {passportVal || '—'}
            </p>
          </div>
        </div>

        {/* PINFL CARD */}
        <div className="bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl border border-gray-200/90 dark:border-white/15 rounded-2xl p-4 shadow-2xs flex items-center gap-3.5 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-200/50 dark:border-emerald-800/40">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {t('userView.pinfl')}
            </p>
            <p className="text-sm font-bold font-mono text-slate-900 dark:text-white mt-0.5 truncate">
              {pinflVal || '—'}
            </p>
          </div>
        </div>

        {/* ADDRESS CARD */}
        <div className="bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl border border-gray-200/90 dark:border-white/15 rounded-2xl p-4 shadow-2xs flex items-center gap-3.5 sm:col-span-2 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-200/50 dark:border-emerald-800/40">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {t('userView.address')}
            </p>
            <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 truncate">
              {addressVal || '—'}
            </p>
          </div>
        </div>
      </div>

      {}
      {!assignmentsLoading && (
        assignments.length > 0 ? (
          <div className="bg-rose-50/90 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-2xs">
                <AlertCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-bold text-rose-900 dark:text-rose-100">
                    {t('userView.activeAssetsTitle', { count: assignments.length })}
                  </h4>
                  <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-rose-200/80 dark:bg-rose-900/60 text-rose-900 dark:text-rose-100">
                    {formatCurrency(totalAssetValue)}
                  </span>
                </div>
                <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">
                  {t('userView.activeAssetsDesc')}
                </p>
              </div>
            </div>
            {isStaff && (
              <Button
                onClick={() => setBulkReturnModalOpen(true)}
                className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-xs whitespace-nowrap self-start sm:self-auto"
              >
                {t('userView.acceptToStock')}
              </Button>
            )}
          </div>
        ) : lastReturnOp ? (
          <div className="bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 shadow-2xs">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-2xs">
                <CheckCircle2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-100">
                    {t('userView.returnedTitle')}
                  </h4>
                  {totalReturnedValue > 0 && (
                    <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-200/80 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-100">
                      {t('userView.totalReturned', { value: formatCurrency(totalReturnedValue) })}
                    </span>
                  )}
                </div>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                  {t('userView.acceptedBy')}:{' '}
                  <span className="font-bold">
                    {lastReturnOp.performedBy?.fullName || t('roles.OMBORCHI')}
                  </span>{' '}
                  • {t('userView.date')}:{' '}
                  <span className="font-semibold">{formatDate(lastReturnOp.createdAt)}</span>{' '}
                  {lastReturnOp.documentNumber ? `• ${t('userView.docNo')} ${lastReturnOp.documentNumber}` : ''}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 sm:p-5 flex items-center gap-3.5 shadow-2xs">
            <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 flex items-center justify-center font-bold text-lg shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                {t('userView.noAssetsTitle')}
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {t('userView.noAssetsDesc')}
              </p>
            </div>
          </div>
        )
      )}

      {}
      <Card className="rounded-2xl shadow-2xs">
        <div className="flex border-b border-gray-200 dark:border-gray-800 px-5 pt-3 bg-gray-50/50 dark:bg-gray-800/20 flex-wrap gap-1">
          <button
            className={`px-4 py-3 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 ${
              tab === 'assets'
                ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
            onClick={() => setTab('assets')}
          >
            <Package className="w-4 h-4" />
            <span>{t('userView.assignedAssetsTab', { count: assignments.length })}</span>
          </button>

          <button
            className={`px-4 py-3 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 ${
              tab === 'tmz'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
            onClick={() => setTab('tmz')}
          >
            <Layers className="w-4 h-4 text-emerald-500" />
            <span>{t('userView.assignedTmzTab', { count: groupedTmzOperations.length })}</span>
          </button>

          <button
            className={`px-4 py-3 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 ${
              tab === 'history'
                ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
            onClick={() => setTab('history')}
          >
            <History className="w-4 h-4" />
            <span>{t('userView.historyTab', { count: historyList.length })}</span>
          </button>
        </div>

        <CardContent className="p-0">
          {tab === 'assets' ? (
            assignmentsLoading ? (
              <div className="p-8">
                <PageLoader />
              </div>
            ) : assignments.length === 0 ? (
              <div className="text-center text-sm text-gray-500 py-12">
                <ShieldCheck className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="font-semibold text-gray-700 dark:text-gray-300">
                  {t('userView.noAssetsAssigned')}
                </p>
                <p className="text-xs text-gray-400 mt-1">{t('userView.noAssetsAssignedDesc')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800 text-left bg-gray-50/70 dark:bg-gray-800/40">
                      <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        {t('userView.timeDocNo')}
                      </th>
                      <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                        {t('userView.assignedAssetsHeader', { count: assignments.length })}
                      </th>
                      <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        {t('userView.valueHeader')}
                      </th>
                      <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right whitespace-nowrap">
                        {t('common.actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
                    {groupedAssignmentBatches.map((batch: any) => (
                      <tr
                        key={batch.key}
                        className="hover:bg-teal-50/20 dark:hover:bg-teal-950/20 transition-colors"
                      >
                        {/* Date & Doc Number */}
                        <td className="px-4 py-3 text-xs align-middle whitespace-nowrap">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {formatDate(batch.assignedAt)}
                          </div>
                          {batch.documentNumber && (
                            <div className="text-2xs font-mono text-teal-700 dark:text-teal-400 font-semibold mt-0.5">
                              № {batch.documentNumber}
                            </div>
                          )}
                        </td>

                        {/* Items Horizontal Wrap Badges - Compact & Gap Free */}
                        <td className="px-4 py-3 align-middle">
                          <div className="flex flex-wrap items-center gap-1.5 max-w-2xl">
                            {batch.items.map((item: any, idx: number) => (
                              <div
                                key={item.id || idx}
                                className="inline-flex items-center gap-1.5 text-xs bg-slate-100/90 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                              >
                                <span className="font-semibold text-slate-900 dark:text-slate-100">
                                  {batch.items.length > 1 ? `${idx + 1}. ` : ''}{item.asset?.product?.name || '—'}
                                </span>
                                {item.asset?.inventoryNumber && (
                                  <CopyableInventoryNumber
                                    value={item.asset.inventoryNumber}
                                    size="2xs"
                                  />
                                )}

                                {isAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => handleReturnClick(item.asset?.id)}
                                    className="ml-0.5 text-2xs font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:underline cursor-pointer"
                                    title={`${item.asset?.inventoryNumber} - ${t('userView.returnToWarehouse')}`}
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>

                        {/* Price */}
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white font-mono text-xs align-middle whitespace-nowrap">
                          {formatCurrency(batch.totalPrice)}
                        </td>

                        {/* Contract Button */}
                        <td className="px-4 py-3 text-right align-middle whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleOpenBatchContract(batch)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-teal-700 dark:text-teal-300 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/60 dark:hover:bg-teal-900/60 rounded-xl transition-all border border-teal-200 dark:border-teal-800 cursor-pointer shadow-2xs active:scale-95"
                            title={t('userView.viewBatchContractTitle')}
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>{t('userView.contractBtn', { count: batch.items.length })}</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-teal-50/30 dark:bg-teal-950/20 font-bold border-t border-teal-100 dark:border-teal-900/50">
                      <td colSpan={2} className="px-4 py-3 text-right text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">
                        {t('profile.totalValue')}
                      </td>
                      <td colSpan={2} className="px-4 py-3 text-teal-600 dark:text-teal-400 text-sm font-extrabold font-mono">
                        {formatCurrency(totalAssetValue)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )
          ) : tab === 'tmz' ? (
            historyLoading ? (
              <div className="p-8">
                <PageLoader />
              </div>
            ) : groupedTmzOperations.length === 0 ? (
              <div className="text-center text-sm text-gray-500 py-12">
                <Layers className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="font-semibold text-gray-700 dark:text-gray-300">
                  {t('userView.noTmzFound')}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {t('userView.noTmzDesc')}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800 text-left bg-gray-50/50 dark:bg-gray-800/10">
                      <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {t('common.date')}
                      </th>
                      <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {t('userView.materialName')}
                      </th>
                      <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {t('userView.issuedQty')}
                      </th>
                      <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {t('userView.givenBy')}
                      </th>
                      <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {t('userView.docNo')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedTmzOperations.map((row: any) => {
                      const items = row.groupItems || [row];
                      return (
                        <tr
                          key={row.id}
                          className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/20"
                        >
                          <td className="px-5 py-3.5 text-xs text-gray-500 font-medium whitespace-nowrap">
                            {formatDate(row.createdAt)}
                          </td>
                          <td className="px-5 py-3.5 min-w-[200px]">
                            <div className="space-y-1">
                              {items.map((gi: any, idx: number) => (
                                <p key={gi.id || idx} className="text-xs font-bold text-gray-900 dark:text-gray-100">
                                  {items.length > 1 ? `${idx + 1}. ` : ''}{gi.product?.name ?? '—'}
                                </p>
                              ))}
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="space-y-1">
                              {items.map((gi: any, idx: number) => (
                                <p key={gi.id || idx} className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                                  {gi.quantity ?? 1} {gi.product?.unit || t('common.units.DONA')}
                                </p>
                              ))}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-xs text-gray-700 dark:text-gray-300 font-medium">
                            {row.performedBy?.fullName || '—'}
                          </td>
                          <td className="px-5 py-3.5 text-xs font-mono font-bold text-gray-500">
                            {row.documentNumber || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : historyLoading ? (
            <div className="p-8">
              <PageLoader />
            </div>
          ) : historyList.length === 0 ? (
            <div className="text-center text-sm text-gray-500 py-12">
              {t('userView.noHistoryFound')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 text-left bg-gray-50/50 dark:bg-gray-800/10">
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {t('userView.historyHeaders.operation')}
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {t('userView.historyHeaders.productAsset')}
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {t('userView.historyHeaders.quantity')}
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {t('userView.historyHeaders.value')}
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {t('userView.historyHeaders.confirmedBy')}
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {t('userView.historyHeaders.documentNo')}
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {t('userView.historyHeaders.dateTime')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {historyList.map((op: any) => {
                    const price = op.asset?.purchasePrice
                      ? Number(op.asset.purchasePrice)
                      : op.product?.inventory?.unitPrice
                      ? Number(op.product.inventory.unitPrice) * op.quantity
                      : 0;

                    return (
                      <tr
                        key={op.id}
                        className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/20"
                      >
                        <td className="px-5 py-3.5">
                          <OperationTypeBadge type={op.type} />
                        </td>
                        <td className="px-5 py-3.5 text-gray-900 dark:text-gray-100 font-medium whitespace-normal break-words min-w-[180px] max-w-xs">
                          <span>{op.product?.name}</span>{' '}
                          {op.asset?.inventoryNumber && (
                            <CopyableInventoryNumber
                              value={op.asset.inventoryNumber}
                              size="2xs"
                              className="ml-1"
                            />
                          )}
                        </td>

                        <td className="px-5 py-3.5 font-bold text-gray-900 dark:text-gray-100">
                          {op.quantity} {t('common.units.DONA')}
                        </td>
                        <td className="px-5 py-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {price > 0 ? formatCurrency(price) : '—'}
                        </td>
                        <td className="px-5 py-3.5 text-gray-700 dark:text-gray-300 font-medium">
                          {op.performedBy?.fullName || '—'}
                        </td>
                        <td className="px-5 py-3.5 text-gray-500 text-xs font-mono">
                          {op.documentNumber || '—'}
                        </td>
                        <td className="px-5 py-3.5 text-gray-500 text-xs">
                          {formatDate(op.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <VerifyIdentityModal
        open={bulkReturnModalOpen}
        onClose={() => setBulkReturnModalOpen(false)}
        onSuccess={handleConfirmBulkReturn}
      />

      {moddiyContractData && (
        <ModdiyJavobgarlikModal
          open={moddiyModalOpen}
          onClose={() => setModdiyModalOpen(false)}
          data={moddiyContractData}
        />
      )}
    </div>
  );
}
