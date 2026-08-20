import { cn } from "../../lib/utils";
import { useTranslation } from "../../hooks/useTranslation";
export type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'purple'
  | 'gray';
interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}
const variants: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  danger:  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  info:    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  purple:  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  gray:    'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};
export default function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center text-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ProductTypeBadge({ type }: { type: string }) {
  const { t } = useTranslation();
  const map: Record<string, { label: string; variant: BadgeVariant }> = {
    ASSET:          { label: t('inventory.typeAsset'), variant: 'info' },
    BERILADIGAN:    { label: t('inventory.typeAsset'), variant: 'info' },
    CONSUMABLE:     { label: t('inventory.typeConsumable'), variant: 'warning' },
    SARFLANADIGAN:  { label: t('inventory.typeConsumable'), variant: 'warning' },
    SHARED:         { label: t('stats.typeShared'), variant: 'purple' },
  };
  const item = map[type] ?? { label: type, variant: 'default' };
  return <Badge variant={item.variant}>{item.label}</Badge>;
}

export function OperationTypeBadge({ type }: { type: string }) {
  const { t } = useTranslation();
  const map: Record<string, { label: string; variant: BadgeVariant }> = {
    STOCK_IN:         { label: t('history.ops.STOCK_IN'), variant: 'success' },
    GIVE_TO_USER:     { label: t('history.ops.GIVE_TO_USER'), variant: 'info' },
    RETURN_FROM_USER: { label: t('history.ops.RETURN_FROM_USER'), variant: 'warning' },
    TRANSFER_USER:    { label: t('history.ops.TRANSFER_USER'), variant: 'purple' },
    GIVE_TO_DEPT:     { label: t('history.ops.GIVE_TO_DEPT'), variant: 'info' },
    ASSIGN_TO_DEPT:   { label: t('history.ops.ASSIGN_TO_DEPT'), variant: 'info' },
    RETURN_FROM_DEPT: { label: t('history.ops.RETURN_FROM_DEPT'), variant: 'warning' },
    WRITE_OFF:        { label: t('history.ops.WRITE_OFF'), variant: 'danger' },
  };
  const item = map[type] ?? { label: type, variant: 'default' };
  return <Badge variant={item.variant}>{item.label}</Badge>;
}

export function AssetStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const map: Record<string, { label: string; variant: BadgeVariant }> = {
    ACTIVE:      { label: t('profile.statusLabels.ACTIVE'), variant: 'success' },
    BROKEN:      { label: t('profile.statusLabels.BROKEN'), variant: 'danger' },
    LOST:        { label: t('profile.statusLabels.LOST'), variant: 'danger' },
    WRITTEN_OFF: { label: t('profile.statusLabels.WRITTEN_OFF'), variant: 'gray' },
  };
  const item = map[status] ?? { label: status, variant: 'default' };
  return <Badge variant={item.variant}>{item.label}</Badge>;
}

export function RoleBadge({ role }: { role: string }) {
  const { t } = useTranslation();
  const roleKey = `roles.${role}`;
  const translatedRole = t(roleKey);
  const fallbackLabel = translatedRole !== roleKey ? translatedRole : (role || '—');

  const variantMap: Record<string, BadgeVariant> = {
    SUPER_ADMIN: 'danger',
    VAZIRLIK_OMBORCHI: 'purple',
    ORG_ADMIN: 'danger',
    ORG_OMBORCHI: 'info',
    ADMIN: 'danger',
    OMBORCHI: 'info',
    KADR: 'purple',
    XODIM: 'success',
  };

  return <Badge variant={variantMap[role] || 'default'}>{fallbackLabel}</Badge>;
}