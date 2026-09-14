import { useState } from 'react';
import Modal from '../ui/modal';
import Button from '../ui/button';
import { Wrench, CheckCircle2, User, Building2 } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

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
  const { t } = useTranslation();
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
      title={t('repairCompleteModal.title')}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={isLoading}
            disabled={isLoading}
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            {t('repairCompleteModal.confirmBtn')}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-start gap-3 p-3.5 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900/60 rounded-xl text-teal-850 dark:text-teal-200 text-xs">
          <Wrench className="w-5 h-5 shrink-0 text-teal-600 dark:text-teal-400 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-teal-900 dark:text-teal-100">
              {t('repairCompleteModal.bannerTitle')}
            </p>
            <p className="text-teal-700 dark:text-teal-300">
              {t('repairCompleteModal.bannerDesc')}
            </p>
            {assetItem && (
              <div className="pt-1.5 space-y-0.5 border-t border-teal-200/60 dark:border-teal-800/60 mt-2">
                <p className="font-semibold text-slate-900 dark:text-white">
                  {t('repairCompleteModal.asset')} <span>{assetItem.product?.name || assetItem.name || ''}</span>
                  {assetItem.inventoryNumber && (
                    <span className="font-mono text-xs text-teal-700 dark:text-teal-300 ml-1.5">
                      (№ {assetItem.inventoryNumber})
                    </span>
                  )}
                </p>
                {assignedUser && (
                  <p className="flex items-center gap-1 text-slate-600 dark:text-slate-400 font-medium">
                    <User className="w-3.5 h-3.5 text-blue-500" />
                    {t('repairCompleteModal.assignedUser')} <b className="text-slate-900 dark:text-white">{assignedUser.fullName || assignedUser.username}</b>
                  </p>
                )}
                {assignedDept && (
                  <p className="flex items-center gap-1 text-slate-600 dark:text-slate-400 font-medium">
                    <Building2 className="w-3.5 h-3.5 text-purple-500" />
                    {t('repairCompleteModal.assignedDept')} <b className="text-slate-900 dark:text-white">{assignedDept.name}</b>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
            {t('repairCompleteModal.noteLabel')} <span className="text-gray-400 font-normal">{t('repairCompleteModal.optional')}</span>
          </label>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('repairCompleteModal.notePlaceholder')}
            className="w-full text-xs rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 p-3 resize-none"
            autoFocus
          />
          <p className="text-[11px] text-gray-400">
            {t('repairCompleteModal.noteHint')}
          </p>
        </div>
      </form>
    </Modal>
  );
}
