import { create } from "zustand";
import type { SyncError } from "../lib/ipc";

interface ErrorsState {
  toasts: SyncError[];
  log: SyncError[];
  push: (e: SyncError) => void;
  dismiss: (ts: number) => void;
  clearLog: () => void;
}

export const useErrors = create<ErrorsState>((set) => ({
  toasts: [],
  log: [],
  push: (e) =>
    set((s) => ({
      toasts: [...s.toasts.slice(-4), e],
      log: [e, ...s.log].slice(0, 100),
    })),
  dismiss: (ts) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.ts !== ts) })),
  clearLog: () => set({ log: [] }),
}));
