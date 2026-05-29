import { useEffect, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { PairList } from "./components/PairList";
import { ActivityFeed } from "./components/ActivityFeed";
import { QAPanel } from "./components/QAPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { AboutPanel } from "./components/AboutPanel";
import { ConflictPrompts } from "./components/ConflictPrompt";
import { RespawnPrompts } from "./components/RespawnPrompt";
import { ErrorToasts } from "./components/ErrorToasts";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { usePairs } from "./stores/usePairs";
import { useActivity } from "./stores/useActivity";
import { useErrors } from "./stores/useErrors";
import {
  onActivity,
  onPairStatus,
  onConflictPrompt,
  onRespawnPrompt,
  onTombstoneAdded,
  onTombstoneCleared,
  onSyncError,
} from "./lib/ipc";
import type { SyncPair } from "./lib/ipc";

type Tab = "pairs" | "activity" | "qa" | "settings" | "about";

export default function App() {
  const [tab, setTab] = useState<Tab>("pairs");
  const { pairs, load: loadPairs, updateStatus, addConflict, addRespawn, clearRespawn } = usePairs();
  const { load: loadActivity, prependEvent, addTombstone, clearTombstone } = useActivity();
  const pushError = useErrors((s) => s.push);

  useEffect(() => {
    loadPairs();
    loadActivity();

    const cleanups: Promise<() => void>[] = [
      onActivity((e) => {
        prependEvent({
          id: Date.now() + Math.random(),
          pairId: e.pairId,
          kind: e.kind,
          path: e.path,
          detail: e.detail,
          ts: e.ts,
        });
      }),
      onPairStatus((e) => {
        updateStatus(e.pairId, e.status as SyncPair["status"]);
      }),
      onConflictPrompt((e) => {
        addConflict(e);
      }),
      onRespawnPrompt((e) => {
        addRespawn(e);
      }),
      onTombstoneAdded((t) => {
        addTombstone(t);
      }),
      onTombstoneCleared((e) => {
        clearTombstone(e.pairId, e.relPath);
        clearRespawn(e.pairId, e.relPath);
      }),
      onSyncError((e) => {
        pushError(e);
      }),
    ];

    return () => {
      cleanups.forEach((p) => p.then((fn) => fn()));
    };
  }, []);

  const panels: Record<Tab, React.ReactNode> = {
    pairs: <PairList />,
    activity: <ActivityFeed />,
    qa: <QAPanel />,
    settings: <SettingsPanel />,
    about: <AboutPanel />,
  };

  return (
    <div className="flex h-screen overflow-hidden bg-bg text-text app-bg">
      <Sidebar active={tab} onChange={setTab} pairs={pairs} />
      <main className="flex-1 overflow-hidden min-w-0">
        <ErrorBoundary label={tab}>{panels[tab]}</ErrorBoundary>
      </main>
      <ConflictPrompts />
      <RespawnPrompts />
      <ErrorToasts />
    </div>
  );
}
