import Card, { CardHeader, CardContent } from '../../../components/ui/card';
import { User, AtSign, Building2, Briefcase, Phone, PhoneCall, ShieldCheck, MapPin } from 'lucide-react';
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
    { label: 'Ichki raqami', value: profileUser?.internalPhone ?? '—', icon: <PhoneCall className="w-4 h-4" /> },
    { label: 'Pasport seriyasi va №', value: passportVal ?? '—', icon: <ShieldCheck className="w-4 h-4" /> },
    { label: 'JSHSHIR', value: pinflVal ?? '—', icon: <ShieldCheck className="w-4 h-4" /> },
    { label: 'Yashash / Registratsiya manzili', value: addressVal ?? '—', icon: <MapPin className="w-4 h-4" /> },
  ];

  return (
    <Card className="rounded-2xl border-gray-200/90 dark:border-white/15 shadow-2xs">
      <CardHeader
        title={t('profile.personalInfo')}
        className="border-b border-gray-100 dark:border-slate-800/60 pb-3"
      />
      <CardContent className="p-4 space-y-3">
        {infoFields.map((item, idx) => (
          <div key={idx} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center flex-shrink-0 border border-teal-200/50 dark:border-teal-800/40">
              {item.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-gray-500 dark:text-gray-400">{item.label}</p>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{item.value}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
