import type { InputHTMLAttributes } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = "", ...rest }: Props) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs text-muted">{label}</label>}
      <input
        className={`rounded border border-border bg-surface-2 px-3 py-1.5 text-sm text-text placeholder-muted/50 outline-none transition-colors focus:border-accent/60 ${className}`}
        {...rest}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
