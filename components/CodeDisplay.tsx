"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface CodeDisplayProps {
  code: string;
}

export default function CodeDisplay({ code }: CodeDisplayProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard API unavailable — fail silently, code is still visible.
    }
  }

  return (
    <div className="animate-fade-in flex flex-col items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/60 py-6">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        Your code
      </p>
      <p className="text-4xl font-semibold tracking-[0.22em] text-ink">
        {code}
      </p>
      <button
        type="button"
        onClick={handleCopy}
        className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-xs font-medium text-ink transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
      >
        {copied ? (
          <>
            <Check size={13} strokeWidth={2} className="text-moss-500" />
            Copied
          </>
        ) : (
          <>
            <Copy size={13} strokeWidth={1.75} />
            Copy code
          </>
        )}
      </button>
      <p className="text-xs text-muted">Share this code with the receiver</p>
    </div>
  );
}
