"use client";

import { useCallback, useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { cx } from "@/lib/utils";

interface FileDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

export default function FileDropzone({
  onFilesSelected,
  disabled,
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      onFilesSelected(Array.from(fileList));
    },
    [onFilesSelected]
  );

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (!disabled) handleFiles(e.dataTransfer.files);
      }}
      className={cx(
        "flex min-h-[245px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-10 text-center transition-all duration-200 cursor-pointer select-none",
        isDragging
          ? "border-rose-400 bg-rose-50/60"
          : "border-rose-200 bg-white hover:border-rose-300 hover:bg-rose-50/30",
        disabled && "pointer-events-none opacity-50"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div
        className={cx(
          "flex h-12 w-12 items-center justify-center rounded-full transition-colors",
          isDragging ? "bg-rose-100" : "bg-white"
        )}
      >
        <UploadCloud
          size={23}
          strokeWidth={1.5}
          className={isDragging ? "text-rose-600" : "text-rose-400"}
        />
      </div>
      <div>
        <p className="text-[15px] font-medium text-ink">
          {isDragging ? "Drop to add files" : "Drop files here"}
        </p>
        <p className="text-sm text-muted mt-0.5">or click to browse</p>
      </div>
    </div>
  );
}
