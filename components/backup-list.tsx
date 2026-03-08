"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, History, Loader2, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { AlertModal } from "@/components/alert-modal";

interface BackupFile {
  name: string;
  date: string;
  size: number;
}

interface BackupListProps {
  onRestore: (filename: string) => void;
}

export function BackupList({ onRestore }: BackupListProps) {
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 5;

  const fetchBackups = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const resp = await fetch(`/api/backup/list?limit=${limit}&offset=${page * limit}`);
      if (resp.ok) {
        const data = await resp.json();
        setBackups(data.backups);
        setTotal(data.total);
      } else if (resp.status === 401) {
        window.location.href = "/login";
      } else {
        const data = await resp.json().catch(() => null);
        if (data?.code === "BLOB_UNREACHABLE") {
          setErrorMessage("Zu diesem Server kann keine Verbindung mehr aufgebaut werden. Backups sind aktuell nicht verfügbar.");
          setBackups([]);
          setTotal(0);
        } else {
          setErrorMessage("Backups konnten nicht geladen werden.");
        }
      }
    } catch (err) {
      console.error("Failed to load backups", err);
      setErrorMessage("Zu diesem Server kann keine Verbindung mehr aufgebaut werden. Backups sind aktuell nicht verfügbar.");
      setBackups([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  const totalPages = Math.ceil(total / limit);

  const deleteBackup = async () => {
    if (!deletingName) return;
    setIsDeleting(true);
    try {
      const resp = await fetch(`/api/backup?filename=${encodeURIComponent(deletingName)}`, {
        method: "DELETE",
      });
      if (resp.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (!resp.ok) {
        const data = await resp.json().catch(() => null);
        if (data?.code === "BLOB_UNREACHABLE") {
          setErrorMessage("Zu diesem Server kann keine Verbindung mehr aufgebaut werden. Backups sind aktuell nicht verfügbar.");
        } else {
          setErrorMessage("Das Backup konnte nicht geloescht werden.");
        }
        return;
      }

      setBackups((prev) => prev.filter((backup) => backup.name !== deletingName));
      setTotal((prev) => Math.max(0, prev - 1));
      await fetchBackups();
    } catch (err) {
      console.error("Failed to delete backup", err);
      setErrorMessage("Zu diesem Server kann keine Verbindung mehr aufgebaut werden. Backups sind aktuell nicht verfügbar.");
    } finally {
      setIsDeleting(false);
      setDeletingName(null);
    }
  };

  const deleteAllBackups = async () => {
    setIsDeletingAll(true);
    try {
      const resp = await fetch(`/api/backup?deleteAll=true`, {
        method: "DELETE",
      });
      if (resp.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (!resp.ok) {
        const data = await resp.json().catch(() => null);
        if (data?.code === "BLOB_UNREACHABLE") {
          setErrorMessage("Zu diesem Server kann keine Verbindung mehr aufgebaut werden.");
        } else {
          setErrorMessage("Backups konnten nicht gelöscht werden.");
        }
        return;
      }

      setBackups([]);
      setTotal(0);
      setPage(0);
    } catch (err) {
      console.error("Failed to delete all backups", err);
      setErrorMessage("Zu diesem Server kann keine Verbindung mehr aufgebaut werden.");
    } finally {
      setIsDeletingAll(false);
      setShowDeleteAllConfirm(false);
    }
  };

  return (
    <>
      <div className="bg-white rounded-lg border border-slate-100 shadow-sm overflow-hidden mb-8">
        <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <History className="w-3.5 h-3.5" /> Letzte Backups
          </h3>
          {backups.length > 0 && (
            <button
              onClick={() => setShowDeleteAllConfirm(true)}
              className="flex items-center gap-1.5 px-2 py-1 text-slate-400 hover:text-red-500 text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
               <Trash2 className="w-3 h-3" /> Alle löschen
            </button>
          )}
        </div>

        <div className="divide-y divide-slate-50">
          {loading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
            </div>
          ) : errorMessage ? (
            <div className="p-8 text-center text-xs text-amber-700 bg-amber-50/60">{errorMessage}</div>
          ) : backups.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              Keine Backups gefunden.
            </div>
          ) : (
            backups.map((b) => (
              <div key={b.name} className="p-4 flex justify-between items-center hover:bg-slate-50/50 transition-colors gap-2">
                <div>
                  <div className="text-xs font-semibold text-slate-700 truncate max-w-50 sm:max-w-xs" title={b.name}>
                    {b.name}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {new Date(b.date).toLocaleString("de-DE")} • {(b.size / 1024).toFixed(1)} KB
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDeletingName(b.name)}
                    className="flex items-center gap-1.5 p-1 text-slate-300 hover:text-red-500 transition-colors rounded text-[11px] font-bold uppercase tracking-wider cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onRestore(b.name)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-[10px] font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                  >
                    <Download className="w-3 h-3 rotate-180" /> Laden
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {totalPages > 1 && !errorMessage && (
          <div className="p-3 border-t border-slate-50 flex justify-center items-center gap-4">
            <button
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
              className="p-1.5 rounded border border-slate-200 disabled:opacity-30 hover:bg-slate-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            <span className="text-[11px] font-bold text-slate-500">
              {page + 1} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage(page + 1)}
              className="p-1.5 rounded border border-slate-200 disabled:opacity-30 hover:bg-slate-50 transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        )}
      </div>

      <AlertModal
        isOpen={Boolean(deletingName)}
        title="Backup löschen"
        message={
          deletingName
            ? `Möchtest du das Backup \"${deletingName}\" wirklich löschen?`
            : ""
        }
        confirmLabel={isDeleting ? "Lösche..." : "Löschen"}
        cancelLabel="Abbrechen"
        onConfirm={deleteBackup}
        onClose={() => {
          if (!isDeleting) {
            setDeletingName(null);
          }
        }}
      />

      <AlertModal
        isOpen={showDeleteAllConfirm}
        title="Alle Backups löschen"
        message="Möchtest du wirklich ALLE Backups unwiderruflich löschen? Diese Aktion kann nicht rückgängig gemacht werden."
        confirmLabel={isDeletingAll ? "Lösche..." : "Alle löschen"}
        cancelLabel="Abbrechen"
        onConfirm={deleteAllBackups}
        onClose={() => {
          if (!isDeletingAll) {
            setShowDeleteAllConfirm(false);
          }
        }}
      />
    </>
  );
}
