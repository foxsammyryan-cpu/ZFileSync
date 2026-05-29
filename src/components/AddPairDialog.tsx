import { motion, AnimatePresence } from "framer-motion";
import { X, FolderOpen, FileText, Folder, ArrowRight, ArrowLeftRight } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "./ui/Button";
import { ipc, pickPath } from "../lib/ipc";
import { usePairs } from "../stores/usePairs";

const schema = z.object({
  name: z.string().min(1, "Required"),
  source: z.string().min(1, "Required"),
  destination: z.string().min(1, "Required"),
  kind: z.enum(["file", "folder"]),
  direction: z.enum(["oneWay", "twoWay"]),
  ignoreRaw: z.string(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
}

const KIND_OPTIONS = [
  {
    value: "file" as const,
    icon: <FileText size={15} />,
    label: "Single File",
    desc: "Watch one specific file — perfect for logs.",
  },
  {
    value: "folder" as const,
    icon: <Folder size={15} />,
    label: "Folder",
    desc: "Mirror an entire directory tree.",
  },
];

const DIR_OPTIONS = [
  {
    value: "oneWay" as const,
    icon: <ArrowRight size={14} />,
    label: "One-way",
    desc: "Source → Destination only. Changes to destination are ignored.",
  },
  {
    value: "twoWay" as const,
    icon: <ArrowLeftRight size={14} />,
    label: "Two-way",
    desc: "Both sides stay in sync. Conflicts are flagged for review.",
  },
];

function PathRow({
  label,
  hint,
  placeholder,
  error,
  reg,
  onPick,
}: {
  label: string;
  hint: string;
  placeholder: string;
  error?: string;
  reg: ReturnType<ReturnType<typeof useForm<FormData>>["register"]>;
  onPick: () => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <label className="text-xs font-medium text-muted">{label}</label>
        <span className="text-xs text-muted/50 font-mono">{hint}</span>
      </div>
      <div className="flex gap-1.5">
        <input
          {...reg}
          placeholder={placeholder}
          className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-text placeholder-muted/40 outline-none transition-colors focus:border-accent/50 font-mono"
        />
        <button
          type="button"
          onClick={onPick}
          className="flex items-center gap-1 px-2.5 py-2 rounded-lg border border-border bg-surface-2 text-muted hover:text-accent hover:border-accent/40 transition-colors cursor-pointer text-xs"
        >
          <FolderOpen size={13} />
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

export function AddPairDialog({ open, onClose }: Props) {
  const { addPair } = usePairs();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { kind: "folder", direction: "oneWay", ignoreRaw: "" },
  });

  const kind = watch("kind");
  const direction = watch("direction");

  const onSubmit = async (data: FormData) => {
    setError(null);
    const ignore =
      kind === "folder"
        ? data.ignoreRaw.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
    try {
      const pair = await ipc.addPair({
        name: data.name,
        source: data.source,
        destination: data.destination,
        kind: data.kind,
        direction: data.direction,
        ignore,
      });
      addPair(pair);
      onClose();
    } catch (e: any) {
      setError(String(e));
    }
  };

  const pickSource = async () => {
    const p = await pickPath(kind);
    if (p) setValue("source", p, { shouldValidate: true });
  };

  const pickDest = async () => {
    const p = await pickPath(kind);
    if (p) setValue("destination", p, { shouldValidate: true });
  };

  const srcPlaceholder =
    kind === "file" ? "/home/user/MyGame/game.log" : "/home/user/MyGame/logs/";
  const dstPlaceholder =
    kind === "file"
      ? "/home/user/workspace/mirrored-game.log"
      : "/home/user/workspace/logs/";
  const srcHint =
    kind === "file" ? "exact path to the file" : "root folder to watch";
  const dstHint =
    kind === "file" ? "exact path of the copy" : "root folder to mirror into";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-4 px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="fixed inset-0 bg-bg/80 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            className="relative z-10 w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto"
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
          >

            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h2 className="text-sm font-semibold text-text">New Sync Pair</h2>
                <p className="text-xs text-muted mt-0.5">
                  Link two paths — changes replicate automatically.
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-1 text-muted hover:text-text rounded-lg transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col min-h-0">
              <div className="px-5 py-4 flex flex-col gap-4 overflow-y-auto">


                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted">Pair name</label>
                  <input
                    {...register("name")}
                    placeholder="Game Logs"
                    autoFocus
                    className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder-muted/40 outline-none transition-colors focus:border-accent/50"
                  />
                  {errors.name && (
                    <p className="text-xs text-danger">{errors.name.message}</p>
                  )}
                </div>


                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted">What to sync</label>
                  <div className="grid grid-cols-2 gap-2">
                    {KIND_OPTIONS.map((opt) => {
                      const active = kind === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setValue("kind", opt.value)}
                          className={`flex flex-col gap-1 px-3 py-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            active
                              ? "border-accent/60 bg-accent/8 text-text"
                              : "border-border bg-surface-2 text-muted hover:border-border/80 hover:text-text"
                          }`}
                        >
                          <span className={active ? "text-accent" : ""}>{opt.icon}</span>
                          <span className="text-xs font-semibold">{opt.label}</span>
                          <span className="text-xs text-muted/70 leading-snug">{opt.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>


                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted">Sync direction</label>
                  <div className="grid grid-cols-2 gap-2">
                    {DIR_OPTIONS.map((opt) => {
                      const active = direction === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setValue("direction", opt.value)}
                          className={`flex flex-col gap-1 px-3 py-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            active
                              ? "border-accent/60 bg-accent/8 text-text"
                              : "border-border bg-surface-2 text-muted hover:border-border/80 hover:text-text"
                          }`}
                        >
                          <span className={active ? "text-accent" : ""}>{opt.icon}</span>
                          <span className="text-xs font-semibold">{opt.label}</span>
                          <span className="text-xs text-muted/70 leading-snug">{opt.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>


                <div className="flex flex-col gap-3">
                  <PathRow
                    label="Source"
                    hint={srcHint}
                    placeholder={srcPlaceholder}
                    error={errors.source?.message}
                    reg={register("source")}
                    onPick={pickSource}
                  />
                  <PathRow
                    label="Destination"
                    hint={dstHint}
                    placeholder={dstPlaceholder}
                    error={errors.destination?.message}
                    reg={register("destination")}
                    onPick={pickDest}
                  />
                </div>


                <AnimatePresence>
                  {kind === "folder" && (
                    <motion.div
                      key="ignore"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-baseline justify-between">
                          <label className="text-xs font-medium text-muted">
                            Ignore patterns
                          </label>
                          <span className="text-xs text-muted/50">
                            comma-separated globs
                          </span>
                        </div>
                        <input
                          {...register("ignoreRaw")}
                          placeholder="build/, *.cache, dist/"
                          className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-text placeholder-muted/40 outline-none transition-colors focus:border-accent/50 font-mono"
                        />
                        <p className="text-xs text-muted/50">
                          Always excluded: node_modules, .git, *.tmp, *.swp
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {error && (
                  <p className="text-xs text-danger bg-danger/10 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}
              </div>


              <div className="flex justify-end gap-2 px-5 py-3 border-t border-border bg-surface-2/50">
                <Button type="button" variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={isSubmitting}>
                  {isSubmitting ? "Adding…" : "Add Pair"}
                </Button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
