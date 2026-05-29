import { useEffect, useState } from "react";
import { ipc, type AppSettings } from "../lib/ipc";
import { Switch } from "./ui/Switch";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";

export function SettingsPanel() {
  const [settings, setSettings] = useState<AppSettings>({ autostart: false, defaultIgnores: [] });
  const [ignoreRaw, setIgnoreRaw] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    ipc.getSettings().then((s) => {
      setSettings(s);
      setIgnoreRaw(s.defaultIgnores.join(", "));
    });
  }, []);

  const save = async () => {
    const s: AppSettings = {
      ...settings,
      defaultIgnores: ignoreRaw.split(",").map((x) => x.trim()).filter(Boolean),
    };
    await ipc.setSettings(s);
    setSettings(s);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-xs font-mono font-semibold text-muted uppercase tracking-widest">Settings</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">General</h3>
          <div className="bg-surface border border-border rounded-lg p-3 flex flex-col gap-3">
            <Switch
              checked={settings.autostart}
              onChange={(v) => setSettings((s) => ({ ...s, autostart: v }))}
              label="Launch on system startup"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">Default Ignore Patterns</h3>
          <div className="bg-surface border border-border rounded-lg p-3">
            <Input
              label="Patterns (comma-separated)"
              value={ignoreRaw}
              onChange={(e) => setIgnoreRaw(e.target.value)}
              placeholder="*.tmp, .cache, build"
            />
            <p className="text-xs text-muted/60 mt-2">
              Applied in addition to built-in defaults: node_modules, .git, *.swp, *.lock
            </p>
          </div>
        </div>

        <Button variant="primary" size="md" onClick={save} className="self-start">
          {saved ? "Saved ✓" : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
