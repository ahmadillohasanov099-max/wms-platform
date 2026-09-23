// @ts-ignore
import html2pdf from 'html2pdf.js';
import { useRef, useState } from 'react';
import Modal from '../ui/modal';
import Button from '../ui/button';
import { Printer, Download, Loader2, FileText, CheckCircle2 } from 'lucide-react';
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
  currentUserName = "Mas'ul xodim",
  organizationName = "O'ZBEKISTON RESPUBLIKASI QURILISH VA UY-JOY KOMMUNAL XO'JALIGI VAZIRLIGI",
}: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);



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

  const getRequestTypeBadgeHtml = (item: RequestItem) => {
    const normReason = String(item.reason || '').toLowerCase().replace(/['ʼ’`ʻ]/g, '');

    if (item.requestType === 'ASSIGNMENT') {
      return `<span style="color: #1d4ed8; font-weight: 700; font-size: 9.5px; white-space: nowrap;">Biriktirish</span>`;
    }
    if (item.requestType === 'REPAIR' || normReason.includes('tamirlash') || normReason.includes('servis')) {
      return `<span style="color: #c2410c; font-weight: 700; font-size: 9.5px; white-space: nowrap;">Ta'mirlash</span>`;
    }
    if (item.requestType === 'RETURN' || normReason.includes('qaytarish')) {
      return `<span style="color: #0f766e; font-weight: 700; font-size: 9.5px; white-space: nowrap;">Qaytarish</span>`;
    }
    return `<span style="color: #b91c1c; font-weight: 700; font-size: 9.5px; white-space: nowrap;">Hisobdan chiqarish</span>`;
  };

  const getStatusBadgeHtml = (status: string) => {
    if (status === 'APPROVED') {
      return `<span style="color: #15803d; font-weight: 700; font-size: 9.5px; white-space: nowrap;">Tasdiqlandi</span>`;
    }
    if (status === 'REJECTED') {
      return `<span style="color: #dc2626; font-weight: 700; font-size: 9.5px; white-space: nowrap;">Rad etildi</span>`;
    }
    return `<span style="color: #d97706; font-weight: 700; font-size: 9.5px; white-space: nowrap;">Kutilmoqda</span>`;
  };

  // Pagination logic:
  // Har bir sahifaga qat'iy 10 tadan so'rov joylashtiriladi.
  const paginateItems = (allRows: RequestItem[]) => {
    if (allRows.length === 0) return [[]];

    const pages: RequestItem[][] = [];
    const pageSize = 10;
    for (let i = 0; i < allRows.length; i += pageSize) {
      pages.push(allRows.slice(i, i + pageSize));
    }
    return pages;
  };

  const pages = paginateItems(items);
  const totalPages = pages.length;

  const renderTableHeader = () => `
    <thead>
      <tr style="background-color: #1e3a8a; color: #ffffff;">
        <th style="border: 1px solid #172554; padding: 7px 3px; text-align: center; width: 28px; font-weight: 800; font-size: 9.5px;">№</th>
        <th style="border: 1px solid #172554; padding: 7px 6px; text-align: left; width: 95px; font-weight: 800; font-size: 9.5px;">So'rov turi</th>
        <th style="border: 1px solid #172554; padding: 7px 6px; text-align: left; width: 140px; font-weight: 800; font-size: 9.5px;">Obyekt / Jihoz</th>
        <th style="border: 1px solid #172554; padding: 7px 5px; text-align: left; width: 105px; font-weight: 800; font-size: 9.5px;">Yuboruvchi</th>
        <th style="border: 1px solid #172554; padding: 7px 5px; text-align: left; width: 105px; font-weight: 800; font-size: 9.5px;">Qabul qiluvchi</th>
        <th style="border: 1px solid #172554; padding: 7px 4px; text-align: center; width: 75px; font-weight: 800; font-size: 9.5px;">Sana</th>
        <th style="border: 1px solid #172554; padding: 7px 4px; text-align: center; width: 90px; font-weight: 800; font-size: 9.5px;">Holati</th>
        <th style="border: 1px solid #172554; padding: 7px 5px; text-align: left; width: 95px; font-weight: 800; font-size: 9.5px;">Ko'rib chiquvchi</th>
        <th style="border: 1px solid #172554; padding: 7px 6px; text-align: left; font-weight: 800; font-size: 9.5px;">Sabab / Izoh</th>
      </tr>
    </thead>
  `;

  const renderTableRows = (pageRows: RequestItem[], startIndex: number) => {
    if (pageRows.length === 0) {
      return `<tr><td colspan="9" style="border: 1px solid #cbd5e1; padding: 25px; text-align: center; color: #64748b; font-size: 11px;">So'rovlar mavjud emas</td></tr>`;
    }

    return pageRows
      .map((row, idx) => {
        const globalIdx = startIndex + idx + 1;
        const isEven = idx % 2 === 1;
        const bg = isEven ? '#f8fafc' : '#ffffff';
        const entity =
          row.entityTitle ||
          row.entityName ||
          (row.requestType === 'ASSIGNMENT' ? row.recipientName || 'Jihoz' : row.entityType);
        const reason = row.reason || '—';
        const comment = row.reviewComment || row.rejectionReason;
        const fullReason = comment ? `${reason} (Izoh: ${comment})` : reason;

        return `
          <tr style="background-color: ${bg}; page-break-inside: avoid; break-inside: avoid;">
            <td style="border: 1px solid #cbd5e1; padding: 6px 3px; text-align: center; font-weight: 800; color: #1e3a8a; font-size: 9.5px;">${globalIdx}</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 6px;">${getRequestTypeBadgeHtml(row)}</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 6px; font-weight: 700; color: #0f172a; font-size: 9.5px;">${entity}</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 5px; color: #334155; font-size: 9.5px;">${row.requestedBy?.fullName || row.requestedBy?.username || '—'}</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 5px; color: #334155; font-size: 9.5px;">${row.recipientName || '—'}</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 4px; text-align: center; font-size: 9px; color: #475569; white-space: nowrap;">${formatDate(row.createdAt)}</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 4px; text-align: center;">
              ${getStatusBadgeHtml(row.status)}
            </td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 5px; font-size: 9px; color: #334155;">${row.reviewedBy?.fullName || '—'}</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 6px; font-size: 9px; color: #334155; word-break: break-word; line-height: 1.35;">${fullReason}</td>
          </tr>
        `;
      })
      .join('');
  };

  const renderSignaturesBlock = () => `
    <table style="width: 100%; border-collapse: collapse; margin-top: 16px; padding-top: 10px; border-top: 1.5px dashed #94a3b8; font-size: 10px; color: #0f172a; page-break-inside: avoid; break-inside: avoid;">
      <tr>
        <td style="width: 50%; vertical-align: top; text-align: left;">
          <div>Hisobotni shakllantirdi: <b style="color: #1e3a8a;">${currentUserName}</b></div>
          <div style="margin-top: 16px;">Imzo: ___________________________________</div>
        </td>
        <td style="width: 50%; vertical-align: top; text-align: right;">
          <div>Tasdiqladi (Mas'ul rahbar): ___________________________________</div>
          <div style="margin-top: 16px;">M.O'. &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Sana: <b>${todayStr}</b> yil</div>
        </td>
      </tr>
    </table>
  `;

  const renderSinglePageHtml = (pageRows: RequestItem[], pageIdx: number, totalPgs: number, startIndex: number) => {
    const isFirstPage = pageIdx === 0;
    const isLastPage = pageIdx === totalPgs - 1;

    return `
      <div class="pdf-page-container" style="width: 277mm; min-height: 190mm; box-sizing: border-box; padding: 8mm 10mm; margin: 0 auto ${isLastPage ? '0' : '25px'} auto; background: #ffffff; page-break-after: always; break-after: page; page-break-inside: avoid; break-inside: avoid; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1); border-radius: 4px; position: relative;">
        
        <!-- Yuqori qism (Gerb + Sarlavha + Jadval) -->
        <div>
          ${
            isFirstPage
              ? `
                <!-- 1-sahifa: O'zbekiston Respublikasi Davlat Gerbi -->
                <div style="text-align: center; margin-bottom: 6px;">
                  <img
                    src="/Emblem_of_Uzbekistan.svg"
                    alt="O'zbekiston Respublikasi Davlat Gerbi"
                    style="height: 54px; width: auto; object-fit: contain; margin: 0 auto; display: inline-block;"
                  />
                </div>

                <!-- 1-sahifa to'liq rasmiy sarlavhasi -->
                <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 14px;">
                  <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; color: #0f172a; letter-spacing: 0.5px; margin-bottom: 3px;">
                    ${organizationName}
                  </div>
                  <div style="font-size: 15.5px; font-weight: 900; text-transform: uppercase; color: #1e40af; letter-spacing: 0.8px;">
                    MODDIY AKTIVLAR HARAKATI VA SO'ROVLAR JURNALI
                  </div>
                  <div style="font-size: 9.5px; color: #64748b; margin-top: 3px;">
                    Hujjat shakllantirildi: <b>${todayFullStr}</b> &nbsp;|&nbsp; Mas'ul xodim: <b>${currentUserName}</b>
                  </div>
                </div>
              `
              : `
                <!-- Keyingi sahifalar sarlavhasi (Faqat Tashkilot nomi va sana — "Davomi" so'zi olib tashlangan) -->
                <table style="width: 100%; border-collapse: collapse; border-bottom: 2px solid #1e3a8a; margin-bottom: 12px; padding-bottom: 4px;">
                  <tr>
                    <td style="text-align: left; font-size: 11px; font-weight: 800; text-transform: uppercase; color: #0f172a; letter-spacing: 0.4px;">
                      ${organizationName}
                    </td>
                    <td style="text-align: right; font-size: 9.5px; color: #475569; font-weight: 600;">
                      Sana: <b>${todayStr}</b>
                    </td>
                  </tr>
                </table>
              `
          }

          <!-- Asosiy Jadval -->
          <table style="width: 100%; border-collapse: collapse; font-size: 9px; line-height: 1.35; margin-bottom: 12px;">
            ${renderTableHeader()}
            <tbody>
              ${renderTableRows(pageRows, startIndex)}
            </tbody>
          </table>
        </div>

        <!-- Quyi qism (Imzolar va sahifa raqami) -->
        <div style="margin-top: 14px; page-break-inside: avoid; break-inside: avoid;">
          ${isLastPage ? renderSignaturesBlock() : ''}

          <!-- Sahifa pastki fiksatsiyasi (Footer) -->
          <table style="width: 100%; border-collapse: collapse; margin-top: 8px; padding-top: 6px; border-top: 1.5px solid #cbd5e1; font-size: 8.5px; color: #64748b;">
            <tr>
              <td style="text-align: left; width: 40%; font-weight: 600;">Ombor Boshqaruv Tizimi (WMS) &nbsp;|&nbsp; Rasmiy hisobot</td>
              <td style="text-align: center; width: 20%; font-weight: 800; color: #1e40af;">Sahifa ${pageIdx + 1} / ${totalPgs}</td>
              <td style="text-align: right; width: 40%;">Chop etildi: <b>${todayFullStr}</b></td>
            </tr>
          </table>
        </div>

      </div>
    `;
  };

  const renderAllPagesHtml = () => {
    let accumulatedCount = 0;
    return pages
      .map((pageRows, pageIdx) => {
        const start = accumulatedCount;
        accumulatedCount += pageRows.length;
        return renderSinglePageHtml(pageRows, pageIdx, totalPages, start);
      })
      .join('');
  };

  // 100% Vektorli Tiniq PDF (Brauzer Print orqali):
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
            <base href="${window.location.origin}/" />
            <meta charset="utf-8"/>
            <title>Sorovlar_Jurnali_${todayStr}</title>
            <style>
              @page {
                size: A4 landscape;
                margin: 0;
              }
              body {
                margin: 0;
                padding: 0;
                background: #ffffff;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .pdf-page-container {
                width: 297mm !important;
                min-height: 200mm !important;
                margin: 0 !important;
                padding: 8mm 10mm !important;
                box-shadow: none !important;
                border-radius: 0 !important;
                page-break-after: always !important;
                break-after: page !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                box-sizing: border-box !important;
              }
              .pdf-page-container:last-child {
                page-break-after: auto !important;
                break-after: auto !important;
              }
              * {
                box-sizing: border-box;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            </style>
          </head>
          <body>
            ${renderAllPagesHtml()}
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
        }, 400);
        return;
      }
    } catch (e) {
      console.warn('Iframe print failed, falling back to window.open:', e);
    }

    // Fallback: window.open
    const win = window.open('', '_blank', 'width=1150,height=850');
    if (win) {
      win.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <base href="${window.location.origin}/" />
            <meta charset="utf-8"/>
            <title>Sorovlar_Jurnali_${todayStr}</title>
            <style>
              @page { size: A4 landscape; margin: 0; }
              body { margin: 0; background: #fff; font-family: sans-serif; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              .pdf-page-container { width: 297mm !important; min-height: 200mm !important; margin: 0 !important; padding: 8mm 10mm !important; page-break-after: always !important; break-after: page !important; page-break-inside: avoid !important; box-sizing: border-box !important; }
              .pdf-page-container:last-child { page-break-after: auto !important; }
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            </style>
          </head>
          <body>${renderAllPagesHtml()}</body>
        </html>
      `);
      win.document.close();
      win.focus();
      setTimeout(() => {
        win.print();
        win.close();
      }, 400);
    }
  };

  // Direct PDF Download: Ultra High-Resolution (3.5x scale) + Strict CSS page-breaks
  const handleDownloadPdf = () => {
    if (!printRef.current) return;
    setIsPdfGenerating(true);

    const opt: any = {
      margin: 0,
      filename: `sorovlar_jurnali_${new Date().toISOString().slice(0, 10)}.pdf`,
      image: { type: 'jpeg', quality: 1.0 },
      html2canvas: {
        scale: 3.5, // 3.5x masshtab (Ultra-HD ~336 DPI): kattalashtirilganda ham xiralashmaydi
        useCORS: true,
        logging: false,
        letterRendering: true,
        scrollY: 0,
        scrollX: 0,
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape', compress: true },
      pagebreak: { mode: ['css', 'legacy'] },
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
    <Modal open={open} onClose={onClose} size="xl" title="So'rovlar Tarixi — Rasmiy PDF Hujjat">
      <div className="space-y-4">
        {/* Yuqori boshqaruv va ma'lumot paneli */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <FileText className="w-4 h-4 text-blue-600" />
            <span>Format: <b>A4 Gorizontal (Landscape)</b></span>
            <span>•</span>
            <span>Jami so'rovlar: <b>{items.length} ta</b></span>
            <span>•</span>
            <span>Jami sahifalar: <b>{totalPages} varoq</b></span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={isPdfGenerating ? <Loader2 className="w-4 h-4 animate-spin text-slate-500" /> : <Download className="w-4 h-4 text-slate-700 dark:text-slate-300" />}
              onClick={handleDownloadPdf}
              disabled={isPdfGenerating}
              className="cursor-pointer"
            >
              {isPdfGenerating ? 'Tayyorlanmoqda...' : 'PDF yuklab olish'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Printer className="w-4 h-4 text-white" />}
              onClick={handlePrint}
              disabled={isPdfGenerating}
              className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              Vektorli PDF (Chop etish)
            </Button>
          </div>
        </div>

        {/* Eslatma / Yo'riqnoma */}
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg text-xs text-blue-700 dark:text-blue-300">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <span>
            <b>Tiniq rasmiy PDF:</b> Har bir varoqqa aniq 10 tadan so'rov erkin joylashtirilgan. 100% tiniq va kattalashtirilganda ham xiralashmaydigan vektor format uchun <b>«Vektorli PDF (Chop etish)»</b> tugmasini bosing va <i>«PDF sifatida saqlash» (Save as PDF)</i> ni tanlang.
          </span>
        </div>

        {/* Hujjat ko'rish oynasi (Preview) */}
        <div className="max-h-[62vh] overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-100 dark:bg-slate-950 p-4">
          <div
            ref={printRef}
            className="text-slate-900 mx-auto"
            dangerouslySetInnerHTML={{ __html: renderAllPagesHtml() }}
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
