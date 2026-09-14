import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { inventoryApi } from "../../api";
import Button from "../../components/ui/button";
import Modal from "../../components/ui/modal";
import toast from "react-hot-toast";
import { Upload, Download, CheckCircle2, AlertCircle, Loader2, Boxes, Package, Sparkles, Users, Building2, Laptop } from "lucide-react";
import { formatCurrency, invalidateAppQueries } from "../../lib/utils";
import { useTranslation } from "../../hooks/useTranslation";
import * as xlsx from "xlsx";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ExcelImportModal({ open, onClose }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [importType, setImportType] = useState<'MASTER' | 'SARFLANADIGAN' | 'BERILADIGAN'>('MASTER');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);

  const importMutation = useMutation({
    mutationFn: (file: File) => {
      if (importType === 'MASTER') {
        return inventoryApi.importMasterExcel(file);
      }
      return inventoryApi.importExcel(file, importType);
    },
    onSuccess: (data) => {
      setResult(data);
      invalidateAppQueries(queryClient);
      toast.success(
        data?.message ||
          (importType === 'MASTER'
            ? t('inventory.excelImport.masterSuccess')
            : importType === 'SARFLANADIGAN'
            ? t('inventory.excelImport.consumableSuccess')
            : t('inventory.excelImport.assetSuccess'))
      );
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || t('inventory.excelImport.uploadError'));
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setResult(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setResult(null);
    }
  };

  const handleDownloadTemplate = async () => {
    if (importType === 'MASTER') {
      try {
        await inventoryApi.downloadMasterTemplate();
        toast.success(t('inventory.excelImport.masterTemplateDownloaded'));
      } catch {
        // Client-side fallback with XLSX
        const wb = xlsx.utils.book_new();

        // 1. Xodimlar
        const ws1 = xlsx.utils.aoa_to_sheet([
          ["№", "F.I.Sh (To'liq ism) *", "Bo'lim nomi *", "Lavozimi", "Username (Login)", "Ichki tel", "Mobil telefon", "Pasport seriyasi va №", "JSHSHIR (14 xonali)", "Yashash manzili"]
        ]);
        ws1["!cols"] = [{ wch: 6 }, { wch: 35 }, { wch: 28 }, { wch: 22 }, { wch: 20 }, { wch: 14 }, { wch: 18 }, { wch: 20 }, { wch: 20 }, { wch: 30 }];
        xlsx.utils.book_append_sheet(wb, ws1, "1. Xodimlar va Bo'limlar");

        // 2. Asosiy vositalar
        const ws2 = xlsx.utils.aoa_to_sheet([
          ["№", "Jihoz / Mahsulot nomi *", "Inventar raqami *", "Seriya raqami", "Sotib olingan narxi (so'm)", "O'lchov birligi", "Biriktirilgan xodim (F.I.Sh yoki Username)", "Hujjat raqami", "Izoh"]
        ]);
        ws2["!cols"] = [{ wch: 6 }, { wch: 40 }, { wch: 24 }, { wch: 20 }, { wch: 24 }, { wch: 15 }, { wch: 38 }, { wch: 18 }, { wch: 22 }];
        xlsx.utils.book_append_sheet(wb, ws2, "2. Asosiy vositalar (Jihozlar)");

        // 3. TMZ
        const ws3 = xlsx.utils.aoa_to_sheet([
          ["№", "Material nomi *", "O'lchov birligi", "Ombordagi miqdori *", "Birlik narxi (so'm)", "Minimal chegara", "Hujjat raqami", "Izoh"]
        ]);
        ws3["!cols"] = [{ wch: 6 }, { wch: 40 }, { wch: 16 }, { wch: 20 }, { wch: 20 }, { wch: 16 }, { wch: 18 }, { wch: 22 }];
        xlsx.utils.book_append_sheet(wb, ws3, "3. TMZ (Sarflanadigan)");

        xlsx.writeFile(wb, "Master_Barcha_Malumotlar_Shabloni.xlsx");
        toast.success(t('inventory.excelImport.masterTemplateDownloaded'));
      }
      return;
    }

    if (importType === 'SARFLANADIGAN') {
      const tmzData = [
        ["Tartib raqami", "TMZ nomi (Sarflanadigan)", "Mahsulot turi", "Qabul qilingan sana", "O'lchov birligi", "Soni", "Birlik narxi (so'm)", "Jami qiymati (so'm)"],
        [1, "A4 qog'oz SvetoCopy Classic (500 varaq)", "TMZ", "12.01.2026", "quti", 50, "45 000,00", "2 250 000,00"]
      ];

      const worksheet = xlsx.utils.aoa_to_sheet(tmzData);
      worksheet["!cols"] = [
        { wch: 12 },
        { wch: 45 },
        { wch: 16 },
        { wch: 18 },
        { wch: 16 },
        { wch: 10 },
        { wch: 22 },
        { wch: 22 }
      ];

      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, "TMZ Kirim Shabloni");
      xlsx.writeFile(workbook, "tmz_kirim_shabloni.xlsx");
      toast.success(t('inventory.excelImport.tmzTemplateDownloaded'));
    } else {
      const assetData = [
        ["Tartib raqami", "Mahsulot nomi", "Mahsulot turi", "Qabul qilingan yili", "Inventar raqami", "O'lchov birligi", "Soni", "Narxi"],
        [1, "MALIBU-2 Mosaic Black Metallic LSY*230622131*,LSGZG53L8PS006590", "Asosiy vosita", "10.01.2024", "22121042000016", "dona", 1, "400 295 560,00"]
      ];

      const worksheet = xlsx.utils.aoa_to_sheet(assetData);
      worksheet["!cols"] = [
        { wch: 12 },
        { wch: 55 },
        { wch: 16 },
        { wch: 18 },
        { wch: 22 },
        { wch: 16 },
        { wch: 10 },
        { wch: 22 }
      ];

      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, "Asosiy Vosita Kirim Shabloni");
      xlsx.writeFile(workbook, "asosiy_vosita_kirim_shabloni.xlsx");
      toast.success(t('inventory.excelImport.assetsTemplateDownloaded'));
    }
  };

  const handleStartImport = () => {
    if (!selectedFile) {
      toast.error(t('inventory.excelImport.selectFileError'));
      return;
    }
    importMutation.mutate(selectedFile);
  };

  const handleCloseModal = () => {
    setSelectedFile(null);
    setResult(null);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleCloseModal}
      title={t('inventory.excelImport.title')}
      size="lg"
    >
      <div className="space-y-4">
        {/* Rejimni tanlash */}
        <div className="p-1 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setImportType('MASTER');
              setSelectedFile(null);
              setResult(null);
            }}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              importType === 'MASTER'
                ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <span>{t('inventory.excelImport.tabMaster')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setImportType('BERILADIGAN');
              setSelectedFile(null);
              setResult(null);
            }}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              importType === 'BERILADIGAN'
                ? 'bg-white dark:bg-gray-900 text-primary-600 dark:text-primary-400 shadow-2xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            <Boxes className="w-4 h-4 text-primary-500" />
            <span>{t('inventory.excelImport.tabAssets')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setImportType('SARFLANADIGAN');
              setSelectedFile(null);
              setResult(null);
            }}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              importType === 'SARFLANADIGAN'
                ? 'bg-white dark:bg-gray-900 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            <Package className="w-4 h-4 text-emerald-500" />
            <span>{t('inventory.excelImport.tabConsumables')}</span>
          </button>
        </div>

        {/* Shablon yuklab olish qatori */}
        <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-800/40 p-2.5 rounded-xl border border-gray-200/80 dark:border-gray-800">
          <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">
            {importType === 'MASTER'
              ? t('inventory.excelImport.descMaster')
              : importType === 'SARFLANADIGAN'
              ? t('inventory.excelImport.descConsumables')
              : t('inventory.excelImport.descAssets')}
          </span>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-600 hover:text-primary-700 dark:text-primary-400 hover:underline"
          >
            <Download className="w-3.5 h-3.5" />
            {importType === 'MASTER'
              ? t('inventory.excelImport.downloadMasterTemplate')
              : t('inventory.excelImport.downloadTemplate')}
          </button>
        </div>

        {result ? (
          <div className="bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-100">
                  {result.message || t('inventory.excelImport.fileSuccess')}
                </h3>
                {result.documentNumber && (
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 font-mono mt-0.5">
                    {t('common.documentNumber')}: {result.documentNumber}
                  </p>
                )}
              </div>
            </div>

            {importType === 'MASTER' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                <div className="bg-white/80 dark:bg-emerald-900/30 p-2.5 rounded-xl border border-emerald-200/60 dark:border-emerald-800 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-600 shrink-0" />
                  <div>
                    <p className="text-3xs uppercase tracking-wider font-semibold text-gray-500">{t('inventory.excelImport.departments')}</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{result.departmentsCreated ?? 0} {t('common.pcs')}</p>
                  </div>
                </div>
                <div className="bg-white/80 dark:bg-emerald-900/30 p-2.5 rounded-xl border border-emerald-200/60 dark:border-emerald-800 flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-3xs uppercase tracking-wider font-semibold text-gray-500">{t('inventory.excelImport.users')}</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{result.usersCreated ?? 0} {t('common.pcs')}</p>
                  </div>
                </div>
                <div className="bg-white/80 dark:bg-emerald-900/30 p-2.5 rounded-xl border border-emerald-200/60 dark:border-emerald-800 flex items-center gap-2">
                  <Laptop className="w-5 h-5 text-purple-600 shrink-0" />
                  <div>
                    <p className="text-3xs uppercase tracking-wider font-semibold text-gray-500">{t('inventory.excelImport.assets')}</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{result.assetsCreated ?? 0} {t('common.pcs')}</p>
                  </div>
                </div>
                <div className="bg-white/80 dark:bg-emerald-900/30 p-2.5 rounded-xl border border-emerald-200/60 dark:border-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0" />
                  <div>
                    <p className="text-3xs uppercase tracking-wider font-semibold text-gray-500">{t('inventory.excelImport.assignedToUsers')}</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{result.assetsAssigned ?? 0} {t('common.pcs')}</p>
                  </div>
                </div>
                <div className="bg-white/80 dark:bg-emerald-900/30 p-2.5 rounded-xl border border-emerald-200/60 dark:border-emerald-800 flex items-center gap-2">
                  <Boxes className="w-5 h-5 text-amber-600 shrink-0" />
                  <div>
                    <p className="text-3xs uppercase tracking-wider font-semibold text-gray-500">{t('inventory.excelImport.freeInStock')}</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{result.assetsInStock ?? 0} {t('common.pcs')}</p>
                  </div>
                </div>
                <div className="bg-white/80 dark:bg-emerald-900/30 p-2.5 rounded-xl border border-emerald-200/60 dark:border-emerald-800 flex items-center gap-2">
                  <Package className="w-5 h-5 text-sky-600 shrink-0" />
                  <div>
                    <p className="text-3xs uppercase tracking-wider font-semibold text-gray-500">{t('inventory.excelImport.tmzProducts')}</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{result.tmzCreated ?? 0} {t('common.pcs')}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="bg-white/80 dark:bg-emerald-900/30 p-2.5 rounded-xl border border-emerald-200/60 dark:border-emerald-800">
                  <p className="text-3xs uppercase tracking-wider font-semibold text-emerald-700 dark:text-emerald-300">
                    {t('inventory.excelImport.typesCount')}
                  </p>
                  <p className="text-base font-extrabold text-emerald-900 dark:text-emerald-100 mt-0.5">
                    {result.importedCount} {t('common.pcs')}
                  </p>
                </div>
                <div className="bg-white/80 dark:bg-emerald-900/30 p-2.5 rounded-xl border border-emerald-200/60 dark:border-emerald-800">
                  <p className="text-3xs uppercase tracking-wider font-semibold text-emerald-700 dark:text-emerald-300">
                    {t('inventory.excelImport.totalQty')}
                  </p>
                  <p className="text-base font-extrabold text-emerald-900 dark:text-emerald-100 mt-0.5">
                    {result.totalQtyCount} {t('common.pcs')}
                  </p>
                </div>
                <div className="bg-white/80 dark:bg-emerald-900/30 p-2.5 rounded-xl border border-emerald-200/60 dark:border-emerald-800">
                  <p className="text-3xs uppercase tracking-wider font-semibold text-emerald-700 dark:text-emerald-300">
                    {t('inventory.excelImport.totalSum')}
                  </p>
                  <p className="text-xs font-extrabold text-emerald-900 dark:text-emerald-100 mt-0.5 font-mono">
                    {formatCurrency(result.totalSumValue)}
                  </p>
                </div>
              </div>
            )}

            {result.errors && result.errors.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200 text-xs text-amber-800 dark:text-amber-200">
                <p className="font-bold mb-0.5 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> {t('inventory.excelImport.warnings')}
                </p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {result.errors.map((errStr: string, idx: number) => (
                    <li key={idx}>{errStr}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : importMutation.isPending ? (
          <div className="py-10 text-center space-y-3 bg-gray-50/50 dark:bg-gray-800/30 rounded-2xl border border-gray-200 dark:border-gray-800">
            <Loader2 className="w-10 h-10 text-primary-600 animate-spin mx-auto" />
            <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
              ⏳ {t('inventory.excelImport.analyzing')}
            </h4>
          </div>
        ) : (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-emerald-500 dark:hover:border-emerald-500 bg-gray-50/50 dark:bg-gray-800/30 rounded-2xl p-10 text-center cursor-pointer transition-all"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileChange}
              className="hidden"
            />

            <Upload className="w-10 h-10 text-gray-400 dark:text-gray-500 mx-auto mb-3" />

            {selectedFile ? (
              <div className="space-y-1">
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-gray-500">
                  {(selectedFile.size / 1024).toFixed(1)} KB • {t('inventory.excelImport.changeFileHint')}
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  {importType === 'MASTER'
                    ? t('inventory.excelImport.dropMasterTitle')
                    : importType === 'SARFLANADIGAN'
                    ? t('inventory.excelImport.dropTmzTitle')
                    : t('inventory.excelImport.dropAssetsTitle')}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {importType === 'MASTER'
                    ? t('inventory.excelImport.dropMasterSub')
                    : t('inventory.excelImport.dropOrBrowse')}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2.5 pt-2 border-t border-gray-100 dark:border-gray-800">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCloseModal}
            disabled={importMutation.isPending}
          >
            {result ? t('common.close') : t('common.cancel')}
          </Button>

          {!result && (
            <Button
              type="button"
              size="sm"
              onClick={handleStartImport}
              loading={importMutation.isPending}
              disabled={!selectedFile || importMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              🚀 {t('inventory.excelImport.startImport')}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
