import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Eye,
  Upload,
  Edit2,
  Trash2,
  Lock,
  Unlock,
  ChevronRight,
  UserMinus,
  Clock,
  Users as UsersIcon,
  FileText,
} from 'lucide-react';
import { usersApi, departmentsApi, organizationsApi } from '../../api';
import { Card, Button, Select, Table, ConfirmDialog, RoleBadge, PageHeader, SearchFilterCard, Pagination } from '../../components/ui';
import toast from 'react-hot-toast';
import UserFormModal from './user-form-modal';
import UserExcelImportModal from './user-excel-import-modal';
import OffboardingConfirmModal from './offboarding-confirm-modal';
import OffboardingAktModal from './offboarding-akt-modal';
import PendingOffboardingsView from './pending-offboardings-view';
import { useAuthStore } from '../../store/auth.store';
import { downloadExport } from '../../lib/export';
import { useTranslation } from '../../hooks/useTranslation';
import { useDebounce } from '../../hooks/useDebounce';
import { formatDate, invalidateAppQueries } from '../../lib/utils';

export default function UsersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isRahbar = user?.role === 'RAHBAR';
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ORG_ADMIN';
  const isGlobalViewer = user?.role === 'SUPER_ADMIN' || user?.role === 'RAHBAR';
  const canManageUsers = user?.role === 'SUPER_ADMIN' || user?.role === 'ORG_ADMIN' || user?.role === 'KADR';
  const canDeleteUsers = user?.role === 'SUPER_ADMIN' || user?.role === 'ORG_ADMIN' || user?.role === 'KADR';

  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'active' | 'offboarding' | 'offboarded'>(
    tabParam === 'offboarding' || tabParam === 'offboarded' ? tabParam : 'active'
  );

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'offboarding' || tab === 'offboarded' || tab === 'active') {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (tab: 'active' | 'offboarding' | 'offboarded') => {
    setActiveTab(tab);
    setSearchParams(tab === 'active' ? {} : { tab });
    setPage(1);
  };

  const [offboardConfirmUser, setOffboardConfirmUser] = useState<any | null>(null);
  const [aktModalUserId, setAktModalUserId] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const limit = 20;

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [orgFilter, setOrgFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [formModal, setFormModal] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [excelModal, setExcelModal] = useState(false);

  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteUser, setDeleteUser] = useState<any>(null);

  const [internalPhoneEdit, setInternalPhoneEdit] = useState<string | null>(null);
  const [internalPhoneValue, setInternalPhoneValue] = useState('');
  const [exportLoading, setExportLoading] = useState(false);

  // Pending offboardings badge count
  const { data: pendingList } = useQuery({
    queryKey: ['pending-offboardings'],
    queryFn: () => usersApi.getPendingOffboardings(),
  });
  const pendingCount = Array.isArray(pendingList) ? pendingList.length : 0;

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, roleFilter, deptFilter, orgFilter, activeTab]);

  const { data: orgsData } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => organizationsApi.getAll(),
    enabled: isGlobalViewer,
  });

  const rawOrgs: any = orgsData;
  const organizations: any[] = Array.isArray(rawOrgs)
    ? rawOrgs
    : Array.isArray(rawOrgs?.data)
    ? rawOrgs.data
    : [];

  const { mutate: updateInternalPhone, isPending: internalPhoneLoading } = useMutation({
    mutationFn: ({ userId, internalPhone }: { userId: string; internalPhone: string }) =>
      usersApi.update(userId, { internalPhone }),
    onSuccess: (_, variables) => {
      const val = variables.internalPhone?.trim();
      toast.success(val ? `Xodimning ichki raqami ${val} ga o'zgartirildi` : "Xodimning ichki raqami o'chirildi");
      invalidateAppQueries(queryClient);
      setInternalPhoneEdit(null);
    },
    onError: (err: any) => {
      toast.error(err?.message || err?.response?.data?.message || t('common.error'));
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, limit, debouncedSearch, roleFilter, deptFilter, orgFilter, activeTab],
    queryFn: () =>
      usersApi.getAll({
        page,
        limit,
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(!isRahbar && roleFilter && { role: roleFilter }),
        ...(deptFilter && { departmentId: deptFilter }),
        ...(orgFilter && { organizationId: orgFilter }),
        employmentStatus: activeTab === 'offboarded' ? 'OFFBOARDED' : 'ACTIVE',
      }),
    enabled: activeTab !== 'offboarding',
  });

  const handleExport = async () => {
    try {
      setExportLoading(true);
      await downloadExport(
        '/users/export',
        `xodimlar_${new Date().toISOString().split('T')[0]}.xlsx`,
        {
          ...(search && { search }),
          ...(!isRahbar && roleFilter && { role: roleFilter }),
          ...(deptFilter && { departmentId: deptFilter }),
          ...(orgFilter ? { organizationId: orgFilter } : user?.organizationId ? { organizationId: user.organizationId } : {}),
        }
      );
      toast.success(t('users.exportSuccess'));
    } catch {
      toast.error(t('users.exportError'));
    } finally {
      setExportLoading(false);
    }
  };

  const { data: depts } = useQuery({
    queryKey: ['departments', orgFilter],
    queryFn: () => departmentsApi.getAll(orgFilter ? { organizationId: orgFilter } : undefined),
  });

  const { mutate: toggleStatus } = useMutation({
    mutationFn: (id: string) => usersApi.toggleStatus(id),
    onSuccess: () => {
      toast.success(t('users.statusUpdated'));
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) => {
      toast.error(err?.message || err?.response?.data?.message || t('common.error'));
    },
  });

  const { mutate: remove, isPending: deleteLoading } = useMutation({
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess: () => {
      toast.success(t('users.userDeleted'));
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setDeleteDialog(false);
    },
    onError: (err: any) => {
      toast.error(err?.message || err?.response?.data?.message || t('common.error'));
    },
  });

  const users = data?.items ?? [];
  const departments = depts ?? [];

  const columns = [
    {
      key: 'fullName',
      title: t('operations.employee'),
      className: 'min-w-[170px]',
      render: (_: any, row: any) => (
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-semibold text-gray-900 dark:text-gray-100 text-xs sm:text-sm">
              {row.fullName}
            </p>
            {row.employmentStatus === 'OFFBOARDING_PENDING' && (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                {t('offboarding.statusPending')}
              </span>
            )}
            {row.employmentStatus === 'OFFBOARDED' && (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400">
                {t('offboarding.statusOffboarded')}
              </span>
            )}
          </div>
          <span className="text-2xs font-mono text-gray-500 dark:text-gray-400">
            @{row.username}
          </span>
        </div>
      ),
    },
    ...(isGlobalViewer
      ? [
          {
            key: 'organization',
            title: t('menu.organizations') || 'Tashkilot',
            className: 'min-w-[150px] max-w-[220px]',
            render: (_: any, row: any) => (
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300 line-clamp-2">
                {row.organization?.name || 'Markaziy apparat'}
              </span>
            ),
          },
        ]
      : []),
    {
      key: 'department',
      title: t('users.department'),
      className: 'min-w-[180px] max-w-[260px]',
      render: (_: any, row: any) => {
        const isStaff = row.role === 'ORG_ADMIN' || row.role === 'SUPER_ADMIN' || row.role === 'VAZIRLIK_OMBORCHI' || row.role === 'ORG_OMBORCHI' || row.role === 'KADR';
        if (isStaff && !row.department?.name) {
          return (
            <span className="text-2xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
              Tizim boshqaruvi
            </span>
          );
        }
        return (
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 leading-normal break-words">
            {row.department?.name ?? '—'}
          </div>
        );
      },
    },
    {
      key: 'position',
      title: t('users.position'),
      className: 'min-w-[140px] max-w-[200px]',
      render: (value: any) => (
        <div className="text-xs text-gray-600 dark:text-gray-400 leading-normal break-words">
          {value ?? '—'}
        </div>
      ),
    },
    {
      key: 'contact',
      title: t('users.phoneAndInternal'),
      render: (_: any, row: any) => {
        const isEditing = internalPhoneEdit === row.id;

        return (
          <div className="flex flex-col gap-0.5 text-xs">
            {row.phone ? (
              <span className="text-gray-700 dark:text-gray-300 font-mono font-medium">
                {row.phone}
              </span>
            ) : (
              <span className="text-gray-400 dark:text-gray-600 text-2xs italic">—</span>
            )}
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-2xs text-gray-400 font-medium">{t('users.internalShort')}</span>
              {isEditing ? (
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    value={internalPhoneValue}
                    onChange={(e) => setInternalPhoneValue(e.target.value)}
                    placeholder="1025"
                    className="w-16 px-1.5 py-0.5 text-xs border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono font-bold"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateInternalPhone({ userId: row.id, internalPhone: internalPhoneValue })
                    }
                    disabled={internalPhoneLoading}
                    className="text-2xs text-primary-600 hover:text-primary-700 font-bold px-1.5 py-0.5 bg-primary-50 dark:bg-primary-950/40 rounded-md transition-colors"
                  >
                    {t('common.save')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setInternalPhoneEdit(null)}
                    className="text-2xs text-gray-400 hover:text-gray-600 px-1"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (canManageUsers && (user?.role !== 'KADR' || row.role === 'XODIM')) {
                      setInternalPhoneEdit(row.id);
                      setInternalPhoneValue(row.internalPhone || '');
                    }
                  }}
                  className={`text-xs font-mono font-bold transition-colors ${
                    row.internalPhone
                      ? 'text-blue-600 dark:text-blue-400 border-b border-dashed border-blue-300 dark:border-blue-700'
                      : 'text-gray-400 dark:text-gray-500 italic border-b border-dashed border-gray-300 dark:border-gray-700'
                  } ${canManageUsers && (user?.role !== 'KADR' || row.role === 'XODIM') ? 'hover:text-primary-600 dark:hover:text-primary-400 cursor-pointer' : ''}`}
                  title={canManageUsers && (user?.role !== 'KADR' || row.role === 'XODIM') ? t('users.clickToEditInternalPhone') : ''}
                >
                  {row.internalPhone || t('users.unassigned')}
                </button>
              )}
            </div>
          </div>
        );
      },
    },
    ...(!isRahbar
      ? [
          {
            key: 'role',
            title: t('users.role'),
            render: (value: any) => <RoleBadge role={value} />,
          },
        ]
      : [
          {
            key: 'assignedAssetsCount',
            title: t('menu.assignedAssets') || 'Biriktirilgan jihozlar',
            render: (_: any, row: any) => {
              const count = row._count?.assignments ?? 0;
              return (
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold ${
                    count > 0
                      ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800'
                      : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                  }`}
                >
                  <span>📦</span>
                  <span>{count > 0 ? `${count} ${t('common.pcs')}` : 'Jihoz yo\'q'}</span>
                </span>
              );
            },
          },
        ]),
    {
      key: 'createdAt',
      title: t('users.registeredDate'),
      render: (_: any, row: any) => (
        <span className="text-xs text-gray-500 font-mono">
          {row.createdAt ? formatDate(row.createdAt) : '—'}
        </span>
      ),
    },
    {
      key: 'isActive',
      title: t('common.status'),
      render: (value: any, row: any) => {
        const canToggleStatus =
          user?.role !== 'XODIM' &&
          user?.role !== 'RAHBAR' &&
          (user?.role !== 'KADR' || row.role === 'XODIM');

        return (
          <div className="py-0.5" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (canToggleStatus) toggleStatus(row.id);
              }}
              disabled={!canToggleStatus}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors select-none cursor-pointer ${
                !canToggleStatus ? 'cursor-default opacity-80' : 'hover:opacity-85 shadow-2xs'
              } ${
                value
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/60'
                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300/60'
              }`}
              title={canToggleStatus ? (value ? t('users.clickToBlock') : t('users.clickToActivate')) : ""}
            >
              {value ? <Unlock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Lock className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />}
              <span>{value ? t('users.active') : t('users.blocked')}</span>
            </button>
          </div>
        );
      },
    },
    {
      key: 'actions',
      title: t('common.actions'),
      className: 'text-right whitespace-nowrap w-[140px]',
      headerClassName: 'text-right',
      render: (_: any, row: any) => {
        const canToggleStatus =
          user?.role !== 'XODIM' &&
          user?.role !== 'RAHBAR' &&
          (user?.role !== 'KADR' || row.role === 'XODIM');

        return (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {activeTab === 'offboarded' ? (
              <button
                type="button"
                onClick={() => setAktModalUserId(row.id)}
                className="p-1.5 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/40 rounded-lg transition-colors cursor-pointer"
                title={t('offboarding.actionViewAkt')}
              >
                <FileText className="w-4 h-4" />
              </button>
            ) : (
              <>
                {canToggleStatus && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleStatus(row.id);
                    }}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      row.isActive
                        ? 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                        : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                    }`}
                    title={row.isActive ? t('users.blockUser') : t('users.activateUser')}
                  >
                    {row.isActive ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => navigate(`/users/${row.id}`)}
                  className="p-1.5 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/40 rounded-lg transition-colors cursor-pointer"
                  title={t('common.details')}
                >
                  <Eye className="w-4 h-4" />
                </button>
                {canManageUsers && (user?.role !== 'KADR' || row.role === 'XODIM') && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditUser(row);
                      setFormModal(true);
                    }}
                    className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition-colors cursor-pointer"
                    title={t('common.edit')}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
                {/* Offboarding button */}
                {canManageUsers &&
                  row.employmentStatus === 'ACTIVE' &&
                  (user?.role !== 'KADR' || row.role === 'XODIM') &&
                  row.role !== 'SUPER_ADMIN' &&
                  row.role !== 'RAHBAR' && (
                    <button
                      type="button"
                      onClick={() => setOffboardConfirmUser(row)}
                      className="p-1.5 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-lg transition-colors cursor-pointer"
                      title={t('offboarding.actionOffboard')}
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  )}
                {canDeleteUsers && (user?.role !== 'KADR' || row.role === 'XODIM') && (
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteUser(row);
                      setDeleteDialog(true);
                    }}
                    className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors cursor-pointer"
                    title={t('common.delete')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('users.title')}
        subtitle={t('users.totalUsers', { count: data?.total ?? 0 })}
        actions={
          <>
            <Button
              variant="outline"
              className="border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/20"
              onClick={handleExport}
              loading={exportLoading}
              disabled={exportLoading}
            >
              {t('common.excel')}
            </Button>
            {canManageUsers && (
              <>
                <Button
                  variant="outline"
                  icon={<Upload className="w-4 h-4" />}
                  onClick={() => setExcelModal(true)}
                >
                  {t('common.importExcel')}
                </Button>
                <Button
                  icon={<Plus className="w-4 h-4" />}
                  onClick={() => {
                    setEditUser(null);
                    setFormModal(true);
                  }}
                >
                  {t('users.newUser')}
                </Button>
              </>
            )}
          </>
        }
      />

      {/* Offboarding / Employee Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => handleTabChange('active')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'active'
              ? 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/30 shadow-2xs'
              : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-800'
          }`}
        >
          <UsersIcon className="w-4 h-4" />
          <span>{t('offboarding.tabAll')}</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('offboarding')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer relative ${
            activeTab === 'offboarding'
              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 shadow-2xs'
              : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>{t('offboarding.tabPending')}</span>
          {pendingCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-2xs font-extrabold bg-amber-500 text-white animate-pulse">
              {pendingCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('offboarded')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'offboarded'
              ? 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/30 shadow-2xs'
              : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-800'
          }`}
        >
          <UserMinus className="w-4 h-4" />
          <span>{t('offboarding.tabArchived')}</span>
        </button>
      </div>

      {activeTab === 'offboarding' ? (
        <PendingOffboardingsView
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
          }}
        />
      ) : (
        <>
          <SearchFilterCard
        searchPlaceholder={t('users.searchPlaceholder')}
        searchValue={search}
        onSearchChange={setSearch}
        filters={
          <div className="flex flex-wrap items-center gap-2">
            {isGlobalViewer && organizations.length > 0 && (
              <div className="w-52">
                <Select
                  options={organizations.map((org: any) => ({
                    value: org.id,
                    label: org.name,
                  }))}
                  placeholder={t('menu.organizations') || "Barcha tashkilotlar"}
                  value={orgFilter}
                  onChange={(e) => {
                    setOrgFilter(e.target.value);
                    setDeptFilter('');
                  }}
                />
              </div>
            )}
            <div className="w-48">
              <Select
                options={departments.map((d: any) => ({
                  value: d.id,
                  label: d.name,
                }))}
                placeholder={t('users.allDepts')}
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
              />
            </div>
            {isAdmin && (
              <div className="w-40">
                <Select
                  options={[
                    { value: 'SUPER_ADMIN', label: t('roles.SUPER_ADMIN') },
                    { value: 'RAHBAR', label: t('roles.RAHBAR') },
                    { value: 'VAZIRLIK_OMBORCHI', label: t('roles.VAZIRLIK_OMBORCHI') },
                    { value: 'ORG_ADMIN', label: t('roles.ORG_ADMIN') },
                    { value: 'ORG_OMBORCHI', label: t('roles.ORG_OMBORCHI') },
                    { value: 'KADR', label: t('roles.KADR') },
                    { value: 'XODIM', label: t('roles.XODIM') },
                  ]}
                  placeholder={t('users.role')}
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                />
              </div>
            )}
          </div>
        }
      />


      <Card className="rounded-2xl border-gray-200/90 dark:border-white/15 shadow-2xs overflow-hidden">
        {/* Mobile Employee Cards View (screens < 768px) */}
        <div className="md:hidden p-3.5 space-y-3">
          {isLoading ? (
            <div className="p-6 text-center text-sm text-gray-500">{t('common.loading')}</div>
          ) : users.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
              {t('users.emptyTitle')}
            </div>
          ) : (
            users.map((u: any) => (
              <div
                key={u.id}
                onClick={() => navigate(`/users/${u.id}`)}
                className="p-4 rounded-xl bg-white dark:bg-slate-900/90 border border-gray-200/80 dark:border-slate-800 shadow-2xs space-y-3 hover:border-teal-500 dark:hover:border-teal-600 transition-all duration-200 cursor-pointer active:scale-[0.99]"
              >
                {/* Employee Header: Avatar & Info */}
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-teal-600/10 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-sm border border-teal-500/20 shrink-0">
                    {u.fullName?.slice(0, 2).toUpperCase() || 'US'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                      {u.fullName}
                    </h4>
                    <p className="text-xs text-gray-400 truncate">
                      @{u.username} • {u.department?.name ?? t('userView.noDept')}
                    </p>
                  </div>
                  {!isRahbar ? (
                    <RoleBadge role={u.role} />
                  ) : u._count?.assignments ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                      📦 {u._count.assignments} {t('common.pcs')}
                    </span>
                  ) : null}
                </div>

                {/* Details & Status */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-slate-800 text-xs">
                  <span className="text-gray-500 dark:text-gray-400">
                    {u.position || t('users.specialist')}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${u.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'}`}>
                    {u.isActive ? t('users.active').toUpperCase() : t('users.blocked').toUpperCase()}
                  </span>
                </div>

                {/* Full Width Action: View Profile */}
                <Button
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/users/${u.id}`);
                  }}
                  className="w-full justify-center text-xs font-bold text-teal-600 dark:text-teal-400 border-teal-200/80 dark:border-teal-800/80 hover:bg-teal-50 dark:hover:bg-teal-950/40 rounded-xl py-2.5 flex items-center gap-2"
                >
                  <span>{t('profile.viewProfile')}</span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table View (screens >= 768px) */}
        <div className="hidden md:block">
          <Table
            columns={columns}
            data={users}
            loading={isLoading}
            rowKey={(row) => row.id}
            emptyTitle={t('users.emptyTitle')}
            emptyDescription={t('users.emptyDescription')}
            onRowClick={(row) => navigate(`/users/${row.id}`)}
          />
        </div>

        {data && (
          <div className="px-4 pb-3">
            <Pagination
              page={page}
              totalPages={data.totalPages || 1}
              total={data.total || 0}
              limit={limit}
              onPageChange={setPage}
            />
          </div>
        )}
      </Card>
      </>
      )}

      <UserFormModal
        open={formModal}
        onClose={() => {
          setFormModal(false);
          setEditUser(null);
        }}
        user={editUser}
        departments={departments}
      />

      <UserExcelImportModal
        open={excelModal}
        onClose={() => setExcelModal(false)}
      />

      <OffboardingConfirmModal
        open={!!offboardConfirmUser}
        onClose={() => setOffboardConfirmUser(null)}
        user={offboardConfirmUser}
        onSuccess={() => {
          handleTabChange('offboarding');
        }}
      />

      <OffboardingAktModal
        open={!!aktModalUserId}
        onClose={() => setAktModalUserId(null)}
        userId={aktModalUserId}
      />

      <ConfirmDialog
        open={deleteDialog}
        onClose={() => setDeleteDialog(false)}
        onConfirm={() => {
          if ((deleteUser?._count?.assignments ?? 0) > 0) {
            toast.error(
              t('users.deleteBlockedWithAssets', {
                name: deleteUser?.fullName,
                count: deleteUser?._count?.assignments,
              })
            );
            setDeleteDialog(false);
            return;
          }
          remove(deleteUser?.id);
        }}
        title={t('users.deleteTitle')}
        description={
          (deleteUser?._count?.assignments ?? 0) > 0
            ? t('users.deleteBlockedWithAssets', {
                name: deleteUser?.fullName,
                count: deleteUser?._count?.assignments,
              })
            : t('users.deleteConfirmDesc', { name: deleteUser?.fullName })
        }
        confirmText={(deleteUser?._count?.assignments ?? 0) > 0 ? t('common.understood') : t('common.delete')}
        variant={(deleteUser?._count?.assignments ?? 0) > 0 ? 'warning' : 'danger'}
        loading={deleteLoading}
      />
    </div>
  );
}
