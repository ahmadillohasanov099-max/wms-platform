import { useState } from 'react';
import {
  Package,
  CornerDownLeft,
  ArrowLeftRight,
  Layers,
  Building2,
  CornerUpLeft,
  Trash2,
  PackageCheck,
  ArrowRight,
} from 'lucide-react';
import GiveToUserModal from './give-to-user-modal';
import ReturnFromUserModal from './return-from-user-modal';
import TransferUserModal from './transfer-user-modal';
import GiveTmzUserModal from './give-tmz-user-modal';
import GiveToDeptModal from './give-to-dept-modal';
import AssignToDeptModal from './assign-to-dept-modal';
import ReturnFromDeptModal from './return-from-dept-modal';
import WriteOffModal from './write-off-modal';
import { useAuthStore } from '../../store/auth.store';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../lib/utils';
import PageHeader from '../../components/ui/page-header';

export default function OperationsPage() {
  const { t } = useTranslation();
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ORG_ADMIN' || user?.role === 'ADMIN';

  const allOperations = [
    {
      id: 'give-to-user',
      category: t('operations.userOps'),
      title: t('operations.giveToUser'),
      description: t('operations.giveToUserDesc'),
      icon: <Package className="w-5 h-5" />,
      colorClass: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-200/80 dark:border-sky-900/40',
      hoverBorderClass: 'hover:border-sky-400/50 dark:hover:border-sky-500/40',
      accentText: 'text-sky-600 dark:text-sky-400',
    },
    {
      id: 'give-tmz-user',
      category: t('operations.userOps'),
      title: t('operations.giveTmzUserTitle'),
      description: t('operations.giveTmzUserDesc'),
      icon: <PackageCheck className="w-5 h-5" />,
      colorClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-900/40',
      hoverBorderClass: 'hover:border-emerald-400/50 dark:hover:border-emerald-500/40',
      accentText: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      id: 'return-from-user',
      category: t('operations.userOps'),
      title: t('operations.returnFromUser'),
      description: t('operations.returnFromUserDesc'),
      icon: <CornerDownLeft className="w-5 h-5" />,
      colorClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200/80 dark:border-amber-900/40',
      hoverBorderClass: 'hover:border-amber-400/50 dark:hover:border-amber-500/40',
      accentText: 'text-amber-600 dark:text-amber-400',
    },
    {
      id: 'transfer-user',
      category: t('operations.userOps'),
      title: t('operations.transferUser'),
      description: t('operations.transferUserDesc'),
      icon: <ArrowLeftRight className="w-5 h-5" />,
      colorClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200/80 dark:border-indigo-900/40',
      hoverBorderClass: 'hover:border-indigo-400/50 dark:hover:border-indigo-500/40',
      accentText: 'text-indigo-600 dark:text-indigo-400',
    },
    {
      id: 'give-to-dept',
      category: t('operations.deptOps'),
      title: t('operations.giveToDept'),
      description: t('operations.giveToDeptDesc'),
      icon: <Layers className="w-5 h-5" />,
      colorClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-900/40',
      hoverBorderClass: 'hover:border-emerald-400/50 dark:hover:border-emerald-500/40',
      accentText: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      id: 'assign-to-dept',
      category: t('operations.deptOps'),
      title: t('operations.assignToDept'),
      description: t('operations.assignToDeptDesc'),
      icon: <Building2 className="w-5 h-5" />,
      colorClass: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-200/80 dark:border-teal-900/40',
      hoverBorderClass: 'hover:border-teal-400/50 dark:hover:border-teal-500/40',
      accentText: 'text-teal-600 dark:text-teal-400',
    },
    {
      id: 'return-from-dept',
      category: t('operations.deptOps'),
      title: t('operations.returnFromDept'),
      description: t('operations.returnFromDeptDesc'),
      icon: <CornerUpLeft className="w-5 h-5" />,
      colorClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200/80 dark:border-amber-900/40',
      hoverBorderClass: 'hover:border-amber-400/50 dark:hover:border-amber-500/40',
      accentText: 'text-amber-600 dark:text-amber-400',
    },
    ...(isAdmin
      ? [
          {
            id: 'write-off',
            category: t('operations.warehouseOps'),
            title: t('operations.writeOff'),
            description: t('operations.writeOffDesc'),
            icon: <Trash2 className="w-5 h-5" />,
            colorClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200/80 dark:border-rose-900/40',
            hoverBorderClass: 'hover:border-rose-400/50 dark:hover:border-rose-500/40',
            accentText: 'text-rose-600 dark:text-rose-400',
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <PageHeader
        title={t('menu.operations')}
        subtitle={t('operations.subtitle')}
      />

      {}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {allOperations.map((op) => (
          <div
            key={op.id}
            onClick={() => setActiveModal(op.id)}
            className={cn(
              "group relative bg-white dark:bg-slate-900/80 dark:backdrop-blur-md p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-xl transition-transform transition-shadow duration-300 ease-out will-change-transform flex flex-col justify-between cursor-pointer hover:-translate-y-0.5",
              op.hoverBorderClass
            )}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700">
                  {op.category}
                </span>
                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white group-hover:bg-slate-200 dark:group-hover:bg-slate-700 flex items-center justify-center transition-colors">
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              <div className="flex items-start gap-3.5 mb-3">
                <div className={cn("p-3 rounded-xl border flex-shrink-0 group-hover:scale-105 transition-transform shadow-xs", op.colorClass)}>
                  {op.icon}
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-slate-900 dark:group-hover:text-white transition-colors leading-snug">
                  {op.title}
                </h3>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                {op.description}
              </p>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span className={cn("group-hover:font-bold transition-all", op.accentText)}>{t('operations.startOperation')}</span>
              <span className={op.accentText}>→</span>
            </div>
          </div>
        ))}
      </div>

      {}
      <GiveToUserModal
        open={activeModal === 'give-to-user'}
        onClose={() => setActiveModal(null)}
      />
      <ReturnFromUserModal
        open={activeModal === 'return-from-user'}
        onClose={() => setActiveModal(null)}
      />
      <TransferUserModal
        open={activeModal === 'transfer-user'}
        onClose={() => setActiveModal(null)}
      />
      <GiveTmzUserModal
        open={activeModal === 'give-tmz-user'}
        onClose={() => setActiveModal(null)}
      />
      <GiveToDeptModal
        open={activeModal === 'give-to-dept'}
        onClose={() => setActiveModal(null)}
      />
      <AssignToDeptModal
        open={activeModal === 'assign-to-dept'}
        onClose={() => setActiveModal(null)}
      />
      <ReturnFromDeptModal
        open={activeModal === 'return-from-dept'}
        onClose={() => setActiveModal(null)}
      />
      <WriteOffModal
        open={activeModal === 'write-off'}
        onClose={() => setActiveModal(null)}
      />
    </div>
  );
}