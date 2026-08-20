import { useState, useMemo } from 'react';
import Card, { CardContent } from '../../../components/ui/card';
import Button from '../../../components/ui/button';
import CopyableInventoryNumber from '../../../components/ui/copyable-inventory-number';
import { PageLoader } from '../../../components/ui/spinner';

import { formatCurrency, formatDate } from '../../../lib/utils';
import { useTranslation } from '../../../hooks/useTranslation';
import ModdiyJavobgarlikModal from '../../../components/documents/moddiy-javobgarlik-modal';
import {
  Package,
  Layers,
  FileText,
} from 'lucide-react';

interface Props {
  assignments: any[];
  tmzOperations?: any[];
  isLoading: boolean;
  totalValue: number;
  requestedAssetIds: string[];
  onRequestModal: (asset: any) => void;
  user?: any;
}

export default function ProfileMyAssetsTable({
  assignments,
  tmzOperations = [],
  isLoading,
  totalValue,
  requestedAssetIds,
  onRequestModal,
  user,
}: Props) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'assets' | 'tmz'>('assets');
  const [moddiyModalOpen, setModdiyModalOpen] = useState(false);
  const [moddiyContractData, setModdiyContractData] = useState<any>(null);

  const groupedAssignmentBatches = useMemo(() => {
    const groups: Record<string, {
      key: string;
      documentNumber?: string;
      assignedAt: string;
      items: any[];
      totalPrice: number;
    }> = {};

    assignments.forEach((item: any) => {
      let key = item.operationId || item.documentNumber;
      if (!key) {
        const dateStr = item.assignedAt || item.createdAt;
        const d = new Date(dateStr);
        key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}-${d.getHours()}-${d.getMinutes()}`;
      }

      if (!groups[key]) {
        groups[key] = {
          key,
          documentNumber: item.documentNumber || item.asset?.inventoryNumber || '1',
          assignedAt: item.assignedAt || item.createdAt,
          items: [],
          totalPrice: 0,
        };
      }

      groups[key].items.push(item);
      groups[key].totalPrice += Number(item.asset?.purchasePrice ?? item.asset?.product?.unitPrice ?? 0);
    });

    return Object.values(groups);
  }, [assignments]);

  const handleOpenBatchContract = (batch: any) => {
    const pass = user?.passport || user?.passportSeries || '';
    const addr = user?.address || '';

    setModdiyContractData({
      documentNumber: batch.documentNumber || `MJSH-2026-${batch.key?.slice(-4) || '001'}`,
      date: batch.assignedAt,
      fromUser: 'Алиматов Таир Наматуллаевич',
      toRecipient: user?.fullName || '',
      recipientPosition: user?.position,
      recipientDepartment: user?.department?.name,
      recipientPassport: pass,
      recipientAddress: addr,
      items: batch.items.map((b: any) => ({
        name: b.asset?.product?.name || b.product?.name || '—',
        inventoryNumber: b.asset?.inventoryNumber || '—',
        serialNumber: b.asset?.serialNumber || '',
      })),
    });
    setModdiyModalOpen(true);
  };

  return (
    <>
      <Card className="rounded-2xl border-gray-200/90 dark:border-white/15 shadow-2xs overflow-hidden">
        {/* Navigation Tabs Header */}
        <div className="flex border-b border-gray-200 dark:border-gray-800 px-5 pt-3 bg-gray-50/50 dark:bg-gray-800/20 flex-wrap gap-2">
          <button
            className={`px-4 py-3 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'assets'
                ? 'border-teal-600 text-teal-600 dark:text-teal-400 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
            onClick={() => setActiveTab('assets')}
          >
            <Package className="w-4 h-4 text-teal-500" />
            <span>Asosiy vositalar ({assignments.length})</span>
          </button>

          <button
            className={`px-4 py-3 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'tmz'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
            onClick={() => setActiveTab('tmz')}
          >
            <Layers className="w-4 h-4 text-emerald-500" />
            <span>Topshirilgan TMZ ({tmzOperations.length})</span>
          </button>
        </div>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8">
              <PageLoader />
            </div>
          ) : activeTab === 'assets' ? (
            assignments.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400 flex flex-col items-center gap-2">
                <Package className="w-10 h-10 text-gray-300 dark:text-slate-700 stroke-1" />
                <span>Sizga biriktirilgan asosiy vositalar yo'q</span>
              </div>
            ) : (
              <>
                {/* Mobile Responsive Cards View */}
                <div className="md:hidden p-3.5 space-y-3">
                  {groupedAssignmentBatches.map((batch: any) => (
                    <div
                      key={batch.key}
                      className="p-4 rounded-xl bg-white dark:bg-slate-900/90 border border-gray-200/80 dark:border-slate-800 shadow-xs space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-white text-xs">
                          {formatDate(batch.assignedAt)}
                        </span>
                        {batch.documentNumber && (
                          <span className="text-2xs font-mono font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded border border-teal-200/70 dark:border-teal-900/60">
                            № {batch.documentNumber}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1.5 pt-1">
                        {batch.items.map((item: any, idx: number) => (
                          <div key={item.id || idx} className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800">
                            <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {idx + 1}. {item.asset?.product?.name || '—'}
                            </span>
                            {item.asset?.inventoryNumber && (
                              <CopyableInventoryNumber
                                value={item.asset.inventoryNumber}
                                size="2xs"
                              />
                            )}

                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-slate-800 text-xs">
                        <span className="text-gray-400">Jami qiymati:</span>
                        <span className="font-bold text-teal-600 dark:text-teal-400 font-mono">
                          {formatCurrency(batch.totalPrice)}
                        </span>
                      </div>

                      <Button
                        variant="outline"
                        onClick={() => handleOpenBatchContract(batch)}
                        className="w-full justify-center text-xs font-bold text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800 hover:bg-teal-50 dark:hover:bg-teal-950/40 py-2 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Shartnoma ({batch.items.length} ta jihoz)</span>
                      </Button>
                    </div>
                  ))}

                  {/* Total Value Summary Footer on Mobile */}
                  <div className="p-4 rounded-xl bg-teal-50/60 dark:bg-teal-950/40 border border-teal-200/80 dark:border-teal-900/60 flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                      {t('profile.totalValue')}
                    </span>
                    <span className="text-sm font-extrabold text-teal-600 dark:text-teal-400">
                      {formatCurrency(totalValue)}
                    </span>
                  </div>
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200/70 dark:border-slate-800/80 text-left bg-gray-50/70 dark:bg-slate-800/40">
                        <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Vaqt / Hujjat №</th>
                        <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Biriktirilgan Jihozlar ({assignments.length} ta)</th>
                        <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Qiymati</th>
                        <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right whitespace-nowrap">{t('common.actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800/50">
                      {groupedAssignmentBatches.map((batch: any) => (
                        <tr key={batch.key} className="hover:bg-teal-50/20 dark:hover:bg-teal-950/20 transition-colors">
                          <td className="px-4 py-3 text-xs align-middle whitespace-nowrap">
                            <div className="font-bold text-slate-900 dark:text-white">{formatDate(batch.assignedAt)}</div>
                            {batch.documentNumber && <div className="text-2xs font-mono text-teal-700 dark:text-teal-400 font-semibold mt-0.5">№ {batch.documentNumber}</div>}
                          </td>
                          <td className="px-4 py-3 align-middle">
                            <div className="flex flex-wrap items-center gap-1.5 max-w-2xl">
                              {batch.items.map((item: any, idx: number) => {
                                const isRequested = item.asset?.id && requestedAssetIds.includes(item.asset.id);
                                return (
                                  <div key={item.id || idx} className="inline-flex items-center gap-1.5 text-xs bg-slate-100/90 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                                      {batch.items.length > 1 ? `${idx + 1}. ` : ''}{item.asset?.product?.name || '—'}
                                    </span>
                                    {item.asset?.inventoryNumber && (
                                      <CopyableInventoryNumber
                                        value={item.asset.inventoryNumber}
                                        size="2xs"
                                      />
                                    )}

                                    {isRequested ? (
                                      <span className="text-2xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-300/50">
                                        So'rov yuborilgan
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => onRequestModal(item)}
                                        className="text-2xs font-semibold text-amber-600 dark:text-amber-400 hover:underline px-1 py-0.5 cursor-pointer"
                                      >
                                        So'rov yuborish
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-900 dark:text-white font-mono text-xs align-middle whitespace-nowrap">
                            {formatCurrency(batch.totalPrice)}
                          </td>
                          <td className="px-4 py-3 text-right align-middle whitespace-nowrap">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenBatchContract(batch)}
                              className="text-xs font-bold text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800 hover:bg-teal-50 dark:hover:bg-teal-950/40 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                              title="Operatsiya bo'yicha umumiy shartnomani ko'rish"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Shartnoma ({batch.items.length})</span>
                            </Button>
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-teal-50/30 dark:bg-teal-950/20 font-bold border-t border-teal-100 dark:border-teal-900/50">
                        <td colSpan={2} className="px-4 py-3 text-right text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">{t('profile.totalValue')}</td>
                        <td colSpan={2} className="px-4 py-3 text-teal-600 dark:text-teal-400 text-sm font-extrabold font-mono">{formatCurrency(totalValue)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )
          ) : (
            /* TMZ Materiallari Tab */
            tmzOperations.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400 flex flex-col items-center gap-2">
                <Layers className="w-10 h-10 text-gray-300 dark:text-slate-700 stroke-1" />
                <p className="font-semibold text-gray-700 dark:text-gray-300">
                  Sizga topshirilgan TMZ materiallari topilmadi
                </p>
                <p className="text-xs text-gray-400">
                  Ushbu hisob bo'yicha hali sarflanadigan materiallar topshirilmagan.
                </p>
              </div>
            ) : (
              <>
                {/* Mobile Cards View for TMZ */}
                <div className="md:hidden p-3.5 space-y-3">
                  {tmzOperations.map((row: any) => {
                    const items = row.groupItems || [row];
                    return (
                      <div
                        key={row.id}
                        className="p-4 rounded-xl bg-white dark:bg-slate-900/90 border border-gray-200/80 dark:border-slate-800 shadow-xs space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-900/60">
                            {row.documentNumber || 'Hujjat № Siz'}
                          </span>
                          <span className="text-xs text-gray-400">
                            {formatDate(row.createdAt)}
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          {items.map((gi: any, idx: number) => (
                            <div key={gi.id || idx} className="flex items-center justify-between text-xs">
                              <span className="font-bold text-gray-900 dark:text-white">
                                {items.length > 1 ? `${idx + 1}. ` : ''}{gi.product?.name ?? '—'}
                              </span>
                              <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                                {gi.quantity ?? 1} {gi.product?.unit || 'dona'}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="pt-2 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between text-xs text-gray-500">
                          <span>Beruvchi: <strong className="text-gray-700 dark:text-gray-300">{row.performedBy?.fullName || '—'}</strong></span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table View for TMZ */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200/70 dark:border-slate-800/80 text-left bg-gray-50/70 dark:bg-slate-800/40">
                        <th className="px-5 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Sana
                        </th>
                        <th className="px-5 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Material Nomi
                        </th>
                        <th className="px-5 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Topshirilgan Soni
                        </th>
                        <th className="px-5 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Beruvchi Mas'ul
                        </th>
                        <th className="px-5 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Hujjat №
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800/50">
                      {tmzOperations.map((row: any) => {
                        const items = row.groupItems || [row];
                        return (
                          <tr
                            key={row.id}
                            className="hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 transition-colors duration-200"
                          >
                            <td className="px-5 py-3.5 text-xs text-gray-500 font-medium whitespace-nowrap">
                              {formatDate(row.createdAt)}
                            </td>
                            <td className="px-5 py-3.5 min-w-[200px]">
                              <div className="space-y-1">
                                {items.map((gi: any, idx: number) => (
                                  <p key={gi.id || idx} className="text-xs font-bold text-gray-900 dark:text-gray-100">
                                    {items.length > 1 ? `${idx + 1}. ` : ''}{gi.product?.name ?? '—'}
                                  </p>
                                ))}
                              </div>
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="space-y-1">
                                {items.map((gi: any, idx: number) => (
                                  <p key={gi.id || idx} className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                                    {gi.quantity ?? 1} {gi.product?.unit || 'dona'}
                                  </p>
                                ))}
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-xs text-gray-700 dark:text-gray-300 font-medium">
                              {row.performedBy?.fullName || '—'}
                            </td>
                            <td className="px-5 py-3.5 text-xs font-mono font-bold text-gray-500">
                              {row.documentNumber || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )
          )}
        </CardContent>
      </Card>

      {moddiyContractData && (
        <ModdiyJavobgarlikModal
          open={moddiyModalOpen}
          onClose={() => setModdiyModalOpen(false)}
          data={moddiyContractData}
        />
      )}
    </>
  );
}
