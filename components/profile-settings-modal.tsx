"use client";

import { FormEvent, useEffect, useState } from "react";
import { KeyRound, Loader2, Save, UserRound, X } from "lucide-react";

type ProfileSettingsPayload = {
  name: string;
  currentPassword: string;
  newPassword: string;
};

interface ProfileSettingsModalProps {
  isOpen: boolean;
  profileName: string;
  isSaving: boolean;
  error: string;
  onClose: () => void;
  onSave: (payload: ProfileSettingsPayload) => void;
}

export function ProfileSettingsModal({
  isOpen,
  profileName,
  isSaving,
  error,
  onClose,
  onSave,
}: ProfileSettingsModalProps) {
  const [name, setName] = useState(profileName);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setName(profileName);
    setCurrentPassword("");
    setNewPassword("");
  }, [isOpen, profileName]);

  if (!isOpen) return null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave({
      name,
      currentPassword,
      newPassword,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <h3 className="text-sm font-bold text-slate-900">Profil bearbeiten</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 transition-colors hover:text-slate-600 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-4">
          {error && (
            <div className="rounded border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
              <UserRound className="h-3 w-3" />
              Profilname
            </label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-slate-400"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
              <KeyRound className="h-3 w-3" />
              Passwort ändern
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              placeholder="Aktuelles Passwort"
              className="w-full rounded border border-slate-200 px-3 py-2 text-xs outline-none transition-colors focus:border-slate-400"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Neues Passwort"
              className="w-full rounded border border-slate-200 px-3 py-2 text-xs outline-none transition-colors focus:border-slate-400"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 cursor-pointer"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 rounded bg-slate-900 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
