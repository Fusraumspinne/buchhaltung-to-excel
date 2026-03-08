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
}

export function AlertModal({ 
  isOpen, 
  title, 
  message, 
  onClose, 
  onConfirm,
  confirmLabel = "Verstanden",
  cancelLabel = "Abbrechen"
}: AlertModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
          <div className="text-slate-600 leading-relaxed whitespace-pre-line text-sm">{message}</div>
        </div>
        <div className="bg-slate-50 p-4 flex justify-end gap-3">
          {onConfirm && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              {cancelLabel}
            </button>
          )}
          <button
            onClick={() => {
              if (onConfirm) onConfirm();
              onClose();
            }}
            className="px-6 py-2 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 cursor-pointer"
          >
            {onConfirm ? confirmLabel : "Verstanden"}
          </button>
        </div>
      </div>
    </div>
  );
}
