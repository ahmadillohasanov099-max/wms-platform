import Card, { CardHeader, CardContent } from '../../../components/ui/card';
import { User, AtSign, Building2, Briefcase, Phone, PhoneCall, ShieldCheck, MapPin, BadgeCheck } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';

interface Props {
  profileUser: any;
}

export default function ProfilePersonalInfoCard({ profileUser }: Props) {
  const { t } = useTranslation();

  const passportVal = profileUser?.passport || profileUser?.passportSeries || '—';
  const pinflVal = profileUser?.pinfl || '—';
  const addressVal = profileUser?.address || '—';

  const infoFields = [
    { label: t('profile.fullName'), value: profileUser?.fullName, icon: <User className="w-4 h-4" /> },
    { label: t('profile.username'), value: `@${profileUser?.username}`, icon: <AtSign className="w-4 h-4" /> },
    { label: t('profile.department'), value: profileUser?.department?.name ?? '—', icon: <Building2 className="w-4 h-4" /> },
    { label: t('profile.position'), value: profileUser?.position ?? '—', icon: <Briefcase className="w-4 h-4" /> },
    { label: t('profile.phone'), value: profileUser?.phone ?? '—', icon: <Phone className="w-4 h-4" /> },
    { label: t('profile.internalPhone'), value: profileUser?.internalPhone ?? '—', icon: <PhoneCall className="w-4 h-4" /> },
    { label: t('profile.passport'), value: passportVal, icon: <BadgeCheck className="w-4 h-4" /> },
    { label: t('profile.pinfl'), value: pinflVal, icon: <ShieldCheck className="w-4 h-4" /> },
    { label: t('profile.address'), value: addressVal, icon: <MapPin className="w-4 h-4" />, fullWidth: true },
  ];

  return (
    <Card className="rounded-2xl border-gray-200/90 dark:border-white/15 shadow-2xs overflow-hidden">
      <CardHeader
        title={
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <span className="font-bold text-slate-900 dark:text-white">{t('profile.personalInfo')}</span>
          </div>
        }
        className="border-b border-gray-100 dark:border-slate-800/60 pb-3.5"
      />
      <CardContent className="p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {infoFields.map((item, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-3 p-3 rounded-xl bg-gray-50/60 dark:bg-slate-800/40 border border-gray-100 dark:border-slate-800 hover:border-teal-300 dark:hover:border-teal-700/60 transition-all ${
                item.fullWidth ? 'sm:col-span-2' : ''
              }`}
            >
              <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0 border border-teal-200/60 dark:border-teal-800/50">
                {item.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">{item.label}</p>
                <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
