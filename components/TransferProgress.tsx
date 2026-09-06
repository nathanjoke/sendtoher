"use client";

interface TransferProgressProps {
  label: string;
  percent: number;
}

export default function TransferProgress({
  label,
  percent,
}: TransferProgressProps) {
  const clamped = Math.min(100, Math.max(0, percent));

  return (
    <div className="animate-fade-in">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="text-sm tabular-nums text-muted">{clamped}%</p>
      </div>
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 w-full overflow-hidden rounded-full bg-line"
      >
        <div
          className="h-full rounded-full bg-rose-400 transition-all duration-200 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
