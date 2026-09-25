// @ts-ignore
import html2pdf from 'html2pdf.js';
import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usersApi } from '../../api';
import Modal from '../../components/ui/modal';
import Button from '../../components/ui/button';
import { Printer, Download } from 'lucide-react';
import { formatDate } from '../../lib/utils';
import { PageLoader } from '../../components/ui/spinner';
import { useTranslation } from '../../hooks/useTranslation';

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string | null;
}

export default function OffboardingAktModal({ open, onClose, userId }: Props) {
  const { t } = useTranslation();
  const printRef = useRef<HTMLDivElement>(null);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);

  const { data: aktData, isLoading } = useQuery({
    queryKey: ['offboarding-akt', userId],
    queryFn: () => usersApi.getOffboardingAkt(userId!),
    enabled: open && !!userId,
  });

  if (!open || !userId) return null;

  const handlePrint = () => {
    if (!printRef.current) return;
    const content = printRef.current.innerHTML;
    const printWindow = window.open('', '', 'height=900,width=1100');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${aktData?.documentNumber || 'Offboarding_Akt'}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 15mm 20mm;
            }
            body {
              font-family: 'Times New Roman', Times, serif;
              color: #000;
              margin: 0;
              padding: 0;
              background: #fff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              font-size: 13pt;
              line-height: 1.4;
            }
            .akt-container {
              width: 100%;
              max-width: 100%;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 14px;
              margin-bottom: 14px;
            }
            th, td {
              border: 1px solid #000;
              padding: 6px 10px;
              font-size: 11pt;
            }
            th {
              background-color: #f2f2f2 !important;
              font-weight: bold;
              text-align: center;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .no-print { display: none !important; }
          </style>
        </head>
        <body>
          ${content}
          <script>
            window.onload = function() {
              window.focus();
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownloadPdf = () => {
    if (!printRef.current) return;
    setIsPdfGenerating(true);

    const opt = {
      margin: [10, 15, 10, 15] as [number, number, number, number],
      filename: `${aktData?.documentNumber || 'Ishdan_boshatish_akti'}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2.5, useCORS: true, logging: false },
      jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
    };

    html2pdf()
      .set(opt)
      .from(printRef.current)
      .save()
      .then(() => setIsPdfGenerating(false))
      .catch(() => setIsPdfGenerating(false));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('offboarding.actionViewAkt')}
      size="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="outline" onClick={onClose}>
            {t('common.close')}
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleDownloadPdf}
              loading={isPdfGenerating}
              icon={<Download className="w-4 h-4" />}
            >
              PDF
            </Button>
            <Button
              onClick={handlePrint}
              icon={<Printer className="w-4 h-4" />}
            >
              {t('common.print') || 'Chop etish'}
            </Button>
          </div>
        </div>
      }
    >
      {isLoading ? (
        <div className="py-12 flex justify-center">
          <PageLoader />
        </div>
      ) : !aktData ? (
        <div className="py-8 text-center text-gray-500">
          {t('common.noData')}
        </div>
      ) : (
        <div className="bg-white text-gray-900 p-8 rounded-xl border border-gray-200 shadow-sm max-h-[70vh] overflow-y-auto">
          <div ref={printRef} className="akt-container font-serif text-[13pt] leading-relaxed text-black">
            {/* Header with Emblem */}
            <div className="flex flex-col items-center justify-center text-center space-y-2 mb-6">
              <img
                src="/Emblem_of_Uzbekistan.svg"
                alt="Davlat Gerbi"
                className="w-16 h-16 object-contain mb-1"
                crossOrigin="anonymous"
              />
              <h2 className="text-base font-bold uppercase tracking-wide text-black">
                O'ZBEKISTON RESPUBLIKASI
              </h2>
              <h3 className="text-sm font-bold uppercase text-black">
                MODDIY JAVOBGARLIK VA JIHOZLARNI TOPSHIRISH-QABUL QILISH
              </h3>
              <h1 className="text-lg font-bold uppercase underline mt-2 text-black">
                DALOLATNOMASI (AKT) № {aktData.documentNumber}
              </h1>
              <p className="text-xs font-sans text-gray-700 mt-1">
                Sana: <strong>{formatDate(aktData.documentDate)}</strong>
              </p>
            </div>

            {/* Intro description */}
            <div className="space-y-3 text-justify text-[12pt] mb-6">
              <p>
                Biz, quyida imzo chekuvchilar: Tashkilot kadrlar bo'limi boshlig'i{' '}
                <strong>{aktData.hrManager?.fullName || '____________________'}</strong>, moddiy javobgar shaxs (bosh omborchi){' '}
                <strong>{aktData.warehouseManager?.fullName || '____________________'}</strong> hamda ishdan bo'shatilayotgan xodim{' '}
                <strong>{aktData.employee?.fullName}</strong> (bo'limi: <em>{aktData.employee?.departmentName}</em>, lavozimi: <em>{aktData.employee?.position}</em>)
                ishtirokida ushbu dalolatnomani tuzdik.
              </p>
              <p>
                Xodim <strong>{aktData.employee?.fullName}</strong> o'zining moddiy javobgarligi va foydalanishida bo'lgan quyidagi barcha jihozlar hamda moddiy qiymatliklarni to'liq, butun va soz holatda tashkilot omboriga topshirdi:
              </p>
            </div>

            {/* Returned Assets Table */}
            <div className="mb-6">
              <table className="w-full border-collapse border border-black text-[11pt]">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-black px-3 py-2 text-center w-12 font-bold">№</th>
                    <th className="border border-black px-3 py-2 text-left font-bold">Jihoz / Mahsulot nomi</th>
                    <th className="border border-black px-3 py-2 text-center font-bold">Inventar raqami</th>
                    <th className="border border-black px-3 py-2 text-center font-bold">Seriya raqami</th>
                    <th className="border border-black px-3 py-2 text-center font-bold">Topshirilgan vaqti</th>
                    <th className="border border-black px-3 py-2 text-center font-bold">Holati</th>
                  </tr>
                </thead>
                <tbody>
                  {aktData.returnedAssets && aktData.returnedAssets.length > 0 ? (
                    aktData.returnedAssets.map((asset: any) => (
                      <tr key={asset.index}>
                        <td className="border border-black px-3 py-1.5 text-center">{asset.index}</td>
                        <td className="border border-black px-3 py-1.5 font-medium">{asset.productName}</td>
                        <td className="border border-black px-3 py-1.5 text-center font-mono">{asset.inventoryNumber}</td>
                        <td className="border border-black px-3 py-1.5 text-center font-mono">{asset.serialNumber || '—'}</td>
                        <td className="border border-black px-3 py-1.5 text-center">{formatDate(asset.returnedAt)}</td>
                        <td className="border border-black px-3 py-1.5 text-center text-xs font-semibold">Qabul qilingan (Soz)</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="border border-black px-3 py-4 text-center italic text-gray-600">
                        Xodim hisobida biriktirilgan aktivlar bo'lmagan (Moddiy qarzdorlik mavjud emas)
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Legal Statement */}
            <div className="space-y-3 text-[12pt] text-justify mb-10">
              <p>
                <strong>XULOSA:</strong> Xodim <strong>{aktData.employee?.fullName}</strong> tomonidan tashkilot oldidagi barcha moddiy majburiyatlar to'liq bajarildi. Omborxona va xo'jalik bo'limining ushbu xodimga nisbatan hech qanday moddiy, moliyaviy yoki mulkiy da'vosi yo'q.
              </p>
              <p className="text-sm italic text-gray-700">
                Ushbu dalolatnoma 3 (uch) nusxada tuzildi (1-nusxa Kadrlar bo'limiga, 2-nusxa Omborxonaga, 3-nusxa Xodimga topshiriladi).
              </p>
            </div>

            {/* Signature Block */}
            <div className="grid grid-cols-3 gap-6 pt-6 border-t border-black text-xs font-serif">
              <div className="space-y-4">
                <p className="font-bold">Topshirdi (Xodim):</p>
                <div className="h-10 border-b border-black"></div>
                <p className="font-semibold">{aktData.employee?.fullName}</p>
                <p className="text-[10px] text-gray-600">(Imzo va sana)</p>
              </div>

              <div className="space-y-4">
                <p className="font-bold">Qabul qildi (Omborchi):</p>
                <div className="h-10 border-b border-black"></div>
                <p className="font-semibold">{aktData.warehouseManager?.fullName}</p>
                <p className="text-[10px] text-gray-600">(Imzo va sana)</p>
              </div>

              <div className="space-y-4">
                <p className="font-bold">Tasdiqladi (Kadr bo'limi):</p>
                <div className="h-10 border-b border-black"></div>
                <p className="font-semibold">{aktData.hrManager?.fullName}</p>
                <p className="text-[10px] text-gray-600">(Imzo va muhr o'rni)</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
