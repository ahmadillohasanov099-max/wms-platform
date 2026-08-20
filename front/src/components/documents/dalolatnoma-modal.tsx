// @ts-ignore
import html2pdf from 'html2pdf.js';
import { useRef, useEffect, useState } from 'react';
import Modal from '../ui/modal';
import Button from '../ui/button';
import { Printer, CheckCircle2, Download, Loader2 } from 'lucide-react';

export interface DalolatnomaItem {
  name: string;
  inventoryNumber: string;
  serialNumber?: string;
  unit?: string;
  quantity?: number;
  condition?: string;
}

export interface DalolatnomaData {
  seqNumber?: number;
  documentNumber?: string;
  date?: string | Date;
  fromUser?: string;
  toRecipient?: string;
  items: DalolatnomaItem[];
  note?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  data: DalolatnomaData | null;
}

export function getNextDalolatnomaNumber(): number {
  try {
    const lastNum = localStorage.getItem('last_dalolatnoma_seq_num');
    const nextNum = lastNum ? parseInt(lastNum, 10) + 1 : 1;
    localStorage.setItem('last_dalolatnoma_seq_num', nextNum.toString());
    return nextNum;
  } catch {
    return 1;
  }
}

export default function DalolatnomaModal({ open, onClose, data }: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const [seqNumber, setSeqNumber] = useState<number>(1);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);

  useEffect(() => {
    if (open && data) {
      if (data.seqNumber) {
        setSeqNumber(data.seqNumber);
      } else {
        const next = getNextDalolatnomaNumber();
        setSeqNumber(next);
      }
    }
  }, [open, data]);

  if (!data) return null;

  const docDate = data.date ? new Date(data.date) : new Date();
  const day = docDate.getDate().toString().padStart(2, '0');
  const monthNames = [
    'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
    'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'
  ];
  const monthName = monthNames[docDate.getMonth()];
  const year = docDate.getFullYear();
  const fromName = data.fromUser || 'Xo‘jalik mudiri';
  const toName = data.toRecipient || '';
  const docNumStr = data.documentNumber || `DAL-2026-${String(seqNumber).padStart(3, '0')}`;
  const isKirimDoc = docNumStr.startsWith('KRM-');
  const titleText = isKirimDoc
    ? 'MAHSULOTLARNI OMBORGA KIRIM QILISH<br/>D A L O L A T N O M A S I'
    : 'ASOSIY VOSITALARNI TOPSHIRISH-QABUL QILISH<br/>D A L O L A T N O M A S I';

  const introText = isKirimDoc
    ? `Ushbu dalolatnoma tuzildi shuning haqida: <strong>${fromName}</strong> mas'ulligi оstida quyida ko'rsatilgan mahsulotlar/jihozlar omborga rasman kirim qilindi hamda omborxona hisobiga qabul qilib olindi.`
    : `Ushbu dalolatnoma tuzildi shuning haqida: <strong>${fromName}</strong> (Topshiruvchi) tomonidan quyida ko'rsatilgan asosiy vositalar (jihozlar) rasman topshirildi va <strong>${toName}</strong> (Qabul qiluvchi) tomonidan foydalanish hamda javobgarlikka qabul qilib olindi.`;

  const renderDalolatnomaHtml = () => `
    <div class="dalolatnoma-block" style="font-family: 'Times New Roman', Times, serif; color: #000; box-sizing: border-box; width: 100%; min-height: 250mm; padding: 5mm 0; display: flex; flex-direction: column; justify-content: space-between;">
      <div>
        <!-- Header Org -->
        <div style="text-align: center; font-weight: bold; font-size: 11pt; margin-bottom: 8px; line-height: 1.3;">
          O‘ZBEKISTON RESPUBLIKASI QURILISH VA UY-JOY KOMMUNAL XO‘JALIGI VAZIRLIGI
        </div>

        <!-- Title -->
        <div style="text-align: center; font-size: 13pt; font-weight: bold; letter-spacing: 1.5px; margin-bottom: 6px; text-transform: uppercase;">
          ${titleText} &nbsp; № &nbsp;<u>&nbsp; ${docNumStr} &nbsp;</u>
        </div>

        <!-- Date -->
        <div style="text-align: center; font-size: 11pt; margin-bottom: 16px;">
          « <u>&nbsp; ${day} &nbsp;</u> » &nbsp;&nbsp; <u>&nbsp;&nbsp;&nbsp; ${monthName} &nbsp;&nbsp;&nbsp;</u> &nbsp;&nbsp; ${year} -yil
        </div>

        <!-- Description / Intro -->
        <div style="font-size: 10.5pt; margin-bottom: 14px; line-height: 1.5; text-align: justify;">
          ${introText}
        </div>

        <!-- Table -->
        <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #000; font-size: 9.5pt; margin-bottom: 16px;">
          <thead>
            <tr style="height: 26px; background-color: #f2f2f2;">
              <th style="border: 1px solid #000; width: 30px; text-align: center; padding: 4px; font-weight: bold;">№</th>
              <th style="border: 1px solid #000; text-align: center; padding: 4px; font-weight: bold;">Asosiy vosita (Jihoz) nomi</th>
              <th style="border: 1px solid #000; width: 110px; text-align: center; padding: 4px; font-weight: bold;">Inventar №</th>
              <th style="border: 1px solid #000; width: 110px; text-align: center; padding: 4px; font-weight: bold;">Zavod (seriya) №</th>
              <th style="border: 1px solid #000; width: 60px; text-align: center; padding: 4px; font-weight: bold;">Soni</th>
              <th style="border: 1px solid #000; width: 100px; text-align: center; padding: 4px; font-weight: bold;">Holati</th>
            </tr>
          </thead>
          <tbody>
            ${data.items.map((item, idx) => `
              <tr style="height: 22px;">
                <td style="border: 1px solid #000; text-align: center; padding: 4px; font-size: 9pt;">${idx + 1}</td>
                <td style="border: 1px solid #000; text-align: left; padding: 4px 6px; font-size: 9pt; font-weight: bold;">${item.name}</td>
                <td style="border: 1px solid #000; text-align: center; padding: 4px; font-size: 9pt; font-family: monospace; font-weight: bold;">${item.inventoryNumber || '-'}</td>
                <td style="border: 1px solid #000; text-align: center; padding: 4px; font-size: 9pt; font-family: monospace;">${item.serialNumber || '-'}</td>
                <td style="border: 1px solid #000; text-align: center; padding: 4px; font-size: 9pt; font-weight: bold;">${item.quantity ?? 1} ${item.unit || 'dona'}</td>
                <td style="border: 1px solid #000; text-align: center; padding: 4px; font-size: 9pt;">${item.condition || 'Soz (yangi)'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        ${data.note ? `
          <div style="font-size: 10pt; margin-bottom: 14px; line-height: 1.4;">
            <strong>Izoh / Qo'shimcha shartlar:</strong> ${data.note}
          </div>
        ` : ''}
      </div>

      <!-- Signatures Section -->
      <div style="margin-top: 30px; font-size: 10.5pt;">
        <div style="margin-bottom: 20px; font-weight: bold;">
          Asosiy vositalar to'liq topshirildi va javobgarlikka qabul qilindi:
        </div>

        <div style="display: flex; justify-content: space-between; align-items: flex-end;">
          <div style="width: 45%;">
            <div style="font-weight: bold; margin-bottom: 6px;">Topshirdi (Topshiruvchi mas'ul):</div>
            <div style="margin-bottom: 4px; font-size: 10pt;">${fromName}</div>
            <div style="border-bottom: 1.5px solid #000; width: 100%; min-height: 28px;"></div>
            <div style="font-size: 8pt; text-align: center; margin-top: 3px;">(F.I.SH. va imzo)</div>
          </div>

          <div style="width: 45%;">
            <div style="font-weight: bold; margin-bottom: 6px;">Qabul qildi (Javobgar shaxs):</div>
            <div style="margin-bottom: 4px; font-size: 10pt;">${toName}</div>
            <div style="border-bottom: 1.5px solid #000; width: 100%; min-height: 28px;"></div>
            <div style="font-size: 8pt; text-align: center; margin-top: 3px;">(F.I.SH. va imzo)</div>
          </div>
        </div>
      </div>
    </div>
  `;

  const triggerPrint = () => {
    try {
      let iframe = document.getElementById('dalolatnoma-print-iframe') as HTMLIFrameElement;
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'dalolatnoma-print-iframe';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.style.visibility = 'hidden';
        document.body.appendChild(iframe);
      }

      const fullHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Dalolatnoma № ${docNumStr}</title>
            <style>
              @page {
                size: A4 portrait;
                margin-top: 15mm;
                margin-bottom: 15mm;
                margin-left: 20mm;
                margin-right: 15mm;
              }
              * {
                box-sizing: border-box;
              }
              body {
                font-family: 'Times New Roman', Times, serif;
                color: #000;
                background: #fff;
                margin: 0;
                padding: 0;
                width: 175mm;
              }
              .page-container {
                width: 175mm;
                margin: 0;
              }
            </style>
          </head>
          <body>
            <div class="page-container">
              ${renderDalolatnomaHtml()}
            </div>
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
    const windowPrint = window.open('', '_blank', 'width=850,height=1100');
    if (windowPrint) {
      windowPrint.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Dalolatnoma № ${docNumStr}</title>
            <style>
              @page { size: A4 portrait; margin: 15mm 15mm 15mm 20mm; }
              body { font-family: 'Times New Roman', serif; color: #000; margin: 0; width: 175mm; }
            </style>
          </head>
          <body>${renderDalolatnomaHtml()}</body>
        </html>
      `);
      windowPrint.document.close();
      windowPrint.focus();
      setTimeout(() => {
        windowPrint.print();
        windowPrint.close();
      }, 300);
    }
  };

  const handleDownloadPdfFile = () => {
    if (!printRef.current) return;
    setIsPdfGenerating(true);
    const element = printRef.current.firstElementChild || printRef.current;
    
    const opt = {
      margin: [10, 12, 10, 15],
      filename: `dalolatnoma_${docNumStr}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
      // @ts-ignore
      html2pdf().set(opt).from(element).save().then(() => {
        setIsPdfGenerating(false);
      }).catch((err: any) => {
        console.error("PDF generation error:", err);
        setIsPdfGenerating(false);
        triggerPrint();
      });
    } catch (err) {
      console.error(err);
      setIsPdfGenerating(false);
      triggerPrint();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Topshirish-Qabul qilish Dalolatnomasi"
      size="xl"
      footer={
        <div className="flex items-center justify-between w-full flex-wrap gap-2">
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
            <CheckCircle2 className="w-4 h-4" />
            Operatsiya saqlandi (Dalolatnoma № {docNumStr})
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose} disabled={isPdfGenerating}>
              Yopish
            </Button>
            <Button
              onClick={handleDownloadPdfFile}
              disabled={isPdfGenerating}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              {isPdfGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {isPdfGenerating ? "PDF tayyorlanmoqda..." : "PDF yuklab olish"}
            </Button>
            <Button
              variant="outline"
              onClick={triggerPrint}
              disabled={isPdfGenerating}
              className="flex items-center gap-2 border-emerald-600 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 font-semibold"
            >
              <Printer className="w-4 h-4" />
              Chop etish (Print)
            </Button>
          </div>
        </div>
      }
    >
      {/* Modal Preview Area */}
      <div className="bg-gray-100 dark:bg-gray-950 p-4 rounded-xl border border-gray-200 dark:border-gray-800 overflow-y-auto max-h-[72vh]">
        <div ref={printRef} className="space-y-4">
          <div 
            className="bg-white text-black p-6 rounded shadow-sm border border-gray-300 mx-auto w-full max-w-[185mm]"
            dangerouslySetInnerHTML={{ __html: renderDalolatnomaHtml() }}
          />
        </div>
      </div>
    </Modal>
  );
}
