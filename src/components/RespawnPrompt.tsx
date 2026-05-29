import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { usePairs } from "../stores/usePairs";
import { useActivity } from "../stores/useActivity";
import { ipc } from "../lib/ipc";
import { Button } from "./ui/Button";

export function RespawnPrompts() {
  const { respawns, clearRespawn, pairs } = usePairs();
  const { clearTombstone } = useActivity();

  if (respawns.length === 0) return null;

  const pairName = (id: string | undefined | null) => {
    if (!id) return "?";
    return pairs.find((p) => p.id === id)?.name ?? String(id).slice(0, 8);
  };

  const respond = async (
    pairId: string,
    relPath: string,
    decision: "resumeOnce" | "alwaysResume" | "ignore"
  ) => {
    await ipc.respondRespawn(pairId, relPath, decision);
    clearRespawn(pairId, relPath);
    if (decision !== "ignore") {
      clearTombstone(pairId, relPath);
    }
  };

  return (
    <div className="fixed bottom-4 left-48 z-40 flex flex-col gap-2 max-w-sm w-full">
      <AnimatePresence>
        {respawns.map((r) => (
          <motion.div
            key={`${r.pairId}:${r.relPath}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="bg-surface border border-accent/30 rounded-xl p-4 shadow-xl"
          >
            <div className="flex items-start gap-2 mb-3">
              <RefreshCw size={14} className="text-accent flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-text">File Reappeared</p>
                <p className="text-xs text-muted mt-0.5">{pairName(r.pairId)}</p>
                <p className="text-xs font-mono text-muted/70 mt-1 break-all">{r.relPath}</p>
              </div>
            </div>
            <p className="text-xs text-muted mb-3">Resume syncing this file?</p>
            <div className="flex gap-1.5 flex-wrap">
              <Button size="sm" variant="ghost" onClick={() => respond(r.pairId, r.relPath, "ignore")}>
                Ignore
              </Button>
              <Button size="sm" variant="ghost" onClick={() => respond(r.pairId, r.relPath, "resumeOnce")}>
                Resume once
              </Button>
              <Button size="sm" variant="primary" onClick={() => respond(r.pairId, r.relPath, "alwaysResume")}>
                Always resume
              </Button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
