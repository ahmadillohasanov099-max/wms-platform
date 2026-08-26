import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { departmentsApi, usersApi } from '../../api';
import { PageLoader } from '../../components/ui/spinner';
import PageHeader from '../../components/ui/page-header';
import { useAuthStore } from '../../store/auth.store';
import { useTranslation } from '../../hooks/useTranslation';
import Card, { CardHeader, CardContent } from '../../components/ui/card';
import { RoleBadge } from '../../components/ui/badge';
import DepartmentAssetsTab from '../departments/components/department-assets-tab';
import { cn } from '../../lib/utils';
import {
  Building2,
  Users,
  Search,
  Phone,
  Briefcase,
  UserCheck,
  AlertCircle,
  Package,
  ShieldCheck,
} from 'lucide-react';

export default function ProfileDepartmentPage() {
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'employees' | 'assets'>('employees');

  // Fetch logged-in user detail
  const { data: userDetailData } = useQuery({
    queryKey: ['profile-user-detail-dept', user?.id],
    queryFn: () => usersApi.getOne(user!.id),
    enabled: !!user?.id,
  });

  const currentUser = userDetailData || user;
  const departmentId = currentUser?.departmentId || currentUser?.department?.id;

  // Fetch department details
  const { data: department, isLoading: isDeptLoading } = useQuery({
    queryKey: ['profile-department-detail', departmentId],
    queryFn: () => departmentsApi.getOne(departmentId!),
    enabled: !!departmentId,
  });

  // Fetch all department employees/colleagues
  const { data: usersData, isLoading: isUsersLoading } = useQuery({
    queryKey: ['profile-department-users', departmentId],
    queryFn: () => usersApi.getAll({ departmentId: departmentId!, limit: 100 }),
    enabled: !!departmentId,
  });

  if (!currentUser) return <PageLoader />;

  const isLoading = isDeptLoading || isUsersLoading;

  const rawUsers = usersData as any;
  let employees: any[] = Array.isArray(rawUsers)
    ? rawUsers
    : Array.isArray(rawUsers?.items)
    ? rawUsers.items
    : Array.isArray(rawUsers?.data)
    ? rawUsers.data
    : [];

  // Fallback: If empty, show current user
  if (employees.length === 0 && currentUser) {
    employees = [currentUser];
  }

  const deptName = department?.name || currentUser?.department?.name || t('userView.noDept');
  const deptDesc = department?.description || "Bo'lim xodimlari va apparat tarkibi";
  const isLeader = !!(department?.leaderId && currentUser?.id && department.leaderId === currentUser.id);
  const deptAssignments = department?.assignments || [];

  const filteredEmployees = employees.filter((emp) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    const fullName = (emp.fullName || '').toLowerCase();
    const position = (emp.position || '').toLowerCase();
    const username = (emp.username || '').toLowerCase();
    const phone = (emp.phone || '').toLowerCase();
    return fullName.includes(q) || position.includes(q) || username.includes(q) || phone.includes(q);
  });

  const activeCount = employees.filter((e) => e.isActive !== false).length;

  return (
    <div className="space-y-6 max-w-6xl pb-10">
      <PageHeader
        title={t('menu.myDepartment')}
        subtitle={`${deptName} — ma'lumotlari va hamkasblar`}
      />

      {!departmentId ? (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-8 text-center text-amber-800 dark:text-amber-300 space-y-3">
          <AlertCircle className="w-12 h-12 mx-auto text-amber-500" />
          <h3 className="text-lg font-bold">Bo'lim biriktirilmagan</h3>
          <p className="text-sm max-w-md mx-auto text-amber-700 dark:text-amber-400">
            Siz hali tizimda hech qanday bo'limga rasman biriktirilmagansiz. Bo'limingizni kiritish uchun Kadrlar bo'limi yoki Administratorga murojaat qiling.
          </p>
        </div>
      ) : (
        <>
          {/* Department Banner & Overview */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-teal-600/10 via-teal-500/5 to-transparent border border-gray-200/90 dark:border-white/15 backdrop-blur-xl shadow-2xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-md shrink-0 border border-teal-500/20">
                  <Building2 className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                      {deptName}
                    </h2>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-teal-100 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 border border-teal-300/60 dark:border-teal-800">
                      {employees.length} ta xodim
                    </span>
                    {isLeader && (
                      <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-amber-500 text-white shadow-xs flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" /> Siz bo'lim boshlig'isiz
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {deptDesc}
                  </p>
                  {department?.leader && !isLeader && (
                    <p className="text-xs font-semibold text-teal-600 dark:text-teal-400 mt-1 flex items-center gap-1">
                      <span className="text-gray-400 font-normal">Bo'lim rahbari:</span> {department.leader.fullName}
                    </p>
                  )}
                </div>
              </div>

              {/* Stats pill */}
              <div className="flex items-center gap-3">
                <div className="bg-white/80 dark:bg-slate-900/80 px-4 py-3 rounded-xl border border-gray-200/90 dark:border-white/15 shadow-2xs flex items-center gap-3">
                  <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-lg">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">
                      Faol hamkasblar
                    </p>
                    <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                      {activeCount} / {employees.length} ta
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Tabs for Department Page */}
          <div className="flex border-b border-gray-200 dark:border-gray-800 gap-2">
            <button
              onClick={() => setActiveTab('employees')}
              className={cn(
                'px-4 py-2.5 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer',
                activeTab === 'employees'
                  ? 'border-teal-600 text-teal-600 dark:text-teal-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              )}
            >
              <Users className="w-4 h-4" />
              <span>Hamkasblar ({employees.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('assets')}
              className={cn(
                'px-4 py-2.5 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer',
                activeTab === 'assets'
                  ? 'border-teal-600 text-teal-600 dark:text-teal-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              )}
            >
              <Package className="w-4 h-4" />
              <span>Bo'lim jihozlari ({deptAssignments.length})</span>
            </button>
          </div>

          {activeTab === 'assets' ? (
            <DepartmentAssetsTab
              assignments={deptAssignments}
              isLoading={isDeptLoading}
              isLeader={isLeader}
            />
          ) : (
            <Card className="rounded-2xl border-gray-200/90 dark:border-white/15 shadow-2xs overflow-hidden">
              <CardHeader
                title={
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                      <span className="font-bold">Bo'lim xodimlari va hamkasblar</span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 font-extrabold border border-teal-200 dark:border-teal-900/50">
                        {filteredEmployees.length} ta
                      </span>
                    </div>

                  {/* Search bar */}
                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Hamkasblarni qidirish..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-slate-800/60 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30 transition-all"
                    />
                  </div>
                </div>
              }
              className="border-b border-gray-100 dark:border-slate-800/60 pb-3.5"
            />

            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8">
                  <PageLoader />
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400 flex flex-col items-center gap-2">
                  <Users className="w-10 h-10 text-gray-300 dark:text-slate-700 stroke-1" />
                  <span>Xodimlar topilmadi</span>
                </div>
              ) : (
                <>
                  {/* Mobile Cards View */}
                  <div className="md:hidden p-3.5 space-y-3">
                    {filteredEmployees.map((emp: any) => {
                      const isMe = emp.id === currentUser.id;
                      return (
                        <div
                          key={emp.id}
                          className={cn(
                            'p-4 rounded-xl border transition-all duration-200 space-y-3',
                            isMe
                              ? 'bg-teal-50/60 dark:bg-teal-950/30 border-teal-300 dark:border-teal-800/80 shadow-xs'
                              : 'bg-white dark:bg-slate-900/90 border-gray-200/80 dark:border-slate-800'
                          )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-teal-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                                {emp.fullName?.slice(0, 2).toUpperCase() || 'US'}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                                    {emp.fullName}
                                  </h4>
                                  {isMe && (
                                    <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-teal-600 text-white">
                                      Siz
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {emp.position || 'Lavozim ko\'rsatilmagan'}
                                </p>
                              </div>
                            </div>
                            <RoleBadge role={emp.role} />
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 dark:border-slate-800 text-xs">
                            <div>
                              <span className="text-gray-400 block">Telefon:</span>
                              <span className="font-semibold text-gray-700 dark:text-gray-300">
                                {emp.phone || '—'}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-400 block">Ichki raqam:</span>
                              <span className="font-mono font-bold text-teal-600 dark:text-teal-400">
                                {emp.internalPhone || '—'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200/70 dark:border-slate-800/80 text-left bg-gray-50/70 dark:bg-slate-800/40">
                          <th className="px-5 py-3.5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Xodim (Ismi Familiyasi)
                          </th>
                          <th className="px-5 py-3.5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Lavozimi
                          </th>
                          <th className="px-5 py-3.5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Roli
                          </th>
                          <th className="px-5 py-3.5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Telefon
                          </th>
                          <th className="px-5 py-3.5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Ichki Tel.
                          </th>
                          <th className="px-5 py-3.5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Holati
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-slate-800/50">
                        {filteredEmployees.map((emp: any) => {
                          const isMe = emp.id === currentUser.id;
                          return (
                            <tr
                              key={emp.id}
                              className={cn(
                                'transition-colors duration-200',
                                isMe
                                  ? 'bg-teal-50/50 dark:bg-teal-950/30 font-semibold'
                                  : 'hover:bg-gray-50/50 dark:hover:bg-slate-800/30'
                              )}
                            >
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-teal-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                                    {emp.fullName?.slice(0, 2).toUpperCase() || 'US'}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-900 dark:text-white">
                                        {emp.fullName}
                                      </span>
                                      {isMe && (
                                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-teal-600 text-white">
                                          Siz
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-xs text-gray-400">@{emp.username}</span>
                                  </div>
                                </div>
                              </td>

                              <td className="px-5 py-3.5 text-slate-700 dark:text-slate-200 font-medium">
                                <div className="flex items-center gap-1.5">
                                  <Briefcase className="w-3.5 h-3.5 text-gray-400" />
                                  <span>{emp.position || '—'}</span>
                                </div>
                              </td>

                              <td className="px-5 py-3.5">
                                <RoleBadge role={emp.role} />
                              </td>

                              <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300 font-medium text-xs">
                                <div className="flex items-center gap-1.5">
                                  <Phone className="w-3.5 h-3.5 text-gray-400" />
                                  <span>{emp.phone || '—'}</span>
                                </div>
                              </td>

                              <td className="px-5 py-3.5 text-teal-600 dark:text-teal-400 font-mono font-bold text-xs">
                                {emp.internalPhone || '—'}
                              </td>

                              <td className="px-5 py-3.5">
                                <span
                                  className={cn(
                                    'inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border',
                                    emp.isActive !== false
                                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/60'
                                      : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/60'
                                  )}
                                >
                                  {emp.isActive !== false ? 'Faol' : 'Bloklangan'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          )}
        </>
      )}
    </div>
  );
}

