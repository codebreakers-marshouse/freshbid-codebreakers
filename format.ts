export const money = (n: number | null | undefined) =>
  `$${Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function timeLeft(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "closed";
  const h = Math.floor(ms / 3.6e6);
  const m = Math.floor((ms % 3.6e6) / 6e4);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function hoursUntil(iso: string): number {
  return Math.max(0, (new Date(iso).getTime() - Date.now()) / 3.6e6);
}

export const STATUS_STYLES: Record<string, string> = {
  open: "bg-success/15 text-success",
  closing: "bg-warning/20 text-warning-foreground",
  awarded: "bg-primary/15 text-primary",
  completed: "bg-muted text-muted-foreground",
  failed: "bg-destructive/15 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
  draft: "bg-muted text-muted-foreground",
};
