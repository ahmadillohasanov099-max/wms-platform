import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';
interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  updateUser: (user: User) => void;
  logout: () => void;
  isMinistryUser: () => boolean;
  isSubOrgUser: () => boolean;
  canDirectDelete: () => boolean;
}
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      setAuth: (user, accessToken, refreshToken) => {
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        set({ user, accessToken, refreshToken, isAuthenticated: true });
      },
      updateUser: (user) => set({ user }),
      logout: () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      },
      isMinistryUser: () => {
        const role = get().user?.role;
        return role === 'SUPER_ADMIN' || role === 'VAZIRLIK_OMBORCHI';
      },
      isSubOrgUser: () => {
        const role = get().user?.role;
        return role === 'ORG_ADMIN' || role === 'ORG_OMBORCHI';
      },
      canDirectDelete: () => {
        const role = get().user?.role;
        return role === 'SUPER_ADMIN' || role === 'ADMIN';
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);