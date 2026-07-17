import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UiState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (value: boolean) => void;

  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (value: boolean) => void;

  activePatient: { name: string; patient_name: string } | null;
  setActivePatient: (patient: { name: string; patient_name: string } | null) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
      setSidebarCollapsed: (value) => set({ sidebarCollapsed: value }),

      commandPaletteOpen: false,
      setCommandPaletteOpen: (value) => set({ commandPaletteOpen: value }),

      activePatient: null,
      setActivePatient: (patient) => set({ activePatient: patient }),
    }),
    { name: "health-c-ui", partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed }) }
  )
);
