import { useQuery } from '@tanstack/react-query';
import { productsApi } from '../../api';
import Modal from '../../components/ui/modal';
import { TableSkeleton } from '../../components/ui/spinner';
import { OperationTypeBadge } from '../../components/ui/badge';
import CopyableInventoryNumber from '../../components/ui/copyable-inventory-number';
import { formatDate } from '../../lib/utils';

import { useTranslation } from '../../hooks/useTranslation';
interface Props {
  open: boolean;
  onClose: () => void;
  product: any;
}
export default function ProductHistoryModal({ open, onClose, product }: Props) {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['product-history', product?.id],
    queryFn: () => productsApi.getHistory(product.id),
    enabled: !!product?.id && open,
  });
  const history = data?.items ?? [];
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('products.historyTitle', { name: product?.name })}
      subtitle={t('products.historySubtitle')}
      size="xl"
    >
      {isLoading ? (
        <TableSkeleton rows={5} cols={4} />
      ) : history.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
          {t('products.noHistory')}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  {t('history.operation')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  {t('products.qty')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  {t('products.userDept')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  {t('products.performedBy')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  {t('common.date')}
                </th>
              </tr>
            </thead>
            <tbody>
              {history.map((item: any) => (
                <tr
                  key={item.id}
                  className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30"
                >
                  <td className="px-4 py-3">
                    <OperationTypeBadge type={item.type} />
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span>{item.quantity} {t('common.pcs')}</span>
                      {item.asset?.inventoryNumber && (
                        <CopyableInventoryNumber
                          value={item.asset.inventoryNumber}
                          size="2xs"
                        />
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {item.user?.fullName ?? item.department?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {item.performedBy?.fullName ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">
                    {formatDate(item.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}