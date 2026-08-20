import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Users, Building2 } from 'lucide-react';
import { departmentsApi } from '../../api';
import { Card, Button, ConfirmDialog, PageHeader, SearchFilterCard } from '../../components/ui';
import toast from 'react-hot-toast';
import DepartmentFormModal from './departments-form-modal';
import DepartmentDetailView from './department-detail-view';
import { useAuthStore } from '../../store/auth.store';
import { downloadExport } from '../../lib/export';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../hooks/useTranslation';
import { useNavigate, useParams } from 'react-router-dom';

export default function DepartmentsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role !== 'XODIM' && user?.role !== 'KADR';
  const navigate = useNavigate();
  const { id, userId } = useParams();

  const [search, setSearch] = useState('');
  const [formModal, setFormModal] = useState(false);
  const [editDept, setEditDept] = useState<any>(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteDept, setDeleteDept] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.getAll(),
  });

  const { mutate: remove, isPending: deleteLoading } = useMutation({
    mutationFn: (id: string) => departmentsApi.remove(id),
    onSuccess: () => {
      toast.success(t('departments.deleteSuccess'));
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setDeleteDialog(false);
    },
    onError: (err: any) => {
      toast.error(err?.message || err?.response?.data?.message || t('common.error'));
    },
  });

  const departments = data ?? [];

  const filtered = departments.filter(
    (d: any) =>
      !search || d.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleExport = async () => {
    try {
      await downloadExport(
        '/departments/export',
        `bolimlar_${new Date().toISOString().split('T')[0]}.csv`
      );
      toast.success(t('departments.exportSuccess'));
    } catch {
      toast.error(t('departments.exportError'));
    }
  };

  if (id) {
    return (
      <DepartmentDetailView
        departmentId={id}
        selectedUserId={userId}
        onBack={() => navigate('/departments')}
        onSelectUser={(uId) => navigate(`/departments/${id}/users/${uId}`)}
        onBackToDept={() => navigate(`/departments/${id}`)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('departments.title')}
        subtitle={t('departments.subtitle')}
        actions={
          <>
            <Button
              variant="outline"
              className="border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/30"
              onClick={handleExport}
            >
              {t('common.excel')}
            </Button>
            {isAdmin && (
              <Button
                icon={<Plus className="w-4 h-4" />}
                onClick={() => {
                  setEditDept(null);
                  setFormModal(true);
                }}
              >
                {t('departments.newDept')}
              </Button>
            )}
          </>
        }
      />

      <SearchFilterCard
        searchPlaceholder={t('departments.searchPlaceholder')}
        searchValue={search}
        onSearchChange={setSearch}
      />

      {isLoading ? (
        <Card className="p-8 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="text-center py-12">
          <div className="text-gray-500 dark:text-gray-400 font-medium">
            {t('departments.emptyTitle')}
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {t('departments.emptyDescription')}
          </div>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((row: any) => (
            <div
              key={row.id}
              onClick={() => navigate(`/departments/${row.id}`)}
              className={cn(
                'group relative z-0 hover:z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-2xl',
                'bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl border border-gray-200/90 dark:border-white/15 shadow-xs',
                'transition-all duration-300 ease-out cursor-pointer gap-4',
                'hover:shadow-lg hover:border-teal-500/40 dark:hover:border-teal-500/40 hover:bg-gray-50/90 dark:hover:bg-slate-800/80'
              )}
            >
              {}
              <div className="flex items-center gap-4 min-w-0">
                <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-teal-600 dark:text-teal-400 border border-slate-200/80 dark:border-slate-700/60 group-hover:scale-110 group-hover:-rotate-3 group-hover:border-teal-500/30 transition-all duration-300 ease-out flex-shrink-0 shadow-2xs">
                  <Building2 className="w-5 h-5 transition-transform duration-300 ease-out group-hover:scale-105" />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <h3 className="font-bold text-slate-900 dark:text-white text-base group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors duration-300">
                    {row.name}
                  </h3>
                  {row.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 transition-colors duration-300">
                      {row.description}
                    </p>
                  )}
                </div>
              </div>

              {}
              <div className="flex items-center justify-between sm:justify-end gap-5">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 group-hover:border-teal-200 dark:group-hover:border-teal-900 transition-colors duration-300">
                  <Users className="w-4 h-4 text-teal-600 dark:text-teal-400 group-hover:scale-110 transition-transform duration-300" />
                  <span>{row._count?.users ?? 0} {t('menu.users').toLowerCase()}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/30 px-3 py-1.5 text-xs font-bold transition-all duration-300 rounded-xl"
                    onClick={(e: any) => {
                      e.stopPropagation();
                      navigate(`/departments/${row.id}`);
                    }}
                  >
                    <span>{t('departments.stats')}</span>
                    <span className="inline-block group-hover:translate-x-1 transition-transform duration-300">→</span>
                  </Button>
                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e: any) => {
                          e.stopPropagation();
                          setEditDept(row);
                          setFormModal(true);
                        }}
                        className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all duration-300 hover:scale-105"
                        title={t('common.edit')}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e: any) => {
                          e.stopPropagation();
                          setDeleteDept(row);
                          setDeleteDialog(true);
                        }}
                        className="p-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-all duration-300 hover:scale-105"
                        title={t('common.delete')}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <DepartmentFormModal
        open={formModal}
        onClose={() => {
          setFormModal(false);
          setEditDept(null);
        }}
        department={editDept}
      />

      <ConfirmDialog
        open={deleteDialog}
        onClose={() => setDeleteDialog(false)}
        onConfirm={() => remove(deleteDept?.id)}
        title={t('departments.deleteTitle')}
        description={t('departments.deleteConfirmDesc', { name: deleteDept?.name })}
        confirmText={t('common.delete')}
        loading={deleteLoading}
      />
    </div>
  );
}