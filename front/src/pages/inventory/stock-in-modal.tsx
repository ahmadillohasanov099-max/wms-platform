import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { operationsApi } from '../../api';
import Modal from '../../components/ui/modal';
import Input from '../../components/ui/input';
import Select from '../../components/ui/select';
import Button from '../../components/ui/button';
import { useTranslation } from '../../hooks/useTranslation';
import { invalidateAppQueries } from '../../lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function StockInModal({ open, onClose }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const schema = z.object({
    name: z.string().min(2, t('inventory.validationName')),
    productType: z.enum(['BERILADIGAN', 'SARFLANADIGAN']),
    unit: z.enum(['DONA', 'PACHKA', 'KOMPLEKT']).optional(),
    year: z.coerce.number().min(1900).max(2100).optional().or(z.literal('')),
    quantity: z.coerce.number().min(1, t('inventory.validationQty')),
    unitPrice: z.coerce.number().min(0),
    minLevel: z.coerce.number().min(0).optional(),
    description: z.string().optional(),
    documentNumber: z.string().optional(),
    note: z.string().optional(),
    inventoryNumbers: z.array(z.string().optional()).optional(),
  }).superRefine((data, ctx) => {
    if (data.productType === 'BERILADIGAN') {
      const qty = Number(data.quantity);
      const invs = data.inventoryNumbers || [];
      for (let i = 0; i < qty; i++) {
        const invVal = invs[i];
        if (!invVal || !invVal.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['inventoryNumbers', i],
            message: 'Inventar raqami kiritilishi shart',
          });
        }
      }

      const filledInvs = invs.slice(0, qty).map((v) => (v || '').trim()).filter(Boolean);
      if (filledInvs.length === qty) {
        const unique = new Set(filledInvs);
        if (unique.size !== qty) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['inventoryNumbers'],
            message: 'Inventar raqamlari takrorlanmasligi shart!',
          });
        }
      }
    }
  });

  type FormData = z.infer<typeof schema>;

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<any>({
    resolver: zodResolver(schema),
    defaultValues: {
      quantity: 1,
      unitPrice: 0,
      productType: 'BERILADIGAN',
      unit: 'DONA',
      inventoryNumbers: [],
    },
  });

  const productType = watch('productType');
  const quantity = watch('quantity') || 0;

  const qty = Number(quantity) || 0;
  const displayQty = Math.min(qty, 100);

  const { mutate, isPending } = useMutation({
    mutationFn: (data: FormData) => {
      const invs = data.productType === 'BERILADIGAN'
        ? (data.inventoryNumbers || []).slice(0, qty).map((s: any) => s?.trim() || '')
        : undefined;

      return operationsApi.stockIn({
        name: data.name,
        productType: data.productType,
        unit: data.unit,
        year: data.year ? Number(data.year) : undefined,
        quantity: qty,
        unitPrice: Number(data.unitPrice),
        minLevel: data.minLevel ? Number(data.minLevel) : undefined,
        description: data.description,
        documentNumber: data.documentNumber,
        note: data.note,
        inventoryNumbers: invs,
      });
    },
    onSuccess: () => {
      toast.success(t('inventory.stockInSuccess'));
      invalidateAppQueries(queryClient);
      reset();
      onClose();
    },
    onError: (err: any) => {
      toast.error(err?.message || err?.response?.data?.message || t('common.error'));
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('inventory.stockInTitle')}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit((data) => mutate(data))} loading={isPending}>
            {t('inventory.stockInBtn')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label={t('inventory.productName')}
          placeholder={t('inventory.productNamePlaceholder')}
          error={errors.name?.message?.toString()}
          required
          {...register('name')}
        />

        <Select
          label={t('inventory.productType')}
          options={[
            { value: 'BERILADIGAN', label: t('inventory.typeAsset') },
            { value: 'SARFLANADIGAN', label: t('inventory.typeConsumable') },
          ]}
          error={errors.productType?.message?.toString()}
          required
          {...register('productType')}
        />

        <div className="grid grid-cols-2 gap-3">
          <Select
            label={t('inventory.unit')}
            options={[
              { value: 'DONA', label: t('common.units.DONA') },
              { value: 'PACHKA', label: t('common.units.PACHKA') },
              { value: 'KOMPLEKT', label: t('common.units.KOMPLEKT') },
            ]}
            {...register('unit')}
          />
          <Input
            label={t('inventory.year')}
            type="number"
            placeholder={t('inventory.yearPlaceholder')}
            {...register('year')}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label={t('operations.quantity')}
            type="number"
            min={1}
            placeholder={t('inventory.qtyPlaceholder')}
            error={errors.quantity?.message?.toString()}
            required
            {...register('quantity')}
          />
          <Input
            label={t('inventory.unitPrice')}
            type="number"
            min={0}
            placeholder={t('inventory.unitPricePlaceholder')}
            error={errors.unitPrice?.message?.toString()}
            {...register('unitPrice')}
          />
        </div>

        {productType === 'BERILADIGAN' && qty > 0 && (
          <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-gray-100 dark:border-gray-800">
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              {t('inventory.inventoryNumbers')} <span className="text-red-500">*</span>
            </h4>
            {errors.inventoryNumbers && (errors.inventoryNumbers as any).message && (
              <p className="text-xs text-red-500 font-medium">
                {(errors.inventoryNumbers as any).message.toString()}
              </p>
            )}

            <div className="max-h-60 overflow-y-auto pr-1 space-y-2">
              {Array.from({ length: displayQty }).map((_, index) => {
                const invError = (errors.inventoryNumbers as any)?.[index]?.message;
                return (
                  <div key={index} className="space-y-1">
                    <input
                      type="text"
                      placeholder={`Inventar raqami #${index + 1}`}
                      className={`w-full rounded-lg border bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 px-3 py-2 ${
                        invError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-700'
                      }`}
                      {...register(`inventoryNumbers.${index}`)}
                    />
                    {invError && (
                      <p className="text-xs text-red-500">{invError.toString()}</p>
                    )}
                  </div>
                );
              })}
            </div>

            {qty > 100 && (
              <p className="text-2xs text-yellow-600 dark:text-yellow-400">
                * 100 dan ortiq mahsulotlar uchun Ommaviy kirim (Bulk) xizmatidan foydalaning.
              </p>
            )}
          </div>
        )}

        <Input
          label={t('inventory.minLevel')}
          type="number"
          min={0}
          placeholder={t('inventory.minLevelPlaceholder')}
          error={errors.minLevel?.message?.toString()}
          {...register('minLevel')}
        />

        <Input
          label={t('common.documentNumber')}
          placeholder={t('inventory.docNumberPlaceholder')}
          error={errors.documentNumber?.message?.toString()}
          {...register('documentNumber')}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('common.note')}
          </label>
          <textarea
            rows={2}
            placeholder={t('inventory.notePlaceholder')}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 px-3 py-2 resize-none"
            {...register('note')}
          />
        </div>
      </div>
    </Modal>
  );
}