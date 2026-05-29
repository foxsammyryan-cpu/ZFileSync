import { create } from "zustand";
import { ipc, type DbEvent, type DbTombstone } from "../lib/ipc";

interface ActivityState {
  events: DbEvent[];
  tombstones: DbTombstone[];
  loading: boolean;
  load: () => Promise<void>;
  prependEvent: (e: DbEvent) => void;
  addTombstone: (t: DbTombstone) => void;
  clearTombstone: (pairId: string, relPath: string) => void;
}

export const useActivity = create<ActivityState>((set) => ({
  events: [],
  tombstones: [],
  loading: false,

  load: async () => {
    set({ loading: true });
    try {
      const [events, tombstones] = await Promise.all([
        ipc.getActivity(150, 0),
        ipc.getTombstones(),
      ]);
      set({ events, tombstones });
    } finally {
      set({ loading: false });
    }
  },

  prependEvent: (e) =>
    set((s) => ({ events: [e, ...s.events].slice(0, 500) })),

  addTombstone: (t) =>
    set((s) => ({ tombstones: [t, ...s.tombstones] })),

  clearTombstone: (pairId, relPath) =>
    set((s) => ({
      tombstones: s.tombstones.filter(
        (t) => !(t.pairId === pairId && t.relPath === relPath)
      ),
    })),
}));
