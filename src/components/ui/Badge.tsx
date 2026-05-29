interface Props {
  color?: "accent" | "warning" | "danger" | "muted";
  children: React.ReactNode;
}

export function Badge({ color = "muted", children }: Props) {
  const colors = {
    accent: "bg-accent/15 text-accent",
    warning: "bg-warning/15 text-warning",
    danger: "bg-danger/15 text-danger",
    muted: "bg-surface-2 text-muted",
  };
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-mono font-medium ${colors[color]}`}>
      {children}
    </span>
  );
}
