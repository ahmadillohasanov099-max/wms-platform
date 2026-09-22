import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { productsApi } from '../../api';
import Modal from '../../components/ui/modal';
import { TableSkeleton } from '../../components/ui/spinner';
import { OperationTypeBadge } from '../../components/ui/badge';
import CopyableInventoryNumber from '../../components/ui/copyable-inventory-number';
import Pagination from '../../components/ui/pagination';
import { formatDate } from '../../lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  product: any;
}

export default function ProductHistoryModal({ open, onClose, product }: Props) {
  const [page, setPage] = useState(1);

  // Fetch full product details (for productType, inventory quantity, unit)
  const { data: fullProduct } = useQuery({
    queryKey: ['product-history-detail', product?.id],
    queryFn: () => (product?.id ? productsApi.getOne(product.id) : null),
    enabled: !!product?.id && open,
  });

  const activeProduct = fullProduct || product;
  const isConsumable = activeProduct?.productType === 'SARFLANADIGAN';
  const unitLabel = activeProduct?.unit ? String(activeProduct.unit).toLowerCase() : 'dona';

  // Fetch operations history
  const { data, isLoading } = useQuery({
    queryKey: ['product-history', product?.id, page],
    queryFn: () => productsApi.getHistory(product.id, { page, limit: 15 }),
    enabled: !!product?.id && open,
  });

  const history: any[] = data?.items ?? [];
  const total = data?.total ?? history.length;
  const totalPages = data?.totalPages ?? 1;

  // Jami sarflangan miqdor (faqat TMZ uchun)
  const totalConsumed = useMemo(() => {
    if (!isConsumable) return 0;
    return history
      .filter((i) => ['GIVE_TO_USER', 'GIVE_TO_DEPT'].includes(i.type))
      .reduce((sum, i) => sum + Number(i.quantity || 0), 0);
  }, [history, isConsumable]);

  // Eng so'nggi amalga qarab Asosiy Vositaning joriy holati (faqat BERILADIGAN uchun)
  const latestOp = history[0];
  const currentStatus = useMemo(() => {
    if (!latestOp || isConsumable) return null;
    switch (latestOp.type) {
      case 'GIVE_TO_USER':
      case 'TRANSFER_USER':
        return {
          holder: latestOp.user?.fullName || 'Xodim',
          dept: latestOp.user?.department?.name || null,
          isUser: true,
        };
      case 'RETURN_FROM_USER':
      case 'RETURN_FROM_DEPT':
      case 'STOCK_IN':
        return {
          holder: 'Omborda (mavjud)',
          dept: null,
          isWarehouse: true,
        };
      case 'GIVE_TO_DEPT':
      case 'ASSIGN_TO_DEPT':
        return {
          holder: latestOp.department?.name || 'Bo‘lim',
          dept: null,
          isDept: true,
        };
      case 'WRITE_OFF':
        return {
          holder: 'Hisobdan chiqarilgan',
          dept: null,
          isWrittenOff: true,
        };
      default:
        return null;
    }
  }, [latestOp, isConsumable]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={activeProduct?.name || 'Mahsulot tarixi'}
      subtitle={isConsumable ? 'TMZ (Sarflanadigan material) harakatlari tarixi' : 'Asosiy vosita (Jihoz) harakatlari tarixi'}
      size="2xl"
      className="max-h-[78vh] my-auto mt-12 sm:mt-auto"
    >
      <div className="space-y-2.5">
        {/* 1. Yuqori Pasport Satri: TMZ va Asosiy vosita uchun moslashtirilgan */}
        {isConsumable ? (
          /* TMZ: Qoldiq va sarf ma'lumotlari */
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-amber-50/70 dark:bg-amber-950/30 rounded-lg border border-amber-200/80 dark:border-amber-900/50 text-xs">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 font-bold text-3xs uppercase tracking-wider">
                TMZ
              </span>
              <span className="text-slate-700 dark:text-slate-300 font-medium">
                Ombordagi qoldiq:{' '}
                <strong className="text-slate-900 dark:text-slate-100 font-bold">
                  {activeProduct?.inventory?.quantity ?? 0} {unitLabel}
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-2xs sm:text-xs">
              <span>
                Jami berilgan (sarf):{' '}
                <strong className="text-slate-800 dark:text-slate-200 font-semibold">
                  {totalConsumed} {unitLabel}
                </strong>
              </span>
              <span>
                Amallar: <strong className="text-slate-800 dark:text-slate-200 font-semibold">{total} ta</strong>
              </span>
            </div>
          </div>
        ) : (
          /* Asosiy Vosita: Joriy biriktirilgan shaxs, inventar raqami */
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200/80 dark:border-slate-800 text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 font-bold text-3xs uppercase tracking-wider">
                Asosiy vosita
              </span>
              <span className="text-slate-400 shrink-0">Joriy holat:</span>
              {currentStatus ? (
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate flex items-center">
                  {currentStatus.isUser ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 shrink-0" />
                      <span className="truncate">{currentStatus.holder}</span>
                      {currentStatus.dept && (
                        <span className="text-slate-400 font-normal ml-1 shrink-0">({currentStatus.dept})</span>
                      )}
                    </>
                  ) : currentStatus.isWarehouse ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-blue-500 mr-1.5 shrink-0" />
                      <span>Omborda (mavjud)</span>
                    </>
                  ) : (
                    <span>{currentStatus.holder}</span>
                  )}
                </span>
              ) : (
                <span className="text-slate-400">—</span>
              )}
            </div>

            <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 shrink-0 text-2xs sm:text-xs">
              {activeProduct?.assets?.[0]?.inventoryNumber && (
                <div className="flex items-center gap-1">
                  <span>Inv:</span>
                  <CopyableInventoryNumber
                    value={activeProduct.assets[0].inventoryNumber}
                    size="2xs"
                  />
                </div>
              )}
              <span>Jami: <strong className="text-slate-800 dark:text-slate-200 font-semibold">{total} ta</strong></span>
            </div>
          </div>
        )}

        {/* 2. Asosiy Jadval */}
        {isLoading ? (
          <div className="py-4">
            <TableSkeleton rows={4} cols={5} />
          </div>
        ) : history.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400">
            Harakatlar tarixi mavjud emas
          </div>
        ) : (
          <>
            {/* A) Mobil ko'rinish (< 768px) */}
            <div className="md:hidden space-y-2 max-h-[50vh] overflow-y-auto pr-0.5">
              {history.map((item: any) => (
                <div
                  key={item.id}
                  className="p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <OperationTypeBadge type={item.type} />
                    <span className="text-3xs font-mono text-slate-400">
                      {formatDate(item.createdAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-800 dark:text-slate-200">
                    <div className="font-semibold truncate">
                      {item.type === 'TRANSFER_USER' ? (
                        <span>{item.fromUser?.fullName || '—'} ➔ {item.user?.fullName || '—'}</span>
                      ) : item.type === 'STOCK_IN' ? (
                        <span className="text-slate-400">Asosiy ombor</span>
                      ) : (
                        <span>
                          {item.user?.fullName ?? item.department?.name ?? '—'}
                          {isConsumable && <span className="text-slate-400 font-normal ml-1">(sarflandi)</span>}
                        </span>
                      )}
                    </div>
                    <span className="text-slate-600 dark:text-slate-300 font-mono shrink-0 ml-2 font-semibold">
                      {item.quantity} {unitLabel}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-3xs text-slate-400">
                    <span>Mas’ul: {item.performedBy?.fullName || '—'}</span>
                    {item.documentNumber && (
                      <span className="font-mono">№ {item.documentNumber}</span>
                    )}
                  </div>
                  {item.note && (
                    <div className="text-3xs italic text-slate-500 dark:text-slate-400">
                      Izoh: {item.note}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* B) Desktop va iPad ko'rinish (>= 768px) */}
            <div className="hidden md:block overflow-x-auto max-h-[52vh] overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-semibold sticky top-0">
                  <tr>
                    <th className="px-3 py-2 whitespace-nowrap">Operatsiya</th>
                    <th className="px-3 py-2 whitespace-nowrap">
                      {isConsumable ? 'Qabul qiluvchi (Xodim / Bo‘lim)' : 'Xodim / Bo‘lim'}
                    </th>
                    <th className="px-3 py-2 whitespace-nowrap">Miqdor</th>
                    <th className="px-3 py-2 whitespace-nowrap">Mas’ul ijrochi</th>
                    <th className="px-3 py-2 whitespace-nowrap">Sana</th>
                    <th className="px-3 py-2 whitespace-nowrap">Izoh / Hujjat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900/30">
                  {history.map((item: any) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Operatsiya */}
                      <td className="px-3 py-2 whitespace-nowrap align-middle">
                        <OperationTypeBadge type={item.type} />
                      </td>

                      {/* Xodim / Bo'lim */}
                      <td className="px-3 py-2 align-middle">
                        {item.type === 'TRANSFER_USER' ? (
                          <div className="font-medium whitespace-nowrap text-slate-700 dark:text-slate-300">
                            <span>{item.fromUser?.fullName || '—'}</span>
                            <span className="mx-1 text-slate-400">➔</span>
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {item.user?.fullName || '—'}
                            </span>
                          </div>
                        ) : item.type === 'STOCK_IN' ? (
                          <span className="text-slate-400">Asosiy ombor</span>
                        ) : (
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                              {item.user?.fullName ?? item.department?.name ?? '—'}
                              {isConsumable && (
                                <span className="text-slate-400 font-normal ml-1.5 text-3xs">
                                  (sarf uchun berilgan)
                                </span>
                              )}
                            </div>
                            {item.user?.department?.name && (
                              <div className="text-3xs text-slate-400 leading-tight">
                                {item.user.department.name}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Miqdor */}
                      <td className="px-3 py-2 whitespace-nowrap align-middle text-slate-700 dark:text-slate-300">
                        <div className="flex items-center gap-1 font-semibold">
                          <span>{item.quantity} {unitLabel}</span>
                          {!isConsumable && item.asset?.inventoryNumber && (
                            <CopyableInventoryNumber
                              value={item.asset.inventoryNumber}
                              size="2xs"
                            />
                          )}
                        </div>
                      </td>

                      {/* Bajaruvchi */}
                      <td className="px-3 py-2 whitespace-nowrap align-middle text-slate-700 dark:text-slate-300">
                        {item.performedBy?.fullName ?? '—'}
                      </td>

                      {/* Sana */}
                      <td className="px-3 py-2 whitespace-nowrap align-middle text-slate-500 dark:text-slate-400 font-mono text-2xs">
                        {formatDate(item.createdAt)}
                      </td>

                      {/* Izoh / Hujjat № */}
                      <td className="px-3 py-2 align-middle text-slate-600 dark:text-slate-400 max-w-[160px]">
                        {item.note && (
                          <div className="italic truncate" title={item.note}>
                            {item.note}
                          </div>
                        )}
                        {item.documentNumber && (
                          <span className="inline-block font-mono text-3xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            № {item.documentNumber}
                          </span>
                        )}
                        {!item.note && !item.documentNumber && (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Sahifalash */}
        {totalPages > 1 && (
          <div className="pt-0.5">
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              limit={15}
              onPageChange={(p) => setPage(p)}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}