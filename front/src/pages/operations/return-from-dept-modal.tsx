import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { operationsApi, departmentsApi, historyApi } from '../../api';
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
export default function ReturnFromDeptModal({ open, onClose }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const schema = z.object({
    departmentId: z.string().min(1, t("operations.validationDept")),
    selectedKey: z.string().min(1, t('operations.validationProduct')),
    quantity: z.coerce.number().min(1, t('operations.validationQty')),
    documentNumber: z.string().optional(),
    note: z.string().optional(),
  });
  type FormData = z.infer<typeof schema>;
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<any>({
    resolver: zodResolver(schema),
    defaultValues: { quantity: 1 },
  });
  const selectedDepartmentId = watch('departmentId');
  const selectedKey = watch('selectedKey');
  useEffect(() => {
    setValue('selectedKey', '');
  }, [selectedDepartmentId, setValue]);
  const { data: deptsData } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.getAll(),
    enabled: open,
  });
  const { data: deptHistoryData } = useQuery({
    queryKey: ['dept-assigned-history-for-return', selectedDepartmentId],
    queryFn: () => historyApi.getAll({ departmentId: selectedDepartmentId, limit: 100 }),
    enabled: !!selectedDepartmentId && open,
  });
  const deptOptions = (deptsData ?? []).map((d: any) => ({
    value: d.id,
    label: d.name,
  }));
  const deptHistoryItems: any[] = deptHistoryData?.items ?? [];
  const itemOptionsMap = new Map<string, { value: string; productId: string; assetId?: string; isAsset: boolean; label: string }>();
  deptHistoryItems.forEach((item: any) => {
    if (item.productId && item.product) {
      const isAsset = item.product.productType === 'BERILADIGAN';
      const key = isAsset && (item.assetId || item.asset?.id) ? `${item.productId}_${item.assetId || item.asset?.id}` : item.productId;
      const invText = item.asset?.inventoryNumber ? ` [Inv: ${item.asset.inventoryNumber}]` : '';
      if (!itemOptionsMap.has(key)) {
        itemOptionsMap.set(key, {
          value: key,
          productId: item.productId,
          assetId: item.assetId || item.asset?.id,
          isAsset,
          label: `${item.product.name}${invText}`,
        });
      }
    }
  });
  const selectedItemMeta = selectedKey ? itemOptionsMap.get(selectedKey) : null;
  useEffect(() => {
    if (selectedItemMeta?.isAsset) {
      setValue('quantity', 1);
    }
  }, [selectedKey, selectedItemMeta, setValue]);
  const productOptions = Array.from(itemOptionsMap.values()).map((opt) => ({
    value: opt.value,
    label: opt.label,
  }));
  const { mutate, isPending } = useMutation({
    mutationFn: (formData: FormData) => {
      const meta = itemOptionsMap.get(formData.selectedKey);
      const payload: any = {
        departmentId: formData.departmentId,
        productId: meta?.productId || formData.selectedKey,
        assetId: meta?.assetId,
        quantity: meta?.isAsset ? 1 : Number(formData.quantity),
        documentNumber: formData.documentNumber,
        note: formData.note,
      };
      return operationsApi.returnFromDept(payload);
    },
    onSuccess: () => {
      toast.success(t("operations.returnFromDeptSuccess"));
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
      onClose={() => { reset(); onClose(); }}
      title={t("operations.returnFromDept")}
      subtitle={t("operations.returnFromDeptSubtitle")}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={() => { reset(); onClose(); }} disabled={isPending}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit((data) => mutate(data))} loading={isPending}>
            {t('operations.returnBtn')}
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
          label={t('operations.asset')}
          options={productOptions}
          placeholder={
            !selectedDepartmentId
              ? t('operations.selectDeptFirst')
              : productOptions.length === 0
              ? t('operations.noReturnableItemsInDept')
              : t('operations.validationProduct')
          }
          error={errors.selectedKey?.message?.toString()}
          required
          disabled={!selectedDepartmentId || productOptions.length === 0}
          {...register('selectedKey')}
        />
        <Input
          label={t('operations.quantity')}
          type="number"
          min={1}
          disabled={selectedItemMeta?.isAsset}
          error={errors.quantity?.message?.toString()}
          required
          {...register('quantity')}
        />
        <Input
          label={t('common.documentNumber')}
          placeholder="AKT-2024-001"
          {...register('documentNumber')}
        />
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
  );
}