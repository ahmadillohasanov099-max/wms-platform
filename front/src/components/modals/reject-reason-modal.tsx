import { useState } from 'react';
import Modal from '../ui/modal';
import Button from '../ui/button';
import { AlertCircle } from 'lucide-react';

interface RejectReasonModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
  title?: string;
  itemTitle?: string;
  isLoading?: boolean;
}

export default function RejectReasonModal({
  open,
  onClose,
  onConfirm,
  title = "Jihozni rad etish",
  itemTitle,
  isLoading = false,
}: RejectReasonModalProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!reason.trim()) {
      setError('Iltimos, rad etish sababini kiriting');
      return;
    }
    setError('');
    await onConfirm(reason.trim());
    setReason('');
  };

  const handleClose = () => {
    setReason('');
    setError('');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={title}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Bekor qilish
          </Button>
          <Button
            variant="danger"
            onClick={handleSubmit}
            loading={isLoading}
            disabled={isLoading || !reason.trim()}
          >
            Rad etishni tasdiqlash
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-start gap-3 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-rose-800 dark:text-rose-300 text-xs">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Diqqat: Ushbu amal bekor qilinmaydi!</p>
            <p className="text-rose-700 dark:text-rose-400">
              Jihoz rad etilgandan so'ng, u avtomatik ravishda ombor hisobiga qaytariladi va omborchiga bildirishnoma yuboriladi.
            </p>
            {itemTitle && (
              <p className="font-semibold pt-1 text-slate-900 dark:text-white">
                Jihoz: <span className="underline">{itemTitle}</span>
              </p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
            Rad etish sababi <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={4}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError('');
            }}
            placeholder="Masalan: Ushbu jihoz nosoz holatda / menga boshqa model kerak edi / tasodifan biriktirilgan..."
            className="w-full text-xs rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500 p-3 resize-none"
            autoFocus
          />
          {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}
        </div>
      </form>
    </Modal>
  );
}
