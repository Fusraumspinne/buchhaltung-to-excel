"use client";

import React from "react";

interface AlertModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onClose: () => void;
  onConfirm?: () => void;
  onCancel?: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  previousLabel?: string;
  nextLabel?: string;
  closeOnConfirm?: boolean;
  compactActions?: boolean;
}

export function AlertModal({ 
  isOpen, 
  title, 
  message, 
  onClose, 
  onConfirm,
  onCancel,
  onPrevious,
  onNext,
  previousLabel = "←",
  nextLabel = "→",
  confirmLabel = "Verstanden",
  cancelLabel = "Abbrechen",
  closeOnConfirm = true,
  compactActions = false,
}: AlertModalProps) {
  if (!isOpen) return null;

  const hasNavigation = Boolean(onPrevious || onNext);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="p-4 sm:p-6">
          <h3 className="mb-2 text-lg font-bold text-slate-900 sm:text-xl">{title}</h3>
          <div className="text-slate-600 leading-relaxed whitespace-pre-line text-sm">{message}</div>
        </div>
        <div
          className={
            hasNavigation
              ? "flex items-center justify-between bg-slate-50 p-4"
              : "flex flex-col-reverse gap-2 bg-slate-50 p-4 sm:flex-row sm:justify-end sm:gap-3"
          }
        >
          {hasNavigation ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onPrevious?.()}
                className="h-8 w-8 rounded-md border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 cursor-pointer"
                aria-label="Vorherige Hilfeseite"
              >
                {previousLabel}
              </button>
              <button
                onClick={() => onNext?.()}
                className="h-8 w-8 rounded-md border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 cursor-pointer"
                aria-label="Nächste Hilfeseite"
              >
                {nextLabel}
              </button>
            </div>
          ) : null}

          <div className={hasNavigation ? "flex items-center gap-2" : "flex flex-col-reverse gap-2 sm:flex-row sm:gap-3"}>
            {onConfirm && (
              <button
                onClick={() => {
                  if (onCancel) {
                    onCancel();
                    return;
                  }
                  onClose();
                }}
                className={
                  compactActions
                    ? "h-8 w-8 rounded-md border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 cursor-pointer"
                    : "w-full rounded-lg px-4 py-2 font-medium text-slate-600 transition-colors hover:bg-slate-100 cursor-pointer sm:w-auto"
                }
              >
                {cancelLabel}
              </button>
            )}
            <button
              onClick={() => {
                if (onConfirm) onConfirm();
                if (closeOnConfirm) onClose();
              }}
              className={
                compactActions
                  ? "h-8 w-8 rounded-md bg-slate-900 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 cursor-pointer"
                  : "w-full rounded-lg bg-slate-900 px-6 py-2 font-medium text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 cursor-pointer sm:w-auto"
              }
            >
              {onConfirm ? confirmLabel : "Verstanden"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
