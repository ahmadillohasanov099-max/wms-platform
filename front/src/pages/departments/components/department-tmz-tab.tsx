import Card, { CardContent } from '../../../components/ui/card';
import Table from '../../../components/ui/table';
import { formatDate } from '../../../lib/utils';
import { useTranslation } from '../../../hooks/useTranslation';

interface DepartmentTmzTabProps {
  tmzData: any;
  isLoading: boolean;
}

export default function DepartmentTmzTab({ tmzData, isLoading }: DepartmentTmzTabProps) {
  const { t } = useTranslation();

  const items = Array.isArray(tmzData)
    ? tmzData
    : tmzData?.items || tmzData?.data || [];

  const columns = [
    {
      key: 'productName',
      title: t('inventory.productName'),
      className: 'whitespace-normal break-words min-w-[200px] max-w-md',
      render: (_: any, row: any) => (
        <span className="font-semibold text-gray-900 dark:text-gray-100 whitespace-normal break-words">
          {row.product?.name || t('operations.product')}
        </span>
      ),
    },
    {
      key: 'quantity',
      title: t('inventory.quantity'),
      render: (val: any) => (
        <span className="font-bold text-teal-600 dark:text-teal-400 text-xs">
          {val} {t('common.pcs')}
        </span>
      ),
    },
    {
      key: 'documentNumber',
      title: t('common.documentNumber'),
      render: (val: any) => (
        <span className="font-mono text-xs text-slate-600 dark:text-slate-400">
          {val || '—'}
        </span>
      ),
    },
    {
      key: 'performedBy',
      title: t('userView.givenBy'),
      render: (_: any, row: any) => (
        <span className="text-xs text-slate-700 dark:text-slate-300">
          {row.performedBy?.fullName || '—'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      title: t('common.date'),
      render: (val: any) => (
        <span className="text-xs text-slate-500 font-mono">
          {val ? formatDate(val) : '—'}
        </span>
      ),
    },
  ];

  return (
    <Card>
      <CardContent className="p-0">
        <Table
          columns={columns}
          data={items}
          loading={isLoading}
          rowKey={(row) => row.id}
          emptyTitle={t('userView.noMaterialsDesc')}
        />
      </CardContent>
    </Card>
  );
}
