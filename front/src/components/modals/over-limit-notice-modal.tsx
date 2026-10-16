import React, { useState } from 'react';
import {
  ShieldAlert,
  FileText,
  CheckCircle2,
  AlertTriangle,
  X,
  Building2,
  User as UserIcon,
  Scale,
  Layers,
  FileCheck,
  UploadCloud,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../ui/modal';
import Button from '../ui/button';
import Input from '../ui/input';
import { limitsApi } from '../../api/endpoints/limits.api';
import type { LimitStatusResponse } from '../../api/endpoints/limits.api';

interface OverLimitNoticeModalProps {
  open: boolean;
  onClose: () => void;
  limitStatus: LimitStatusResponse | null;
  requestedQuantity: number;
  targetName?: string;
  isDepartment?: boolean;
  departmentId?: string;
  userId?: string;
  onLimitIncreased?: (updatedStatus: LimitStatusResponse) => void;
}

export default function OverLimitNoticeModal({
  open,
  onClose,
  limitStatus,
  requestedQuantity,
  targetName,
  isDepartment,
  departmentId,
  userId,
  onLimitIncreased,
}: OverLimitNoticeModalProps) {
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [additionalQuantity, setAdditionalQuantity] = useState<number | string>(
    limitStatus
      ? Math.max(1, Math.ceil(requestedQuantity - (limitStatus.remaining ?? 0)))
      : 1,
  );
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open || !limitStatus) return null;

  const baseLimit = limitStatus.baseLimit ?? 0;
  const totalAllowed = limitStatus.totalAllowed ?? baseLimit;
  const spent = limitStatus.currentMonthSpent ?? 0;
  const remaining = limitStatus.remaining ?? 0;
  const excess = Math.max(0, Math.round((requestedQuantity - remaining) * 1000) / 1000);
  const unit = limitStatus.unit || 'dona';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUploadDecree = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error('Vazir / Rahbariyat buyrug‘i faylini (PDF yoki rasm) yuklash shart!');
      return;
    }
    const addQty = Number(additionalQuantity);
    if (!addQty || addQty <= 0) {
      toast.error('Qo‘shimcha miqdor 0 dan katta bo‘lishi shart!');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await limitsApi.addException({
        productId: limitStatus.productId,
        departmentId: departmentId,
        userId: userId,
        monthlyLimitId: limitStatus.limitId || undefined,
        yearMonth: limitStatus.yearMonth,
        additionalQuantity: addQty,
        file: file,
      });

      toast.success(
        res.message || 'Buyruq asosida limit muvaffaqiyatli oshirildi!',
      );
      if (onLimitIncreased && res.updatedStatus) {
        onLimitIncreased(res.updatedStatus);
      }
      setShowOrderForm(false);
      onClose();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          'Buyruqni yuklashda xatolik yuz berdi',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title=""
      size="lg"
      footer={null}
    >
      <div className="space-y-5 py-1">
        {/* Rasmiy va Qat'iy Ogohlantirish Headeri */}
        <div className="flex items-start gap-4 p-4 rounded-xl bg-gradient-to-r from-red-500/10 via-amber-500/10 to-transparent border border-red-500/20">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center shrink-0 text-red-500 shadow-inner">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-wider px-2 py-0.5 rounded-full bg-red-500/20 text-red-600 dark:text-red-400 uppercase">
                Ogohlantirish va Cheklov
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Scale className="w-3.5 h-3.5" /> Qonuniy meʼyor
              </span>
            </div>
            <h3 className="text-lg font-bold text-foreground mt-1">
              Oylik isteʼmol meʼyori chegarasiga yetildi
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Qonunan belgilangan oylik isteʼmol meʼyori cheklovi asosida ushbu amal bloklandi.
            </p>
          </div>
        </div>

        {/* Mahsulot va Obyekt ma'lumotlari */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Mahsulot:</span>
              <span className="text-sm font-semibold text-foreground">
                {limitStatus.productName}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {isDepartment ? (
                <Building2 className="w-4 h-4 text-blue-500" />
              ) : (
                <UserIcon className="w-4 h-4 text-emerald-500" />
              )}
              <span className="text-xs text-muted-foreground">
                {isDepartment ? 'Bo‘lim:' : 'Xodim:'}
              </span>
              <span className="text-sm font-medium text-foreground">
                {targetName || (isDepartment ? 'Tegishli bo‘lim' : 'Xodim')}
              </span>
            </div>
          </div>

          {/* Oylik hisob-kitob ko'rsatkichlari kartalari */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            <div className="bg-muted/40 p-2.5 rounded-lg border border-border/50 text-center">
              <span className="text-[11px] text-muted-foreground block font-medium">
                {limitStatus.totalExceptions > 0 ? 'Jami ruxsat' : 'Oylik meʼyor'}
              </span>
              <span className="text-base font-bold text-foreground block mt-0.5">
                {totalAllowed} <span className="text-xs font-normal">{unit}</span>
              </span>
              {limitStatus.totalExceptions > 0 && (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-medium">
                  ({baseLimit} + {limitStatus.totalExceptions})
                </span>
              )}
            </div>

            <div className="bg-muted/40 p-2.5 rounded-lg border border-border/50 text-center">
              <span className="text-[11px] text-muted-foreground block font-medium">
                Shu oyda olingan
              </span>
              <span className="text-base font-bold text-amber-600 dark:text-amber-400 block mt-0.5">
                {spent} <span className="text-xs font-normal">{unit}</span>
              </span>
            </div>

            <div className="bg-muted/40 p-2.5 rounded-lg border border-border/50 text-center">
              <span className="text-[11px] text-muted-foreground block font-medium">
                Qolgan limit
              </span>
              <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 block mt-0.5">
                {remaining} <span className="text-xs font-normal">{unit}</span>
              </span>
            </div>

            <div className="bg-red-500/10 p-2.5 rounded-lg border border-red-500/30 text-center">
              <span className="text-[11px] text-red-600 dark:text-red-400 block font-semibold">
                So‘ralgan miqdor
              </span>
              <span className="text-base font-bold text-red-600 dark:text-red-400 block mt-0.5">
                {requestedQuantity} <span className="text-xs font-normal">{unit}</span>
              </span>
            </div>
          </div>

          {excess > 0 && (
            <div className="text-xs text-red-600 dark:text-red-400 bg-red-500/5 px-3 py-2 rounded-lg border border-red-500/15 flex items-center justify-between">
              <span>Ruxsat etilgan limitdan ortiqcha miqdor:</span>
              <span className="font-bold">+{excess} {unit}</span>
            </div>
          )}

          {limitStatus.decreeReference && (
            <div className="text-xs text-muted-foreground bg-muted/20 px-3 py-1.5 rounded flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>Meʼyoriy asos: <strong>{limitStatus.decreeReference}</strong></span>
            </div>
          )}
        </div>

        {/* Qonuniy tushuntirish */}
        <div className="text-xs text-muted-foreground leading-relaxed bg-amber-500/5 border border-amber-500/20 p-3.5 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-foreground block mb-0.5">
              Limitdan oshirish faqat rasmiy buyruq bilan mumkin
            </span>
            Rahbariyat talabiga binoan oylik meʼyordan ortiq TMZ berish qatʼiyan taqiqlanadi.
            Agar qo‘shimcha ehtiyoj yuzasidan bildirishnoma berilib, Vazir yoki Rahbariyat tomonidan
            tasdiqlangan buyruq mavjud bo‘lsa, ushbu buyruqni tizimga biriktiring. Shundan so‘ng
            limit oshirilib, material berishga ruxsat etiladi.
          </div>
        </div>

        {/* Buyruq yuklash formasi yoki tugmasi */}
        {!showOrderForm ? (
          <div className="flex items-center justify-between gap-3 pt-2">
            <Button variant="outline" onClick={onClose}>
              Bekor qilish
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-2"
              onClick={() => setShowOrderForm(true)}
            >
              <FileCheck className="w-4 h-4" />
              Rahbariyat (Vazir) buyrug‘ini biriktirish
            </Button>
          </div>
        ) : (
          <form
            onSubmit={handleUploadDecree}
            className="border-2 border-primary/20 bg-primary/5 rounded-xl p-4 space-y-4 animate-in fade-in duration-200"
          >
            <div className="flex items-center justify-between border-b border-primary/10 pb-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <h4 className="text-sm font-bold text-foreground">
                  Vazir / Rahbariyat buyrug‘i maʼlumotlari
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowOrderForm(false)}
                className="text-muted-foreground hover:text-foreground text-xs flex items-center gap-1"
              >
                <X className="w-4 h-4" /> Yopish
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <Input
                label={`Qo‘shimcha ruxsat miqdori (${unit}) *`}
                type="number"
                step="any"
                min="0.0001"
                value={additionalQuantity}
                onChange={(e) => setAdditionalQuantity(e.target.value)}
                required
              />

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-foreground">
                  Buyruq hujjati fayli (PDF yoki rasm) *
                </label>
                <div className="relative">
                  <input
                    type="file"
                    id="exception-decree-file"
                    accept=".pdf,image/*"
                    onChange={handleFileChange}
                    required
                    className="sr-only"
                  />
                  {!file ? (
                    <label
                      htmlFor="exception-decree-file"
                      className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-white/20 bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors text-xs text-primary font-semibold"
                    >
                      <UploadCloud className="w-4 h-4 text-muted-foreground" />
                      <span>Faylni tanlash (PDF / Rasm)</span>
                    </label>
                  ) : (
                    <div className="flex items-center justify-between p-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-xs">
                      <span className="truncate font-semibold text-emerald-600 dark:text-emerald-400 max-w-[180px]">
                        ✓ {file.name}
                      </span>
                      <label
                        htmlFor="exception-decree-file"
                        className="text-[11px] text-primary hover:underline cursor-pointer shrink-0 ml-2"
                      >
                        Almashtirish
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-primary/10">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowOrderForm(false)}
                disabled={isSubmitting}
              >
                Bekor qilish
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
                loading={isSubmitting}
              >
                <CheckCircle2 className="w-4 h-4" />
                Buyruqni tasdiqlash va limitni oshirish
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
