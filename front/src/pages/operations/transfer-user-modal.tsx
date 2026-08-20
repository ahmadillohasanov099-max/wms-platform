import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { operationsApi, usersApi } from '../../api';
import Modal from '../../components/ui/modal';
import Input from '../../components/ui/input';
import Select from '../../components/ui/select';
import Button from '../../components/ui/button';
import { useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { invalidateAppQueries } from '../../lib/utils';
interface Props {
  open: boolean;
  onClose: () => void;
}
export default function TransferUserModal({ open, onClose }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [fromUserId, setFromUserId] = useState('');
  const schema = z.object({
    fromUserId: z.string().min(1, t('operations.validationEmployee')),
    toUserId: z.string().min(1, t('operations.validationEmployee')),
    assetId: z.string().min(1, t('operations.validationAsset')),
    documentNumber: z.string().optional(),
    note: z.string().optional(),
  });
  type FormData = z.infer<typeof schema>;
  const { data: usersData } = useQuery({
    queryKey: ['users-all'],
    queryFn: () => usersApi.getAll({ limit: 100 }),
    enabled: open,
  });
  const { data: assignmentsData } = useQuery({
    queryKey: ['user-assignments', fromUserId],
    queryFn: () => usersApi.getAssignments(fromUserId),
    enabled: !!fromUserId,
  });
  const users = usersData?.items ?? [];
  const assignments = assignmentsData ?? [];
  const userOptions = users.map((u: any) => ({
    value: u.id,
    label: `${u.fullName} (${u.department?.name ?? ''})`,
  }));
  const assetOptions = assignments.map((a: any) => ({
    value: a.asset?.id,
    label: `${a.asset?.inventoryNumber} — ${a.asset?.product?.name}`,
  }));
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });
  const { mutate, isPending } = useMutation({
    mutationFn: (data: FormData) => operationsApi.transferUser(data),
    onSuccess: () => {
      toast.success(t('operations.transferSuccess'));
      invalidateAppQueries(queryClient);
      reset();
      setFromUserId('');
      onClose();
    },
    onError: (err: any) => {
      toast.error(err?.message || t('common.error'));
    },
  });
  return (
    <Modal
      open={open}
      onClose={() => { reset(); setFromUserId(''); onClose(); }}
      title={t('operations.transferUser')}
      subtitle={t('operations.transferUserDesc')}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={() => { reset(); setFromUserId(''); onClose(); }} disabled={isPending}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit((data) => mutate(data))} loading={isPending}>
            {t('operations.transferBtn')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label={t('operations.fromEmployee')}
          options={userOptions}
          placeholder={t('operations.validationEmployee')}
          error={errors.fromUserId?.message}
          required
          {...register('fromUserId', {
            onChange: (e) => setFromUserId(e.target.value),
          })}
        />
        <Select
          label={t('operations.asset')}
          options={assetOptions}
          placeholder={fromUserId ? t('operations.assetPlaceholder') : t('operations.assetSelectUserFirst')}
          error={errors.assetId?.message}
          required
          disabled={!fromUserId}
          {...register('assetId')}
        />
        <Select
          label={t('operations.toEmployee')}
          options={userOptions}
          placeholder={t('operations.validationEmployee')}
          error={errors.toUserId?.message}
          required
          {...register('toUserId')}
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