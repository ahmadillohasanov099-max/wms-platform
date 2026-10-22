import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Scale,
  Plus,
  FileText,
  AlertCircle,
  Trash2,
  Pencil,
  User as UserIcon,
  ExternalLink,
  UploadCloud,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Card, { CardHeader, CardContent } from '../ui/card';
import Button from '../ui/button';
import Input from '../ui/input';
import Modal from '../ui/modal';
import { limitsApi } from '../../api/endpoints/limits.api';
import { productsApi } from '../../api';
import { useAuthStore } from '../../store/auth.store';
import { formatDate, formatSimpleDate } from '../../lib/utils';
import { formatProductQuantity, roundQuantity } from '../../lib/quantity-utils';
import { useTranslation } from '../../hooks/useTranslation';

interface LimitsSummaryCardProps {
  userId?: string;
  departmentId?: string;
  targetName?: string;
}

export default function LimitsSummaryCard({
  userId,
  departmentId,
  targetName,
}: LimitsSummaryCardProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const canManage =
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'RAHBAR' ||
    user?.role === 'VAZIRLIK_OMBORCHI' ||
    user?.role === 'ORG_ADMIN' ||
    user?.role === 'ORG_OMBORCHI';

  // --- Add Limit Modal State ---
  const [isAddLimitModalOpen, setIsAddLimitModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [addMode, setAddMode] = useState<'PACHKA' | 'DONA'>('DONA');
  const [rawLimitInput, setRawLimitInput] = useState<number | string>(40);
  const decreeRef = "Vazirlik ichki me'yoriy qarori";

  // --- Edit Limit Modal State (with Decree) ---
  const [editingLimit, setEditingLimit] = useState<any | null>(null);
  const [rawEditInput, setRawEditInput] = useState<number | string>(40);
  const [editFile, setEditFile] = useState<File | null>(null);

  const { data: limitsData, isLoading } = useQuery({
    queryKey: ['limits-summary', { userId, departmentId }],
    queryFn: () =>
      limitsApi.getLimits({
        userId: userId || undefined,
        departmentId: departmentId || undefined,
        limit: 50,
      }),
  });

  const { data: productsData } = useQuery({
    queryKey: ['products-for-limits'],
    queryFn: () => productsApi.getAll({ productType: 'SARFLANADIGAN', limit: 200 }),
    enabled: isAddLimitModalOpen || !!editingLimit,
  });

  const productsList: any[] = productsData?.items ?? [];
  const limitsList: any[] = limitsData?.data ?? [];

  // Selected product in Add modal
  const selectedProduct = productsList.find((p) => p.id === selectedProductId);
  const hasAddPackaging =
    selectedProduct?.packageSize &&
    selectedProduct.packageSize > 1 &&
    (selectedProduct.unit === 'PACHKA' || selectedProduct.unit === 'PACK');

  // Mutation: Add / Create Limit
  const addLimitMutation = useMutation({
    mutationFn: (payload: any) => limitsApi.setLimit(payload),
    onSuccess: () => {
      toast.success("Oylik me'yor muvaffaqiyatli belgilandi");
      queryClient.invalidateQueries({ queryKey: ['limits-summary'] });
      setIsAddLimitModalOpen(false);
      setSelectedProductId('');
      setRawLimitInput(40);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || 'Xatolik');
    },
  });

  // Mutation: Edit / Update Limit with Decree
  const updateLimitMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      limitsApi.updateLimit(id, payload),
    onSuccess: (res: any) => {
      toast.success(res?.message || "Oylik me'yor buyruq asosida yangilandi");
      queryClient.invalidateQueries({ queryKey: ['limits-summary'] });
      setEditingLimit(null);
      setEditFile(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || 'Xatolik');
    },
  });

  // Mutation: Delete Limit
  const deleteLimitMutation = useMutation({
    mutationFn: (id: string) => limitsApi.deleteLimit(id),
    onSuccess: () => {
      toast.success("Me'yor o'chirildi");
      queryClient.invalidateQueries({ queryKey: ['limits-summary'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || 'Xatolik');
    },
  });

  const handleOpenEdit = (limitItem: any) => {
    setEditingLimit(limitItem);
    setRawEditInput(limitItem.limitQuantity);
    setEditFile(null);
  };

  const handleSaveAddLimit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) {
      toast.error('Mahsulotni tanlang');
      return;
    }
    const rawVal = Number(rawLimitInput);
    if (!rawVal || rawVal <= 0) {
      toast.error("Miqdor 0 dan katta bo'lishi kerak");
      return;
    }

    let finalQuantity = rawVal;
    if (hasAddPackaging && addMode === 'DONA' && selectedProduct.packageSize) {
      finalQuantity = roundQuantity(rawVal / selectedProduct.packageSize, 4);
    }

    addLimitMutation.mutate({
      productId: selectedProductId,
      userId: userId || undefined,
      departmentId: departmentId || undefined,
      limitQuantity: finalQuantity,
      decreeReference: decreeRef.trim() || undefined,
    });
  };

  const handleSaveEditLimit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLimit) return;

    if (!editFile) {
      toast.error('Yangi buyruq faylini (PDF yoki rasm) yuklash shart!');
      return;
    }

    const rawVal = Number(rawEditInput);
    if (!rawVal || rawVal <= 0) {
      toast.error("Miqdor 0 dan katta bo'lishi kerak");
      return;
    }

    updateLimitMutation.mutate({
      id: editingLimit.id,
      payload: {
        limitQuantity: rawVal,
        file: editFile,
      },
    });
  };

  return (
    <Card className="rounded-2xl border-gray-200/90 dark:border-white/15 shadow-2xs overflow-hidden mb-6">
      <CardHeader
        title={
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200/60 dark:border-emerald-900/40">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-slate-900 dark:text-white text-sm sm:text-base block">
                Choraklik TMZ isteʼmol meʼyorlari (3 oylik limitlar)
              </span>
              <span className="text-xs text-muted-foreground block">
                {targetName
                  ? `${targetName} uchun belgilangan meʼyorlar va qoldiqlar`
                  : 'Choraklik meʼyorlar va qoldiqlar nazorati'}
              </span>
            </div>
          </div>
        }
        action={
          canManage && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs flex items-center gap-1.5 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              onClick={() => {
                setIsAddLimitModalOpen(true);
                setSelectedProductId('');
                setRawLimitInput(40);
                setAddMode('DONA');
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              Meʼyor belgilash
            </Button>
          )
        }
      />
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6 text-center text-xs text-muted-foreground">
            Yuklanmoqda...
          </div>
        ) : limitsList.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
            Hozircha ushbu {userId ? 'xodim' : 'bo‘lim'} uchun alohida oylik isteʼmol meʼyori belgilanmagan.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200/80 dark:border-white/10 bg-gray-50/75 dark:bg-slate-800/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="py-3 px-4">Mahsulot</th>
                  <th className="py-3 px-4 text-center">Choraklik meʼyor (3 oylik)</th>
                  <th className="py-3 px-4 text-center">Choraklik sarf</th>
                  <th className="py-3 px-4 text-center">Qolgan limit</th>
                  <th className="py-3 px-4 text-center">Yangilanish sanasi</th>
                  <th className="py-3 px-4">Asos va Masʼul</th>
                  {canManage && <th className="py-3 px-4 text-right">Amallar</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-xs">
                {limitsList.map((item: any) => {
                  const prod = item.product;
                  const formattedLimit = formatProductQuantity(
                    item.limitQuantity,
                    prod?.unit,
                    prod?.packageSize,
                    t,
                  );
                  const formattedSpent = formatProductQuantity(
                    item.currentMonthSpent ?? 0,
                    prod?.unit,
                    prod?.packageSize,
                    t,
                  );
                  const formattedRemaining = formatProductQuantity(
                    item.remaining ?? item.limitQuantity,
                    prod?.unit,
                    prod?.packageSize,
                    t,
                  );

                  const latestDecree =
                    item.latestDecree ||
                    item.history?.find((h: any) => h.fileUrl) ||
                    item.history?.[0];
                  const lastEditor =
                    latestDecree?.createdBy?.fullName || item.createdBy?.fullName;
                  const lastTimestamp =
                    latestDecree?.createdAt || item.updatedAt || item.createdAt;
                  const decreeFileUrl = latestDecree?.fileUrl;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      {/* Mahsulot */}
                      <td className="py-3.5 px-4 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-foreground">
                            {prod?.name}
                          </span>
                          {prod?.packageSize && prod.packageSize > 1 && (
                            <span className="text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border/50 whitespace-nowrap">
                              1 pachka = {prod.packageSize} dona
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Oylik me'yor */}
                      <td className="py-3.5 px-4 text-center font-bold text-sm text-foreground whitespace-nowrap">
                        <span>{formattedLimit}</span>
                        {item.totalExceptions > 0 && (
                          <span className="block text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                            (+{formatProductQuantity(item.totalExceptions, prod?.unit, prod?.packageSize, t)})
                          </span>
                        )}
                      </td>

                      {/* Sarf (Bu oy) */}
                      <td className="py-3.5 px-4 text-center font-semibold text-sm text-amber-600 dark:text-amber-400 whitespace-nowrap">
                        {formattedSpent}
                      </td>

                      {/* Qolgan limit */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          {formattedRemaining}
                        </span>
                      </td>

                      {/* Yangilanish sanasi */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex flex-col items-center">
                          <span className="font-semibold text-xs text-foreground">
                            {formatSimpleDate(item.nextResetDate) || '01.01.2027'}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {item.periodCode ? (item.periodCode.split('-')[1] + ' chorak') : (item.periodName || 'IV chorak')}
                          </span>
                        </div>
                      </td>

                      {/* Asos va Mas'ul */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1">
                          {decreeFileUrl ? (
                            <a
                              href={decreeFileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 w-fit px-2 py-0.5 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-md transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Buyruq hujjati</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">
                              {item.decreeReference || "Meʼyoriy qaror"}
                            </span>
                          )}
                          {lastEditor && (
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <UserIcon className="w-3 h-3 text-muted-foreground/70 shrink-0" />
                              <span>{lastEditor}</span>
                              <span>·</span>
                              <span>{formatDate(lastTimestamp)}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Amallar */}
                      {canManage && (
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(item)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                              title="Tahrirlash"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    "Rostdan ham ushbu meʼyorni o‘chirmoqchimisiz?"
                                  )
                                ) {
                                  deleteLimitMutation.mutate(item.id);
                                }
                              }}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                              title="O‘chirish"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {/* --- 1. Me'yor belgilash modali (Yangi me'yor) --- */}
      <Modal
        open={isAddLimitModalOpen}
        onClose={() => setIsAddLimitModalOpen(false)}
        title="Choraklik isteʼmol meʼyorini belgilash (3 oylik)"
        size="md"
        footer={null}
      >
        <form onSubmit={handleSaveAddLimit} className="space-y-4 py-2">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              TMZ Mahsulot *
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full text-xs rounded-lg border border-input bg-background px-3 py-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              required
            >
              <option value="">-- Mahsulotni tanlang --</option>
              {productsList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.packageSize ? `(1 pachka = ${p.packageSize} dona)` : `(${p.unit || 'dona'})`}
                </option>
              ))}
            </select>
          </div>

          {/* O'lchov birligi tanlash (Pachka / Dona) */}
          {hasAddPackaging && (
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Kiritish birligi
              </label>
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/60 border border-border/60 w-fit">
                <button
                  type="button"
                  onClick={() => setAddMode('DONA')}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    addMode === 'DONA'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                  }`}
                >
                  Dona
                </button>
                <button
                  type="button"
                  onClick={() => setAddMode('PACHKA')}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    addMode === 'PACHKA'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                  }`}
                >
                  Pachka
                </button>
              </div>
            </div>
          )}

          <div>
            <Input
              label={`Oylik meʼyor miqdori (${hasAddPackaging && addMode === 'DONA' ? 'Dona' : selectedProduct?.unit || 'Dona'}) *`}
              type="number"
              step="any"
              min="0.0001"
              value={rawLimitInput}
              onChange={(e) => setRawLimitInput(e.target.value)}
              required
            />
            {hasAddPackaging && selectedProduct?.packageSize && (
              <span className="text-[11px] text-muted-foreground block mt-1">
                {addMode === 'DONA'
                  ? `(= ${roundQuantity(Number(rawLimitInput || 0) / selectedProduct.packageSize, 3)} pachka)`
                  : `(= ${Math.round(Number(rawLimitInput || 0) * selectedProduct.packageSize)} dona)`}
              </span>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddLimitModalOpen(false)}
            >
              Bekor qilish
            </Button>
            <Button
              type="submit"
              size="sm"
              loading={addLimitMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              Saqlash
            </Button>
          </div>
        </form>
      </Modal>

      {/* --- 2. Me'yorni tahrirlash modali --- */}
      {editingLimit && (
        <Modal
          open={!!editingLimit}
          onClose={() => setEditingLimit(null)}
          title="Oylik meʼyorni tahrirlash"
          size="md"
          footer={null}
        >
          <form onSubmit={handleSaveEditLimit} className="space-y-4 py-2">
            <div className="bg-muted/40 p-3 rounded-xl border border-border/60">
              <span className="text-xs text-muted-foreground block">
                Tanlangan mahsulot:
              </span>
              <span className="text-sm font-bold text-foreground block mt-0.5">
                {editingLimit.product?.name}
              </span>
              <span className="text-xs text-muted-foreground block mt-1">
                Amaldagi meʼyor:{' '}
                <strong className="text-foreground">
                  {formatProductQuantity(
                    editingLimit.limitQuantity,
                    editingLimit.product?.unit,
                    editingLimit.product?.packageSize,
                    t,
                  )}
                </strong>
              </span>
            </div>

            <div>
              <Input
                label={`Yangi oylik meʼyor miqdori (${editingLimit.product?.unit || 'Dona'}) *`}
                type="number"
                step="any"
                min="0.0001"
                value={rawEditInput}
                onChange={(e) => setRawEditInput(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-foreground">
                Asos bo‘lgan yangi buyruq fayli (PDF yoki rasm) *
              </label>
              <div className="relative">
                <input
                  type="file"
                  id="edit-decree-file"
                  accept=".pdf,image/*"
                  required
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setEditFile(e.target.files[0]);
                    }
                  }}
                  className="sr-only"
                />
                {!editFile ? (
                  <label
                    htmlFor="edit-decree-file"
                    className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl border-2 border-dashed border-gray-300 dark:border-white/20 bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors text-center"
                  >
                    <UploadCloud className="w-6 h-6 text-muted-foreground" />
                    <span className="text-xs font-semibold text-primary">
                      Buyruq faylini yuklash uchun bosing
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      PDF, JPG yoki PNG formatida
                    </span>
                  </label>
                ) : (
                  <div className="flex items-center justify-between p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">
                          {editFile.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {(editFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <label
                      htmlFor="edit-decree-file"
                      className="text-xs font-medium text-primary hover:underline cursor-pointer shrink-0 ml-2"
                    >
                      Almashtirish
                    </label>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingLimit(null)}
              >
                Bekor qilish
              </Button>
              <Button
                type="submit"
                size="sm"
                loading={updateLimitMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                Saqlash
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </Card>
  );
}
