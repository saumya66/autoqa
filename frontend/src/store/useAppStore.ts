import { create } from 'zustand';

export type AppSection = 'projects' | 'create' | 'execute';

interface AppState {
  activeSection: AppSection;
  setActiveSection: (section: AppSection) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeSection: 'projects',
  setActiveSection: (section) => set({ activeSection: section }),
}));
