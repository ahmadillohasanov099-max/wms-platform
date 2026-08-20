import Card, { CardContent } from '../../../components/ui/card';
import Table from '../../../components/ui/table';
import CopyableInventoryNumber from '../../../components/ui/copyable-inventory-number';
import { formatDate } from '../../../lib/utils';

import { useTranslation } from '../../../hooks/useTranslation';

interface DepartmentAssetsTabProps {
  assetsData?: any;
  assignments?: any[];
  isLoading: boolean;
  isAdmin?: boolean;
  onReturnClick?: (item: any) => void;
}

export default function DepartmentAssetsTab({
  assetsData,
  assignments,
  isLoading,
  isAdmin,
  onReturnClick,
}: DepartmentAssetsTabProps) {
  const { t } = useTranslation();

  const items = Array.isArray(assignments)
    ? assignments
    : (assetsData?.items && assetsData.items.length > 0)
    ? assetsData.items
    : Array.isArray(assetsData)
    ? assetsData
    : assetsData?.data || [];

  const columns = [
    {
      key: 'productName',
      title: t('departments.assetsTableHeaderName'),
      className: 'whitespace-normal break-words min-w-[200px] max-w-md',
      render: (_: any, row: any) => (
        <span className="font-semibold text-gray-900 dark:text-gray-100 whitespace-normal break-words">
          {row.asset?.product?.name || row.product?.name || row.name || t('operations.asset')}
        </span>
      ),
    },
    {
      key: 'inventoryNumber',
      title: t('profile.headers.invNumber'),
      render: (_: any, row: any) => {
        const inv = row.asset?.inventoryNumber || row.inventoryNumber || row.note;
        return <CopyableInventoryNumber value={inv} />;
      },
    },

    {
      key: 'assignedUser',
      title: t('departments.assetsTableHeaderHolder'),
      render: (_: any, row: any) => (
        <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
          {row.user?.fullName || row.performedBy?.fullName || row.assignedToUser?.fullName || t('dashboard.departments')}
        </span>
      ),
    },
    {
      key: 'documentNumber',
      title: t('common.documentNumber'),
      render: (_: any, row: any) => (
        <span className="font-mono text-xs text-slate-600 dark:text-slate-400">
          {row.documentNumber || row.asset?.serialNumber || row.serialNumber || '—'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      title: t('common.date'),
      render: (_: any, row: any) => (
        <span className="text-xs text-slate-500 font-mono">
          {row.assignedAt || row.createdAt || row.updatedAt ? formatDate(row.assignedAt || row.createdAt || row.updatedAt) : '—'}
        </span>
      ),
    },
    ...(isAdmin && onReturnClick
      ? [
          {
            key: 'actions',
            title: t('common.actions'),
            render: (_: any, row: any) => (
              <button
                onClick={() => onReturnClick(row)}
                className="px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-all"
              >
                {t('userView.returnBtn')}
              </button>
            ),
          },
        ]
      : []),
  ];

  return (
    <Card>
      <CardContent className="p-0">
        <Table
          columns={columns}
          data={items}
          loading={isLoading}
          rowKey={(row: any) => String(row.id || row.assetId || row.inventoryNumber || Math.random())}
          emptyTitle={t('departments.noAssignedAssets')}
        />
      </CardContent>
    </Card>
  );
}
