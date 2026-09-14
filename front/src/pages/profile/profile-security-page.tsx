import { PageLoader } from '../../components/ui/spinner';
import PageHeader from '../../components/ui/page-header';
import { useAuthStore } from '../../store/auth.store';
import { useTranslation } from '../../hooks/useTranslation';
import Card, { CardHeader, CardContent } from '../../components/ui/card';
import { ShieldCheck, KeyRound, CheckCircle2, ShieldAlert, Laptop } from 'lucide-react';

import ProfileSecurityCard from './components/profile-security-card';

export default function ProfileSecurityPage() {
  const { user } = useAuthStore();
  const { t } = useTranslation();

  if (!user) return <PageLoader />;

  return (
    <div className="space-y-6 max-w-6xl pb-10">
      <PageHeader
        title={t('menu.profileSecurity')}
        subtitle={t('profile.securityPageSubtitle')}
      />

      {/* Security Hero Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-teal-600/10 via-teal-500/5 to-transparent border border-gray-200/90 dark:border-white/15 backdrop-blur-xl shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-md shrink-0 border border-teal-500/20">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {t('profile.securityBannerTitle')}
                </h2>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-teal-100 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 border border-teal-300/60 dark:border-teal-800">
                  {t('profile.protected')}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                {t('profile.securityPageDesc')}
              </p>
            </div>
          </div>

          {/* Stats pills */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="bg-white/80 dark:bg-slate-900/80 px-3.5 py-2.5 rounded-xl border border-gray-200/90 dark:border-white/15 shadow-2xs flex items-center gap-2.5">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-lg">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">
                  {t('profile.accountStatus')}
                </p>
                <p className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                  {t('profile.activeProtected')}
                </p>
              </div>
            </div>

            <div className="bg-white/80 dark:bg-slate-900/80 px-3.5 py-2.5 rounded-xl border border-gray-200/90 dark:border-white/15 shadow-2xs flex items-center gap-2.5">
              <div className="p-2 bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 rounded-lg">
                <KeyRound className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">
                  {t('profile.authType')}
                </p>
                <p className="text-xs font-extrabold text-slate-900 dark:text-white">
                  {t('profile.byPassword')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Password change card */}
        <div className="lg:col-span-2">
          <ProfileSecurityCard />
        </div>

        {/* Right Column: Security Recommendations */}
        <div className="space-y-6">
          <Card className="rounded-2xl border-gray-200/90 dark:border-white/15 shadow-2xs overflow-hidden">
            <CardHeader
              title={
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-amber-500" />
                  <span className="font-bold text-slate-900 dark:text-white">{t('profile.securityRules')}</span>
                </div>
              }
              className="border-b border-gray-100 dark:border-slate-800/60 pb-3.5"
            />
            <CardContent className="p-5 space-y-3.5 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                <p>{t('profile.ruleStrongPass')}</p>
              </div>

              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                <p>{t('profile.ruleConfidential')}</p>
              </div>

              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                <p>{t('profile.ruleLogout')}</p>
              </div>

              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                <p>{t('profile.ruleSuspicious')}</p>
              </div>

              <div className="pt-3 border-t border-gray-100 dark:border-slate-800">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400">
                    <Laptop className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase font-bold text-gray-400">{t('profile.activeSession')}</p>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                      @{user.username} ({user.role})
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
