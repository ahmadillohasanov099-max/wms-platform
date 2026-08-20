// @ts-ignore
import html2pdf from 'html2pdf.js';
import { useRef, useEffect, useState } from 'react';
import Modal from '../ui/modal';
import Button from '../ui/button';
import { Printer, CheckCircle2, Download, Loader2 } from 'lucide-react';

export interface TalabnomaItem {
  name: string;
  unit: string;
  quantity: number;
}

export interface TalabnomaData {
  seqNumber?: number;
  documentNumber?: string;
  date?: string | Date;
  fromUser?: string;
  toRecipient?: string;
  items: TalabnomaItem[];
  note?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  data: TalabnomaData | null;
}

export function getNextTalabnomaNumber(): number {
  try {
    const lastNum = localStorage.getItem('last_talabnoma_seq_num');
    const nextNum = lastNum ? parseInt(lastNum, 10) + 1 : 1;
    localStorage.setItem('last_talabnoma_seq_num', nextNum.toString());
    return nextNum;
  } catch {
    return 1;
  }
}

export function numberToWordsUz(num: number): string {
  if (num <= 0) return '';

  const ones = ['', 'bir', 'ikki', 'uch', 'to‘rt', 'besh', 'olti', 'yetti', 'sakkiz', 'to‘qqiz'];
  const tens = ['', 'o‘n', 'yigirma', 'o‘ttiz', 'qirq', 'ellik', 'oltmish', 'yetmish', 'sakkson', 'to‘qson'];

  if (num < 10) return ones[num].charAt(0).toUpperCase() + ones[num].slice(1);
  if (num < 100) {
    const t = Math.floor(num / 10);
    const o = num % 10;
    const res = (tens[t] + (o ? ' ' + ones[o] : '')).trim();
    return res.charAt(0).toUpperCase() + res.slice(1);
  }
  if (num < 1000) {
    const h = Math.floor(num / 100);
    const rem = num % 100;
    const res = ((h === 1 ? 'yuz' : ones[h] + ' yuz') + (rem ? ' ' + numberToWordsUz(rem).toLowerCase() : '')).trim();
    return res.charAt(0).toUpperCase() + res.slice(1);
  }
  if (num < 1000000) {
    const th = Math.floor(num / 1000);
    const rem = num % 1000;
    const res = ((th === 1 ? 'ming' : numberToWordsUz(th).toLowerCase() + ' ming') + (rem ? ' ' + numberToWordsUz(rem).toLowerCase() : '')).trim();
    return res.charAt(0).toUpperCase() + res.slice(1);
  }

  return num.toString();
}

