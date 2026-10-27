// @ts-ignore
import html2pdf from 'html2pdf.js';
import { useRef, useEffect, useState } from 'react';
import Modal from '../ui/modal';
import Button from '../ui/button';
import { Printer, CheckCircle2, Download, Loader2, ShieldCheck, MapPin, FileText, Calendar } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

export interface ModdiyJavobgarlikItem {
  name: string;
  inventoryNumber: string;
  serialNumber?: string;
  unit?: string;
  quantity?: number;
}

export interface ModdiyJavobgarlikData {
  seqNumber?: number;
  documentNumber?: string;
  date?: string | Date;
  fromUser?: string;
  toRecipient?: string;
  recipientPosition?: string;
  recipientDepartment?: string;
  recipientPassport?: string;
  recipientAddress?: string;
  items: ModdiyJavobgarlikItem[];
  note?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  data: ModdiyJavobgarlikData | null;
}


function formatDateForInput(dateVal?: string | Date): string {
  if (!dateVal) return '';
  if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
    return dateVal;
  }
  const dObj = new Date(dateVal);
  if (isNaN(dObj.getTime())) return '';
  const y = dObj.getFullYear();
  const m = String(dObj.getMonth() + 1).padStart(2, '0');
  const d = String(dObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function ModdiyJavobgarlikModal({ open, onClose, data }: Props) {
  const { t } = useTranslation();
  const printRef = useRef<HTMLDivElement>(null);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);

  // Editable Fields for preview/print
  const [documentNumber, setDocumentNumber] = useState<string>('');
  const [documentDate, setDocumentDate] = useState<string>('');
  const [recipientPassport, setRecipientPassport] = useState<string>('');
  const [recipientAddress, setRecipientAddress] = useState<string>('');
  const [toRecipient, setToRecipient] = useState<string>('');

  useEffect(() => {
    if (open && data) {
      const targetUserStr = data.toRecipient || (data as any).toUser || '';
      const pass = data.recipientPassport || '';
      const addr = data.recipientAddress || '';
      const initialDate = data.date ? formatDateForInput(data.date) : '';
      setRecipientPassport(pass);
      setRecipientAddress(addr);
      setToRecipient(targetUserStr);
      setDocumentNumber(''); // Shartnoma raqami default bo'yicha bo'sh bo'ladi
      setDocumentDate(initialDate);
    }
  }, [open, data]);

  if (!data) return null;

  const monthNames = [
    'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
    'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'
  ];
  const toNameStr = toRecipient || data.toRecipient || '';
  const docNumStr = documentNumber.trim();

  // If date is not provided, leave blank underline spaces for printing
  let dateLineHtml = '<div>202__ йил « <u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u> » <u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u></div>';

  if (documentDate && /^\d{4}-\d{2}-\d{2}$/.test(documentDate)) {
    const [yStr, mStr, dStr] = documentDate.split('-');
    const mIndex = parseInt(mStr, 10) - 1;
    const y = parseInt(yStr, 10);
    const d = dStr;
    const mName = mIndex >= 0 && mIndex < 12 ? monthNames[mIndex] : '';
    dateLineHtml = `<div>${y} йил « <u>&nbsp; ${d} &nbsp;</u> » <u>&nbsp;&nbsp;&nbsp; ${mName} &nbsp;&nbsp;&nbsp;</u></div>`;
  } else if (data.date) {
    const dObj = new Date(data.date);
    if (!isNaN(dObj.getTime())) {
      const y = dObj.getFullYear();
      const d = String(dObj.getDate()).padStart(2, '0');
      const mName = monthNames[dObj.getMonth()];
      dateLineHtml = `<div>${y} йил « <u>&nbsp; ${d} &nbsp;</u> » <u>&nbsp;&nbsp;&nbsp; ${mName} &nbsp;&nbsp;&nbsp;</u></div>`;
    }
  }
  const passportInfoStr = [recipientPassport || data.recipientPassport, recipientAddress || data.recipientAddress].filter(Boolean).join(', ');

  const renderAgreementHtml = () => `
    <div class="agreement-block" style="font-family: 'Times New Roman', Times, serif; color: #000; box-sizing: border-box; width: 100%; min-height: 260mm; padding: 0; line-height: 1.45; font-size: 11pt;">
      <div>
        <!-- Title 1 (BOLD) -->
        <div style="text-align: center; font-size: 13pt; font-weight: bold; margin-bottom: 3px; color: #000;">
          Якка тартибдаги тўлиқ моддий жавобгарлик тўғрисида
        </div>
        <!-- Title 2 (NORMAL & UNDERLINE) -->
        <div style="text-align: center; font-size: 12pt; font-weight: normal; margin-bottom: 14px; color: #000;">
          <u>&nbsp; ${docNumStr || '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'} &nbsp;</u>- сонли шартнома
        </div>

        <!-- Date & Location -->
        <div style="display: flex; justify-content: space-between; font-size: 11pt; margin-bottom: 14px; font-weight: normal;">
          ${dateLineHtml}
          <div>Тошкент шаҳри</div>
        </div>

        <!-- Preamble -->
        <div style="text-align: justify; font-size: 11pt; margin-bottom: 12px; line-height: 1.45;">
          Ўзбекистон Республикаси Мехнат Кодексининг 203-моддасига асосан бир томондан Ўзбекистон Республикаси Қурилиш ва уй-жой коммунал ҳўжалиги вазирлиги вазири ўринбосари <strong style="font-weight: bold; color: #000;">Алиматов Таир Наматуллаевич</strong>, кейинги ўринларда “Иш берувчи” деб юритилади, иккинчи томондан <strong style="font-weight: bold; color: #000;">${toNameStr}</strong>${passportInfoStr ? ` (${passportInfoStr})` : ''}, кейинги ўринларда “Ходим” деб юритилади, мазкур шартномани қуйидагича туздилар:
        </div>

        <!-- Section 1 (NORMAL) -->
        <div style="text-align: justify; font-size: 11pt; margin-bottom: 8px; font-weight: normal;">
          1. “Ходим” “Иш берувчи” томонидан ишониб топширилган моддий кимматликларни яъни:
        </div>

        <!-- Items list -->
        <div style="font-size: 10.5pt; margin-left: 10px; margin-bottom: 8px;">
          ${data.items.map((item) => `
            <div style="margin-bottom: 4px; text-align: justify;">
              - <strong style="font-weight: bold; color: #000;">${item.name}</strong> ${item.inventoryNumber ? `инвентар рақами <strong style="font-family: monospace; font-weight: bold; color: #000;">${item.inventoryNumber}</strong>` : ''}${item.serialNumber ? `, серия рақами <strong style="font-family: monospace; font-weight: bold;">${item.serialNumber}</strong>` : ''}
            </div>
          `).join('')}
        </div>

        <div style="text-align: justify; font-size: 11pt; margin-bottom: 12px; font-weight: normal;">
          ушбу моддий бойликларни сақлаш, унга шикаст етказмаслик, маҳсус буйруқ ёки тегишли ҳужжатларсиз бошқа шахсларга топширмаслик бўйича жавобгарликни ўз зиммасига олади.
        </div>

        <!-- Section 1.1 (NORMAL) -->
        <div style="text-align: justify; font-size: 11pt; margin-bottom: 6px; font-weight: normal;">
          1.1. “Ходим” юқоридаги мол-мулкларни сақланишини таъминламаганлиги учун тўлиқ моддий жавобгарликни олишда қуйидагиларга мажбур:
        </div>
        <div style="font-size: 10.5pt; margin-left: 10px; margin-bottom: 10px; line-height: 1.4; text-align: justify; font-weight: normal;">
          а) “Иш берувчи”га унга ишониб топширган моддий қиммаликларни сақланишини таъминлашда хавф-хатар туғдирувчи хамма холатлар тўғрисида ўз вақтида хабар бериш;<br/>
          б) унга ишониб берилган қимматликларнинг харакати ва колдиклари тўғрисидамахсулот пул ва бошка хисоботлар хисобини олиб бориш ва белгиланган тартибда иш берувчи томонидан масъул қилиб белгиланган ходимга тақдим килиш:<br/>
          в) унга ишониб топширилган моддий қимматликларни рўйхатдан ўтказиш чоғида иштирок этиш:<br/>
          г) унга бириктирилган моддий қимматлик ва корхона мулкини сақламаганлик учун иш берувчига етказилган зарарни тўлиқ тўлаш:<br/>
          д) Ўзбёкистон Республикасининг амалдаги қонунларига асосан моддий жавобгарликни тўла равишда ўз зиммамга олиш.
        </div>

        <!-- Section 1.2 (NORMAL) -->
        <div style="text-align: justify; font-size: 11pt; margin-bottom: 10px; font-weight: normal;">
          1.2. Ходим иш берувчига етказилган зарарни, ўз ихтиёри билан амалдаги қонун ҳужжатлари асосида бирданига тўлаш ҳуқуқига эга.
        </div>

        <div style="text-align: justify; font-size: 11pt; margin-bottom: 6px; font-weight: normal;">
          Ходимнинг бошқа мажбуриятлари.
        </div>

        <!-- Section 2 (NORMAL HEADER) -->
        <div style="text-align: justify; font-size: 11pt; margin-bottom: 6px; font-weight: normal;">
          2. Иш берувчи қуйидагиларга мажбур:
        </div>
        <div style="font-size: 10.5pt; margin-left: 10px; margin-bottom: 10px; line-height: 1.4; text-align: justify; font-weight: normal;">
          а) ходимга нормал ишлашини ва унга ишониб топширилган моддий қимматликларни тўла сақлашни таъминлаш учун зарур шарт-шароитни яратиб бериш;<br/>
          б) ходимни иш берувчига келтирган зарари учун ходимларнинг тўлиқ моддий жавобгарлиги тўғрисидаги амалдаги қонунлар, шунингдек йурикномалар, мулкни сақлаш нормаси ва қоидалари билан таништириш:<br/>
          в) белгиланган тартибда моддий қимматликларни рўйхатдан ўтказишни олиб бориш.
        </div>

        <!-- Section 2.1 - 6 (NORMAL) -->
        <div style="text-align: justify; font-size: 11pt; margin-bottom: 8px; font-weight: normal;">
          2.1. Иш берувчи келтирилган зарар учун ходимдан ундиришни тўла ёки кисман рад этиш ҳуқуқига эга.
        </div>
        <div style="text-align: justify; font-size: 11pt; margin-bottom: 8px; font-weight: normal;">
          3. Ходим томонидан келтирилган зарар микдори ва уни тўлаш, хисобхона хисоби асосида ҳақиқий етказилган зарар буйича аникланади.
        </div>
        <div style="text-align: justify; font-size: 11pt; margin-bottom: 8px; font-weight: normal;">
          4. Агар зарар ходим айби билан келтирилмаганлиги ва шунингдек охирги зарурат ва шу каби жавобгарликни истисно қиладиган ҳолатлар натижасида келтирилганлиги аниқланса, у холда ходимдан моддий жавобгарлик олиб ташланади.
        </div>
        <div style="text-align: justify; font-size: 11pt; margin-bottom: 8px; font-weight: normal;">
          5. Мазкур шартнома иш берувчи томонидан ходимга моддий қимматлик ва мулк ишониб топширилган меҳнат муносабатлари давом этаётган вақтда кучга эга.
        </div>
        <div style="text-align: justify; font-size: 11pt; margin-bottom: 10px; font-weight: normal;">
          6. Шартнома икки нусхада тузилган булиб, иккаласи хам бирдек юридик кучга эга, улардан бири иш берувчида, иккинчиси эса ходимда сақланади.
        </div>

        <div style="text-align: justify; font-size: 11pt; margin-bottom: 12px; font-weight: normal;">
          Иш берувчининг бошқа мажбуриятлари.
        </div>
      </div>

      <!-- Section 7 (BOLD & TABLE ALIGNED) -->
      <div style="margin-top: 20px; font-size: 11pt; page-break-inside: avoid;">
        <div style="text-align: center; font-weight: bold; margin-bottom: 14px; color: #000;">
          7. Томонлар манзили ва имзолари:
        </div>

        <table style="width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 10.5pt;">
          <thead>
            <tr>
              <th style="width: 50%; text-align: center; font-weight: bold; padding-bottom: 8px; vertical-align: top; color: #000;">
                “ИШ БЕРУВЧИ”
              </th>
              <th style="width: 50%; text-align: center; font-weight: bold; padding-bottom: 8px; vertical-align: top; color: #000;">
                “ХОДИМ”
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="vertical-align: top; padding-right: 15px;">
                <div style="text-align: center; font-weight: bold; line-height: 1.4; min-height: 45px;">
                  Ўзбекистон Республикаси Қурилиш ва уй-жой коммунал ҳўжалиги вазирлиги вазири ўринбосари
                </div>
              </td>
              <td style="vertical-align: top; padding-left: 15px;">
                <div style="text-align: left; font-weight: normal; line-height: 1.4; min-height: 45px;">
                  <div style="margin-bottom: 5px;">
                    <span style="font-weight: bold;">Манзили:</span> ${recipientAddress || data.recipientAddress || '—'}
                  </div>
                  <div>
                    <span style="font-weight: bold;">Паспорт:</span> ${recipientPassport || data.recipientPassport || '—'}
                  </div>
                </div>
              </td>
            </tr>
            <tr>
              <td style="vertical-align: bottom; padding-top: 30px; padding-right: 15px;">
                <div style="text-align: left; font-weight: bold; white-space: nowrap;">
                  ______________Т. Алиматов
                </div>
              </td>
              <td style="vertical-align: bottom; padding-top: 30px; padding-left: 15px;">
                <div style="text-align: left; font-weight: bold; white-space: nowrap;">
                  _____________ ${toNameStr}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  const triggerPrint = () => {
    try {
      let iframe = document.getElementById('moddiy-javobgarlik-print-iframe') as HTMLIFrameElement;
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'moddiy-javobgarlik-print-iframe';
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
            <title></title>
            <style>
              @page {
                size: A4 portrait;
                margin-top: 15mm;
                margin-bottom: 15mm;
                margin-left: 20mm;
                margin-right: 15mm;
              }
              @media print {
                html, body {
                  margin: 0 !important;
                  padding: 0 !important;
                }
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
              ${renderAgreementHtml()}
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

    const windowPrint = window.open('', '_blank', 'width=850,height=1100');
    if (windowPrint) {
      windowPrint.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title></title>
            <style>
              @page { size: A4 portrait; margin: 15mm 15mm 15mm 20mm; }
              body { font-family: 'Times New Roman', Times, serif; color: #000; margin: 0; width: 175mm; }
            </style>
          </head>
          <body>${renderAgreementHtml()}</body>
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
      margin: [12, 15, 12, 20],
      filename: docNumStr ? `moddiy_javobgarlik_shartnomasi_${docNumStr}.pdf` : 'moddiy_javobgarlik_shartnomasi.pdf',
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
      title={t('moddiyModal.title')}
      size="xl"
      footer={
        <div className="flex items-center justify-between w-full flex-wrap gap-2">
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
            <CheckCircle2 className="w-4 h-4" />
            {docNumStr ? t('moddiyModal.saved', { docNo: docNumStr }) : t('moddiyModal.title')}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose} disabled={isPdfGenerating}>
              {t('moddiyModal.close')}
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
              {isPdfGenerating ? t('moddiyModal.preparingPdf') : t('moddiyModal.downloadPdf')}
            </Button>
            <Button
              variant="outline"
              onClick={triggerPrint}
              disabled={isPdfGenerating}
              className="flex items-center gap-2 border-emerald-600 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 font-semibold"
            >
              <Printer className="w-4 h-4" />
              {t('moddiyModal.print')}
            </Button>
          </div>
        </div>
      }
    >
      {/* Quick Edit/Fill Fields */}
      <div className="bg-slate-50/90 dark:bg-slate-900/90 p-3.5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs mb-3 space-y-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {/* 1. Shartnoma raqami */}
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-500" />
              <span>{t('moddiyModal.contractNumber')}</span>
            </label>
            <input
              type="text"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              className="w-full h-9 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs transition-all"
            />
          </div>

          {/* 2. Shartnoma sanasi */}
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-500" />
              <span>{t('moddiyModal.contractDate')}</span>
            </label>
            <input
              type="date"
              value={documentDate}
              onChange={(e) => setDocumentDate(e.target.value)}
              className="w-full h-9 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs transition-all"
            />
          </div>

          {/* 3. Pasport seriyasi va raqami */}
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-sky-500" />
              <span>{t('userView.passportSeriesNo')}</span>
            </label>
            <input
              type="text"
              value={recipientPassport}
              onChange={(e) => setRecipientPassport(e.target.value)}
              className="w-full h-9 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 shadow-2xs transition-all uppercase font-mono"
            />
          </div>
        </div>

        {/* 4. Yashash / Ro'yxatdan o'tgan manzili (Full width) */}
        <div>
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-500" />
            <span>{t('userView.address')}</span>
          </label>
          <input
            type="text"
            value={recipientAddress}
            onChange={(e) => setRecipientAddress(e.target.value)}
            className="w-full h-9 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-2xs transition-all"
          />
        </div>
      </div>

      {/* Modal Preview Area */}
      <div className="bg-gray-100 dark:bg-gray-950 p-4 rounded-xl border border-gray-200 dark:border-gray-800 overflow-y-auto max-h-[64vh]">
        <div ref={printRef} className="space-y-4">
          <div 
            className="bg-white text-black p-8 rounded shadow-sm border border-gray-300 mx-auto w-full max-w-[185mm]"
            dangerouslySetInnerHTML={{ __html: renderAgreementHtml() }}
          />
        </div>
      </div>
    </Modal>
  );
}
