import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "../../api";
import Button from "../../components/ui/button";
import Modal from "../../components/ui/modal";
import toast from "react-hot-toast";
import { Upload, Download, CheckCircle2, Loader2, Users, Building2 } from "lucide-react";
import { invalidateAppQueries } from "../../lib/utils";
import * as xlsx from "xlsx";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function UserExcelImportModal({ open, onClose }: Props) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);

  const importMutation = useMutation({
    mutationFn: (file: File) => usersApi.importExcel(file),
    onSuccess: (data) => {
      setResult(data);
      invalidateAppQueries(queryClient);
      toast.success(data?.message || "Excel orqali xodimlar muvaffaqiyatli yuklandi!");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || "Excel faylini yuklashda xatolik yuz berdi");
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

  const handleDownloadTemplate = () => {
    const data = [
      ["Xodim F.I.SH", "Username", "Bo'lim nomi", "Lavozim", "Telefon raqami", "Ichki raqam", "Pasport seriyasi va raqami", "JSHSHIR", "Yashash manzili", "Rol", "Parol"],
      ["Alisher Karimov", "alisher_k", "Buxgalteriya", "Bosh buxgalter", "+998901234567", "1025", "AD 1234567", "31508940001234", "Toshkent sh., Chilonzor t., 5-mavze 12-uy 4-xonadon", "XODIM", "123456"],
      ["Dilnoza Umarova", "dilnoza_u", "IT Bo'limi", "Dasturchi", "+998935551122", "1081", "AA 7654321", "32009950005678", "Toshkent sh., Yunusobod t., 11-mavze 5-uy 12-xonadon", "XODIM", "123456"],
      ["Jasurbek Rahimov", "jasur_r", "Moliya Bo'limi", "Analitik", "+998977778899", "1040", "AB 9876543", "30101960009012", "Toshkent sh., Mirzo Ulug'bek t., Mustaqillik shoh ko'chasi 45-uy", "XODIM", "123456"]
    ];

    const worksheet = xlsx.utils.aoa_to_sheet(data);

    worksheet["!cols"] = [
      { wch: 26 }, 
      { wch: 16 }, 
      { wch: 22 }, 
      { wch: 20 }, 
      { wch: 18 }, 
      { wch: 12 }, 
      { wch: 25 }, 
      { wch: 18 }, 
      { wch: 45 }, 
      { wch: 12 }, 
      { wch: 12 }  
    ];

    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "Xodimlar Shablon");

    xlsx.writeFile(workbook, "xodimlar_yuklash_shabloni.xlsx");
    toast.success("Excel shablon yuklab olindi!");
  };

  const handleStartImport = () => {
    if (!selectedFile) {
      toast.error("Iltimos, Excel faylni tanlang!");
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
      title="📥 Excel fayldan ommaviy xodimlarni yuklash"
    >
      <div className="space-y-5">
        {}
        <div className="flex items-center justify-between p-4 bg-primary-50 dark:bg-primary-950/30 border border-primary-100 dark:border-primary-900/50 rounded-xl">
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-primary-900 dark:text-primary-200">
              1-qadam: Shablonni yuklab oling
            </h4>
            <p className="text-xs text-primary-700 dark:text-primary-400">
              Xodimlarni to'g'ri shaklda kiritish uchun standart Excel shablonidan foydalaning. Bo'lim nomi mos kelmasa, avtomatik yangi bo'lim yaratiladi.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownloadTemplate}
            className="shrink-0 gap-1.5 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/50"
          >
            <Download className="w-4 h-4" />
            Shablon
          </Button>
        </div>

        {}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
            2-qadam: Excel faylini tanglang yoki sudrab olib keling (.xlsx, .xls)
          </label>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors ${
              selectedFile
                ? "border-primary-500 bg-primary-50/50 dark:bg-primary-950/20"
                : "border-gray-300 dark:border-gray-700 hover:border-primary-400 hover:bg-gray-50 dark:hover:bg-gray-900/50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileChange}
              className="hidden"
            />

            <div className="flex flex-col items-center gap-2">
              <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-full text-primary-600 dark:text-primary-400">
                <Upload className="w-6 h-6" />
              </div>

              {selectedFile ? (
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {(selectedFile.size / 1024).toFixed(1)} KB • O'zgartirish uchun bosing
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Excel faylni tanlang yoki shu yerga sudrab tashlang
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Faqat .xlsx yoki .xls formatidagi fayllar (100-500 tagacha xodimlar)
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Result alert */}
        {result && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>{result.message}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-emerald-200/60 dark:border-emerald-800/60 text-xs text-emerald-900 dark:text-emerald-200">
              <div className="flex items-center gap-1.5 bg-white/60 dark:bg-gray-900/60 p-2 rounded-lg">
                <Users className="w-4 h-4 text-primary-500" />
                <span>Yangi: <b>{result.createdUsers ?? 0}</b></span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/60 dark:bg-gray-900/60 p-2 rounded-lg">
                <Building2 className="w-4 h-4 text-purple-500" />
                <span>Bo'limlar: <b>{result.createdDepartments ?? 0}</b></span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/60 dark:bg-gray-900/60 p-2 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Jami: <b>{result.totalRows ?? 0}</b></span>
              </div>
            </div>
          </div>
        )}

        {}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCloseModal}
            disabled={importMutation.isPending}
          >
            {result ? "Yopish" : "Bekor qilish"}
          </Button>

          {!result && (
            <Button
              type="button"
              onClick={handleStartImport}
              loading={importMutation.isPending}
              disabled={!selectedFile || importMutation.isPending}
              className="gap-2"
            >
              {importMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Yuklanmoqda...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Ommaviy yuklash
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
