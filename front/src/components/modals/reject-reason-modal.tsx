import { useState } from 'react';
import { toast } from 'react-hot-toast';
import Modal from '../ui/modal';
import Button from '../ui/button';

interface RejectReasonModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  title?: string;
}

export default function RejectReasonModal({
  open,
  onClose,
  onConfirm,
  title = "So'rovni rad etish",
}: RejectReasonModalProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error('Iltimos, rad etish sababini kiritib o\'ting');
      return;
    }

    setLoading(true);
    try {
      await onConfirm(reason.trim());
      setReason('');
      onClose();
    } catch (error: any) {
      toast.error(error?.message || 'Rad etishda xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle="Rad etish sababi quyi tashkilot vakillariga ko'rsatiladi."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Rad etish sababi <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Nima uchun so'rov rad etilayotganini tushuntiring..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-red-500 focus:outline-none"
            required
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Bekor qilish
          </Button>
          <Button type="submit" variant="danger" loading={loading}>
            Rad etish
          </Button>
        </div>
      </form>
    </Modal>
  );
}
