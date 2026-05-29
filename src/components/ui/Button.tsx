import { motion } from "framer-motion";
import type { ButtonHTMLAttributes } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "danger";
  size?: "sm" | "md";
}

export function Button({ variant = "ghost", size = "md", className = "", children, ...rest }: Props) {
  const base =
    "inline-flex items-center gap-1.5 rounded font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed select-none";
  const variants = {
    primary: "bg-accent text-bg hover:bg-accent-dim",
    ghost: "text-muted hover:text-text hover:bg-surface-2",
    danger: "text-danger hover:bg-danger/10",
  };
  const sizes = { sm: "px-2 py-0.5 text-xs", md: "px-3 py-1.5 text-sm" };
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...(rest as any)}
    >
      {children}
    </motion.button>
  );
}
