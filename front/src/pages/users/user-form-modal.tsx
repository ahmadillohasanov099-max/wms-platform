import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { usersApi } from '../../api';
import Modal from '../../components/ui/modal';
import Input from '../../components/ui/input';
import Select from '../../components/ui/select';
import Button from '../../components/ui/button';
import { useTranslation } from '../../hooks/useTranslation';

interface Props {
  open: boolean;
  onClose: () => void;
  user?: any;
  departments: any[];
}
export default function UserFormModal({ open, onClose, user, departments }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isEdit = !!user;
  const createSchema = z
    .object({
      fullName: z.string().min(2, t('users.validationName')),
      username: z.string().min(3, t('users.validationUsername')),
      password: z.string().min(6, t('users.validationPassword')),
      role: z.enum(['ADMIN', 'OMBORCHI', 'KADR', 'XODIM']),
      departmentId: z.string().optional(),
      phone: z.string().optional(),
      internalPhone: z.string().optional(),
      position: z.string().optional(),
      passport: z.string().optional(),
      pinfl: z.string().optional(),
      address: z.string().optional(),
    })
    .refine(
      (data) => data.role !== 'XODIM' || (!!data.departmentId && data.departmentId.trim().length > 0),
      {
        message: t('users.validationDept'),
        path: ['departmentId'],
      }
    );

  const editSchema = z
    .object({
      fullName: z.string().min(2).optional(),
      username: z.string().min(3).optional(),
      role: z.enum(['ADMIN', 'OMBORCHI', 'KADR', 'XODIM']).optional(),
      departmentId: z.string().optional(),
      phone: z.string().optional(),
      internalPhone: z.string().optional(),
      position: z.string().optional(),
      passport: z.string().optional(),
      pinfl: z.string().optional(),
      address: z.string().optional(),
    })
    .refine(
      (data) => !data.role || data.role !== 'XODIM' || (!!data.departmentId && data.departmentId.trim().length > 0),
      {
        message: t('users.validationDept'),
        path: ['departmentId'],
      }
    );

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<any>({
    resolver: zodResolver(isEdit ? editSchema : createSchema),
    defaultValues: {
      role: 'XODIM',
    },
  });

  const selectedRole = watch('role') || 'XODIM';

  useEffect(() => {
    if (user) {
      reset({
        fullName: user.fullName,
        username: user.username,
        role: user.role,
        departmentId: user.departmentId || '',
        phone: user.phone ?? '',
        internalPhone: user.internalPhone ?? '',
        position: user.position ?? '',
        passport: user.passport ?? user.passportSeries ?? '',
        pinfl: user.pinfl ?? '',
        address: user.address ?? '',
      });
    } else {
      reset({ fullName: '', username: '', password: '', role: 'XODIM', departmentId: '', phone: '', internalPhone: '', position: '', passport: '', pinfl: '', address: '' });
    }
  }, [user, open, reset]);

  const { mutate, isPending } = useMutation({
    mutationFn: async (data: any) => {
      const isStaffRole = data.role && data.role !== 'XODIM';
      const payload = {
        ...data,
        departmentId: isStaffRole ? undefined : (data.departmentId || undefined),
        passport: data.passport?.trim() || undefined,
        pinfl: data.pinfl?.trim() || undefined,
        address: data.address?.trim() || undefined,
      };
      return isEdit ? await usersApi.update(user.id, payload) : await usersApi.create(payload);
    },
    onSuccess: () => {
      toast.success(isEdit ? t('users.updateSuccess') : t('users.createSuccess'));
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (err: any) => {
      toast.error(err?.message || err?.response?.data?.message || t('common.error'));
    },
  });
  const deptOptions = departments.map((d: any) => ({ value: d.id, label: d.name }));
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? t('users.editTitle') : t('users.addTitle')}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isPending}>{t('common.cancel')}</Button>
          <Button onClick={handleSubmit((data) => mutate(data))} loading={isPending}>
            {isEdit ? t('common.save') : t('common.add')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label={t('users.fullNameLabel')}
          placeholder={t('users.fullNamePlaceholder')}
          error={errors.fullName?.message as string}
          required
          {...register('fullName')}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label={t('users.usernameLabel')}
            placeholder={t('users.usernamePlaceholder')}
            error={errors.username?.message as string}
            required
            {...register('username')}
          />
          {!isEdit && (
            <Input
              label={t('users.passwordLabel')}
              type="password"
              placeholder="••••••"
              error={errors.password?.message as string}
              required
              {...register('password')}
            />
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select
            label={t('users.role')}
            options={[
              { value: 'ADMIN', label: t('users.roleAdmin') },
              { value: 'OMBORCHI', label: t('users.roleOmborchi') },
              { value: 'KADR', label: t('users.roleKadr') },
              { value: 'XODIM', label: t('users.roleXodim') },
            ]}
            error={errors.role?.message as string}
            required
            {...register('role', {
              onChange: (e) => {
                if (e.target.value !== 'XODIM') {
                  setValue('departmentId', '');
                }
              },
            })}
          />
          {selectedRole === 'XODIM' ? (
            <Select
              label={t('users.department')}
              options={deptOptions}
              placeholder={t('products.typePlaceholder')}
              error={errors.departmentId?.message as string}
              required
              {...register('departmentId')}
            />
          ) : (
            <div className="flex flex-col justify-end">
              <label className="text-xs font-semibold text-gray-500 mb-1.5">
                {t('users.department')}
              </label>
              <div className="px-3.5 py-2.5 rounded-xl bg-gray-100 dark:bg-slate-800 text-xs text-gray-500 font-medium border border-gray-200 dark:border-slate-700">
                Tizim boshqaruvi (Bo'lim shart emas)
              </div>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input label={t('users.phoneLabel')} placeholder={t('users.phonePlaceholder')} {...register('phone')} />
          <Input label={t('userView.internalPhone')} placeholder="Masalan: 1025" {...register('internalPhone')} />
          <Input label={t('users.position')} placeholder={t('users.positionPlaceholder')} {...register('position')} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label={t('userView.passportSeriesNo')} placeholder="AD 1234567" {...register('passport')} />
          <Input label={t('userView.pinfl')} placeholder="31508940001234" maxLength={14} {...register('pinfl')} />
        </div>
        <Input label={t('userView.address')} placeholder="Toshkent sh., Yunusobod tumani" {...register('address')} />
      </div>
    </Modal>
  );
}