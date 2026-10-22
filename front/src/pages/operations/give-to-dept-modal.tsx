import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { operationsApi, departmentsApi, productsApi } from '../../api';
import Modal from '../../components/ui/modal';
import Input from '../../components/ui/input';
import Select from '../../components/ui/select';
import Button from '../../components/ui/button';
import TalabnomaModal, { type TalabnomaData } from '../../components/documents/talabnoma-modal';
import OverLimitNoticeModal from '../../components/modals/over-limit-notice-modal';
import type { LimitStatusResponse } from '../../api/endpoints/limits.api';
import { useAuthStore } from '../../store/auth.store';
import { useTranslation } from '../../hooks/useTranslation';
import { invalidateAppQueries } from '../../lib/utils';
import { formatProductQuantity, getUnitLabel, roundQuantity } from '../../lib/quantity-utils';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function GiveToDeptModal({ open, onClose }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [talabnomaData, setTalabnomaData] = useState<TalabnomaData | null>(null);
  const [giveMode, setGiveMode] = useState<'PACHKA' | 'DONA'>('PACHKA');
  const [donaCount, setDonaCount] = useState<number | string>(100);
  const [overLimitState, setOverLimitState] = useState<{
    open: boolean;
    limitStatus: LimitStatusResponse | null;
    requestedQuantity: number;
    fallbackMessage?: string;
  }>({
    open: false,
    limitStatus: null,
    requestedQuantity: 1,
  });

  const schema = z.object({
    departmentId: z.string().min(1, t("operations.validationDept")),
    productId: z.string().min(1, t('operations.validationProduct')),
    quantity: z.coerce.number().min(0.0001, t('operations.validationQty')),
    note: z.string().optional(),
  });

  type FormData = z.infer<typeof schema>;

  const { data: deptsData } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.getAll(),
    enabled: open,
  });

  const { data: productsData } = useQuery({
    queryKey: ['products-consumable'],
    queryFn: () => productsApi.getAll({ productType: 'SARFLANADIGAN', limit: 100 }),
    enabled: open,
  });

  const deptList: any[] = deptsData ?? [];
  const productList: any[] = productsData?.items ?? [];

  const deptOptions = deptList.map((d: any) => ({
    value: d.id,
    label: d.name,
  }));

  const productOptions = productList.map((p: any) => ({
    value: p.id,
    label: `${p.name} (${formatProductQuantity(p.inventory?.quantity ?? 0, p.unit, p.packageSize, t)})`,
  }));

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<any>({
    resolver: zodResolver(schema),
    defaultValues: { quantity: 1 },
  });

  const selectedProductId = watch('productId');
  const selectedProduct = useMemo(
    () => productList.find((p) => p.id === selectedProductId),
    [productList, selectedProductId]
  );

  const hasPackaging =
    selectedProduct?.packageSize &&
    selectedProduct.packageSize > 1 &&
    (selectedProduct.unit === 'PACHKA' || selectedProduct.unit === 'PACK');

  const { mutate, isPending } = useMutation({
    mutationFn: (data: FormData) => {
      let finalQty = data.quantity;
      if (hasPackaging && giveMode === 'DONA') {
        const donaNum = Number(donaCount) || 1;
        finalQty = roundQuantity(donaNum / selectedProduct.packageSize, 4);
      }
      return operationsApi.giveToDept({
        ...data,
        quantity: finalQty,
      });
    },
    onSuccess: (_, variables) => {
      const selectedDept = deptList.find((d) => d.id === variables.departmentId);

      const isDonaMode = hasPackaging && giveMode === 'DONA';
      const tData: TalabnomaData = {
        documentNumber: `TLB-${Date.now().toString().slice(-6)}`,
        date: new Date(),
        fromUser: user?.fullName || 'Xo‘jalik mudiri A.Urunbadalov',
        toRecipient: selectedDept?.name || 'Bo‘lim',
        items: [
          {
            name: selectedProduct?.name || 'Mahsulot',
            unit: isDonaMode ? 'dona' : getUnitLabel(selectedProduct?.unit, t),
            quantity: isDonaMode ? Number(donaCount) || 1 : variables.quantity,
          },
        ],
        note: variables.note,
      };

      toast.success(t("operations.giveToDeptSuccess"));
      invalidateAppQueries(queryClient);
      reset();
      setGiveMode('PACHKA');
      onClose();
      setTalabnomaData(tData);
    },
    onError: (err: any) => {
      const errData = err?.response?.data || err;
      const isOverLimit =
        errData?.errorCode === 'OVER_MONTHLY_LIMIT' ||
        !!errData?.limitStatus ||
        (typeof errData?.message === 'string' &&
          (errData.message.includes('OVER_MONTHLY_LIMIT') ||
           errData.message.includes('Oylik meʼyor') ||
           errData.message.includes('limitdan oshib')));

      if (isOverLimit) {
        setOverLimitState({
          open: true,
          limitStatus: errData?.limitStatus || null,
          requestedQuantity: errData?.requestedQuantity || 1,
          fallbackMessage: errData?.message,
        });
        return;
      }
      toast.error(errData?.message || err?.message || t('common.error'));
    },
  });

  return (
    <>
      <Modal
        open={open && !overLimitState.open}
        onClose={() => { reset(); setGiveMode('PACHKA'); onClose(); }}
        title={t("operations.giveToDept")}
        subtitle={t("operations.giveToDeptSubtitle")}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => { reset(); setGiveMode('PACHKA'); onClose(); }} disabled={isPending}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSubmit((data) => mutate(data))} loading={isPending}>
              {t('operations.give')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label={t('users.department')}
            options={deptOptions}
            placeholder={t("operations.validationDept")}
            error={errors.departmentId?.message?.toString()}
            required
            {...register('departmentId')}
          />
          <Select
            label={t('history.product')}
            options={productOptions}
            placeholder={t('operations.validationProduct')}
            error={errors.productId?.message?.toString()}
            required
            {...register('productId')}
          />

          {hasPackaging ? (
            <div className="space-y-2 p-2.5 bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/80 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  {t('common.units.giveMode')}
                </span>
                <div className="flex items-center gap-1 bg-gray-200 dark:bg-gray-700 p-0.5 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setGiveMode('PACHKA')}
                    className={`px-2.5 py-1 text-3xs font-bold rounded-md transition-colors ${
                      giveMode === 'PACHKA'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                    }`}
                  >
                    {t('common.units.pachkaMode')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setGiveMode('DONA')}
                    className={`px-2.5 py-1 text-3xs font-bold rounded-md transition-colors ${
                      giveMode === 'DONA'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                    }`}
                  >
                    {t('common.units.donaMode')}
                  </button>
                </div>
              </div>

              {giveMode === 'DONA' ? (
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                    Donalar soni (1 pachka = {selectedProduct.packageSize} dona)
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={donaCount}
                    onChange={(e) => setDonaCount(e.target.value)}
                    placeholder="Masalan: 200"
                  />
                  <span className="text-3xs text-emerald-700 dark:text-emerald-400 font-semibold block mt-1">
                    = {roundQuantity((Number(donaCount) || 0) / selectedProduct.packageSize, 4)} pachka ombordan chiqariladi
                  </span>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                    Pachkalar soni (1 pachka = {selectedProduct.packageSize} dona)
                  </label>
                  <Input
                    type="number"
                    step="any"
                    min={0.001}
                    error={errors.quantity?.message?.toString()}
                    required
                    {...register('quantity')}
                  />
                  <span className="text-3xs text-slate-500 font-medium block mt-1">
                    = {Math.round((Number(watch('quantity')) || 0) * selectedProduct.packageSize)} dona
                  </span>
                </div>
              )}
            </div>
          ) : (
            <Input
              label={t('operations.quantity')}
              type="number"
              step={selectedProduct?.unit === 'DONA' ? '1' : 'any'}
              min={selectedProduct?.unit === 'DONA' ? 1 : 0.0001}
              error={errors.quantity?.message?.toString()}
              required
              {...register('quantity')}
            />
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('common.note')}</label>
            <textarea
              rows={2}
              placeholder={t('inventory.notePlaceholder')}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 px-3 py-2 resize-none"
              {...register('note')}
            />
          </div>
        </div>
      </Modal>

      <TalabnomaModal
        open={!!talabnomaData}
        onClose={() => setTalabnomaData(null)}
        data={talabnomaData}
      />

      <OverLimitNoticeModal
        open={overLimitState.open}
        onClose={() => {
          setOverLimitState({ open: false, limitStatus: null, requestedQuantity: 1 });
          reset();
          setGiveMode('PACHKA');
          onClose();
        }}
        limitStatus={overLimitState.limitStatus}
        requestedQuantity={overLimitState.requestedQuantity}
        targetName={deptList.find((d) => d.id === watch('departmentId'))?.name}
        isDepartment={true}
        fallbackMessage={overLimitState.fallbackMessage}
      />
    </>
  );
}