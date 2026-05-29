import { openUrl } from "@tauri-apps/plugin-opener";
import { ExternalLink, GitFork, Globe, Code2, Zap, Shield, Info } from "lucide-react";

async function open(url: string) {
  await openUrl(url);
}

function LinkButton({
  href,
  icon,
  label,
  sublabel,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
}) {
  return (
    <button
      onClick={() => open(href)}
      className="group flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-surface/60 hover:bg-surface hover:border-accent/40 transition-all cursor-pointer text-left w-full"
    >
      <span className="text-muted group-hover:text-accent transition-colors flex-shrink-0">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-text">{label}</p>
        {sublabel && (
          <p className="text-xs text-muted font-mono truncate">{sublabel}</p>
        )}
      </div>
      <ExternalLink size={12} className="text-muted/40 group-hover:text-accent/60 transition-colors flex-shrink-0" />
    </button>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <span className="px-2.5 py-1 rounded-md bg-surface-2 border border-border text-xs font-mono text-muted">
      {label}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-xs font-mono uppercase tracking-widest text-muted px-1">{title}</p>
      {children}
    </div>
  );
}

export function AboutPanel() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <Info size={14} className="text-muted" />
        <h2 className="text-sm font-semibold text-text">About</h2>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col gap-6">


        <div className="flex items-center gap-4">
          <img
            src="/icon.png"
            alt="ZFileSync"
            className="w-16 h-16 rounded-2xl flex-shrink-0 shadow-lg"
          />
          <div>
            <h1 className="text-xl font-mono font-bold text-text tracking-wide">ZFileSync</h1>
            <p className="text-xs text-muted mt-0.5">v0.1.0 · GPL-3.0</p>
            <p className="text-sm text-text/70 mt-1.5 leading-snug max-w-xs">
              Real-time file &amp; folder mirroring for Linux and Windows.
              Zero cloud, zero latency — just your files, instantly synced.
            </p>
          </div>
        </div>


        <Section title="Built with">
          <div className="flex flex-wrap gap-1.5">
            <Chip label="Tauri v2" />
            <Chip label="Rust" />
            <Chip label="React 19" />
            <Chip label="TypeScript" />
            <Chip label="notify" />
            <Chip label="SQLite" />
            <Chip label="blake3" />
            <Chip label="walkdir" />
            <Chip label="Tailwind CSS v4" />
            <Chip label="framer-motion" />
            <Chip label="zustand" />
          </div>
        </Section>


        <Section title="Project">
          <LinkButton
            href="https://zsync.eu/zfilesync/"
            icon={<Globe size={15} />}
            label="Download &amp; landing page"
            sublabel="zsync.eu/zfilesync/"
          />
          <LinkButton
            href="https://github.com/TheHolyOneZ/ZFileSync"
            icon={<GitFork size={15} />}
            label="Source code"
            sublabel="github.com/TheHolyOneZ/ZFileSync"
          />
        </Section>


        <Section title="Developer">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-surface/60">
            <div className="w-9 h-9 rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0">
              <span className="text-accent font-mono font-bold text-sm">Z</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-text">TheHolyOneZ</p>
              <p className="text-xs text-muted">Developer &amp; maintainer</p>
            </div>
          </div>
          <LinkButton
            href="https://zsync.eu"
            icon={<Code2 size={15} />}
            label="More projects"
            sublabel="zsync.eu"
          />
          <LinkButton
            href="https://github.com/TheHolyOneZ"
            icon={<GitFork size={15} />}
            label="GitHub profile"
            sublabel="github.com/TheHolyOneZ"
          />
        </Section>


        <Section title="License">
          <button
            onClick={() => open("https://www.gnu.org/licenses/gpl-3.0.html")}
            className="group flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-surface/60 hover:bg-surface hover:border-accent/40 transition-all cursor-pointer text-left w-full"
          >
            <Shield size={15} className="text-muted group-hover:text-accent transition-colors flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-text">GNU General Public License v3.0</p>
              <p className="text-xs text-muted">Free and open-source software</p>
            </div>
            <ExternalLink size={12} className="text-muted/40 group-hover:text-accent/60 transition-colors flex-shrink-0" />
          </button>
        </Section>


        <Section title="Features">
          <div className="grid grid-cols-2 gap-1.5">
            {[
              "One-way file sync",
              "Two-way file sync",
              "One-way folder sync",
              "Two-way folder sync",
              "Conflict resolution",
              "Tombstone tracking",
              "Respawn detection",
              "Ignore patterns",
              "SQLite event log",
              "System tray",
              "Autostart",
              "Live activity feed",
            ].map((f) => (
              <div key={f} className="flex items-center gap-2 text-xs text-muted">
                <Zap size={10} className="text-accent flex-shrink-0" />
                {f}
              </div>
            ))}
          </div>
        </Section>

      </div>
    </div>
  );
}
