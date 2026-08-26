import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Eye, Upload, Edit2, Trash2, Lock, Unlock, ChevronRight } from 'lucide-react';
import { usersApi, departmentsApi } from '../../api';
import { Card, Button, Select, Table, ConfirmDialog, RoleBadge, PageHeader, SearchFilterCard } from '../../components/ui';
import toast from 'react-hot-toast';
import UserFormModal from './user-form-modal';
import UserExcelImportModal from './user-excel-import-modal';
import { useAuthStore } from '../../store/auth.store';
import { downloadExport } from '../../lib/export';
import { useTranslation } from '../../hooks/useTranslation';
import { useDebounce } from '../../hooks/useDebounce';
import { formatDate, invalidateAppQueries } from '../../lib/utils';

export default function UsersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const canManageUsers = user?.role === 'SUPER_ADMIN' || user?.role === 'ORG_ADMIN' || user?.role === 'ADMIN' || user?.role === 'KADR';
  const canDeleteUsers = user?.role === 'SUPER_ADMIN' || user?.role === 'ORG_ADMIN' || user?.role === 'ADMIN';

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [roleFilter, setRoleFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [formModal, setFormModal] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [excelModal, setExcelModal] = useState(false);

  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteUser, setDeleteUser] = useState<any>(null);

  const [internalPhoneEdit, setInternalPhoneEdit] = useState<string | null>(null);
  const [internalPhoneValue, setInternalPhoneValue] = useState('');

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
    queryKey: ['users', debouncedSearch, roleFilter, deptFilter],
    queryFn: () =>
      usersApi.getAll({
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(roleFilter && { role: roleFilter }),
        ...(deptFilter && { departmentId: deptFilter }),
        limit: 50,
      }),
  });

  const handleExport = async () => {
    try {
      await downloadExport(
        '/users/export',
        `xodimlar_${new Date().toISOString().split('T')[0]}.xlsx`,
        {
          ...(search && { search }),
          ...(roleFilter && { role: roleFilter }),
          ...(deptFilter && { departmentId: deptFilter }),
        }
      );
      toast.success(t('users.exportSuccess'));
    } catch {
      toast.error(t('users.exportError'));
    }
  };

  const { data: depts } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.getAll(),
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
          <p className="font-semibold text-gray-900 dark:text-gray-100 text-xs sm:text-sm">
            {row.fullName}
          </p>
          <span className="text-2xs font-mono text-gray-500 dark:text-gray-400">
            @{row.username}
          </span>
        </div>
      ),
    },
    {
      key: 'department',
      title: t('users.department'),
      className: 'min-w-[200px] max-w-[280px]',
      render: (_: any, row: any) => {
        const isStaff = row.role === 'ADMIN' || row.role === 'SUPER_ADMIN' || row.role === 'OMBORCHI' || row.role === 'VAZIRLIK_OMBORCHI' || row.role === 'KADR';
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
                    if (canManageUsers) {
                      setInternalPhoneEdit(row.id);
                      setInternalPhoneValue(row.internalPhone || '');
                    }
                  }}
                  className={`text-xs font-mono font-bold transition-colors ${
                    row.internalPhone
                      ? 'text-blue-600 dark:text-blue-400 border-b border-dashed border-blue-300 dark:border-blue-700'
                      : 'text-gray-400 dark:text-gray-500 italic border-b border-dashed border-gray-300 dark:border-gray-700'
                  } ${canManageUsers ? 'hover:text-primary-600 dark:hover:text-primary-400 cursor-pointer' : ''}`}
                  title={canManageUsers ? t('users.clickToEditInternalPhone') : ''}
                >
                  {row.internalPhone || t('users.unassigned')}
                </button>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: 'role',
      title: t('users.role'),
      render: (value: any) => <RoleBadge role={value} />,
    },
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
        const canToggleStatus = user?.role !== 'XODIM';

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
        const canToggleStatus = user?.role !== 'XODIM';

        return (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
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
            {canManageUsers && (
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
            {canDeleteUsers && (
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

      <SearchFilterCard
        searchPlaceholder={t('users.searchPlaceholder')}
        searchValue={search}
        onSearchChange={setSearch}
        filters={
          <div className="flex flex-wrap items-center gap-2">
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
            <div className="w-40">
              <Select
                options={[
                  { value: 'SUPER_ADMIN', label: t('roles.SUPER_ADMIN') },
                  { value: 'VAZIRLIK_OMBORCHI', label: t('roles.VAZIRLIK_OMBORCHI') },
                  { value: 'ORG_ADMIN', label: t('roles.ORG_ADMIN') },
                  { value: 'ORG_OMBORCHI', label: t('roles.ORG_OMBORCHI') },
                  { value: 'ADMIN', label: t('roles.ADMIN') },
                  { value: 'OMBORCHI', label: t('roles.OMBORCHI') },
                  { value: 'KADR', label: t('roles.KADR') },
                  { value: 'XODIM', label: t('roles.XODIM') },
                ]}
                placeholder={t('users.role')}
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              />
            </div>
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
                  <RoleBadge role={u.role} />
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
      </Card>

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

      <ConfirmDialog
        open={deleteDialog}
        onClose={() => setDeleteDialog(false)}
        onConfirm={() => remove(deleteUser?.id)}
        title={t('users.deleteTitle')}
        description={t('users.deleteConfirmDesc', { name: deleteUser?.fullName })}
        confirmText={t('common.delete')}
        loading={deleteLoading}
      />
    </div>
  );
}
