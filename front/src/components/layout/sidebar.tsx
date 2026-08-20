import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Users,
  ArrowLeftRight,
  History,
  BarChart3,
  LogOut,
  User,
  Warehouse,
  Package,
  PackageCheck,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { useUiStore } from '../../store/ui.store';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../lib/utils';
import type { UserRole } from '../../types';

interface NavItem {
  path: string;
  labelKey: string;
  customLabel?: string;
  icon: React.ReactNode;
  roles: UserRole[];
  showBadge?: boolean;
}

const navItems: NavItem[] = [
  {
    path: '/dashboard',
    labelKey: 'dashboard',
    icon: <LayoutDashboard className="w-4 h-4" />,
    roles: ['SUPER_ADMIN', 'VAZIRLIK_OMBORCHI', 'ORG_ADMIN', 'ORG_OMBORCHI', 'ADMIN', 'OMBORCHI'],
  },

  {
    path: '/inventory',
    labelKey: 'inventory',
    icon: <Warehouse className="w-4 h-4" />,
    roles: ['SUPER_ADMIN', 'VAZIRLIK_OMBORCHI', 'ORG_ADMIN', 'ORG_OMBORCHI', 'KADR', 'ADMIN', 'OMBORCHI'],
  },
  {
    path: '/operations',
    labelKey: 'operations',
    icon: <ArrowLeftRight className="w-4 h-4" />,
    roles: ['SUPER_ADMIN', 'VAZIRLIK_OMBORCHI', 'ORG_ADMIN', 'ORG_OMBORCHI', 'ADMIN', 'OMBORCHI'],
  },
  {
    path: '/departments',
    labelKey: 'departments',
    icon: <Building2 className="w-4 h-4" />,
    roles: ['SUPER_ADMIN', 'VAZIRLIK_OMBORCHI', 'ORG_ADMIN', 'ORG_OMBORCHI', 'KADR', 'ADMIN', 'OMBORCHI'],
  },
  {
    path: '/users',
    labelKey: 'users',
    icon: <Users className="w-4 h-4" />,
    roles: ['SUPER_ADMIN', 'VAZIRLIK_OMBORCHI', 'ORG_ADMIN', 'ORG_OMBORCHI', 'KADR', 'ADMIN', 'OMBORCHI'],
  },

  {
    path: '/assigned-assets',
    labelKey: 'assignedAssets',
    icon: <PackageCheck className="w-4 h-4" />,
    roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'ADMIN', 'KADR'],
  },
  {
    path: '/history',
    labelKey: 'history',
    icon: <History className="w-4 h-4" />,
    roles: ['SUPER_ADMIN', 'VAZIRLIK_OMBORCHI', 'ORG_ADMIN', 'ORG_OMBORCHI', 'KADR', 'ADMIN', 'OMBORCHI'],
  },
  {
    path: '/stats',
    labelKey: 'stats',
    icon: <BarChart3 className="w-4 h-4" />,
    roles: ['SUPER_ADMIN', 'VAZIRLIK_OMBORCHI', 'ORG_ADMIN', 'ORG_OMBORCHI', 'ADMIN', 'OMBORCHI'],
  },
  {
    path: '/audit-logs',
    labelKey: 'auditLogs',
    icon: <ShieldCheck className="w-4 h-4 text-emerald-500" />,
    roles: ['SUPER_ADMIN'],
  },
  {
    path: '/organizations',
    labelKey: 'organizations',
    customLabel: 'Boshqarmalar',
    icon: <Building2 className="w-4 h-4 text-sky-500" />,
    roles: ['SUPER_ADMIN'],
  },
  {
    path: '/profile/info',
    labelKey: 'profileInfo',
    icon: <User className="w-4 h-4" />,
    roles: ['XODIM'],
  },
  {
    path: '/profile/department',
    labelKey: 'myDepartment',
    icon: <Building2 className="w-4 h-4" />,
    roles: ['XODIM'],
  },
  {
    path: '/profile/assets',
    labelKey: 'profileAssets',
    icon: <Package className="w-4 h-4" />,
    roles: ['XODIM'],
  },
  {
    path: '/profile/activity',
    labelKey: 'profileActivity',
    icon: <History className="w-4 h-4" />,
    roles: ['XODIM'],
  },
  {
    path: '/profile/security',
    labelKey: 'profileSecurity',
    icon: <Lock className="w-4 h-4" />,
    roles: ['XODIM'],
  },
];

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const { sidebarOpen, toggleSidebar } = useUiStore();
  const { t } = useTranslation();
  const location = useLocation();

  const isItemActive = (itemPath: string) => {
    return location.pathname === itemPath;
  };

  const filteredNavItems = navItems.filter(
    (item) => user && item.roles.includes(user.role),
  );

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const getRoleLabel = (role?: UserRole) => {
    if (!role) return t('roles.XODIM');
    return t(`roles.${role}`);
  };

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col shrink-0 transition-all duration-300 ease-in-out',
        'bg-white dark:bg-slate-900/95 dark:backdrop-blur-xl',
        'border border-gray-200 dark:border-white/15',
        'rounded-2xl shadow-xl overflow-hidden',
        'md:h-[calc(100vh-30px)] md:mt-[10px] md:mb-[20px] md:ml-[10px] md:z-20',
        sidebarOpen ? 'md:w-56' : 'md:w-16',
      )}
    >
      {/* Logo */}
      <div
        onClick={toggleSidebar}
        className={cn(
          "flex items-center border-b border-gray-200 dark:border-gray-800 h-16 cursor-pointer hover:bg-gray-50/55 dark:hover:bg-gray-800/30 transition-all duration-300",
          sidebarOpen ? "px-4 gap-2.5" : "justify-center px-0"
        )}
        title={sidebarOpen ? t('common.closeMenu') : t('common.openMenu')}
      >
        <img
          src="/vaz-logo.png"
          alt="Vazirlik Logo"
          className={cn(
            "object-contain flex-shrink-0 transition-all duration-200",
            sidebarOpen ? "w-8 h-8" : "w-9 h-9"
          )}
        />
        {sidebarOpen && (
          <span className="text-sm font-bold text-gray-900 dark:text-gray-100 tracking-wider truncate">
            WMS
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
        {filteredNavItems.map((item) => {
          const active = isItemActive(item.path);
          const labelText = item.customLabel || t(`menu.${item.labelKey}`);

          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => {
                if (window.innerWidth < 768 && sidebarOpen) {
                  toggleSidebar();
                }
              }}
              className={cn(
                'group flex items-center justify-between px-3.5 py-3 rounded-xl text-sm transition-colors duration-200 relative select-none cursor-pointer',
                active
                  ? 'bg-teal-600 text-white font-bold shadow-xs dark:bg-teal-600 dark:text-white'
                  : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800/80 hover:text-gray-900 dark:hover:text-white',
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex-shrink-0">{item.icon}</span>
                <span className={cn('truncate font-medium', !sidebarOpen && 'md:hidden')}>
                  {labelText}
                </span>
              </div>
            </NavLink>
          );
        })}
      </nav>

      {}
      <div className="px-2 py-3 border-t border-gray-200 dark:border-gray-800 space-y-0.5">
        {}
        <div
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg',
            sidebarOpen ? '' : 'justify-center',
          )}
        >
          <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-semibold text-teal-600 dark:text-teal-400">
              {user?.fullName?.slice(0, 2).toUpperCase() || 'US'}
            </span>
          </div>
          {sidebarOpen && (
            <div className="overflow-hidden min-w-0 flex-1">
              <p className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">
                {user?.fullName}
              </p>
              <p className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold truncate" title={user?.organization?.name || ''}>
                {user?.organization?.name || getRoleLabel(user?.role)}
              </p>
            </div>
          )}
        </div>

        {}
        <button
          onClick={handleLogout}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm',
            'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors',
            !sidebarOpen && 'justify-center',
          )}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {sidebarOpen && <span>{t('menu.logout')}</span>}
        </button>
      </div>
    </aside>
  );
}