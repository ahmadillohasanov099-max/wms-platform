import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./sidebar";
import Topbar from "./topbar";
import { useTranslation } from "../../hooks/useTranslation";
import { useAuthStore } from "../../store/auth.store";
import { socketService } from "../../lib/socket";
import Modal from "../ui/modal";
import Button from "../ui/button";
import { LogOut, AlertTriangle } from "lucide-react";
import { useUiStore } from "../../store/ui.store";

import MobileBottomNav from "./mobile-bottom-nav";

export default function AppLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();
  const { theme } = useUiStore();
  const [terminatedModal, setTerminatedModal] = useState<string | null>(null);

  const key = pathname.slice(1);
  const title = t(`menu.${key}`);

  useEffect(() => {
    if (user?.id) {
      const socket = socketService.connect();
      socketService.joinUserRoom(user.id);

      const onTerminated = (evt: any) => {
        setTerminatedModal(evt?.message || "Sizning shartnomangiz bekor qilindi va tizimdan chiqarildingiz.");
      };

      socket.on("account:terminated", onTerminated);

      return () => {
        socket.off("account:terminated", onTerminated);
      };
    }
  }, [user?.id]);

  const handleTerminatedLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex h-screen overflow-hidden relative bg-gray-50 dark:bg-slate-950">
      {}
      {theme === 'dark' && (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none z-0"
          style={{ backgroundImage: "url('/back-img.png')" }}
        />
      )}
      {}
      <div className="hidden dark:block absolute inset-0 bg-slate-950/40 pointer-events-none z-0" />

      {}
      <Sidebar />

      {}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden relative z-10">
        {}
        <Topbar title={title} />

        {}
        <main className="flex-1 overflow-y-auto p-3 sm:p-5 pb-20 md:pb-5 min-w-0 relative z-10">
          <Outlet />
        </main>
      </div>

      {}
      <MobileBottomNav />

      {}
      {terminatedModal && (
        <Modal
          open={!!terminatedModal}
          onClose={handleTerminatedLogout}
          title=""
          size="sm"
          footer={
            <Button
              variant="danger"
              className="w-full justify-center gap-2"
              onClick={handleTerminatedLogout}
            >
              <LogOut className="w-4 h-4" />
              Tizimdan chiqish
            </Button>
          }
        >
          <div className="flex flex-col items-center text-center gap-4 py-3">
            <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400">
              <AlertTriangle className="w-7 h-7 animate-bounce" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Ishdan bo'shatilish yakunlandi
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                {terminatedModal}
              </p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
