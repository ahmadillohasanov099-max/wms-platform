import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Moon, Sun, Search, ChevronDown, ArrowRight, CheckCircle2, XCircle, Menu, Globe } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useUiStore } from '../../store/ui.store';
import { useAuthStore } from '../../store/auth.store';
import { useTranslation } from '../../hooks/useTranslation';
import { inventoryApi, deletionRequestsApi } from '../../api';
import { socketService } from '../../lib/socket';
import { cn } from '../../lib/utils';
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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  const isMinistry = isMinistryUser();
  const canManageRequests = isMinistry || ['OMBORCHI', 'ORG_OMBORCHI', 'ADMIN', 'SUPER_ADMIN', 'VAZIRLIK_OMBORCHI'].includes(user?.role || '');

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

  useEffect(() => {
    const socket = socketService.getSocket() || socketService.connect();
    const handleRefetch = () => {
      queryClient.invalidateQueries({ queryKey: ['deletion-requests'] });
    };

    socket.on('deletion-request:created', handleRefetch);
    socket.on('deletion-request:updated', handleRefetch);

    return () => {
      socket.off('deletion-request:created', handleRefetch);
      socket.off('deletion-request:updated', handleRefetch);
    };
  }, [queryClient]);

  const { data: lowStock } = useQuery({
    queryKey: ['low-stock'],
    queryFn: () => inventoryApi.getLowStock(),
    refetchInterval: 60000,
  });

  const { data: deletionReqsData } = useQuery({
    queryKey: ['deletion-requests', 'PENDING'],
    queryFn: () => deletionRequestsApi.getAll({ status: 'PENDING' }),
    enabled: canManageRequests,
    refetchInterval: 15000,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => deletionRequestsApi.approve(id),
    onSuccess: () => {
      toast.success("So'rov muvaffaqiyatli tasdiqlandi!");
      queryClient.invalidateQueries({ queryKey: ['deletion-requests'] });
      queryClient.invalidateQueries({ queryKey: ['user-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Tasdiqlashda xatolik yuz berdi");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => deletionRequestsApi.reject(id, { rejectionReason: "Omborchi rad etdi" }),
    onSuccess: () => {
      toast.success("So'rov rad etildi!");
      queryClient.invalidateQueries({ queryKey: ['deletion-requests'] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Rad etishda xatolik yuz berdi");
    },
  });

  const lowStockCount = Array.isArray(lowStock) ? lowStock.length : 0;
  const pendingRequestsList: DeletionRequest[] = Array.isArray(deletionReqsData)
    ? deletionReqsData
    : (deletionReqsData as any)?.data || [];
  const pendingCount = pendingRequestsList.length;
  const totalNotificationBadge = pendingCount + lowStockCount;

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

        <div className="relative" ref={bellRef}>
          <button
            onClick={() => setBellOpen(!bellOpen)}
            className={cn(
              'relative w-8 h-8 flex items-center justify-center rounded-lg transition-colors',
              'hover:bg-gray-100 dark:hover:bg-gray-800',
              'text-gray-500 dark:text-gray-400',
            )}
            title={t('topbar.notifications')}
          >
            <Bell className="w-4 h-4" />
            {totalNotificationBadge > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {totalNotificationBadge}
              </span>
            )}
          </button>

          {bellOpen && (
            <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl overflow-hidden z-50">
              <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-primary-600" />
                  <span>{t('topbar.notifications')}</span>
                </h4>
                {canManageRequests && pendingCount > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">
                    {t('topbar.pendingCount', { count: pendingCount })}
                  </span>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                {canManageRequests && pendingCount > 0 ? (
                  pendingRequestsList.slice(0, 8).map((req: DeletionRequest) => (
                    <div
                      key={req.id}
                      className="p-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                          {req.entityType === 'ASSET'
                            ? "🛠️ Jihoz So'rovi"
                            : req.entityType === 'PRODUCT'
                            ? t('history.product')
                            : req.entityType === 'USER'
                            ? t('menu.users')
                            : t('menu.departments')}
                        </span>
                        <span className="text-[10px] text-gray-400 font-medium">
                          {req.requestedBy?.fullName || req.organization?.name || 'Xodim'}
                        </span>
                      </div>

                      <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {req.entityName || req.entityTitle || req.entityId}
                      </p>

                      {req.reason && (
                        <p className="text-xs text-gray-600 dark:text-gray-300 italic line-clamp-2 bg-gray-100/60 dark:bg-gray-800/40 p-2 rounded-lg">
                          "{req.reason}"
                        </p>
                      )}

                      {/* Omborchi Action Buttons */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            approveMutation.mutate(req.id);
                          }}
                          disabled={approveMutation.isPending || rejectMutation.isPending}
                          className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Tasdiqlash</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            rejectMutation.mutate(req.id);
                          }}
                          disabled={approveMutation.isPending || rejectMutation.isPending}
                          className="flex-1 py-1.5 px-2 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Rad etish</span>
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center text-xs text-gray-400">
                    {t('topbar.noPendingRequests')}
                  </div>
                )}
              </div>

              {canManageRequests && (
                <div className="p-3 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-100 dark:border-gray-800 text-center">
                  <button
                    onClick={() => {
                      setBellOpen(false);
                      navigate('/deletion-requests');
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    <span>{t('topbar.reviewAllRequests')}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}