import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Moon,
  Sun,
  Search,
  ChevronDown,
  ArrowRight,
  CheckCircle2,
  Menu,
  Globe,
  Check,
  X,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useUiStore } from '../../store/ui.store';
import { useAuthStore } from '../../store/auth.store';
import { useTranslation } from '../../hooks/useTranslation';
import {
  inventoryApi,
  deletionRequestsApi,
  usersApi,
  operationsApi,
  departmentsApi,
} from '../../api';
import { socketService } from '../../lib/socket';
import { cn } from '../../lib/utils';
import RejectReasonModal from '../modals/reject-reason-modal';
import type { DeletionRequest } from '../../types';

interface TopbarProps {
  title: string;
}

export default function Topbar({}: TopbarProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { theme, toggleTheme, language, setLanguage, sidebarOpen, toggleSidebar } = useUiStore();
  const { user, isMinistryUser } = useAuthStore();
  const { t } = useTranslation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [rejectingAssignment, setRejectingAssignment] = useState<any | null>(null);
  const [rejectingRequest, setRejectingRequest] = useState<DeletionRequest | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  // Read notifications state stored in localStorage
  const [readNotifIds, setReadNotifIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('read_request_notif_ids') || '[]');
    } catch {
      return [];
    }
  });

  const markAsRead = (id: string) => {
    setReadNotifIds((prev) => {
      const updated = [...new Set([...prev, id])];
      localStorage.setItem('read_request_notif_ids', JSON.stringify(updated));
      return updated;
    });
  };

  const isMinistry = isMinistryUser();
  const canManageRequests =
    isMinistry ||
    ['OMBORCHI', 'ORG_OMBORCHI', 'ADMIN', 'SUPER_ADMIN', 'VAZIRLIK_OMBORCHI'].includes(
      user?.role || ''
    );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    };
    const handleScroll = () => {
      setDropdownOpen(false);
      setBellOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, []);

  const languages = [
    { code: 'uz', name: "O'zbek" },
    { code: 'ru', name: 'Русский' },
    { code: 'en', name: 'English' },
  ] as const;

  const currentLang = languages.find((l) => l.code === language) || languages[0];

  // Fetch logged in user detailed profile
  const { data: userDetailData } = useQuery({
    queryKey: ['profile-user-detail-topbar', user?.id],
    queryFn: () => usersApi.getOne(user!.id),
    enabled: !!user?.id,
    staleTime: 60000,
  });

  const currentUser = userDetailData || user;
  const departmentId = currentUser?.departmentId || currentUser?.department?.id;

  // Fetch user's department detail
  const { data: departmentData } = useQuery({
    queryKey: ['topbar-department-detail', departmentId],
    queryFn: () => departmentsApi.getOne(departmentId!),
    enabled: !!departmentId,
    refetchInterval: 20000,
  });

  const isLeader =
    departmentData?.leaderId === user?.id ||
    (departmentData?.leader as any)?.id === user?.id ||
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'ADMIN';

  // Department pending assignments
  const deptAssignments: any[] = departmentData?.assignments || [];
  const pendingDeptAssignments = isLeader
    ? deptAssignments.filter((a: any) => a.status === 'PENDING')
    : [];
  const deptPendingCount = pendingDeptAssignments.length;

  useEffect(() => {
    const socket = socketService.getSocket() || socketService.connect();
    if (user?.id) {
      socket.emit('join:user', user.id);
    }

    const handleRefetch = () => {
      queryClient.invalidateQueries({ queryKey: ['deletion-requests'] });
      queryClient.invalidateQueries({ queryKey: ['my-deletion-requests'] });
      queryClient.invalidateQueries({ queryKey: ['profile-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['user-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['topbar-department-detail'] });
      queryClient.invalidateQueries({ queryKey: ['profile-department-detail'] });
      queryClient.invalidateQueries({ queryKey: ['department-detail'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-assets'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['low-stock'] });
      queryClient.invalidateQueries({ queryKey: ['operations'] });
    };

    const handleNewAssignment = (data: any) => {
      handleRefetch();
      if (data?.departmentId) {
        toast(`🏢 Bo'limingizga yangi jihoz biriktirildi: ${data.assetName || 'Jihoz'}`, {
          duration: 4000,
        });
      } else {
        toast(`👤 Sizga yangi shaxsiy jihoz biriktirildi: ${data.assetName || 'Jihoz'}`, {
          duration: 4000,
        });
      }
    };

    const handleRequestUpdated = (data: any) => {
      handleRefetch();
      if (data?.requestedById === user?.id) {
        if (data?.status === 'REJECTED') {
          toast.error(
            `❌ Qaytarish so'rovingiz rad etildi: ${data.reviewComment || data.rejectionReason || 'Sabab ko‘rsatilmadi'}`,
            { duration: 6000 }
          );
        } else if (data?.status === 'APPROVED') {
          toast.success("✅ Qaytarish so'rovingiz omborchi tomonidan qabul qilindi!", {
            duration: 5000,
          });
        }
      }
    };

    socket.on('deletion-request:created', handleRefetch);
    socket.on('deletion-request:updated', handleRequestUpdated);
    socket.on('assignment:new', handleNewAssignment);
    socket.on('assignment:created', handleRefetch);
    socket.on('assignment:updated', handleRefetch);
    socket.on('inventory:updated', handleRefetch);
    socket.on('operation:created', handleRefetch);

    return () => {
      socket.off('deletion-request:created', handleRefetch);
      socket.off('deletion-request:updated', handleRequestUpdated);
      socket.off('assignment:new', handleNewAssignment);
      socket.off('assignment:created', handleRefetch);
      socket.off('assignment:updated', handleRefetch);
      socket.off('inventory:updated', handleRefetch);
      socket.off('operation:created', handleRefetch);
    };
  }, [queryClient, user?.id]);

  const { data: lowStock } = useQuery({
    queryKey: ['low-stock'],
    queryFn: () => inventoryApi.getLowStock(),
    enabled: canManageRequests,
    refetchInterval: 60000,
  });

  const { data: deletionReqsData } = useQuery({
    queryKey: ['deletion-requests', 'PENDING'],
    queryFn: () => deletionRequestsApi.getAll({ status: 'PENDING' }),
    enabled: canManageRequests,
    refetchInterval: 15000,
  });

  const { data: myAssignmentsData } = useQuery({
    queryKey: ['profile-assignments', user?.id],
    queryFn: () => usersApi.getAssignments(user!.id),
    enabled: !!user?.id,
    refetchInterval: 20000,
  });

  // Employee's own return requests to check approvals/rejections
  const { data: myRequestsData } = useQuery({
    queryKey: ['my-deletion-requests', user?.id],
    queryFn: () => deletionRequestsApi.getMy(),
    enabled: !!user?.id,
    refetchInterval: 15000,
  });

  const acceptAssignmentMutation = useMutation({
    mutationFn: (id: string) => operationsApi.acceptAssignment(id),
    onSuccess: (res: any) => {
      toast.success(res?.message || "Jihoz qabul qilindi!");
      queryClient.invalidateQueries({ queryKey: ['profile-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['user-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['topbar-department-detail'] });
      queryClient.invalidateQueries({ queryKey: ['profile-department-detail'] });
      queryClient.invalidateQueries({ queryKey: ['department-detail'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-assets'] });
      queryClient.invalidateQueries({ queryKey: ['deletion-requests'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || "Xatolik yuz berdi");
    },
  });

  const rejectAssignmentMutation = useMutation({
    mutationFn: ({ assignmentId, reason }: { assignmentId: string; reason: string }) =>
      operationsApi.rejectAssignment(assignmentId, { reason }),
    onSuccess: (res: any) => {
      toast.success(res?.message || "Jihoz rad etildi va omborga qaytarildi");
      queryClient.invalidateQueries({ queryKey: ['profile-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['user-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['topbar-department-detail'] });
      queryClient.invalidateQueries({ queryKey: ['profile-department-detail'] });
      queryClient.invalidateQueries({ queryKey: ['department-detail'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-assets'] });
      queryClient.invalidateQueries({ queryKey: ['deletion-requests'] });
      setRejectingAssignment(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || "Xatolik yuz berdi");
    },
  });

  const approveRequestMutation = useMutation({
    mutationFn: (id: string) => deletionRequestsApi.approve(id),
    onSuccess: () => {
      toast.success("So'rov qabul qilindi!");
      queryClient.invalidateQueries({ queryKey: ['deletion-requests'] });
      queryClient.invalidateQueries({ queryKey: ['my-deletion-requests'] });
      queryClient.invalidateQueries({ queryKey: ['user-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Xatolik yuz berdi");
    },
  });

  const rejectRequestMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      deletionRequestsApi.reject(id, { rejectionReason: reason }),
    onSuccess: () => {
      toast.success("So'rov rad etildi!");
      queryClient.invalidateQueries({ queryKey: ['deletion-requests'] });
      queryClient.invalidateQueries({ queryKey: ['my-deletion-requests'] });
      setRejectingRequest(null);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Xatolik yuz berdi");
    },
  });

  const myAssignments: any[] = myAssignmentsData || [];
  const pendingMyAssignments = myAssignments.filter((a: any) => a.status === 'PENDING');
  const myPendingCount = pendingMyAssignments.length;

  const lowStockList: any[] = Array.isArray(lowStock) ? lowStock : [];
  const lowStockCount = lowStockList.length;
  const pendingRequestsList: DeletionRequest[] = Array.isArray(deletionReqsData)
    ? deletionReqsData
    : (deletionReqsData as any)?.data || [];
  const pendingReqCount = canManageRequests ? pendingRequestsList.length : 0;

  // Filter employee's recent reviewed requests that are unread
  const myRequestsList: DeletionRequest[] = Array.isArray(myRequestsData)
    ? myRequestsData
    : (myRequestsData as any)?.data || [];
  const unreadReviewedRequests = myRequestsList.filter(
    (r) => (r.status === 'APPROVED' || r.status === 'REJECTED') && !readNotifIds.includes(r.id)
  );

  const totalNotificationBadge =
    myPendingCount +
    deptPendingCount +
    (canManageRequests ? pendingReqCount + lowStockCount : unreadReviewedRequests.length);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-3 sm:px-6 bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl border border-gray-200 dark:border-white/15 rounded-2xl h-16 shadow-sm m-[10px] gap-2">
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <button
          onClick={toggleSidebar}
          className="hidden md:flex p-1.5 sm:p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          title={sidebarOpen ? "Menyuni yopish" : "Menyuni ochish"}
        >
          <Menu className="w-5 h-5" />
        </button>
        <img
          src="/vaz-logo.png"
          alt="Tashkilot Logo"
          className="w-8 h-8 object-contain shrink-0 hidden xs:block"
        />
        <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
          <h2
            className="text-[10px] xs:text-[11px] sm:text-[13px] lg:text-[16px] font-bold text-gray-950 dark:text-gray-50 uppercase tracking-tight leading-tight truncate"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            {user?.organization?.name || t('topbar.ministryName')}
          </h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className="text-[7.5px] sm:text-[8.5px] lg:text-[10px] text-teal-600 dark:text-teal-400 font-semibold tracking-widest uppercase truncate"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              {user?.organization?.type === 'SUB_ORG' ? 'Hududiy Ombor Boshqaruv Tizimi' : t('topbar.systemTitle')}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm text-gray-400 dark:text-gray-500 w-40 lg:w-48">
          <Search className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{t('topbar.searchPlaceholder')}</span>
        </div>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className={cn(
              'flex items-center gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl transition-colors border border-gray-200 dark:border-slate-800 text-xs font-bold text-gray-700 dark:text-gray-300 cursor-pointer select-none',
              'hover:bg-gray-100 dark:hover:bg-slate-800/80'
            )}
          >
            <Globe className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
            <span className="uppercase text-xs font-mono font-extrabold">{currentLang.code}</span>
            <ChevronDown className="w-3 h-3 text-gray-400" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-1.5 w-28 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden py-1 z-50">
              {languages.map((l) => (
                <button
                  key={l.code}
                  onClick={() => {
                    setLanguage(l.code);
                    setDropdownOpen(false);
                    window.location.reload();
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors cursor-pointer',
                    l.code === language
                      ? 'text-teal-600 dark:text-teal-400 font-bold bg-teal-50/30 dark:bg-teal-950/30'
                      : 'text-gray-700 dark:text-gray-300 font-medium'
                  )}
                >
                  <span>{l.name}</span>
                  <span className="uppercase text-[10px] font-mono text-gray-400">{l.code}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={toggleTheme}
          className={cn(
            'w-8 h-8 flex items-center justify-center rounded-lg transition-colors',
            'hover:bg-gray-100 dark:hover:bg-gray-800',
            'text-gray-500 dark:text-gray-400',
          )}
          title="Mavzu"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
        </button>

        {/* Minimalist Professional Notification Bell Popover */}
        <div className="relative" ref={bellRef}>
          <button
            onClick={() => setBellOpen(!bellOpen)}
            className={cn(
              'relative w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-200 cursor-pointer',
              totalNotificationBadge > 0
                ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-300/80 dark:border-amber-800/80 shadow-2xs'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 border border-transparent'
            )}
            title={t('topbar.notifications')}
          >
            <Bell className="w-4 h-4" />
            {totalNotificationBadge > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 bg-rose-600 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-xs ring-2 ring-white dark:ring-slate-900">
                {totalNotificationBadge}
              </span>
            )}
          </button>

          {bellOpen && (
            <div className="absolute right-0 mt-2 w-[310px] sm:w-[370px] bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-150">
              
              {/* Header */}
              <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-800/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                    Bildirishnomalar
                  </h4>
                </div>
                {totalNotificationBadge > 0 ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
                    {totalNotificationBadge} ta yangi
                  </span>
                ) : (
                  <span className="text-[10px] text-gray-400">Yangi xabar yo'q</span>
                )}
              </div>

              {/* Notification Unified Feed List */}
              <div className="max-h-[360px] overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800/80 p-2 space-y-2">
                
                {/* 1. 👤 Shaxsiy jihozlar (Xodim / Rahbar uchun biriktirilgan) */}
                {myPendingCount > 0 && (
                  <div className="space-y-1.5">
                    {pendingMyAssignments.map((asgn: any) => (
                      <div
                        key={asgn.id}
                        className="p-3 bg-blue-50/40 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/60 rounded-xl space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-extrabold text-[10px] text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/60 px-1.5 py-0.5 rounded">
                            👤 Shaxsiy jihoz
                          </span>
                          {asgn.asset?.inventoryNumber && (
                            <span className="font-mono text-[10px] text-gray-500">
                              № {asgn.asset.inventoryNumber}
                            </span>
                          )}
                        </div>

                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {asgn.asset?.product?.name || 'Jihoz'}
                        </p>

                        <div className="flex items-center gap-1.5 pt-0.5">
                          <button
                            onClick={() => acceptAssignmentMutation.mutate(asgn.id)}
                            disabled={acceptAssignmentMutation.isPending}
                            className="flex-1 py-1 px-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Qabul</span>
                          </button>
                          <button
                            onClick={() => setRejectingAssignment(asgn)}
                            disabled={acceptAssignmentMutation.isPending}
                            className="flex-1 py-1 px-2 bg-white dark:bg-slate-900 hover:bg-rose-50 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-lg border border-rose-200 dark:border-rose-900 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Rad</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 2. 🏢 Bo'lim jihozlari (Bo'lim boshlig'i uchun biriktirilgan) */}
                {deptPendingCount > 0 && (
                  <div className="space-y-1.5">
                    {pendingDeptAssignments.map((asgn: any) => (
                      <div
                        key={asgn.id}
                        className="p-3 bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/60 rounded-xl space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-extrabold text-[10px] text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-1.5 py-0.5 rounded">
                            🏢 Bo'lim jihozi ({departmentData?.name || "Bo'lim"})
                          </span>
                          {(asgn.asset?.inventoryNumber || asgn.inventoryNumber) && (
                            <span className="font-mono text-[10px] text-gray-500">
                              № {asgn.asset?.inventoryNumber || asgn.inventoryNumber}
                            </span>
                          )}
                        </div>

                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {asgn.asset?.product?.name || asgn.product?.name || 'Jihoz'}
                        </p>

                        <div className="flex items-center gap-1.5 pt-0.5">
                          <button
                            onClick={() => acceptAssignmentMutation.mutate(asgn.id)}
                            disabled={acceptAssignmentMutation.isPending}
                            className="flex-1 py-1 px-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Qabul</span>
                          </button>
                          <button
                            onClick={() => setRejectingAssignment(asgn)}
                            disabled={acceptAssignmentMutation.isPending}
                            className="flex-1 py-1 px-2 bg-white dark:bg-slate-900 hover:bg-rose-50 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-lg border border-rose-200 dark:border-rose-900 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Rad</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 3. 📋 Xodimlarga: Qaytarish so'rovi omborchi tomonidan ko'rib chiqilganlik natijasi */}
                {!canManageRequests && unreadReviewedRequests.length > 0 && (
                  <div className="space-y-1.5">
                    {unreadReviewedRequests.slice(0, 4).map((req: DeletionRequest) => {
                      const isRejected = req.status === 'REJECTED';
                      const reviewerName = req.reviewedBy?.fullName || 'Omborchi';
                      const reasonText = req.reviewComment || req.rejectionReason || 'Sabab ko‘rsatilmadi';

                      return (
                        <div
                          key={req.id}
                          className={cn(
                            'p-2.5 rounded-xl border space-y-1.5',
                            isRejected
                              ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200/80 dark:border-rose-900/50'
                              : 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-900/50'
                          )}
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span
                              className={cn(
                                'font-extrabold text-[10px] px-1.5 py-0.5 rounded',
                                isRejected
                                  ? 'text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/60'
                                  : 'text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60'
                              )}
                            >
                              {isRejected ? "❌ Qaytarish so'rovi rad etildi" : "✅ Qaytarish so'rovi qabul qilindi"}
                            </span>
                            <span className="text-[10px] text-gray-500 truncate max-w-[120px]">
                              {reviewerName}
                            </span>
                          </div>

                          <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                            {req.entityName || req.entityTitle || 'Jihoz'}
                          </p>

                          {isRejected ? (
                            <p className="text-[11px] text-rose-700 dark:text-rose-300 italic bg-rose-100/60 dark:bg-rose-950/40 px-2 py-1 rounded">
                              Rad sababi: "{reasonText}"
                            </p>
                          ) : (
                            <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                              Jihoz ombor hisobiga muvaffaqiyatli qabul qilindi
                            </p>
                          )}

                          <button
                            onClick={() => markAsRead(req.id)}
                            className="w-full py-1 px-2 bg-white dark:bg-slate-900 hover:bg-gray-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg border border-gray-200 dark:border-slate-700 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>O'qildi deb belgilash</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 4. 📋 Admin / Omborchi uchun: Xodimlardan kelgan so'rovlar va rad etilganlik bildirishnomalari */}
                {canManageRequests && pendingReqCount > 0 && (
                  <div className="space-y-1.5">
                    {pendingRequestsList.slice(0, 6).map((req: DeletionRequest) => {
                      const isRejectionNotice = req.reason?.toLowerCase().includes('rad etildi');
                      
                      // Extract clean short title and inventory number
                      let title = (req.entityName || req.entityTitle || req.entityId || 'Jihoz').trim();
                      let invNumber: string | undefined;
                      const invMatch = title.match(/\(Inv:\s*([^\)]+)\)/i);
                      if (invMatch) {
                        invNumber = invMatch[1].trim();
                        title = title.replace(/\(Inv:\s*[^\)]+\)/i, '').trim();
                      }
                      const commaIndex = title.indexOf(',');
                      if (title.length > 45 && commaIndex > 10) {
                        title = title.substring(0, commaIndex).trim();
                      } else if (title.length > 55) {
                        title = title.substring(0, 52) + '...';
                      }

                      // Extract clean reason
                      let cleanReason = (req.reason || '').trim();
                      let reqType = cleanReason.includes("TA'MIRLASH") || cleanReason.includes("Ta'mirlash") ? "Ta'mirlash" : "Qaytarish";
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

                      if (isRejectionNotice) {
                        return (
                          <div
                            key={req.id}
                            className="p-3 bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/60 rounded-xl space-y-1.5 transition-all shadow-2xs"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-[10px] text-rose-700 dark:text-rose-300 bg-rose-100/80 dark:bg-rose-950/70 px-2 py-0.5 rounded-full">
                                ❌ Xodim rad etdi
                              </span>
                              <span className="text-[11px] font-medium text-neutral-500 truncate max-w-[120px]">
                                {req.requestedBy?.fullName || 'Xodim'}
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-1">
                              <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                                {title}
                              </p>
                              {invNumber && (
                                <span className="text-[10px] font-mono text-neutral-400 shrink-0">
                                  № {invNumber}
                                </span>
                              )}
                            </div>

                            {cleanReason && (
                              <p className="text-[11px] text-neutral-600 dark:text-neutral-300 italic bg-white dark:bg-neutral-900/60 px-2.5 py-1 rounded-lg border border-neutral-200/60 dark:border-neutral-700/40">
                                Sabab: "{cleanReason}"
                              </p>
                            )}

                            <button
                              onClick={() => approveRequestMutation.mutate(req.id)}
                              disabled={approveRequestMutation.isPending}
                              className="w-full py-1.5 px-3 bg-white hover:bg-neutral-100 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 text-xs font-semibold rounded-lg border border-neutral-200 dark:border-neutral-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>O'qildi deb belgilash</span>
                            </button>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={req.id}
                          className="p-3 bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/60 rounded-xl space-y-1.5 transition-all shadow-2xs"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-[10px] text-teal-800 dark:text-teal-300 bg-teal-100/80 dark:bg-teal-950/70 px-2 py-0.5 rounded-full">
                              {reqType === "Ta'mirlash" ? "🛠️ Ta'mirlash so'rovi" : "📦 Qaytarish so'rovi"}
                            </span>
                            <span className="text-[11px] font-medium text-neutral-500 truncate max-w-[120px]">
                              {req.requestedBy?.fullName || 'Xodim'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                              {title}
                            </p>
                            {invNumber && (
                              <span className="text-[10px] font-mono text-neutral-400 shrink-0">
                                № {invNumber}
                              </span>
                            )}
                          </div>

                          {cleanReason && (
                            <p className="text-[11px] text-neutral-600 dark:text-neutral-300 italic bg-white dark:bg-neutral-900/60 px-2.5 py-1 rounded-lg border border-neutral-200/60 dark:border-neutral-700/40">
                              "{cleanReason}"
                            </p>
                          )}

                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={() => approveRequestMutation.mutate(req.id)}
                              disabled={approveRequestMutation.isPending || rejectRequestMutation.isPending}
                              className="flex-1 py-1.5 px-3 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Qabul</span>
                            </button>
                            <button
                              onClick={() => setRejectingRequest(req)}
                              disabled={approveRequestMutation.isPending || rejectRequestMutation.isPending}
                              className="flex-1 py-1.5 px-3 bg-white hover:bg-rose-50 hover:text-rose-600 dark:bg-neutral-900 dark:hover:bg-rose-950/40 text-neutral-600 dark:text-neutral-300 text-xs font-semibold rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-rose-200 dark:hover:border-rose-900 transition-all flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Rad</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 5. ⚠️ Kam qolgan tovarlar (Admin / Omborchi uchun) */}
                {canManageRequests && lowStockCount > 0 && (
                  <div className="space-y-1.5">
                    {lowStockList.slice(0, 3).map((item: any) => (
                      <div
                        key={item.id}
                        className="p-2.5 bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/50 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div className="space-y-0.5">
                          <span className="font-bold text-gray-900 dark:text-gray-100 truncate">
                            {item.product?.name || item.name}
                          </span>
                          <p className="text-[10px] text-rose-600 dark:text-rose-400">
                            Minimal qoldiqdan kam qoldi
                          </p>
                        </div>
                        <span className="font-mono font-extrabold text-rose-600 dark:text-rose-400 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-900 text-xs">
                          {item.quantity} {item.product?.unit || 'ta'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Empty State */}
                {totalNotificationBadge === 0 && (
                  <div className="py-8 text-center text-xs text-gray-400 flex flex-col items-center gap-2">
                    <CheckCircle2 className="w-7 h-7 text-emerald-500 stroke-1" />
                    <span className="font-medium text-gray-600 dark:text-gray-300">
                      Hozircha yangi bildirishnomalar yo'q
                    </span>
                  </div>
                )}
              </div>

              {/* Footer Link */}
              <div className="p-2.5 bg-gray-50/80 dark:bg-slate-800/80 border-t border-gray-100 dark:border-slate-800 text-center">
                <button
                  onClick={() => {
                    setBellOpen(false);
                    navigate('/deletion-requests');
                  }}
                  className="w-full py-1.5 px-3 rounded-lg text-teal-600 hover:text-teal-700 dark:text-teal-400 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>So'rovlar tarixi</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* Reject Assignment Modal (When user rejects taking an asset) */}
      <RejectReasonModal
        open={!!rejectingAssignment}
        onClose={() => setRejectingAssignment(null)}
        onConfirm={async (reason) => {
          if (!rejectingAssignment) return;
          await rejectAssignmentMutation.mutateAsync({
            assignmentId: rejectingAssignment.id,
            reason,
          });
        }}
        title="Jihozni qabul qilishni rad etish"
        itemTitle={rejectingAssignment?.asset?.product?.name || rejectingAssignment?.product?.name || 'Jihoz'}
        isLoading={rejectAssignmentMutation.isPending}
      />

      {/* Reject Return Request Modal (When Admin/Omborchi rejects an employee's return request) */}
      <RejectReasonModal
        open={!!rejectingRequest}
        onClose={() => setRejectingRequest(null)}
        onConfirm={async (reason) => {
          if (!rejectingRequest) return;
          await rejectRequestMutation.mutateAsync({
            id: rejectingRequest.id,
            reason,
          });
        }}
        title="Qaytarish so'rovini rad etish"
        itemTitle={rejectingRequest?.entityName || 'Qaytarish so‘rovi'}
        isLoading={rejectRequestMutation.isPending}
      />
    </header>
  );
}