export default function TalabnomaModal({ open, onClose, data }: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const [seqNumber, setSeqNumber] = useState<number>(1);

  const [isPdfGenerating, setIsPdfGenerating] = useState(false);

  useEffect(() => {
    if (open && data) {
      if (data.seqNumber) {
        setSeqNumber(data.seqNumber);
      } else {
        const next = getNextTalabnomaNumber();
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

  const handleDownloadPdfFile = () => {
    if (!printRef.current) return;
    setIsPdfGenerating(true);
    const element = printRef.current.firstElementChild || printRef.current;
    
    const opt = {
      margin: [10, 12, 10, 15],
      filename: `talabnoma_${data.documentNumber || seqNumber}.pdf`,
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
        handlePrint();
      });
    } catch (err) {
      console.error(err);
      setIsPdfGenerating(false);
      handlePrint();
    }
  };

  const totalRows = 15;
  const rows: Array<{ index: number; name: string; unit: string; qty: string | number; qtyWords: string }> = [];
  for (let i = 0; i < totalRows; i++) {
    const item = data.items[i];
    rows.push({
      index: i + 1,
      name: item ? item.name : '',
      unit: item ? item.unit : '',
      qty: item ? item.quantity : '',
      qtyWords: item ? numberToWordsUz(item.quantity) : '',
    });
  }

  const renderSingleTalabnomaHtml = () => `
    <div class="talabnoma-block" style="font-family: 'Times New Roman', Times, serif; color: #000; box-sizing: border-box; width: 100%; height: 133mm; padding: 2mm 0; display: flex; flex-direction: column; justify-content: space-between;">
      <div>
        <!-- Header Org -->
        <div style="text-align: center; font-weight: normal; font-size: 10.5pt; margin-bottom: 6px; line-height: 1.2;">
          O‘zbekiston Respublikasi Qurilish va uy-joy kommunal xo‘jaligi vazirligi
        </div>

        <!-- Title -->
        <div style="text-align: center; font-size: 13pt; font-weight: bold; letter-spacing: 2px; margin-bottom: 4px;">
          T A L A B N O M A &nbsp; № &nbsp;<u>&nbsp; ${seqNumber} &nbsp;</u>
        </div>

        <!-- Date -->
        <div style="text-align: center; font-size: 10.5pt; margin-bottom: 10px;">
          « <u>&nbsp; ${day} &nbsp;</u> » &nbsp;&nbsp; <u>&nbsp;&nbsp;&nbsp; ${monthName} &nbsp;&nbsp;&nbsp;</u> &nbsp;&nbsp; ${year} -yil
        </div>

        <!-- Kimdan / Kimga -->
        <div style="font-size: 10pt; margin-bottom: 8px; line-height: 1.4;">
          <div style="margin-bottom: 4px;">
            <span style="font-weight: bold; text-decoration: underline;">Kimdan:</span> &nbsp;&nbsp;
            <span style="text-decoration: underline; font-weight: normal;">${fromName}</span>
          </div>
          <div>
            <span style="font-weight: bold; text-decoration: underline;">Kimga:</span> &nbsp;&nbsp;
            <span style="border-bottom: 1px solid #000; display: inline-block; width: 85%; text-indent: 6px; font-weight: normal;">${toName}</span>
          </div>
        </div>

        <!-- Table -->
        <table style="width: 100%; border-collapse: collapse; border: 1.2px solid #000; font-size: 9pt; margin-bottom: 8px;">
          <thead>
            <tr style="height: 20px;">
              <th rowspan="2" style="border: 1px solid #000; width: 26px; text-align: center; padding: 2px; font-weight: bold;">№</th>
              <th rowspan="2" style="border: 1px solid #000; text-align: center; padding: 2px; font-weight: bold;">Tovar nomi</th>
              <th rowspan="2" style="border: 1px solid #000; width: 75px; text-align: center; padding: 2px; font-weight: bold;">O‘lchov<br/>birligi</th>
              <th colspan="2" style="border: 1px solid #000; text-align: center; padding: 2px; font-weight: bold;">Chiqarilgan soni</th>
            </tr>
            <tr style="height: 18px;">
              <th style="border: 1px solid #000; width: 60px; text-align: center; padding: 2px; font-weight: bold;">soni</th>
              <th style="border: 1px solid #000; width: 125px; text-align: center; padding: 2px; font-weight: bold;">so‘zda</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr style="height: 17px;">
                <td style="border: 1px solid #000; text-align: center; padding: 2px 2px; font-size: 8.5pt;">${r.index}</td>
                <td style="border: 1px solid #000; text-align: left; padding: 2px 5px; font-size: 8.5pt;">${r.name}</td>
                <td style="border: 1px solid #000; text-align: center; padding: 2px 2px; font-size: 8.5pt;">${r.unit}</td>
                <td style="border: 1px solid #000; text-align: center; padding: 2px 2px; font-size: 8.5pt; font-weight: bold;">${r.qty}</td>
                <td style="border: 1px solid #000; text-align: center; padding: 2px 2px; font-size: 8.5pt; font-style: italic;">${r.qtyWords}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Signatures (Short clean lines without names) -->
      <div style="display: flex; justify-content: space-between; align-items: flex-end; font-size: 10pt; padding-top: 6px;">
        <div style="width: 46%; text-align: left;">
          <div style="display: flex; align-items: flex-end;">
            <span style="font-weight: bold; margin-right: 6px;">Topshirdi</span>
            <div style="border-bottom: 1px solid #000; width: 110px; min-height: 22px;"></div>
          </div>
          <div style="font-size: 7.5pt; text-align: center; margin-top: 2px; width: 175px;">(F.I.SH, imzo)</div>
        </div>

        <div style="width: 46%; text-align: left;">
          <div style="display: flex; align-items: flex-end;">
            <span style="font-weight: bold; margin-right: 6px;">Qabul qildi</span>
            <div style="border-bottom: 1px solid #000; width: 110px; min-height: 22px;"></div>
          </div>
          <div style="font-size: 7.5pt; text-align: center; margin-top: 2px; width: 185px;">(F.I.SH, imzo)</div>
        </div>
      </div>

    </div>
  `;

  const handlePrint = () => {
    const windowPrint = window.open('', '', 'left=0,top=0,width=850,height=1100,toolbar=0,scrollbars=0,status=0');
    if (!windowPrint) return;

    windowPrint.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Talabnoma № ${seqNumber}</title>
          <style>
            @page {
              size: A4 portrait;
              margin-top: 8mm;
              margin-bottom: 8mm;
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
              min-height: 281mm;
              position: relative;
              box-sizing: border-box;
              margin: 0;
            }
            .talabnoma-block {
              height: 135mm;
            }
            .full-cut-line {
              position: absolute;
              top: 140.5mm; /* Exact 50% A4 midpoint */
              left: 0;
              width: 100%;
              border-top: 1.5px dashed #000;
            }
          </style>
        </head>
        <body>
          <div class="page-container">
            <!-- Single Copy (Top) -->
            ${renderSingleTalabnomaHtml()}

            <!-- Dashed Cut Line at exact 50% A4 midpoint -->
            <div class="full-cut-line"></div>
          </div>
        </body>
      </html>
    `);

    windowPrint.document.close();
    windowPrint.focus();
    setTimeout(() => {
      windowPrint.print();
      windowPrint.close();
    }, 250);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Talabnoma"
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full flex-wrap gap-2">
          <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 text-xs font-medium">
            <CheckCircle2 className="w-4 h-4" />
            Operatsiya saqlandi
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose} disabled={isPdfGenerating}>
              Yopish
            </Button>
            <Button
              onClick={handleDownloadPdfFile}
              disabled={isPdfGenerating}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold"
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
              onClick={handlePrint}
              disabled={isPdfGenerating}
              className="flex items-center gap-2 border-blue-600 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 font-semibold"
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
          {/* Single Copy Preview Box */}
          <div 
            className="bg-white text-black p-5 rounded shadow-sm border border-gray-300 mx-auto w-[175mm] pl-6 pr-4"
            dangerouslySetInnerHTML={{ __html: renderSingleTalabnomaHtml() }}
          />

          {/* Dashed Cut Line in Preview */}
          <div className="border-t-2 border-dashed border-gray-400 my-3 w-[175mm] mx-auto" />
        </div>
      </div>
    </Modal>
  );
}

