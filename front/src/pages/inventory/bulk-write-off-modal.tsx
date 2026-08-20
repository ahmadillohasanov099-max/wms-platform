import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { operationsApi, authApi } from '../../api';
import { invalidateAppQueries } from '../../lib/utils';
import Modal from '../../components/ui/modal';
import Input from '../../components/ui/input';
import Button from '../../components/ui/button';
import { useTranslation } from '../../hooks/useTranslation';
import { Sparkles, ShieldAlert, Trash2, Plus, Minus, Eye, EyeOff } from 'lucide-react';

const QUICK_REASONS = [
  { label: "Buzilgan / Singan", icon: "🔨" },
  { label: "Eskirgan / Yaroqsiz", icon: "⏳" },
  { label: "Yo'qolgan / Kamchilik", icon: "🔍" },
  { label: "Muddati o'tgan", icon: "📅" },
  { label: "Taqsimot xatoligi", icon: "⚠️" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  selectedItems: any[]; 
  onSuccess: () => void;
}

export default function BulkWriteOffModal({ open, onClose, selectedItems, onSuccess }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [documentNumber, setDocumentNumber] = useState('');
  const [note, setNote] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (open) {
      const initial: Record<string, number> = {};
      selectedItems.forEach((item) => {
        initial[item.productId] = 1;
      });
      setQuantities(initial);
      setDocumentNumber('');
      setNote('');
      setPassword('');
      setShowPassword(false);
    }
  }, [open, selectedItems]);

  const handleQtyChange = (productId: string, val: number, max: number) => {
    const qty = Math.max(1, Math.min(max, val));
    setQuantities((prev) => ({ ...prev, [productId]: qty }));
  };

  const generateDocNumber = () => {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomNum = Math.floor(100 + Math.random() * 900);
    setDocumentNumber(`AKT-${dateStr}-${randomNum}`);
  };

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      if (selectedItems.length > 1) {
        if (!password) {
          throw new Error("Shaxsni tasdiqlash uchun parolingizni kiriting!");
        }
        const verification = await authApi.verifyPassword(password);
        if (!verification || !verification.success) {
          throw new Error("Kiritilgan parol noto'g'ri!");
        }
      }

      const items = selectedItems.map((item) => ({
        productId: item.productId,
        quantity: quantities[item.productId] || 1,
      }));

      return operationsApi.bulkWriteOff({
        items,
        documentNumber: documentNumber || undefined,
        note: note || undefined,
      });
    },
    onSuccess: (res: any) => {
      toast.success(res?.message || t('operations.writeOffSuccess'));
      invalidateAppQueries(queryClient);
      onSuccess();
      onClose();
    },
    onError: (err: any) => {
      toast.error(err?.message || t('common.error'));
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('operations.writeOff') + " (Ommaviy)"}
      subtitle="Belgilangan mahsulotlarni ombordan ommaviy hisobdan chiqarish"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            {t('common.cancel')}
          </Button>
          <Button
            className="bg-red-600 hover:bg-red-700 text-white"
            onClick={() => mutate()}
            loading={isPending}
            disabled={selectedItems.length === 0 || (selectedItems.length > 1 && !password)}
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            {t('operations.writeOffBtn')} ({selectedItems.length})
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                {t('common.documentNumber')}
              </label>
              <button
                type="button"
                onClick={generateDocNumber}
                className="text-2xs font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                Avto raqam
              </button>
            </div>
            <Input
              placeholder="AKT-2026-001"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              {t('operations.reason')}
            </label>
            <textarea
              rows={1}
              placeholder={t('operations.reasonPlaceholder')}
              className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 px-3 py-2 resize-none"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        {}
        <div className="flex flex-wrap gap-1.5">
          <span className="text-2xs font-medium text-gray-400 dark:text-gray-500 self-center mr-1">
            Tezkor sabablar:
          </span>
          {QUICK_REASONS.map((reason) => (
            <button
              key={reason.label}
              type="button"
              onClick={() => {
                setNote((prev) => (prev ? `${prev}, ${reason.label}` : reason.label));
              }}
              className="inline-flex items-center gap-1 text-2xs px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
            >
              <span>{reason.icon}</span>
              <span>{reason.label}</span>
            </button>
          ))}
        </div>

        {}
        <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-2xs">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 uppercase text-xs font-semibold">
              <tr>
                <th className="px-4 py-3">Mahsulot nomi</th>
                <th className="px-4 py-3">Turi</th>
                <th className="px-4 py-3 text-center">Ombordagi qoldiq</th>
                <th className="px-4 py-3 text-right" style={{ width: '160px' }}>Chiqarish miqdori</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-900">
              {selectedItems.map((item) => {
                const qty = quantities[item.productId] || 1;
                const unit = item.product?.unit;
                const translatedUnit = unit ? (t(`common.units.${unit}`) || unit) : t('common.pcs');
                const isConsumable = item.product?.productType === 'SARFLANADIGAN';

                return (
                  <tr key={item.productId} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100 whitespace-normal break-words min-w-[180px] max-w-xs">
                      {item.product?.name}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                      <span className={`px-2 py-0.5 rounded font-semibold ${isConsumable ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300'}`}>
                        {isConsumable ? t('inventory.typeConsumable') : t('inventory.typeAsset')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">
                      {item.quantity} {translatedUnit}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isConsumable ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleQtyChange(item.productId, qty - 1, item.quantity)}
                            className="w-6 h-6 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={item.quantity}
                            value={qty}
                            onChange={(e) => handleQtyChange(item.productId, Number(e.target.value), item.quantity)}
                            className="w-12 text-center text-xs font-bold px-1 py-1 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleQtyChange(item.productId, qty + 1, item.quantity)}
                            className="w-6 h-6 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500 font-mono">1 {translatedUnit}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {selectedItems.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    Hech qanday mahsulot tanlanmagan
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {}
        {selectedItems.length > 1 && (
          <div className="border border-red-200 dark:border-red-900/40 rounded-xl p-3.5 bg-red-50/30 dark:bg-red-950/20 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-red-800 dark:text-red-300 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-red-600" />
                Shaxsni tasdiqlash uchun parolingizni kiriting:
              </label>
              <span className="text-2xs text-gray-500">
                Ommaviy chiqarish ({selectedItems.length} xil mahsulot)
              </span>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Tasdiqlash paroli"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 pr-9 text-xs border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
