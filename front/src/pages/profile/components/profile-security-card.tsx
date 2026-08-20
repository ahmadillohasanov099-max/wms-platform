import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { authApi } from '../../../api';
import Card, { CardHeader, CardContent } from '../../../components/ui/card';
import Input from '../../../components/ui/input';
import Button from '../../../components/ui/button';
import { useTranslation } from '../../../hooks/useTranslation';
import { KeyRound, ShieldCheck, Lock, CheckCircle2, Eye, EyeOff } from 'lucide-react';

export default function ProfileSecurityCard() {
  const { t } = useTranslation();
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const passwordSchema = z.object({
    currentPassword: z.string().min(1, t('profile.validationCurrentPassword')),
    newPassword: z.string().min(6, t('profile.validationNewPassword')),
    confirmPassword: z.string().min(1, t('profile.validationConfirmPassword')),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: t('profile.validationMatch'),
    path: ['confirmPassword'],
  });

  type PasswordFormData = z.infer<typeof passwordSchema>;

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  const { mutate: changePassword, isPending } = useMutation({
    mutationFn: (data: PasswordFormData) => authApi.changePassword({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    }),
    onSuccess: () => {
      toast.success(t('profile.passwordChanged'));
      reset();
      setShowPasswordForm(false);
    },
    onError: (err: any) => {
      toast.error(err?.message || t('common.error'));
    },
  });

  return (
    <Card className="rounded-2xl border-gray-200/90 dark:border-white/15 shadow-2xs overflow-hidden">
      <CardHeader
        title={
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <span className="font-bold">{t('profile.security')}</span>
          </div>
        }
        className="border-b border-gray-100 dark:border-slate-800/60 pb-3.5"
      />
      <CardContent className="p-4 sm:p-6 space-y-4">
        {/* Security Info Banner */}
        <div className="p-3.5 rounded-xl bg-teal-50/60 dark:bg-teal-950/40 border border-teal-200/70 dark:border-teal-900/60 flex items-start gap-3">
          <div className="p-2 rounded-lg bg-teal-500 text-white shrink-0 mt-0.5">
            <Lock className="w-4 h-4" />
          </div>
          <div className="text-xs space-y-1">
            <h4 className="font-bold text-gray-900 dark:text-white">
              {t('profile.securityInfoTitle')}
            </h4>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              {t('profile.securityInfoDesc')}
            </p>
          </div>
        </div>

        {!showPasswordForm ? (
          <Button
            variant="outline"
            className="w-full justify-center gap-2 rounded-xl py-3 border-gray-300 dark:border-slate-700 hover:border-teal-500 hover:bg-teal-50/40 dark:hover:bg-teal-950/30 text-teal-600 dark:text-teal-400 font-bold transition-all duration-300 cursor-pointer"
            onClick={() => setShowPasswordForm(true)}
          >
            <KeyRound className="w-4 h-4" />
            <span>{t('profile.changePassword')}</span>
          </Button>
        ) : (
          <form
            onSubmit={handleSubmit((data) => changePassword(data))}
            className="space-y-4 pt-1"
          >
            <div className="relative">
              <Input
                label={t('profile.currentPassword')}
                type={showCurrent ? 'text' : 'password'}
                error={errors.currentPassword?.message}
                required
                {...register('currentPassword')}
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-9 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="relative">
              <Input
                label={t('profile.newPassword')}
                type={showNew ? 'text' : 'password'}
                error={errors.newPassword?.message}
                required
                {...register('newPassword')}
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-9 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="relative">
              <Input
                label={t('profile.confirmNewPassword')}
                type={showConfirm ? 'text' : 'password'}
                error={errors.confirmPassword?.message}
                required
                {...register('confirmPassword')}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-9 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 justify-center rounded-xl py-2.5 font-bold cursor-pointer"
                onClick={() => {
                  setShowPasswordForm(false);
                  reset();
                }}
                disabled={isPending}
              >
                {t('profile.cancel')}
              </Button>
              <Button type="submit" className="flex-1 justify-center rounded-xl py-2.5 font-bold cursor-pointer" loading={isPending}>
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                {t('profile.save')}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
