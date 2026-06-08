"use client";

import { useEffect, useState } from "react";
import {
  DatabaseBackup,
  Download,
  Loader2,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { BackupSummary } from "@/lib/types";

interface BackupModalProps {
  isOpen: boolean;
  backups: BackupSummary[];
  isLoading: boolean;
  isCreating: boolean;
  restoringBackupId: string | null;
  deletingBackupId: string | null;
  error: string;
  onClose: () => void;
  onCreate: (label: string) => void;
  onDownload: (backupId: string) => void;
  onRestore: (backupId: string) => void;
  onDelete: (backupId: string) => void;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function BackupModal({
  isOpen,
  backups,
  isLoading,
  isCreating,
  restoringBackupId,
  deletingBackupId,
  error,
  onClose,
  onCreate,
  onDownload,
  onRestore,
  onDelete,
}: BackupModalProps) {
  const [label, setLabel] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setLabel("");
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreate = () => {
    onCreate(label);
    setLabel("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[100dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-lg border border-slate-200 bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-lg">
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <div className="flex items-center gap-2">
            <DatabaseBackup className="h-4 w-4 text-blue-500" />
            <h3 className="text-sm font-bold text-slate-900">JSON-Backups</h3>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
              {backups.length}/25
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 transition-colors hover:text-slate-600 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-slate-100 bg-slate-50/60 p-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Label optional"
              className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-slate-400"
            />
            <button
              type="button"
              onClick={handleCreate}
              disabled={isCreating || isLoading}
              className="flex items-center justify-center gap-2 rounded bg-slate-900 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-white transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer sm:py-2"
            >
              {isCreating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <DatabaseBackup className="h-3.5 w-3.5" />
              )}
              Erstellen
            </button>
          </div>
          {error && (
            <div className="mt-3 rounded border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-xs font-bold uppercase tracking-wider text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Lädt
            </div>
          ) : backups.length === 0 ? (
            <div className="rounded border border-dashed border-slate-200 py-10 text-center text-xs text-slate-400">
              Noch keine Backups vorhanden.
            </div>
          ) : (
            <div className="space-y-2">
              {backups.map((backup) => {
                const isRestoring = restoringBackupId === backup.id;
                const isDeleting = deletingBackupId === backup.id;

                return (
                  <div
                    key={backup.id}
                    className="flex min-w-0 flex-col gap-3 rounded border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-slate-800">
                        {backup.label || "Manuelles Backup"}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-medium text-slate-400">
                        <span>{formatDateTime(backup.createdAt)}</span>
                        <span>{backup.sheetCount} Sheets</span>
                        <span>{backup.rowCount} Einträge</span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => onDownload(backup.id)}
                        title="JSON herunterladen"
                        className="rounded border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRestore(backup.id)}
                        disabled={Boolean(restoringBackupId)}
                        title="Backup wiederherstellen"
                        className="rounded border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                      >
                        {isRestoring ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(backup.id)}
                        disabled={Boolean(deletingBackupId)}
                        title="Backup löschen"
                        className="rounded border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                      >
                        {isDeleting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
