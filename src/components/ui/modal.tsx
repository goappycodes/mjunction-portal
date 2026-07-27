'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

/**
 * Lightweight accessible modal. Closes on backdrop click and Escape, locks body
 * scroll while open, and animates in (see `.modal-*` keyframes in globals.css).
 * Bottom-sheet on mobile, centered dialog on ≥sm. Stops click propagation so it
 * can live inside a clickable table row without triggering row navigation.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="modal-overlay absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="modal-panel relative z-10 w-full max-h-[90vh] overflow-y-auto rounded-t-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl sm:w-full sm:max-w-md sm:rounded-2xl">
        <header className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-[var(--muted)] transition-colors hover:bg-[var(--muted-surface)] hover:text-[var(--foreground)]"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
