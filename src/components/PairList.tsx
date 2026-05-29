import { AnimatePresence, motion } from "framer-motion";
import { Plus, FolderSync } from "lucide-react";
import { useState } from "react";
import { usePairs } from "../stores/usePairs";
import { PairCard } from "./PairCard";
import { AddPairDialog } from "./AddPairDialog";
import { Button } from "./ui/Button";
import { SkeletonPairCard } from "./Skeleton";

export function PairList() {
  const { pairs, loading } = usePairs();
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <h2 className="text-sm font-semibold text-text">Sync Pairs</h2>
          <p className="text-xs text-muted mt-0.5">
            {pairs.length === 0
              ? "No pairs configured."
              : `${pairs.length} pair${pairs.length === 1 ? "" : "s"} watching`}
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowAdd(true)}>
          <Plus size={13} /> New pair
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5">
        {loading && (
          <>
            <SkeletonPairCard />
            <SkeletonPairCard />
            <SkeletonPairCard />
          </>
        )}
        <AnimatePresence mode="popLayout">
          {pairs.map((pair) => (
            <PairCard key={pair.id} pair={pair} />
          ))}
        </AnimatePresence>
        {!loading && pairs.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center gap-4"
          >
            <div className="p-4 rounded-2xl bg-surface border border-border">
              <FolderSync size={28} className="text-accent" />
            </div>
            <div>
              <p className="text-sm font-medium text-text">No sync pairs yet</p>
              <p className="text-xs text-muted mt-1 max-w-xs">
                Add a pair to mirror a file or folder in real time.
              </p>
            </div>
            <Button variant="primary" size="sm" onClick={() => setShowAdd(true)}>
              <Plus size={13} /> Add your first pair
            </Button>
          </motion.div>
        )}
      </div>

      <AddPairDialog open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  );
}
