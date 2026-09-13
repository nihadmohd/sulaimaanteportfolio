"use client";

import { create } from "zustand";

/** Global UI chrome state (menus, sheets) — kept tiny and serializable. */
export interface UiState {
  mobileNavOpen: boolean;
  adminNavOpen: boolean;
  commandOpen: boolean;
  cookiePrefsOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  setAdminNavOpen: (open: boolean) => void;
  setCommandOpen: (open: boolean) => void;
  setCookiePrefsOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  mobileNavOpen: false,
  adminNavOpen: false,
  commandOpen: false,
  cookiePrefsOpen: false,
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
  setAdminNavOpen: (open) => set({ adminNavOpen: open }),
  setCommandOpen: (open) => set({ commandOpen: open }),
  setCookiePrefsOpen: (open) => set({ cookiePrefsOpen: open }),
}));
