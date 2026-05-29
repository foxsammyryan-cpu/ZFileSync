import { motion, AnimatePresence } from "framer-motion";
import { Copy, Trash2, AlertTriangle, RefreshCw, AlertOctagon, Check } from "lucide-react";
import { useActivity } from "../stores/useActivity";
import { usePairs } from "../stores/usePairs";
import { useErrors } from "../stores/useErrors";
import { SkeletonActivityRow } from "./Skeleton";

function relTime(ts: number) {
  if (!Number.isFinite(ts) || ts <= 0) return "—";
  const diff = Date.now() - ts;
  if (diff < 0) return "now";
  if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))}s`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return new Date(ts).toLocaleDateString();
}

const kindConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  copied:   { icon: <Copy size={11} />,         color: "text-accent",   label: "copied"   },
  deleted:  { icon: <Trash2 size={11} />,       color: "text-danger",   label: "deleted"  },
  conflict: { icon: <AlertTriangle size={11} />, color: "text-warning", label: "conflict" },
  respawn:  { icon: <RefreshCw size={11} />,    color: "text-accent",   label: "respawn"  },
  resolved: { icon: <Check size={11} />,        color: "text-muted",    label: "resolved" },
  error:    { icon: <AlertOctagon size={11} />, color: "text-danger",   label: "error"    },
};

export function ActivityFeed() {
  const { events, tombstones, loading } = useActivity();
  const { pairs } = usePairs();
  const errorLog = useErrors((s) => s.log);
  const clearLog = useErrors((s) => s.clearLog);

  const pairName = (id: string | undefined | null) => {
    if (!id) return "?";
    return pairs.find((p) => p.id === id)?.name ?? String(id).slice(0, 8);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b border-border">
        <h2 className="text-sm font-semibold text-text">Activity</h2>
        <p className="text-xs text-muted mt-0.5">
          {events.length} event{events.length === 1 ? "" : "s"} ·{" "}
          {tombstones.length} tombstone{tombstones.length === 1 ? "" : "s"}
          {errorLog.length > 0 ? ` · ${errorLog.length} error${errorLog.length === 1 ? "" : "s"}` : ""}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">

        {tombstones.length > 0 && (
          <Section title="Deleted files">
            <AnimatePresence>
              {tombstones.map((t) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-danger/8 border border-danger/20"
                >
                  <Trash2 size={11} className="text-danger flex-shrink-0" />
                  <span className="font-mono text-xs text-text truncate flex-1">
                    {t.relPath || "(file)"}
                  </span>
                  <span className="text-xs text-muted font-mono">{pairName(t.pairId)}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </Section>
        )}


        {errorLog.length > 0 && (
          <Section
            title="Errors"
            action={
              <button
                onClick={clearLog}
                className="text-xs text-muted hover:text-text transition-colors cursor-pointer"
              >
                Clear
              </button>
            }
          >
            {errorLog.slice(0, 20).map((e, i) => (
              <div
                key={`${e.ts}-${i}`}
                className="flex items-start gap-2 px-3 py-2 rounded-lg bg-danger/8 border border-danger/20"
              >
                <AlertOctagon size={11} className="text-danger flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-medium text-danger">{e.op}</span>
                    <span className="text-xs text-muted font-mono">{pairName(e.pairId)}</span>
                  </div>
                  <p className="text-xs text-text/90 mt-0.5 break-words leading-snug">{e.message}</p>
                  <p className="text-xs text-muted/70 mt-0.5 font-mono truncate" title={e.path}>
                    {e.path}
                  </p>
                </div>
              </div>
            ))}
          </Section>
        )}


        <Section title="Recent activity">
          {loading ? (
            <>
              <SkeletonActivityRow />
              <SkeletonActivityRow />
              <SkeletonActivityRow />
              <SkeletonActivityRow />
            </>
          ) : events.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted">
              Quiet so far — sync events will appear here.
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {events.map((ev) => {
                const cfg = kindConfig[ev.kind] ?? {
                  icon: <Copy size={11} />,
                  color: "text-muted",
                  label: ev.kind,
                };
                return (
                  <motion.div
                    key={ev.id}
                    initial={{ opacity: 0, y: -3 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2.5 px-3 py-1.5 rounded-md hover:bg-surface-2 transition-colors group"
                  >
                    <span className={`flex-shrink-0 ${cfg.color}`}>{cfg.icon}</span>
                    <span className={`text-xs font-medium w-16 flex-shrink-0 ${cfg.color}`}>
                      {cfg.label}
                    </span>
                    <span
                      className="font-mono text-xs text-text/80 truncate flex-1"
                      title={ev.path}
                    >
                      {ev.path || "(root)"}
                    </span>
                    <span className="text-xs text-muted/70 flex-shrink-0 font-mono">
                      {pairName(ev.pairId)}
                    </span>
                    <span className="text-xs text-muted/50 flex-shrink-0 font-mono w-8 text-right">
                      {relTime(ev.ts)}
                    </span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-mono uppercase tracking-widest text-muted">{title}</p>
        {action}
      </div>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}
