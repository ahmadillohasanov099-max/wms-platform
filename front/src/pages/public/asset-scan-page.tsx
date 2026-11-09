import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ShieldCheck,
  Building2,
  User,
  Phone,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  ExternalLink,
  Loader2,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';
import { inventoryApi } from '../../api';
import { useAuthStore } from '../../store/auth.store';

export default function AssetScanPage() {
  const { inventoryNumber } = useParams<{ inventoryNumber: string }>();
  const { isAuthenticated } = useAuthStore();
  const [copied, setCopied] = useState(false);

  const {
    data: asset,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['public-asset-passport', inventoryNumber],
    queryFn: () => inventoryApi.getPublicAssetPassport(inventoryNumber || ''),
    enabled: Boolean(inventoryNumber),
    retry: 1,
  });

  const handleCopy = () => {
    if (asset?.inventoryNumber) {
      navigator.clipboard.writeText(asset.inventoryNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Ishchi holatda (Faol)
          </span>
        );
      case 'BROKEN':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="w-3.5 h-3.5" />
            Taʼmirtalab (Buzilgan)
          </span>
        );
      case 'WRITTEN_OFF':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
            <Clock className="w-3.5 h-3.5" />
            Hisobdan chiqarilgan
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex flex-col items-center justify-start py-8 px-4 sm:px-6">
      {/* BRAND & STATE HEADER */}
      <div className="w-full max-w-lg mb-6 flex flex-col items-center text-center">
        <div className="w-16 h-16 sm:w-20 sm:h-20 mb-3 drop-shadow-sm flex items-center justify-center">
          <img
            src="/Emblem_of_Uzbekistan.svg"
            alt="Davlat Gerbi"
            className="w-full h-full object-contain"
          />
        </div>
        <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400">
          O‘zbekiston Respublikasi
        </span>
        <h1 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
          {asset?.organization?.name || "Qurilish va uy-joy kommunal xo'jaligi vazirligi"}
        </h1>
        <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300">
          <ShieldCheck className="w-3 h-3 text-emerald-500" />
          Yagona Moddiy Aktivlar Davlat Reyestri
        </div>
      </div>

      {/* MAIN PASSPORT CARD */}
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600 dark:text-emerald-400" />
            <p className="text-sm font-medium text-slate-500">Jihoz pasporti yuklanmoqda...</p>
          </div>
        ) : isError || !asset ? (
          <div className="py-16 px-6 text-center flex flex-col items-center">
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 text-rose-500 rounded-2xl mb-3">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              Jihoz topilmadi
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-6">
              «{inventoryNumber}» inventar raqamli jihoz tizimda mavjud emas yoki o‘chirilgan.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:opacity-90 transition-all shadow-md"
            >
              Tizimga kirish
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          <div>
            {/* HERO BADGE */}
            <div className="p-6 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex flex-col items-center text-center">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Inventar raqami
                </span>
                {getStatusBadge(asset.status)}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
                  {asset.inventoryNumber}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  title="Nusxa olish"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>

              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-2">
                {asset.product?.name}
              </h2>
              {asset.product?.year && (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Ishlab chiqarilgan yili: {asset.product.year}
                </span>
              )}
            </div>

            {/* DETAILS LIST */}
            <div className="p-6 space-y-4 text-sm divide-y divide-slate-100 dark:divide-slate-800">
              {/* JAVOBGAR SHAXS VA BO'LIM */}
              <div className="pt-2 first:pt-0">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  Biriktirilgan masʼul
                </span>
                {asset.isAssigned && asset.assignedTo ? (
                  <div className="flex items-start gap-3 bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5 rounded-2xl border border-emerald-100 dark:border-emerald-900/40">
                    <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                      <User className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-slate-900 dark:text-white">
                        {asset.assignedTo.user?.fullName || 'Bo‘lim balansida'}
                      </h4>
                      {asset.assignedTo.user?.position && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {asset.assignedTo.user.position}
                        </p>
                      )}
                      <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mt-1 flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5" />
                        {asset.assignedTo.department?.name || 'Tashkilot bo‘limi'}
                      </p>
                      {asset.assignedTo.user?.phone && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5" />
                          {asset.assignedTo.user.phone}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-xs font-medium flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    Hozirda hech kimga biriktirilmagan (Ombor zaxirasida mavjud)
                  </div>
                )}
              </div>

              {/* SERIAL NUMBER & TEHNIK SPECS */}
              <div className="pt-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  Texnik identifikatsiya
                </span>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 font-semibold block">Seriya raqami</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">
                      {asset.serialNumber || 'Mavjud emas'}
                    </span>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 font-semibold block">Boshlang‘ich narxi</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                      {asset.purchasePrice
                        ? `${Math.round(asset.purchasePrice).toLocaleString()} so‘m`
                        : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* TASHKILOT REKVIZITLARI */}
              <div className="pt-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  Tashkilot (Balans saqlovchi)
                </span>
                <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                  <p className="font-bold text-slate-900 dark:text-white">
                    {asset.organization?.name}
                  </p>
                  {asset.organization?.address && (
                    <p className="text-slate-500 dark:text-slate-400">
                      {asset.organization.address}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* ACTION FOOTER */}
            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-[11px] text-slate-400 text-center sm:text-left">
                * Ushbu maʼlumotlar WMS davlat bazasi bilan real-vaqtda sinxronlangan.
              </span>

              {isAuthenticated ? (
                <Link
                  to={`/assigned-assets`}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs"
                >
                  Tizimda boshqarish
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              ) : (
                <Link
                  to="/login"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:opacity-90 transition-all shadow-xs"
                >
                  Xodim sifatida kirish
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <footer className="mt-8 text-center text-[11px] text-slate-400">
        © 2026 WMS Davlat Ombor Boshqaruv Platformasi. Barcha huquqlar himoyalangan.
      </footer>
    </div>
  );
}
