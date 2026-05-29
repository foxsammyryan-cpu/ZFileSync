import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  ArrowLeftRight,
  Pause,
  Play,
  Trash2,
  MoreVertical,
  File as FileIcon,
  Folder as FolderIcon,
  AlertOctagon,
} from "lucide-react";
import { useState } from "react";
import type { SyncPair } from "../lib/ipc";
import { ipc } from "../lib/ipc";
import { usePairs } from "../stores/usePairs";
import { useErrors } from "../stores/useErrors";

const statusConfig = {
  idle:     { label: "idle",     color: "muted",   pulse: false },
  syncing:  { label: "live",     color: "accent",  pulse: true  },
  paused:   { label: "paused",   color: "muted",   pulse: false },
  conflict: { label: "conflict", color: "warning", pulse: true  },
  missing:  { label: "missing",  color: "danger",  pulse: false },
  error:    { label: "error",    color: "danger",  pulse: true  },
} as const;

function shortPath(p: string, max = 34) {
  if (p.length <= max) return p;
  const parts = p.replace(/\\/g, "/").split("/");
  const file = parts.pop() ?? "";
  const result = "…/" + file;
  return result.length <= max ? result : "…" + file.slice(-(max - 1));
}

interface Props {
  pair: SyncPair;
}

export function PairCard({ pair }: Props) {
  const { removePair, updateStatus } = usePairs();
  const [menuOpen, setMenuOpen] = useState(false);
  const cfg = statusConfig[pair.status] ?? statusConfig.idle;

  const lastError = useErrors((s) =>
    s.log.find((e) => e.pairId === pair.id)
  );

  const handlePause = async () => {
    await ipc.pausePair(pair.id);
    updateStatus(pair.id, "paused");
  };

  const handleResume = async () => {
    await ipc.resumePair(pair.id);
    updateStatus(pair.id, "syncing");
  };

  const handleDelete = async () => {
    await ipc.removePair(pair.id);
    removePair(pair.id);
    setMenuOpen(false);
  };

  const dotColor =
    cfg.color === "accent"
      ? "bg-accent shadow-[0_0_8px] shadow-accent/60"
      : cfg.color === "warning"
      ? "bg-warning shadow-[0_0_8px] shadow-warning/60"
      : cfg.color === "danger"
      ? "bg-danger shadow-[0_0_8px] shadow-danger/60"
      : "bg-muted/40";

  const badgeBg =
    cfg.color === "accent"
      ? "bg-accent/12 text-accent border-accent/20"
      : cfg.color === "warning"
      ? "bg-warning/12 text-warning border-warning/20"
      : cfg.color === "danger"
      ? "bg-danger/12 text-danger border-danger/20"
      : "bg-surface-2 text-muted border-border";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.2 }}
      className="group relative rounded-xl border border-border bg-surface/60 hover:border-border-2 hover:bg-surface transition-colors overflow-visible"
    >
      <div className="p-3.5 flex flex-col gap-2.5">

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">

            <span className="relative flex-shrink-0 w-2.5 h-2.5">
              <span className={`absolute inset-0 rounded-full ${dotColor}`} />
              {cfg.pulse && (
                <motion.span
                  className={`absolute inset-0 rounded-full ${
                    cfg.color === "accent"
                      ? "bg-accent"
                      : cfg.color === "warning"
                      ? "bg-warning"
                      : "bg-danger"
                  }`}
                  animate={{ scale: [1, 2.4], opacity: [0.45, 0] }}
                  transition={{ repeat: Infinity, duration: 1.4, ease: "easeOut" }}
                />
              )}
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-text truncate leading-tight">
                {pair.name}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs text-muted flex items-center gap-1">
                  {pair.kind === "file" ? <FileIcon size={10} /> : <FolderIcon size={10} />}
                  {pair.kind}
                </span>
                <span className="text-muted/30">·</span>
                <span className="text-xs text-muted flex items-center gap-1">
                  {pair.direction === "twoWay" ? <ArrowLeftRight size={10} /> : <ArrowRight size={10} />}
                  {pair.direction === "twoWay" ? "two-way" : "one-way"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <span className={`text-xs font-mono px-1.5 py-0.5 rounded border ${badgeBg}`}>
              {cfg.label}
            </span>
            {pair.status === "paused" ? (
              <button
                onClick={handleResume}
                title="Resume"
                className="p-1.5 text-muted hover:text-accent rounded-md hover:bg-surface-2 transition-colors cursor-pointer"
              >
                <Play size={13} />
              </button>
            ) : (
              <button
                onClick={handlePause}
                title="Pause"
                className="p-1.5 text-muted hover:text-text rounded-md hover:bg-surface-2 transition-colors cursor-pointer"
              >
                <Pause size={13} />
              </button>
            )}
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-1.5 text-muted hover:text-text rounded-md hover:bg-surface-2 transition-colors cursor-pointer"
              >
                <MoreVertical size={13} />
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -4 }}
                      transition={{ duration: 0.1 }}
                      className="absolute right-0 top-8 z-20 bg-surface border border-border rounded-lg shadow-2xl min-w-36 py-1"
                    >
                      <button
                        onClick={handleDelete}
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                      >
                        <Trash2 size={12} /> Remove pair
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>


        <div className="flex items-center gap-2 px-2.5 py-2 rounded-md bg-bg/40 border border-border/60">
          <span
            className="font-mono text-xs text-muted truncate flex-1 text-right"
            title={pair.source}
          >
            {shortPath(pair.source)}
          </span>
          <span className="flex-shrink-0 text-muted/60">
            {pair.direction === "twoWay" ? <ArrowLeftRight size={11} /> : <ArrowRight size={11} />}
          </span>
          <span
            className="font-mono text-xs text-muted truncate flex-1"
            title={pair.destination}
          >
            {shortPath(pair.destination)}
          </span>
        </div>


        {pair.status === "error" && lastError && (
          <div className="flex items-start gap-2 px-2.5 py-1.5 rounded-md bg-danger/8 border border-danger/20">
            <AlertOctagon size={12} className="text-danger flex-shrink-0 mt-0.5" />
            <p className="text-xs text-danger/90 leading-snug break-words">
              {lastError.message}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
