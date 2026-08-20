import { useState } from 'react';
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
import { useAuthStore } from '../../store/auth.store';
import { useTranslation } from '../../hooks/useTranslation';
import { invalidateAppQueries } from '../../lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function GiveToDeptModal({ open, onClose }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [talabnomaData, setTalabnomaData] = useState<TalabnomaData | null>(null);

  const schema = z.object({
    departmentId: z.string().min(1, t("operations.validationDept")),
    productId: z.string().min(1, t('operations.validationProduct')),
    quantity: z.coerce.number().min(1, t('operations.validationQty')),
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
    label: `${p.name} (${p.inventory?.quantity ?? 0} ${t('common.pcs')})`,
  }));

  const { register, handleSubmit, reset, formState: { errors } } = useForm<any>({
    resolver: zodResolver(schema),
    defaultValues: { quantity: 1 },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (data: FormData) => operationsApi.giveToDept(data),
    onSuccess: (_, variables) => {
      const selectedDept = deptList.find((d) => d.id === variables.departmentId);
      const selectedProduct = productList.find((p) => p.id === variables.productId);

      const tData: TalabnomaData = {
        documentNumber: `TLB-${Date.now().toString().slice(-6)}`,
        date: new Date(),
        fromUser: user?.fullName || 'Xo‘jalik mudiri A.Urunbadalov',
        toRecipient: selectedDept?.name || 'Bo‘lim',
        items: [
          {
            name: selectedProduct?.name || 'Mahsulot',
            unit: selectedProduct?.unit || 'dona',
            quantity: variables.quantity,
          },
        ],
        note: variables.note,
      };

      toast.success(t("operations.giveToDeptSuccess"));
      invalidateAppQueries(queryClient);
      reset();
      onClose();
      setTalabnomaData(tData);
    },
    onError: (err: any) => {
      toast.error(err?.message || t('common.error'));
    },
  });

  return (
    <>
      <Modal
        open={open}
        onClose={() => { reset(); onClose(); }}
        title={t("operations.giveToDept")}
        subtitle={t("operations.giveToDeptSubtitle")}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => { reset(); onClose(); }} disabled={isPending}>
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
          <Input
            label={t('operations.quantity')}
            type="number"
            min={1}
            error={errors.quantity?.message?.toString()}
            required
            {...register('quantity')}
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

      {}
      <TalabnomaModal
        open={!!talabnomaData}
        onClose={() => setTalabnomaData(null)}
        data={talabnomaData}
      />
    </>
  );
}