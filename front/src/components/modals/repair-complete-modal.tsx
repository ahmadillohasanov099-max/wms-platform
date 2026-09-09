import { useState } from 'react';
import Modal from '../ui/modal';
import Button from '../ui/button';
import { Wrench, CheckCircle2, User, Building2 } from 'lucide-react';

interface RepairCompleteModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (note: string) => Promise<void> | void;
  assetItem?: any;
  isLoading?: boolean;
}

export default function RepairCompleteModal({
  open,
  onClose,
  onConfirm,
  assetItem,
  isLoading = false,
}: RepairCompleteModalProps) {
  const [note, setNote] = useState('');

  const activeAssignment = assetItem?.assignments?.find((a: any) => !a.returnedAt);
  const assignedUser = activeAssignment?.user;
  const assignedDept = activeAssignment?.department;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    await onConfirm(note.trim());
    setNote('');
  };

  const handleClose = () => {
    setNote('');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Jihoz ta'mirlandi deb tasdiqlash"
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Bekor qilish
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={isLoading}
            disabled={isLoading}
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            Tasdiqlash va bildirishnoma yuborish
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-start gap-3 p-3.5 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900/60 rounded-xl text-teal-850 dark:text-teal-200 text-xs">
          <Wrench className="w-5 h-5 shrink-0 text-teal-600 dark:text-teal-400 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-teal-900 dark:text-teal-100">
              Jihoz soz holatga keltiriladi
            </p>
            <p className="text-teal-700 dark:text-teal-300">
              Tasdiqlashdan so'ng, jihoz holati <b>"Faol / Soz"</b>ga o'tadi va mas'ul xodimga tizim orqali jihozni olib ketish haqida bildirishnoma boradi.
            </p>
            {assetItem && (
              <div className="pt-1.5 space-y-0.5 border-t border-teal-200/60 dark:border-teal-800/60 mt-2">
                <p className="font-semibold text-slate-900 dark:text-white">
                  Jihoz: <span>{assetItem.product?.name || assetItem.name || 'Jihoz'}</span>
                  {assetItem.inventoryNumber && (
                    <span className="font-mono text-xs text-teal-700 dark:text-teal-300 ml-1.5">
                      (№ {assetItem.inventoryNumber})
                    </span>
                  )}
                </p>
                {assignedUser && (
                  <p className="flex items-center gap-1 text-slate-600 dark:text-slate-400 font-medium">
                    <User className="w-3.5 h-3.5 text-blue-500" />
                    Biriktirilgan xodim: <b className="text-slate-900 dark:text-white">{assignedUser.fullName || assignedUser.username}</b>
                  </p>
                )}
                {assignedDept && (
                  <p className="flex items-center gap-1 text-slate-600 dark:text-slate-400 font-medium">
                    <Building2 className="w-3.5 h-3.5 text-purple-500" />
                    Biriktirilgan bo'lim: <b className="text-slate-900 dark:text-white">{assignedDept.name}</b>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
            Ta'mirlash tavsifi / Usta xulosasi <span className="text-gray-400 font-normal">(ixtiyoriy)</span>
          </label>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Masalan: Operatsion tizim qayta o'rnatildi, klaviatura sozlandi va to'liq testdan o'tkazildi..."
            className="w-full text-xs rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 p-3 resize-none"
            autoFocus
          />
          <p className="text-[11px] text-gray-400">
            Ushbu tavsif xodimga yuboriladigan bildirishnomada ko'rinadi.
          </p>
        </div>
      </form>
    </Modal>
  );
}
