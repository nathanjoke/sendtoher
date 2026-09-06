"use client";

import { File, X, Download } from "lucide-react";
import { formatBytes } from "@/lib/utils";
import type { TransferFile } from "@/types/transfer";

interface FileListProps {
  files: TransferFile[];
  onRemove?: (id: string) => void;
  onDownload?: (id: string) => void;
  variant?: "sender" | "receiver";
}

export default function FileList({
  files,
  onRemove,
  onDownload,
  variant = "sender",
}: FileListProps) {
  if (files.length === 0) return null;

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <div className="animate-fade-in">
      <div className="flex items-baseline justify-between px-1 mb-2">
        <p className="text-sm font-medium text-ink">
          {files.length} {files.length === 1 ? "file" : "files"}
        </p>
        <p className="text-sm text-muted">{formatBytes(totalSize)} total</p>
      </div>

      <ul className="thin-scroll flex max-h-56 flex-col gap-1.5 overflow-y-auto pr-1">
        {files.map((f) => (
          <li
            key={f.id}
            className="flex items-center gap-3 rounded-xl border border-line bg-white px-3 py-2.5"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-50">
              <File size={15} strokeWidth={1.5} className="text-rose-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">
                {f.name}
              </p>
              {typeof f.progress === "number" && f.progress < 100 ? (
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-line">
                  <div
                    className="h-full rounded-full bg-rose-500 transition-all duration-150"
                    style={{ width: `${f.progress}%` }}
                  />
                </div>
              ) : (
                <p className="text-xs text-muted">{formatBytes(f.size)}</p>
              )}
            </div>

            {variant === "sender" && onRemove && (
              <button
                type="button"
                onClick={() => onRemove(f.id)}
                aria-label={`Remove ${f.name}`}
                className="shrink-0 rounded-full p-1.5 text-muted transition-colors hover:bg-paper hover:text-ink"
              >
                <X size={15} strokeWidth={1.75} />
              </button>
            )}

            {variant === "receiver" && onDownload && (
              <button
                type="button"
                onClick={() => onDownload(f.id)}
                aria-label={`Download ${f.name}`}
                className="shrink-0 rounded-full p-1.5 text-muted transition-colors hover:bg-paper hover:text-rose-600"
              >
                <Download size={15} strokeWidth={1.75} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
