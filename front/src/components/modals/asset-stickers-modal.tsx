import { useEffect, useState, useMemo } from 'react';
import QRCode from 'qrcode';
import {
  Printer,
  X,
  CheckSquare,
  Square,
  Tag,
  Search,
  FileText,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Scissors,
} from 'lucide-react';
import Button from '../ui/button';
import { useTranslation } from '../../hooks/useTranslation';

export interface StickerAssetItem {
  id: string;
  inventoryNumber: string;
  serialNumber?: string | null;
  productName: string;
  organizationName?: string;
  departmentName?: string;
  status?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  assets: StickerAssetItem[];
}

// 3 columns x 10 rows = 30 stickers per A4 page with shared single-cut borders
const STICKERS_PER_A4_PAGE = 30;

export default function AssetStickersModal({ open, onClose, assets }: Props) {
  const { t } = useTranslation();

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filterText, setFilterText] = useState('');

  // Pagination for preview in modal
  const [previewPage, setPreviewPage] = useState(1);

  // QR codes generated ONLY for the active 30 visible items in the preview
  const [previewQrMap, setPreviewQrMap] = useState<Record<string, string>>({});

  // Non-blocking print preparation state
  const [isPreparingPrint, setIsPreparingPrint] = useState(false);
  const [printProgress, setPrintProgress] = useState(0);

  // Initialize selected assets when opened
  useEffect(() => {
    if (open && assets.length > 0) {
      setSelectedIds(assets.map((a) => a.id));
      setFilterText('');
      setPreviewPage(1);
    }
  }, [open, assets]);

  // Filter assets based on search query
  const filteredAssets = useMemo(() => {
    if (!filterText.trim()) return assets;
    const query = filterText.toLowerCase();
    return assets.filter(
      (a) =>
        a.inventoryNumber.toLowerCase().includes(query) ||
        (a.productName && a.productName.toLowerCase().includes(query)) ||
        (a.serialNumber && a.serialNumber.toLowerCase().includes(query)) ||
        (a.departmentName && a.departmentName.toLowerCase().includes(query))
    );
  }, [assets, filterText]);

  // Reset page when filter changes
  useEffect(() => {
    setPreviewPage(1);
  }, [filterText]);

  // Total pages in preview
  const totalPreviewPages = Math.max(1, Math.ceil(filteredAssets.length / STICKERS_PER_A4_PAGE));

  // Current page assets (30 items in DOM, zero lag)
  const currentPageAssets = useMemo(() => {
    const start = (previewPage - 1) * STICKERS_PER_A4_PAGE;
    return filteredAssets.slice(start, start + STICKERS_PER_A4_PAGE);
  }, [filteredAssets, previewPage]);

  // Generate QR codes ONLY for the 30 visible items on the current preview page
  useEffect(() => {
    if (!open || currentPageAssets.length === 0) return;

    let isMounted = true;
    const generatePreviewQrs = async () => {
      const origin = import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin;
      const newMap: Record<string, string> = {};

      for (const asset of currentPageAssets) {
        if (!asset.inventoryNumber) continue;
        const scanUrl = `${origin}/scan/${encodeURIComponent(asset.inventoryNumber)}`;
        try {
          const svgString = await QRCode.toString(scanUrl, {
            type: 'svg',
            margin: 0,
            width: 80,
          });
          newMap[asset.id] = `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
        } catch {
          // ignore
        }
      }

      if (isMounted) {
        setPreviewQrMap((prev) => ({ ...prev, ...newMap }));
      }
    };

    generatePreviewQrs();
    return () => {
      isMounted = false;
    };
  }, [open, currentPageAssets]);

  if (!open) return null;

  // Toggle selection
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Quick selection helpers
  const selectAll = () => setSelectedIds(assets.map((a) => a.id));
  const deselectAll = () => setSelectedIds([]);

  const selectFirst30 = () => {
    setSelectedIds(filteredAssets.slice(0, 30).map((a) => a.id));
  };

  const selectFirst60 = () => {
    setSelectedIds(filteredAssets.slice(0, 60).map((a) => a.id));
  };

  const selectCurrentPageOnly = () => {
    const pageIds = currentPageAssets.map((a) => a.id);
    setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
  };

  const selectedAssets = useMemo(() => {
    const selectedSet = new Set(selectedIds);
    return assets.filter((a) => selectedSet.has(a.id));
  }, [assets, selectedIds]);

  const totalSheets = Math.ceil(selectedAssets.length / STICKERS_PER_A4_PAGE) || 0;

  // Asynchronous batch generation and printing with shared cut lines
  const handlePrint = async () => {
    if (selectedAssets.length === 0 || isPreparingPrint) return;

    setIsPreparingPrint(true);
    setPrintProgress(0);

    const origin = import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin;
    const qrSvgMap: Record<string, string> = {};
    const batchSize = 40;

    try {
      for (let i = 0; i < selectedAssets.length; i += batchSize) {
        const batch = selectedAssets.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (asset) => {
            if (!asset.inventoryNumber) return;
            const scanUrl = `${origin}/scan/${encodeURIComponent(asset.inventoryNumber)}`;
            try {
              const svg = await QRCode.toString(scanUrl, {
                type: 'svg',
                margin: 0,
              });
              qrSvgMap[asset.id] = svg;
            } catch (err) {
              console.error('QR generation error:', err);
            }
          })
        );

        const currentCount = Math.min(i + batchSize, selectedAssets.length);
        setPrintProgress(Math.round((currentCount / selectedAssets.length) * 100));

        // Yield to browser event loop so UI stays responsive
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      // Chunk into pages of exactly 30 (3 cols x 10 rows)
      const chunkedPages: StickerAssetItem[][] = [];
      for (let i = 0; i < selectedAssets.length; i += STICKERS_PER_A4_PAGE) {
        chunkedPages.push(selectedAssets.slice(i, i + STICKERS_PER_A4_PAGE));
      }

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert("Brauzerda oyna ochish bloklangan. Iltimos, popup-ga ruxsat bering.");
        setIsPreparingPrint(false);
        return;
      }

      // Generate HTML with border-collapse table:
      // Single shared 1px dashed cut-line between adjacent stickers!
      // One straight scissor/cutter stroke slices 2 stickers at once!
      const pagesHtml = chunkedPages
        .map((pageChunk, pageIdx) => {
          let rowsHtml = '';
          for (let r = 0; r < 10; r++) {
            const rowAssets = pageChunk.slice(r * 3, (r + 1) * 3);
            if (rowAssets.length === 0) break;

            const cellsHtml = [0, 1, 2]
              .map((cIdx) => {
                const asset = rowAssets[cIdx];
                if (!asset) {
                  return '<td class="sticker empty-cell"></td>';
                }
                const svgContent = qrSvgMap[asset.id] || '<div class="qr-placeholder">QR</div>';
                return `
                  <td class="sticker">
                    <div class="sticker-inner">
                      <div class="qr-col">
                        ${svgContent}
                      </div>
                      <div class="info-col">
                        <div class="inv-number">${asset.inventoryNumber}</div>
                        <div class="product-name">${asset.productName || 'Jihoz'}</div>
                        <div class="meta-row">
                          ${asset.serialNumber ? `<span class="serial">SN: ${asset.serialNumber}</span>` : ''}
                          ${asset.departmentName && asset.departmentName !== '—' ? `<span class="dept">${asset.departmentName}</span>` : ''}
                        </div>
                      </div>
                    </div>
                  </td>
                `;
              })
              .join('');

            rowsHtml += `<tr>${cellsHtml}</tr>`;
          }

          return `
            <div class="page-sheet" data-page="${pageIdx + 1}">
              <table class="sticker-grid">
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>
            </div>
          `;
        })
        .join('');

      printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="uz">
        <head>
          <meta charset="utf-8" />
          <title>Inventar QR Stikerlari - WMS (A4 Standart 30 talik)</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 0;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Consolas", monospace, sans-serif;
            }
            body {
              background: #ffffff;
              color: #000000;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .page-sheet {
              width: 210mm;
              height: 297mm;
              max-height: 297mm;
              padding: 12mm 9mm;
              page-break-after: always;
              break-after: page;
              box-sizing: border-box;
              display: flex;
              justify-content: center;
              align-items: flex-start;
              background: #ffffff;
              overflow: hidden;
            }
            .page-sheet:last-child {
              page-break-after: avoid;
              break-after: avoid;
            }
            /* SHARED CUT LINES: border-collapse merges borders into 1 single shared cut line */
            .sticker-grid {
              width: 192mm;
              border-collapse: collapse;
              border-spacing: 0;
              table-layout: fixed;
              margin: 0 auto;
            }
            .sticker {
              width: 64mm;
              height: 25.5mm;
              max-height: 25.5mm;
              border: 1px dashed #64748b;
              padding: 2mm 2.5mm;
              box-sizing: border-box;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              vertical-align: middle;
              background: #ffffff;
            }
            .empty-cell {
              border: 1px dashed #cbd5e1;
            }
            .sticker-inner {
              display: flex;
              align-items: center;
              gap: 2.5mm;
              width: 100%;
              height: 100%;
              overflow: hidden;
            }
            .qr-col {
              width: 20mm;
              height: 20mm;
              flex-shrink: 0;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .qr-col svg {
              width: 20mm;
              height: 20mm;
              display: block;
            }
            .qr-placeholder {
              width: 20mm;
              height: 20mm;
              border: 1px solid #ccc;
              font-size: 7pt;
              display: flex;
              align-items: center;
              justify-content: center;
              color: #888;
            }
            .info-col {
              flex: 1;
              min-width: 0;
              display: flex;
              flex-direction: column;
              justify-content: center;
              overflow: hidden;
            }
            .inv-number {
              font-size: 11pt;
              font-weight: 900;
              color: #000000;
              font-family: "Segoe UI Mono", "Consolas", "Courier New", monospace;
              letter-spacing: -0.2px;
              line-height: 1.15;
              word-break: break-all;
            }
            .product-name {
              font-size: 7pt;
              font-weight: 600;
              color: #1e293b;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              line-height: 1.2;
              margin-top: 1px;
            }
            .meta-row {
              display: flex;
              align-items: center;
              gap: 2mm;
              font-size: 6pt;
              color: #64748b;
              font-family: "Segoe UI", monospace, sans-serif;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              line-height: 1.1;
              margin-top: 1px;
            }
            .meta-row .serial {
              font-family: monospace;
            }
            @media print {
              body {
                margin: 0;
              }
              .page-sheet {
                page-break-after: always !important;
                break-after: page !important;
              }
              .page-sheet:last-child {
                page-break-after: avoid !important;
                break-after: avoid !important;
              }
            }
          </style>
        </head>
        <body>
          ${pagesHtml}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
    } catch (err) {
      console.error('Print preparation error:', err);
    } finally {
      setIsPreparingPrint(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden">
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Asosiy Vositalar uchun QR-kodli Yorliqlar (Sticker Print)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                <Scissors className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  <strong>30 ta stiker / 1 A4</strong> • Birlashgan qirqish chiziqlari: 1 ta qirqish bilan biryo‘la 2 ta stiker tayyor bo‘ladi
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isPreparingPrint}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CONTROLS BAR */}
        <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* SEARCH INPUT */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Qidirish (inv raqam, nom, SN)..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
            {filterText && (
              <button
                onClick={() => setFilterText('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* QUICK SELECTION PRESETS */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-400 text-[11px] font-medium mr-1">Tezkor:</span>
            <button
              onClick={selectFirst30}
              className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-[11px] transition-colors cursor-pointer"
              title="Birinchi 30 ta (1 varoq A4)"
            >
              1 varoq (30 ta)
            </button>
            <button
              onClick={selectFirst60}
              className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-[11px] transition-colors cursor-pointer"
              title="Birinchi 60 ta (2 varoq A4)"
            >
              2 varoq (60 ta)
            </button>
            <button
              onClick={selectAll}
              className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px] transition-colors cursor-pointer"
            >
              Barchasi ({assets.length})
            </button>
            <button
              onClick={deselectAll}
              className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-500 text-[11px] transition-colors cursor-pointer"
            >
              Tozalash
            </button>
          </div>

          {/* SELECTION STATS BADGE */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-200/70 dark:border-emerald-800/60 ml-auto sm:ml-0">
            <FileText className="w-3.5 h-3.5" />
            <span>
              Tanlangan: <strong>{selectedIds.length}</strong> ta
            </span>
            {selectedIds.length > 0 && (
              <span className="font-mono text-emerald-600 dark:text-emerald-400 text-[11px] ml-1">
                ({totalSheets} varoq A4)
              </span>
            )}
          </div>
        </div>

        {/* PREVIEW SUB-HEADER */}
        <div className="px-6 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>
              Ko‘rinmoqda: <strong>{(previewPage - 1) * STICKERS_PER_A4_PAGE + 1}–{Math.min(previewPage * STICKERS_PER_A4_PAGE, filteredAssets.length)}</strong> / {filteredAssets.length} ta
            </span>
            <button
              onClick={selectCurrentPageOnly}
              className="text-emerald-600 dark:text-emerald-400 hover:underline font-semibold text-[11px] ml-2 cursor-pointer"
            >
              + Ushbu varoqdagilarni tanlash
            </button>
          </div>

          {totalPreviewPages > 1 && (
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[11px] mr-1">
                Varoq {previewPage} / {totalPreviewPages}
              </span>
              <button
                disabled={previewPage <= 1}
                onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                disabled={previewPage >= totalPreviewPages}
                onClick={() => setPreviewPage((p) => Math.min(totalPreviewPages, p + 1))}
                className="p-1 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* STICKERS PREVIEW AREA */}
        <div className="flex-1 overflow-y-auto p-5 bg-slate-100/70 dark:bg-slate-950/50 min-h-[360px]">
          {assets.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              Chop etish uchun birorta ham asosiy vosita topilmadi.
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              "{filterText}" so‘rovi bo‘yicha hech qanday jihoz topilmadi.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {currentPageAssets.map((asset) => {
                const isSelected = selectedIds.includes(asset.id);
                const qrUrl = previewQrMap[asset.id];

                return (
                  <div
                    key={asset.id}
                    onClick={() => toggleSelect(asset.id)}
                    className={`relative cursor-pointer transition-all rounded-xl border bg-white dark:bg-slate-900 p-2 select-none flex items-center gap-2 shadow-xs hover:border-emerald-500 ${
                      isSelected
                        ? 'border-emerald-500 ring-2 ring-emerald-500/20 dark:ring-emerald-500/30'
                        : 'border-slate-200 dark:border-slate-800 opacity-60 hover:opacity-100'
                    }`}
                  >
                    {/* CHECKBOX ICON */}
                    <div className="absolute top-1.5 right-1.5 text-slate-400">
                      {isSelected ? (
                        <CheckSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
                      )}
                    </div>

                    {/* QR CODE PREVIEW */}
                    <div className="w-11 h-11 shrink-0 bg-white p-0.5 rounded-lg border border-slate-100 shadow-2xs flex items-center justify-center">
                      {qrUrl ? (
                        <img src={qrUrl} alt="QR" className="w-full h-full object-contain" />
                      ) : (
                        <div className="animate-pulse w-full h-full bg-slate-100 rounded" />
                      )}
                    </div>

                    {/* TEXT DETAILS */}
                    <div className="flex-1 min-w-0 pr-3">
                      <h4 className="text-xs font-black font-mono tracking-tight text-slate-900 dark:text-white break-all leading-tight">
                        {asset.inventoryNumber}
                      </h4>
                      <p className="text-[10.5px] font-semibold text-slate-600 dark:text-slate-300 truncate mt-0.5">
                        {asset.productName || 'Jihoz'}
                      </p>
                      <div className="flex items-center gap-1.5 text-[9.5px] text-slate-400 truncate">
                        {asset.serialNumber && (
                          <span className="font-mono">SN: {asset.serialNumber}</span>
                        )}
                        {asset.departmentName && asset.departmentName !== '—' && (
                          <span className="truncate">({asset.departmentName})</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* PROGRESS OVERLAY WHEN PREPARING PRINT */}
        {isPreparingPrint && (
          <div className="absolute inset-0 z-20 bg-slate-950/75 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-white text-center animate-in fade-in">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
            <h3 className="text-base font-bold mb-1">
              Stikerlar chop etishga tayyorlanmoqda...
            </h3>
            <p className="text-xs text-slate-300 mb-4">
              Vektorli QR-kodlar va A4 varoqlar generatsiya qilinmoqda ({printProgress}%)
            </p>
            <div className="w-64 h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
              <div
                className="h-full bg-emerald-500 transition-all duration-150"
                style={{ width: `${printProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* FOOTER ACTIONS */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
          <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
            * ✂️ <strong>Birlashtirilgan chiziqlar</strong>: Qaychi yoki kesgich (gilotina) bilan to‘g‘ri chiziq bo‘yicha 1 marta qirqilganda 2 ta stiker bir vaqtda ajraladi.
          </p>

          <div className="flex items-center gap-2.5 ml-auto">
            <Button variant="outline" size="sm" onClick={onClose} disabled={isPreparingPrint}>
              {t('common.cancel')}
            </Button>
            <Button
              size="sm"
              onClick={handlePrint}
              disabled={selectedIds.length === 0 || isPreparingPrint}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              icon={isPreparingPrint ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
            >
              {isPreparingPrint ? `Tayyorlanmoqda (${printProgress}%)` : `Chop etish (${selectedIds.length} ta • ${totalSheets} varoq)`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
