import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { historyApi } from '../../api';
import { useAuthStore } from '../../store/auth.store';
import { Card, CardContent, Select, Table, Pagination, OperationTypeBadge, Button, PageHeader, CopyableInventoryNumber } from '../../components/ui';

import { formatDate } from '../../lib/utils';
import toast from 'react-hot-toast';
import { exportToStyledExcel } from '../../lib/export';
import { FileText, Loader2, Printer } from 'lucide-react';
import api from '../../api/axios';
import { useTranslation } from '../../hooks/useTranslation';
import TalabnomaModal, { type TalabnomaData } from '../../components/documents/talabnoma-modal';
import DalolatnomaModal, { type DalolatnomaData } from '../../components/documents/dalolatnoma-modal';
import ModdiyJavobgarlikModal, { type ModdiyJavobgarlikData } from '../../components/documents/moddiy-javobgarlik-modal';

export default function HistoryPage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const isXodim = user?.role === 'XODIM';

  const [page, setPage] = useState(1);
  const [operationType, setOperationType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [pdfLoadingIds, setPdfLoadingIds] = useState<Record<string, boolean>>({});
  const [talabnomaData, setTalabnomaData] = useState<TalabnomaData | null>(null);
  const [dalolatnomaData, setDalolatnomaData] = useState<DalolatnomaData | null>(null);
  const [moddiyData, setModdiyData] = useState<ModdiyJavobgarlikData | null>(null);
  const [exportLoading, setExportLoading] = useState(false);

  const operationTypes = [
    { value: 'STOCK_IN', label: t('history.ops.STOCK_IN') },
    { value: 'GIVE_TO_USER', label: t('history.ops.GIVE_TO_USER') },
    { value: 'RETURN_FROM_USER', label: t('history.ops.RETURN_FROM_USER') },
    { value: 'TRANSFER_USER', label: t('history.ops.TRANSFER_USER') },
    { value: 'GIVE_TO_DEPT', label: t('history.ops.GIVE_TO_DEPT') },
    { value: 'ASSIGN_TO_DEPT', label: t('history.ops.ASSIGN_TO_DEPT') },
    { value: 'RETURN_FROM_DEPT', label: t('history.ops.RETURN_FROM_DEPT') },
    { value: 'WRITE_OFF', label: t('history.ops.WRITE_OFF') },
  ];

  const { data, isLoading } = useQuery({
    queryKey: ['history', page, operationType, from, to],
    queryFn: () =>
      historyApi.getAll({
        page,
        limit: 15,
        operationType: operationType || undefined,
        userId: isXodim ? user?.id : undefined,
        from: from || undefined,
        to: to || undefined,
      }),
    staleTime: 30000,
  });

  const getOpLabel = (type: string) => {
    switch (type) {
      case 'STOCK_IN': return 'Kirim (Ombor)';
      case 'GIVE_TO_USER': return 'Xodimga berish';
      case 'RETURN_FROM_USER': return 'Xodimdan qaytarish';
      case 'TRANSFER_USER': return 'Xodimlararo o‘tkazish';
      case 'GIVE_TO_DEPT': return 'Bo‘limga TMZ berish';
      case 'ASSIGN_TO_DEPT': return 'Bo‘limga jihoz biriktirish';
      case 'RETURN_FROM_DEPT': return 'Bo‘limdan qaytarish';
      case 'WRITE_OFF': return 'Hisobdan chiqarish';
      default: return type || '—';
    }
  };

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const firstRes = await historyApi.getAll({
        page: 1,
        limit: 100,
        operationType: operationType || undefined,
        userId: isXodim ? user?.id : undefined,
        from: from || undefined,
        to: to || undefined,
      });

      const totalPages = firstRes?.totalPages ?? 1;
      let exportItems: any[] = firstRes?.items ?? [];

      if (totalPages > 1) {
        const remainingPages = Array.from({ length: Math.min(totalPages - 1, 50) }, (_, i) => i + 2);
        const remainingResults = await Promise.all(
          remainingPages.map((p) =>
            historyApi.getAll({
              page: p,
              limit: 100,
              operationType: operationType || undefined,
              userId: isXodim ? user?.id : undefined,
              from: from || undefined,
              to: to || undefined,
            })
          )
        );
        remainingResults.forEach((r) => {
          if (r?.items) {
            exportItems = exportItems.concat(r.items);
          }
        });
      }

      if (exportItems.length === 0) {
        toast.error('Yuklab olish uchun ma’lumotlar topilmadi');
        return;
      }

      const headers = [
        '№',
        'Sana',
        'Operatsiya Turi',
        'Mahsulot / Jihoz Nomi',
        'Inventar №',
        'Miqdori',
        'Qabul Qiluvchi / Egasi',
        'Bajaruvchi Mas’ul',
        'Hujjat №',
        'Izoh',
      ];

      const rows = exportItems.map((item: any, idx: number) => {
        const invNo = item.asset?.inventoryNumber || item.inventoryNumber || '—';
        const recipient = item.user
          ? `${item.user.fullName}${item.user.department?.name ? ` (${item.user.department.name})` : ''}`
          : item.department?.name ?? '—';

        return [
          idx + 1,
          formatDate(item.createdAt),
          getOpLabel(item.type),
          item.product?.name ?? '—',
          invNo,
          `${item.quantity ?? 1} ${item.product?.unit || 'dona'}`,
          recipient,
          item.performedBy?.fullName ?? '—',
          item.documentNumber ?? '—',
          item.note ?? '—',
        ];
      });

      const filename = `amallar_tarixi_${new Date().toISOString().split('T')[0]}.xlsx`;

      exportToStyledExcel({
        filename,
        sheetName: 'Amallar Tarixi',
        headers,
        rows,
        colWidths: [6, 16, 22, 35, 22, 12, 28, 25, 16, 25],
        centerColIndexes: [0, 1, 2, 4, 5, 7, 8],
      });

      toast.success(t('history.exportSuccess'));
    } catch (err: any) {
      console.error('Export error:', err);
      toast.error(t('history.exportError'));
    } finally {
      setExportLoading(false);
    }
  };

  const handleDownloadPdf = async (operationId: string) => {
    setPdfLoadingIds((prev) => ({ ...prev, [operationId]: true }));
    try {
      const blob = await api.get(`/operations/${operationId}/pdf`, {
        responseType: 'blob',
      }) as unknown as Blob;

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `dalolatnoma_${operationId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      toast.success(t('history.pdfSuccess'));
    } catch (err) {
      console.warn('Backend PDF endpoint error, opening document modal fallback:', err);
      const targetRow = groupedHistory.find((r: any) => r.id === operationId || r.groupItems?.some((gi: any) => gi.id === operationId));
      if (targetRow) {
        const docNum = String(targetRow.documentNumber || '');
        const isModdiy = docNum.startsWith('MJSH-') || targetRow.type === 'GIVE_TO_USER' || targetRow.type === 'ASSIGN_TO_DEPT' || targetRow.product?.productType === 'BERILADIGAN';
        if (isModdiy) {
          handleOpenModdiyJavobgarlik(targetRow);
        } else if (docNum.startsWith('DAL-')) {
          handleOpenDalolatnoma(targetRow);
        } else {
          handleOpenTalabnoma(targetRow);
        }
      } else {
        toast.error(t('history.pdfError'));
      }
    } finally {
      setPdfLoadingIds((prev) => ({ ...prev, [operationId]: false }));
    }
  };

  const handleOpenTalabnoma = (row: any) => {
    const groupItems = row.groupItems && row.groupItems.length > 0 ? row.groupItems : [row];
    const recipient = row.user
      ? `${row.user.fullName}${row.user.department?.name ? ` (${row.user.department.name})` : ''}`
      : row.department?.name ?? 'Bo‘lim';

    const numericPart = row.documentNumber ? parseInt(row.documentNumber.replace(/\D/g, ''), 10) : undefined;

    setTalabnomaData({
      seqNumber: numericPart || undefined,
      documentNumber: row.documentNumber || undefined,
      date: row.createdAt,
      fromUser: row.performedBy?.fullName || "Xo'jalik mudiri",
      toRecipient: recipient,
      items: groupItems.map((gi: any) => ({
        name: gi.product?.name ? `${gi.product.name}${gi.asset?.inventoryNumber ? ` (Inv: ${gi.asset.inventoryNumber})` : ''}` : 'Mahsulot',
        unit: gi.product?.unit || 'dona',
        quantity: gi.quantity || 1,
      })),
      note: row.note,
    });
  };

  const handleOpenDalolatnoma = (row: any) => {
    const groupItems = row.groupItems && row.groupItems.length > 0 ? row.groupItems : [row];
    const recipient = row.user
      ? `${row.user.fullName}${row.user.department?.name ? ` (${row.user.department.name})` : ''}`
      : row.department?.name ?? 'Bo‘lim';

    setDalolatnomaData({
      documentNumber: row.documentNumber || `DAL-2026-${row.id?.slice(-4) || '001'}`,
      date: row.createdAt,
      fromUser: row.performedBy?.fullName || "Xo'jalik mudiri",
      toRecipient: recipient,
      items: groupItems.map((gi: any) => ({
        name: gi.product?.name ?? 'Asosiy vosita',
        inventoryNumber: gi.asset?.inventoryNumber || gi.inventoryNumber || '—',
        serialNumber: gi.asset?.serialNumber || gi.serialNumber || undefined,
        unit: gi.product?.unit || 'dona',
        quantity: gi.quantity || 1,
      })),
      note: row.note,
    });
  };

  const handleOpenModdiyJavobgarlik = (row: any) => {
    const groupItems = row.groupItems && row.groupItems.length > 0 ? row.groupItems : [row];
    const recipient = row.user?.fullName ?? row.department?.name ?? '—';
    const passportVal = row.user?.passport || row.user?.passportSeries || '';
    const addressVal = row.user?.address || '';

    setModdiyData({
      documentNumber: row.documentNumber || `MJSH-2026-${row.id?.slice(-4) || '001'}`,
      date: row.createdAt,
      fromUser: "Алиматов Таир Наматуллаевич",
      toRecipient: recipient,
      recipientPosition: row.user?.position,
      recipientDepartment: row.user?.department?.name || row.department?.name,
      recipientPassport: passportVal,
      recipientAddress: addressVal,
      items: groupItems.map((gi: any) => ({
        name: gi.product?.name ?? 'Asosiy vosita',
        inventoryNumber: gi.asset?.inventoryNumber || gi.inventoryNumber || '—',
        serialNumber: gi.asset?.serialNumber || gi.serialNumber || undefined,
        unit: gi.product?.unit || 'dona',
        quantity: gi.quantity || 1,
      })),
      note: row.note,
    });
  };

  const rawHistory = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  // Group operations into 1 single operation row per submission (by documentNumber or timestamp + recipient)
  const groupedHistory: any[] = [];
  const mapDocToGroup = new Map<string, any>();

  for (const item of rawHistory) {
    const docNum = item.documentNumber?.trim();
    if (docNum) {
      if (mapDocToGroup.has(docNum)) {
        mapDocToGroup.get(docNum).groupItems.push(item);
        continue;
      } else {
        const newGroup = {
          ...item,
          groupItems: [item],
        };
        mapDocToGroup.set(docNum, newGroup);
        groupedHistory.push(newGroup);
        continue;
      }
    }

    // Fallback: group operations created at the exact same minute for the same user/department
    const timeKey = item.createdAt ? new Date(item.createdAt).toISOString().slice(0, 16) : item.id;
    const recipientKey = item.userId ? `u_${item.userId}` : item.departmentId ? `d_${item.departmentId}` : 'none';
    const fallbackKey = `${item.type}_${recipientKey}_${timeKey}`;

    if (mapDocToGroup.has(fallbackKey)) {
      mapDocToGroup.get(fallbackKey).groupItems.push(item);
    } else {
      const newGroup = {
        ...item,
        groupItems: [item],
      };
      mapDocToGroup.set(fallbackKey, newGroup);
      groupedHistory.push(newGroup);
    }
  }

  const columns = [
    {
      key: 'createdAt',
      title: t('common.date'),
      render: (value: any) => (
        <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap font-medium">
          {formatDate(value)}
        </span>
      ),
    },
    {
      key: 'type',
      title: t('history.operation'),
      className: 'text-center',
      render: (value: any) => <OperationTypeBadge type={value} />,
    },
    {
      key: 'product',
      title: t('history.product'),
      className: 'whitespace-normal break-words min-w-[220px] max-w-md',
      render: (_: any, row: any) => {
        const items = row.groupItems || [row];
        return (
          <div className="space-y-1 py-0.5">
            {items.map((gi: any, idx: number) => (
              <div key={gi.id || idx} className="min-w-0 break-words">
                <p className="text-xs font-bold text-gray-900 dark:text-gray-100">
                  {items.length > 1 ? `${idx + 1}. ` : ''}{gi.product?.name ?? '—'}
                </p>
                {gi.asset?.inventoryNumber && (
                  <div className="mt-0.5">
                    <CopyableInventoryNumber
                      value={gi.asset.inventoryNumber}
                      prefix="Inv: "
                      size="2xs"
                    />
                  </div>
                )}

              </div>
            ))}
          </div>
        );
      },
    },
    {
      key: 'quantity',
      title: t('history.qty'),
      render: (_: any, row: any) => {
        const items = row.groupItems || [row];
        return (
          <div className="space-y-1 py-0.5">
            {items.map((gi: any, idx: number) => (
              <p key={gi.id || idx} className="text-xs font-extrabold text-gray-700 dark:text-gray-300">
                {gi.quantity ?? 1} {gi.product?.unit || 'dona'}
              </p>
            ))}
          </div>
        );
      },
    },
    {
      key: 'user',
      title: t('history.userDept'),
      render: (_: any, row: any) => (
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
          {row.user?.fullName ?? row.department?.name ?? '—'}
        </span>
      ),
    },
    {
      key: 'performedBy',
      title: t('history.performedBy'),
      render: (_: any, row: any) => (
        <span className="text-gray-600 dark:text-gray-400 text-xs">
          {row.performedBy?.fullName ?? '—'}
        </span>
      ),
    },
    {
      key: 'documentNumber',
      title: t('history.document'),
      render: (value: any) => (
        <span className="text-gray-500 dark:text-gray-400 text-xs font-mono font-bold">
          {value ?? '—'}
        </span>
      ),
    },
    {
      key: 'pdf',
      title: t('history.file'),
      render: (_: any, row: any) => {
        const docNum = String(row.documentNumber || '');
        const pType = row.product?.productType;

        // 1. TMZ / Sarflanadigan -> Talabnoma
        const isTalabnoma =
          docNum.startsWith('TLB-') ||
          row.type === 'GIVE_TMZ_USER' ||
          row.type === 'GIVE_TO_DEPT' ||
          pType === 'SARFLANADIGAN';

        // 2. Omborga Kirim -> Kirim Dalolatnomasi
        const isKirim = docNum.startsWith('KRM-') || row.type === 'STOCK_IN';

        // 3. Asosiy vosita / Beriladigan -> Shartnoma (MJSh)
        const isModdiy =
          docNum.startsWith('MJSH-') ||
          (!isKirim && !isTalabnoma && (
            row.type === 'GIVE_TO_USER' ||
            row.type === 'ASSIGN_TO_DEPT' ||
            pType === 'BERILADIGAN'
          ));

        if (isTalabnoma) {
          return (
            <button
              onClick={() => handleOpenTalabnoma(row)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-bold text-xs transition-colors border border-blue-200/80 dark:border-blue-800 shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5" />
              Talabnoma
            </button>
          );
        }

        if (isModdiy) {
          return (
            <button
              onClick={() => handleOpenModdiyJavobgarlik(row)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-bold text-xs transition-colors border border-emerald-200/80 dark:border-emerald-800 shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5" />
              Shartnoma
            </button>
          );
        }

        if (isKirim || docNum.startsWith('DAL-')) {
          return (
            <button
              onClick={() => handleOpenDalolatnoma(row)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 font-bold text-xs transition-colors border border-purple-200/80 dark:border-purple-800 shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5" />
              {isKirim ? 'Kirim Dalolatnomasi' : 'Dalolatnoma'}
            </button>
          );
        }

        const isPdfLoading = pdfLoadingIds[row.id];
        return (
          <button
            onClick={() => handleDownloadPdf(row.id)}
            disabled={isPdfLoading}
            className="flex items-center gap-1.5 text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPdfLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-500" />
            ) : (
              <FileText className="w-3.5 h-3.5" />
            )}
            {isPdfLoading ? "Yuklanmoqda..." : t('history.pdfBtn')}
          </button>
        );
      },
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('history.title')}
        subtitle={t('history.totalActions', { count: total })}
        actions={
          <Button
            variant="outline"
            className="border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/20"
            onClick={handleExport}
            loading={exportLoading}
          >
            {t('common.excel')}
          </Button>
        }
      />

      <Card>
        <CardContent>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-52">
              <Select
                options={operationTypes}
                placeholder={t('history.allOps')}
                value={operationType}
                onChange={(e) => {
                  setOperationType(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={from}
                onChange={(e) => { setFrom(e.target.value); setPage(1); }}
                className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <span className="text-gray-400 text-sm">—</span>
              <input
                type="date"
                value={to}
                onChange={(e) => { setTo(e.target.value); setPage(1); }}
                className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            {(operationType || from || to) && (
              <button
                onClick={() => {
                  setOperationType('');
                  setFrom('');
                  setTo('');
                  setPage(1);
                }}
                className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                {t('history.clear')}
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <Table
          columns={columns}
          data={groupedHistory}
          loading={isLoading}
          rowKey={(row) => row.id}
          emptyTitle={t('history.emptyTitle')}
          emptyDescription={t('history.emptyDescription')}
        />
        <div className="px-5 border-t border-gray-100 dark:border-gray-800">
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            limit={15}
            onPageChange={setPage}
          />
        </div>
      </Card>

      <TalabnomaModal
        open={!!talabnomaData}
        onClose={() => setTalabnomaData(null)}
        data={talabnomaData}
      />

      <DalolatnomaModal
        open={!!dalolatnomaData}
        onClose={() => setDalolatnomaData(null)}
        data={dalolatnomaData}
      />

      <ModdiyJavobgarlikModal
        open={!!moddiyData}
        onClose={() => setModdiyData(null)}
        data={moddiyData}
      />
    </div>
  );
}