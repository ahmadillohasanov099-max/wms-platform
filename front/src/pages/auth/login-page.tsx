import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Lock, User, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/auth.store";
import { useUiStore } from "../../store/ui.store";
import { authApi } from "../../api";
import Button from "../../components/ui/button";
import { useTranslation } from "../../hooks/useTranslation";
import { cn, getDefaultRouteForRole } from "../../lib/utils";

export default function LoginPage() {
  const { t } = useTranslation();
  const { language, setLanguage } = useUiStore();
  const [showPassword, setShowPassword] = useState(false);
  const [lockedUsername, setLockedUsername] = useState<string | null>(() => {
    try {
      return localStorage.getItem("auth_lockout_username") || null;
    } catch {
      return null;
    }
  });

  const [lockoutSeconds, setLockoutSeconds] = useState<number | null>(() => {
    try {
      const savedUntil = localStorage.getItem("auth_lockout_until");
      if (savedUntil) {
        const diff = Math.ceil((Number(savedUntil) - Date.now()) / 1000);
        return diff > 0 ? diff : null;
      }
    } catch {}
    return null;
  });

  useEffect(() => {
    if (lockoutSeconds === null || lockoutSeconds <= 0) return;

    const interval = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev === null || prev <= 1) {
          localStorage.removeItem("auth_lockout_until");
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  const formatCountdown = (totalSecs: number) => {
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isLocked = Boolean(lockoutSeconds && lockoutSeconds > 0);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const schema = z.object({
    username: z.string().min(1, t("login.usernameRequired")),
    password: z.string().min(6, t("login.passwordLength")),
  });

  type FormData = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    getValues,
    reset,
    clearErrors,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  // Admin tizimdan blokdan chiqarsa, timer darhol to'xtaydi va xatolar 0 holatiga qaytadi
  useEffect(() => {
    if (!isLocked || !lockedUsername) return;

    let isMounted = true;
    const checkServerStatus = async () => {
      try {
        const res = await authApi.checkLockoutStatus(lockedUsername);
        const data = res?.data || res;
        if (isMounted && data && !data.isLocked) {
          setLockoutSeconds(null);
          setLockedUsername(null);
          localStorage.removeItem("auth_lockout_until");
          localStorage.removeItem("auth_lockout_username");
          clearErrors();
          toast.success(t("login.adminUnlockedNotice", {}, "Hisobingiz administrator tomonidan blokdan chiqarildi. Tizimga kirishingiz mumkin."), {
            duration: 6000,
            icon: "🔓",
            style: {
              maxWidth: "460px",
              padding: "14px 18px",
              lineHeight: "1.5",
              fontSize: "13.5px",
              fontWeight: 500,
              borderRadius: "14px",
            },
          });
        }
      } catch {}
    };

    checkServerStatus();
    const interval = setInterval(checkServerStatus, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isLocked, lockedUsername, clearErrors]);

  const { mutate: login, isPending } = useMutation({
    mutationFn: authApi.login,
    onSuccess: (res: any) => {
      const { accessToken, refreshToken, user } = res.data;
      setAuth(user, accessToken, refreshToken);
      toast.success(t("login.welcome", { name: user.fullName }));
      navigate(getDefaultRouteForRole(user.role));
    },    onError: (err: any) => {
      const serverMessage =
        err?.message ||
        err?.response?.data?.message ||
        t("login.invalidCredentials");

      const remainingSecs =
        err?.remainingSeconds ||
        err?.response?.data?.remainingSeconds ||
        (err?.lockedUntil ? Math.ceil((new Date(err.lockedUntil).getTime() - Date.now()) / 1000) : null) ||
        (err?.response?.data?.lockedUntil ? Math.ceil((new Date(err.response.data.lockedUntil).getTime() - Date.now()) / 1000) : null);

      const errorCode = err?.errorCode || err?.response?.data?.errorCode;
      const remainingAttempts = err?.remainingAttempts ?? err?.response?.data?.remainingAttempts;
      const remainingMinutes =
        err?.remainingMinutes ||
        err?.response?.data?.remainingMinutes ||
        (remainingSecs ? Math.max(1, Math.ceil(remainingSecs / 60)) : 1);

      if (remainingSecs && remainingSecs > 0) {
        const attemptedUsername = getValues("username") || "";
        setLockoutSeconds(remainingSecs);
        setLockedUsername(attemptedUsername);
        localStorage.setItem("auth_lockout_until", String(Date.now() + remainingSecs * 1000));
        if (attemptedUsername) {
          localStorage.setItem("auth_lockout_username", attemptedUsername);
        }
      }

      // Dynamic localization for security messages
      let displayMessage = typeof serverMessage === "string" ? serverMessage : t("login.invalidCredentials");
      if (errorCode === "LOGIN_FAILED_ATTEMPTS" && remainingAttempts !== undefined) {
        displayMessage = t("login.failedAttemptsNotice", { count: remainingAttempts }, displayMessage);
      } else if (errorCode === "LOGIN_WARN_LAST_ATTEMPT") {
        displayMessage = t("login.warnLastAttempt", {}, displayMessage);
      } else if (errorCode === "LOGIN_LOCKED_15M") {
        displayMessage = t("login.locked15mNotice", {}, displayMessage);
      } else if (errorCode === "LOGIN_LOCKED_1H") {
        displayMessage = t("login.locked1hNotice", {}, displayMessage);
      } else if (errorCode === "LOGIN_CURRENTLY_LOCKED") {
        displayMessage = t("login.currentlyLockedNotice", { minutes: remainingMinutes }, displayMessage);
      } else {
        if (displayMessage.includes("15 daqiqa") && (displayMessage.includes("ketma-ket") || displayMessage.includes("3 marta"))) {
          displayMessage = t("login.locked15mNotice", {}, displayMessage);
        } else if (displayMessage.includes("1 soat")) {
          displayMessage = t("login.locked1hNotice", {}, displayMessage);
        } else if (displayMessage.includes("Yana 1 ta") || displayMessage.includes("1 ta xato")) {
          displayMessage = t("login.warnLastAttempt", {}, displayMessage);
        } else if (displayMessage.includes("tiklanishiga") && remainingMinutes) {
          displayMessage = t("login.currentlyLockedNotice", { minutes: remainingMinutes }, displayMessage);
        }
      }

      const isSecurityNotice =
        Boolean(remainingSecs) ||
        Boolean(errorCode) ||
        displayMessage.includes("urinish") ||
        displayMessage.includes("blok") ||
        displayMessage.includes("xavfsizlik") ||
        displayMessage.includes("попыт") ||
        displayMessage.includes("блок") ||
        displayMessage.includes("attempt") ||
        displayMessage.includes("locked");

      toast.error(displayMessage, {
        duration: isSecurityNotice ? 8500 : 4000,
        style: {
          maxWidth: "480px",
          padding: "14px 18px",
          lineHeight: "1.5",
          fontSize: "13.5px",
          fontWeight: 500,
          borderRadius: "14px",
        },
      });
    },
  });

  const onSubmit = (data: FormData) => {
    login(data);
  };

  const languages = [
    { code: "uz", name: "O'zbek", flag: "🇺🇿" },
    { code: "ru", name: "Русский", flag: "🇷🇺" },
    { code: "en", name: "English", flag: "🇬🇧" },
  ] as const;

  const currentLang = languages.find((l) => l.code === language) || languages[0];

  return (
    <div
      className="w-full min-h-screen flex flex-col items-center justify-center p-4 relative bg-cover bg-center bg-no-repeat overflow-hidden"
      style={{ backgroundImage: "url('/back-img.jpg')" }}
    >
      {}
      <div className="absolute inset-0 bg-slate-950/40 pointer-events-none z-0" />

      {}
      <div className="absolute top-4 right-4 z-20">
        <button
          onClick={() => setLangDropdownOpen(!langDropdownOpen)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl transition-all border border-white/30 text-sm font-bold text-white bg-transparent backdrop-blur-md shadow-lg",
            "hover:bg-white/10 hover:border-white/50"
          )}
        >
          <span>{currentLang.flag}</span>
          <span className="uppercase tracking-wider">{currentLang.code}</span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-300" />
        </button>

        {langDropdownOpen && (
          <div className="absolute right-0 mt-2 w-36 bg-slate-950/90 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden py-1 z-30">
            {languages.map((l) => (
              <button
                key={l.code}
                onClick={() => {
                  setLanguage(l.code);
                  setLangDropdownOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-sm transition-colors",
                  l.code === language
                    ? "text-white font-bold bg-white/20"
                    : "text-slate-300 hover:bg-slate-800"
                )}
              >
                <span>{l.flag}</span>
                <span>{l.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="w-full max-w-sm relative z-10 space-y-6">
        {}
        <div className="flex flex-col items-center justify-center my-3 relative">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              rotateY: [0, 360],
              y: [0, -6, 0],
            }}
            transition={{
              rotateY: { duration: 12, repeat: Infinity, ease: "linear" },
              y: { duration: 3.5, repeat: Infinity, ease: "easeInOut" },
              opacity: { duration: 0.5 }
            }}
            className="relative flex items-center justify-center [perspective:1000px]"
          >
            {}
            <div className="absolute -inset-4 rounded-full bg-white/10 blur-xl pointer-events-none opacity-40" />

            <img
              src="/vaz-logo.png"
              alt="Vazirlik Logotipi"
              className="relative z-10 h-28 w-28 object-contain drop-shadow-[0_10px_25px_rgba(0,0,0,0.6)] transition-all duration-300 hover:scale-105"
              onError={(e: any) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const placeholder = document.getElementById('vaz-logo-placeholder');
                if (placeholder) placeholder.style.display = 'flex';
              }}
            />

            <div
              id="vaz-logo-placeholder"
              className="hidden relative z-10 w-28 h-28 bg-slate-900/80 backdrop-blur-xl border border-white/20 rounded-3xl flex flex-col items-center justify-center text-white shadow-2xl p-2 text-center"
            >
              <div className="w-10 h-10 rounded-2xl bg-white text-slate-950 flex items-center justify-center mb-1 shadow-lg border border-white/40">
                <span className="text-base font-black">🏛️</span>
              </div>
              <span className="text-xs font-bold text-white tracking-wide">Vaz-Logo</span>
              <span className="text-[10px] text-slate-400 mt-0.5 font-mono">public/vaz-logo</span>
            </div>
          </motion.div>
        </div>

        {}
        <div className="bg-transparent backdrop-blur-[10px] rounded-3xl border border-white/20 shadow-[0_25px_60px_rgba(0,0,0,0.5)] p-7 sm:p-8">
          <h2 className="text-sm font-extrabold text-white mb-5 tracking-widest uppercase text-center border-b border-white/15 pb-3">
            {t("login.formTitle")}
          </h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                {t("login.usernameLabel")}
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  placeholder="username"
                  disabled={isLocked || isPending}
                  className={cn(
                    "w-full rounded-xl border bg-transparent backdrop-blur-sm text-sm text-white font-extrabold border-white/30 placeholder:text-slate-300 pl-10 pr-4 py-2.5 transition-all shadow-inner focus:outline-none focus:ring-1 focus:ring-white focus:border-white",
                    isLocked && "opacity-50 cursor-not-allowed bg-slate-900/40",
                    errors.username && "border-rose-500 focus:ring-rose-500/40"
                  )}
                  {...register("username")}
                />
              </div>
              {errors.username && (
                <p className="text-xs text-rose-400 font-bold">{errors.username.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                {t("login.passwordLabel")}
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••"
                  disabled={isLocked || isPending}
                  className={cn(
                    "w-full rounded-xl border bg-transparent backdrop-blur-sm text-sm text-white font-extrabold border-white/30 placeholder:text-slate-300 pl-10 pr-10 py-2.5 transition-all shadow-inner focus:outline-none focus:ring-1 focus:ring-white focus:border-white",
                    isLocked && "opacity-50 cursor-not-allowed bg-slate-900/40",
                    errors.password && "border-rose-500 focus:ring-rose-500/40"
                  )}
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => !isLocked && setShowPassword(!showPassword)}
                  disabled={isLocked}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-white transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-rose-400 font-bold">
                  {errors.password.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isLocked || isPending}
              className={cn(
                "w-full mt-3 rounded-xl py-3.5 text-sm font-black bg-gradient-to-r from-slate-100 to-white hover:from-white hover:to-slate-100 text-slate-950 shadow-xl shadow-white/10 active:scale-[0.98] transition-all duration-200 border-none",
                isLocked && "opacity-40 cursor-not-allowed pointer-events-none"
              )}
              loading={isPending}
              size="md"
            >
              {t("login.button")}
            </Button>
            {isLocked && lockoutSeconds !== null && (
              <div className="flex flex-col items-center gap-1.5 mt-2.5">
                <p className="text-xs text-red-400 font-semibold text-center tracking-wide">
                  {t(
                    "login.lockoutCountdown",
                    { time: formatCountdown(lockoutSeconds) },
                    `Parol ko‘p marotaba xato kiritildi. ${formatCountdown(lockoutSeconds)} dan keyin qayta urinib ko'ring`
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setLockoutSeconds(null);
                    setLockedUsername(null);
                    localStorage.removeItem("auth_lockout_until");
                    localStorage.removeItem("auth_lockout_username");
                    clearErrors();
                    reset();
                  }}
                  className="text-[11px] text-slate-300 hover:text-white underline underline-offset-2 transition-colors cursor-pointer"
                >
                  {t("login.switchAccount", {}, "Boshqa login bilan kirish")}
                </button>
              </div>
            )}
          </form>
        </div>

        {}
        <p className="text-center text-xs font-bold text-slate-200 drop-shadow-md tracking-wider">
          {t("login.footer")}
        </p>
      </div>
    </div>
  );
}
