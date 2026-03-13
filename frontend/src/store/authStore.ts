import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  /** True when user chose "Skip & Use Locally" - no projects, Create opens by default */
  skipped: boolean;
  setAuth: (token: string, user: AuthUser) => void;
  setSkipped: () => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      skipped: false,
      setAuth: (token, user) => set({ token, user, skipped: false }),
      setSkipped: () => set({ token: null, user: null, skipped: true }),
      clearAuth: () => set({ token: null, user: null, skipped: false }),
    }),
    {
      name: 'autoqa-auth',
      partialize: (state) => ({ token: state.token, user: state.user, skipped: state.skipped }),
    }
  )
);

