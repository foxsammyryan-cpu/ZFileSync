import { ArrowLeftRight, History, Settings, Beaker, Info } from "lucide-react";
import type { SyncPair } from "../lib/ipc";

type Tab = "pairs" | "activity" | "qa" | "settings" | "about";

interface Props {
  active: Tab;
  onChange: (t: Tab) => void;
  pairs: SyncPair[];
}

export function Sidebar({ active, onChange, pairs }: Props) {
  const syncing = pairs.filter((p) => p.status === "syncing").length;
  const errored = pairs.filter((p) => p.status === "error").length;
  const paused = pairs.filter((p) => p.status === "paused").length;

  const items: { id: Tab; icon: React.ReactNode; label: string; badge?: number }[] = [
    { id: "pairs", icon: <ArrowLeftRight size={15} />, label: "Pairs", badge: pairs.length },
    { id: "activity", icon: <History size={15} />, label: "Activity" },
    { id: "qa", icon: <Beaker size={15} />, label: "QA Tester" },
    { id: "settings", icon: <Settings size={15} />, label: "Settings" },
    { id: "about", icon: <Info size={15} />, label: "About" },
  ];

  return (
    <aside className="flex flex-col w-52 border-r border-border bg-surface/40 backdrop-blur-sm flex-shrink-0">

      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <img src="/icon.png" alt="ZFileSync" className="w-7 h-7 rounded-md flex-shrink-0" />
          <h1 className="text-sm font-mono font-bold tracking-wider text-text">
            ZFileSync
          </h1>
        </div>
        <p className="text-xs text-muted mt-2 leading-snug">
          Real-time mirror for files & folders.
        </p>
      </div>


      <nav className="flex flex-col gap-0.5 p-2 flex-1">
        {items.map((item) => {
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className={`group relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left w-full cursor-pointer ${
                isActive
                  ? "bg-accent/10 text-accent"
                  : "text-muted hover:text-text hover:bg-surface-2"
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-accent rounded-r" />
              )}
              <span className="flex-shrink-0">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className={`text-xs font-mono px-1.5 rounded ${isActive ? "bg-accent/20 text-accent" : "bg-surface-2 text-muted"}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>


      <div className="px-3 py-3 border-t border-border space-y-1.5">
        <StatusRow label="Syncing" count={syncing} color="accent" />
        <StatusRow label="Paused" count={paused} color="muted" />
        <StatusRow label="Errors" count={errored} color="danger" />
      </div>
    </aside>
  );
}

function StatusRow({ label, count, color }: { label: string; count: number; color: "accent" | "muted" | "danger" }) {
  const dot = color === "accent" ? "bg-accent" : color === "danger" ? "bg-danger" : "bg-muted/50";
  const text = color === "accent" ? "text-accent" : color === "danger" ? "text-danger" : "text-muted";
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="flex items-center gap-1.5 text-muted">
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
        {label}
      </span>
      <span className={`font-mono ${count > 0 ? text : "text-muted/50"}`}>{count}</span>
    </div>
  );
}
