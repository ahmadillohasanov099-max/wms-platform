import { NavLink, useLocation } from 'react-router-dom';
import {
  User,
  Package,
  History,
  Lock,
  LayoutDashboard,
  Warehouse,
  ArrowLeftRight,
  BarChart3,
  Users,
} from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { useTranslation } from '../../hooks/useTranslation';

export default function MobileBottomNav() {
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const location = useLocation();

  if (!user) return null;

  const isXodim = user.role === 'XODIM';

  const xodimItems = [
    { path: '/profile/info', label: t('menu.profileInfo'), icon: <User className="w-5 h-5" /> },
    { path: '/profile/assets', label: t('menu.profileAssets'), icon: <Package className="w-5 h-5" /> },
    { path: '/profile/activity', label: t('menu.profileActivity'), icon: <History className="w-5 h-5" /> },
    { path: '/profile/security', label: t('menu.profileSecurity'), icon: <Lock className="w-5 h-5" /> },
  ];

  const managerItems = [
    { path: '/dashboard', label: t('menu.dashboard'), icon: <LayoutDashboard className="w-5 h-5" /> },
    { path: '/inventory', label: t('menu.inventory'), icon: <Warehouse className="w-5 h-5" /> },
    { path: '/operations', label: t('menu.operations'), icon: <ArrowLeftRight className="w-5 h-5" /> },
    { path: '/stats', label: t('menu.stats'), icon: <BarChart3 className="w-5 h-5" /> },
    { path: '/users', label: t('menu.users'), icon: <Users className="w-5 h-5" /> },
  ];

  const items = isXodim ? xodimItems : managerItems;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-gray-200 dark:border-slate-800 px-1 py-1.5 shadow-lg">
      <div className="flex items-center justify-around">
        {items.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-bold transition-all duration-200 select-none ${
                isActive
                  ? 'text-teal-600 dark:text-teal-400 scale-105'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              <span className={isActive ? 'text-teal-600 dark:text-teal-400' : ''}>{item.icon}</span>
              <span className="truncate max-w-[65px] text-center leading-tight">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
