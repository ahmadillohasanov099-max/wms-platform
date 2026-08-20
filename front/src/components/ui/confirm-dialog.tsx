import { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import Modal from "./modal";
import Button from "./button";
import { useTranslation } from "../../hooks/useTranslation";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (password?: string) => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning";
  loading?: boolean;
  requirePassword?: boolean;
}

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText,
  cancelText,
  variant = "danger",
  loading = false,
  requirePassword = false,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");

  const finalConfirmText = confirmText || t("common.confirm");
  const finalCancelText = cancelText || t("common.cancel");

  useEffect(() => {
    if (!open) {
      setPassword("");
    }
  }, [open]);

  const handleConfirm = () => {
    if (requirePassword && !password) {
      return;
    }
    onConfirm(password);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title=""
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {finalCancelText}
          </Button>
          <Button
            variant={variant === "danger" ? "danger" : "primary"}
            onClick={handleConfirm}
            loading={loading}
            disabled={requirePassword && !password}
          >
            {finalConfirmText}
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center text-center gap-4 py-2">
        <div
          className={
            variant === "danger"
              ? "w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center"
              : "w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center"
          }
        >
          <AlertTriangle
            className={
              variant === "danger"
                ? "w-6 h-6 text-red-600 dark:text-red-400"
                : "w-6 h-6 text-yellow-600 dark:text-yellow-400"
            }
          />
        </div>

        <div className="w-full">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
            {description}
          </p>

          {requirePassword && (
            <div className="w-full text-left mt-4 space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                {t("profile.validationCurrentPassword")}:
              </label>
              <input
                type="password"
                placeholder={t("profile.currentPassword")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                autoFocus
              />
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
