// @ts-ignore
import html2pdf from 'html2pdf.js';
import { useRef, useState } from 'react';
import Modal from '../ui/modal';
import Button from '../ui/button';
import { Printer, Download, Loader2, FileText } from 'lucide-react';
import type { RequestItem } from '../../types';
import { formatDate } from '../../lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  items: RequestItem[];
  currentUserName?: string;
  organizationName?: string;
}

export default function RequestsReportModal({
  open,
  onClose,
  items,
  currentUserName = 'Mas\'ul xodim',
  organizationName = "O'ZBEKISTON RESPUBLIKASI QURILISH VA UY-JOY KOMMUNAL XO'JALIGI VAZIRLIGI",
}: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);

  const stats = {
    total: items.length,
    approved: items.filter((i) => i.status === 'APPROVED').length,
    pending: items.filter((i) => i.status === 'PENDING').length,
    rejected: items.filter((i) => i.status === 'REJECTED').length,
  };

  const todayStr = new Date().toLocaleDateString('uz-UZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const todayFullStr = new Date().toLocaleString('uz-UZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const getRequestTypeLabel = (item: RequestItem) => {
    const normReason = String(item.reason || '').toLowerCase().replace(/['ʼ’`ʻ]/g, '');
    if (item.requestType === 'ASSIGNMENT') return 'Jihoz biriktirish';
    if (item.requestType === 'REPAIR' || normReason.includes('tamirlash') || normReason.includes('servis')) return 'Ta\'mirlash';
    if (item.requestType === 'RETURN' || normReason.includes('qaytarish')) return 'Qaytarish';
    return 'O\'chirish so\'rovi';
  };

  const getStatusText = (status: string) => {
    if (status === 'APPROVED') return 'Tasdiqlangan';
    if (status === 'REJECTED') return 'Rad etilgan';
    return 'Kutilmoqda';
  };

  const renderHtmlContent = () => `
    <div style="font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1e293b; line-height: 1.4; padding: 10px;">
      <!-- Sarlavha / Header -->
      <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 14px;">
        <div style="font-size: 12px; font-weight: bold; text-transform: uppercase; color: #0f172a; letter-spacing: 0.5px; margin-bottom: 4px;">
          ${organizationName}
        </div>
        <div style="font-size: 15px; font-weight: 800; text-transform: uppercase; color: #1e40af; margin-top: 4px; letter-spacing: 0.8px;">
          MODDIY AKTIVLAR HARAKATI VA SO'ROVLAR JURNALI
        </div>
        <div style="font-size: 10px; color: #64748b; margin-top: 4px;">
          Hujjat shakllantirildi: <b>${todayFullStr}</b> | Mas'ul: <b>${currentUserName}</b>
        </div>
      </div>

      <!-- Xulosa / Statistik blok -->
      <div style="display: flex; justify-content: space-between; gap: 8px; margin-bottom: 14px;">
        <div style="flex: 1; padding: 6px 10px; background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; text-align: center;">
          <span style="font-size: 9px; text-transform: uppercase; color: #475569; font-weight: bold;">Jami so'rovlar</span>
          <div style="font-size: 14px; font-weight: bold; color: #0f172a; margin-top: 2px;">${stats.total} ta</div>
        </div>
        <div style="flex: 1; padding: 6px 10px; background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 4px; text-align: center;">
          <span style="font-size: 9px; text-transform: uppercase; color: #047857; font-weight: bold;">Tasdiqlangan</span>
          <div style="font-size: 14px; font-weight: bold; color: #059669; margin-top: 2px;">${stats.approved} ta</div>
        </div>
        <div style="flex: 1; padding: 6px 10px; background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 4px; text-align: center;">
          <span style="font-size: 9px; text-transform: uppercase; color: #b45309; font-weight: bold;">Kutilmoqda</span>
          <div style="font-size: 14px; font-weight: bold; color: #d97706; margin-top: 2px;">${stats.pending} ta</div>
        </div>
        <div style="flex: 1; padding: 6px 10px; background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 4px; text-align: center;">
          <span style="font-size: 9px; text-transform: uppercase; color: #be123c; font-weight: bold;">Rad etilgan</span>
          <div style="font-size: 14px; font-weight: bold; color: #e11d48; margin-top: 2px;">${stats.rejected} ta</div>
        </div>
      </div>

      <!-- Asosiy Jadval -->
      <table style="width: 100%; border-collapse: collapse; font-size: 9.5px;">
        <thead>
          <tr style="background-color: #1e3a8a; color: #ffffff;">
            <th style="border: 1px solid #0f172a; padding: 6px 4px; text-align: center; width: 25px;">№</th>
            <th style="border: 1px solid #0f172a; padding: 6px 6px; text-align: left; width: 85px;">So'rov turi</th>
            <th style="border: 1px solid #0f172a; padding: 6px 6px; text-align: left; width: 150px;">Obyekt / Jihoz</th>
            <th style="border: 1px solid #0f172a; padding: 6px 6px; text-align: left; width: 110px;">Yuboruvchi</th>
            <th style="border: 1px solid #0f172a; padding: 6px 6px; text-align: left; width: 110px;">Qabul qiluvchi</th>
            <th style="border: 1px solid #0f172a; padding: 6px 6px; text-align: center; width: 75px;">Sana</th>
            <th style="border: 1px solid #0f172a; padding: 6px 6px; text-align: center; width: 75px;">Holati</th>
            <th style="border: 1px solid #0f172a; padding: 6px 6px; text-align: left; width: 100px;">Ko'rib chiquvchi</th>
            <th style="border: 1px solid #0f172a; padding: 6px 6px; text-align: left;">Sabab / Izoh</th>
          </tr>
        </thead>
        <tbody>
          ${
            items.length === 0
              ? `<tr><td colspan="9" style="border: 1px solid #cbd5e1; padding: 20px; text-align: center; color: #64748b;">So'rovlar mavjud emas</td></tr>`
              : items
                  .map((row, idx) => {
                    const isEven = idx % 2 === 1;
                    const bg = isEven ? '#f8fafc' : '#ffffff';
                    const statusColor =
                      row.status === 'APPROVED'
                        ? '#059669'
                        : row.status === 'REJECTED'
                        ? '#e11d48'
                        : '#d97706';
                    const entity =
                      row.entityTitle ||
                      row.entityName ||
                      (row.requestType === 'ASSIGNMENT' ? row.recipientName || 'Jihoz' : row.entityType);
                    const reason = row.reason || '—';
                    const comment = row.reviewComment || row.rejectionReason;
                    const fullReason = comment ? `${reason} (Izoh: ${comment})` : reason;

                    return `
                      <tr style="background-color: ${bg};">
                        <td style="border: 1px solid #cbd5e1; padding: 5px 3px; text-align: center; font-weight: bold;">${idx + 1}</td>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 6px; font-weight: 600;">${getRequestTypeLabel(row)}</td>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 6px; font-weight: 600; color: #0f172a;">${entity}</td>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 6px;">${row.requestedBy?.fullName || row.requestedBy?.username || '—'}</td>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 6px;">${row.recipientName || '—'}</td>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 4px; text-align: center; font-size: 8.5px;">${formatDate(row.createdAt)}</td>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 4px; text-align: center; font-weight: bold; color: ${statusColor};">
                          ${getStatusText(row.status)}
                        </td>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 6px; font-size: 9px;">${row.reviewedBy?.fullName || '—'}</td>
                        <td style="border: 1px solid #cbd5e1; padding: 5px 6px; font-size: 8.5px; color: #334155; word-break: break-word;">${fullReason}</td>
                      </tr>
                    `;
                  })
                  .join('')
          }
        </tbody>
      </table>

      <!-- Pastki Imzolar Bloki -->
      <div style="margin-top: 25px; padding-top: 10px; border-top: 1px dashed #94a3b8; display: flex; justify-content: space-between; font-size: 10.5px;">
        <div>
          <div>Hisobotni shakllantirdi: <b>${currentUserName}</b></div>
          <div style="margin-top: 18px;">Imzo: _________________________</div>
        </div>
        <div style="text-align: right;">
          <div>Tasdiqladi (Mas'ul rahbar): _________________________</div>
          <div style="margin-top: 18px;">M.O'. &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Sana: <b>${todayStr}</b> yil</div>
        </div>
      </div>
    </div>
  `;

  const handlePrint = () => {
    try {
      let iframe = document.getElementById('report_print_iframe') as HTMLIFrameElement;
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'report_print_iframe';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
      }

      const fullHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>So'rovlar Jurnali - ${todayStr}</title>
            <style>
              @page {
                size: A4 landscape;
                margin: 10mm 12mm 10mm 12mm;
              }
              body {
                margin: 0;
                padding: 0;
                background: #fff;
              }
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            </style>
          </head>
          <body>
            ${renderHtmlContent()}
          </body>
        </html>
      `;

      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (doc) {
        doc.open();
        doc.write(fullHtml);
        doc.close();

        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        }, 300);
        return;
      }
    } catch (e) {
      console.warn('Iframe print failed, falling back to window.open:', e);
    }

    // Fallback: window.open
    const win = window.open('', '_blank', 'width=1100,height=800');
    if (win) {
      win.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>So'rovlar Jurnali - ${todayStr}</title>
            <style>
              @page { size: A4 landscape; margin: 10mm; }
              body { margin: 0; background: #fff; }
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            </style>
          </head>
          <body>${renderHtmlContent()}</body>
        </html>
      `);
      win.document.close();
      win.focus();
      setTimeout(() => {
        win.print();
        win.close();
      }, 350);
    }
  };

  const handleDownloadPdf = () => {
    if (!printRef.current) return;
    setIsPdfGenerating(true);

    const opt: any = {
      margin: [8, 10, 8, 10],
      filename: `sorovlar_jurnali_${new Date().toISOString().slice(0, 10)}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
    };

    try {
      // @ts-ignore
      html2pdf()
        .set(opt)
        .from(printRef.current)
        .save()
        .then(() => {
          setIsPdfGenerating(false);
        })
        .catch((err: any) => {
          console.error('PDF xatoligi:', err);
          setIsPdfGenerating(false);
          handlePrint();
        });
    } catch (err) {
      console.error(err);
      setIsPdfGenerating(false);
      handlePrint();
    }
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} size="xl" title="So'rovlar Tarixi — Rasmiy Hujjat">
      <div className="space-y-4">
        {/* Yuqori boshqaruv paneli */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <FileText className="w-4 h-4 text-blue-600" />
            <span>Format: <b>A4 Gorizontal (Landscape)</b></span>
            <span>•</span>
            <span>Jami satrlar: <b>{items.length} ta</b></span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<Printer className="w-4 h-4" />}
              onClick={handlePrint}
              className="cursor-pointer"
            >
              Chop etish
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={isPdfGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              onClick={handleDownloadPdf}
              disabled={isPdfGenerating}
              className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isPdfGenerating ? 'Yuklanmoqda...' : 'PDF yuklab olish'}
            </Button>
          </div>
        </div>

        {/* Hujjat ko'rish oynasi (Preview) */}
        <div className="max-h-[65vh] overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl bg-white shadow-inner p-4">
          <div
            ref={printRef}
            className="bg-white text-slate-900 mx-auto"
            dangerouslySetInnerHTML={{ __html: renderHtmlContent() }}
          />
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onClose}>
            Yopish
          </Button>
        </div>
      </div>
    </Modal>
  );
}
