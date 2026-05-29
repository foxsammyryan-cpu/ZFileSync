import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { usePairs } from "../stores/usePairs";
import { ipc } from "../lib/ipc";
import { Button } from "./ui/Button";

export function ConflictPrompts() {
  const { conflicts, clearConflict, pairs } = usePairs();

  if (conflicts.length === 0) return null;

  const pairName = (id: string | undefined | null) => {
    if (!id) return "?";
    return pairs.find((p) => p.id === id)?.name ?? String(id).slice(0, 8);
  };

  const resolve = async (pairId: string, relPath: string, choice: "keepSource" | "keepDest" | "keepBoth") => {
    await ipc.resolveConflict(pairId, relPath, choice);
    clearConflict(pairId, relPath);
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col gap-2 max-w-sm w-full">
      <AnimatePresence>
        {conflicts.map((c) => (
          <motion.div
            key={`${c.pairId}:${c.relPath}`}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="bg-surface border border-warning/40 rounded-xl p-4 shadow-xl"
          >
            <div className="flex items-start gap-2 mb-3">
              <AlertTriangle size={14} className="text-warning flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-text">Sync Conflict</p>
                <p className="text-xs text-muted mt-0.5">{pairName(c.pairId)}</p>
                <p className="text-xs font-mono text-muted/70 mt-1 break-all">{c.relPath}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => resolve(c.pairId, c.relPath, "keepSource")}>
                Keep source
              </Button>
              <Button size="sm" variant="ghost" onClick={() => resolve(c.pairId, c.relPath, "keepDest")}>
                Keep dest
              </Button>
              <Button size="sm" variant="primary" onClick={() => resolve(c.pairId, c.relPath, "keepBoth")}>
                Keep both
              </Button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
