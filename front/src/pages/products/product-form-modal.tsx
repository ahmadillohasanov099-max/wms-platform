import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { productsApi } from '../../api';
import Modal from '../../components/ui/modal';
import Button from '../../components/ui/button';
import Input from '../../components/ui/input';
import Select from '../../components/ui/select';
import { useTranslation } from '../../hooks/useTranslation';
import { invalidateAppQueries } from '../../lib/utils';
interface Props {
  open: boolean;
  onClose: () => void;
  product?: any;
}
export default function ProductFormModal({ open, onClose, product }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isEdit = !!product;
  const schema = z.object({
    name: z.string().min(2, t('products.validationName')),
    code: z.string().optional(),
    productType: z.enum(['BERILADIGAN', 'SARFLANADIGAN'], {
      message: t('products.validationType'),
    }),
    unit: z.enum(['DONA', 'PACHKA', 'KOMPLEKT', 'LITR', 'KG', 'METR']).optional(),
    packageSize: z.coerce.number().min(1).optional().or(z.literal('')),
    description: z.string().optional(),
  });
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<any>({
    resolver: zodResolver(schema) as any,
  });

  const selectedUnit = watch('unit');

  useEffect(() => {
    if (product) {
      reset({
        name: product.name,
        code: product.code ?? '',
        productType: product.productType,
        unit: product.unit || 'DONA',
        packageSize: product.packageSize ?? '',
        description: product.description ?? '',
      });
    } else {
      reset({
        name: '',
        code: '',
        productType: undefined,
        unit: 'DONA',
        packageSize: '',
        description: '',
      });
    }
  }, [product, reset]);
  const { mutate, isPending } = useMutation({
    mutationFn: (data: any) => {
      if (isEdit) {
        return productsApi.update(product.id, {
          ...data,
          packageSize: data.packageSize ? Number(data.packageSize) : null,
        });
      }
      return Promise.reject(new Error(t('products.validationCreateError')));
    },
    onSuccess: () => {
      toast.success(
        isEdit ? t('products.updateSuccess') : t('products.createSuccess'),
      );
      invalidateAppQueries(queryClient);
      onClose();
    },
    onError: (err: any) => {
      toast.error(err?.message || t('common.error'));
    },
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? t('products.editTitle') : t('products.addTitle')}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSubmit((data) => mutate(data))}
            loading={isPending}
          >
            {isEdit ? t('common.save') : t('common.add')}
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
        <Input
          label={t('products.productCode')}
          placeholder={t('products.codePlaceholder')}
          error={errors.code?.message?.toString()}
          {...register('code')}
        />
        <Select
          label={t('inventory.productType')}
          options={[
            { value: 'BERILADIGAN', label: t('inventory.typeAsset') },
            { value: 'SARFLANADIGAN', label: t('inventory.typeConsumable') },
          ]}
          placeholder={t('products.typePlaceholder')}
          error={errors.productType?.message?.toString()}
          required
          disabled={isEdit}
          {...register('productType')}
        />
        <Select
          label={t('inventory.unit')}
          options={[
            { value: 'DONA', label: t('common.units.DONA') },
            { value: 'PACHKA', label: t('common.units.PACHKA') },
            { value: 'KOMPLEKT', label: t('common.units.KOMPLEKT') },
            { value: 'LITR', label: t('common.units.LITR') },
            { value: 'KG', label: t('common.units.KG') },
            { value: 'METR', label: t('common.units.METR') },
          ]}
          {...register('unit')}
        />
        {selectedUnit === 'PACHKA' && (
          <Input
            label={t('common.units.packageSize')}
            type="number"
            min={1}
            placeholder={t('common.units.packageSizePlaceholder')}
            error={errors.packageSize?.message?.toString()}
            {...register('packageSize')}
          />
        )}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('common.description')}
          </label>
          <textarea
            rows={3}
            placeholder={t('products.descPlaceholder')}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 px-3 py-2 resize-none"
            {...register('description')}
          />
        </div>
      </div>
    </Modal>
  );
}