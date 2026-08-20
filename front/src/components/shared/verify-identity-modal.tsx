import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '../ui/modal';
import { authApi } from '../../api';
import toast from 'react-hot-toast';

interface VerifyIdentityModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
}

export default function VerifyIdentityModal({
  open,
  onClose,
  onSuccess,
}: VerifyIdentityModalProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!password) return;
    setLoading(true);
    try {
      await authApi.verifyPassword(password);
      await onSuccess();
      setPassword('');
      onClose();
    } catch {
      toast.error('Shaxsingiz tasdiqlanmadi');
      setPassword('');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handlePreventPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    toast.error("Parolni nusxalash taqiqlangan, qo'lda kiriting!");
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!loading) {
          setPassword('');
          onClose();
        }
      }}
      title="Shaxsingizni tasdiqlang"
      size="sm"
      footer={
        <>
          <button
            onClick={() => {
              setPassword('');
              onClose();
            }}
            disabled={loading}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 font-medium"
          >
            Bekor qilish
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || !password}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Tasdiqlash
          </button>
        </>
      }
    >
      <div className="space-y-3 py-2">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Amalni bajarish uchun joriy parolingizni kiriting:
        </p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onPaste={handlePreventPaste}
          autoComplete="new-password"
          placeholder="Parolingizni kiriting"
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 px-3 py-2"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && password && !loading) {
              handleConfirm();
            }
          }}
        />
      </div>
    </Modal>
  );
}
