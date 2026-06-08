"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  FileSpreadsheet,
  Loader2,
  LockKeyhole,
  Plus,
  UserRound,
} from "lucide-react";

type ProfileSummary = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  sheetCount: number;
};

type Mode = "open" | "create";

export default function ProfileHome() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<Mode>("create");
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [profileName, setProfileName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedProfileId),
    [profiles, selectedProfileId]
  );

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/profiles", { credentials: "same-origin" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Profile konnten nicht geladen werden.");
      }

      const nextProfiles: ProfileSummary[] = Array.isArray(payload?.profiles)
        ? payload.profiles
        : [];
      setProfiles(nextProfiles);
      if (nextProfiles.length > 0) {
        setMode("open");
        setSelectedProfileId((current) =>
          nextProfiles.some((profile) => profile.id === current)
            ? current
            : nextProfiles[0].id
        );
      } else {
        setMode("create");
        setSelectedProfileId("");
      }
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Profile konnten nicht geladen werden."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  const resetForm = (nextMode: Mode, profileId = "") => {
    setMode(nextMode);
    setSelectedProfileId(profileId);
    setPassword("");
    setError("");
  };

  const handleCreateProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/profiles", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: profileName, password }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Profil konnte nicht erstellt werden.");
      }

      router.replace(`/profiles/${encodeURIComponent(payload.profile.id)}`);
      router.refresh();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Profil konnte nicht erstellt werden."
      );
    } finally {
      setSubmitting(false);
      setPassword("");
    }
  };

  const handleOpenProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedProfile) return;

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch(
        `/api/profiles/${encodeURIComponent(selectedProfile.id)}/login`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ password }),
        }
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Profil konnte nicht geöffnet werden.");
      }

      router.replace(`/profiles/${encodeURIComponent(selectedProfile.id)}`);
      router.refresh();
    } catch (openError) {
      setError(
        openError instanceof Error
          ? openError.message
          : "Profil konnte nicht geöffnet werden."
      );
    } finally {
      setSubmitting(false);
      setPassword("");
    }
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-white p-3 text-slate-900 sm:p-4 lg:p-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full min-w-0 max-w-6xl flex-col gap-6 px-1 sm:px-2 md:px-4 md:border-x md:border-slate-100">
        <header className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between sm:pt-4">
          <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-800 sm:text-xl">
            <FileSpreadsheet className="h-5 w-5 text-blue-500" />
            BUCHHALTUNG
          </h1>
          <button
            type="button"
            onClick={() => resetForm("create")}
            className="flex w-full items-center justify-center gap-1.5 rounded bg-slate-900 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-white shadow-md shadow-slate-200 transition-all hover:bg-slate-800 sm:w-auto cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Neues Profil
          </button>
        </header>

        {error && (
          <div className="flex items-start gap-2 rounded border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-none" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid min-w-0 flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="min-w-0">
            {loading ? (
              <div className="flex h-56 items-center justify-center rounded border border-slate-100 text-xs font-bold uppercase tracking-wider text-slate-400">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Lädt
              </div>
            ) : profiles.length === 0 ? (
              <div className="flex h-56 items-center justify-center rounded border border-dashed border-slate-200 text-center text-xs text-slate-500">
                Noch keine Profile
              </div>
            ) : (
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                {profiles.map((profile) => {
                  const isSelected = profile.id === selectedProfileId && mode === "open";
                  return (
                    <button
                      key={profile.id}
                      type="button"
                      onClick={() => resetForm("open", profile.id)}
                      className={`min-w-0 rounded border p-4 text-left transition-all cursor-pointer ${
                        isSelected
                          ? "border-slate-900 bg-slate-50"
                          : "border-slate-100 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="flex h-9 w-9 flex-none items-center justify-center rounded bg-white text-slate-500 ring-1 ring-slate-100">
                            <UserRound className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-bold text-slate-800">
                              {profile.name}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {profile.sheetCount} Sheets
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 flex-none text-slate-300" />
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Aktualisiert{" "}
                        {new Date(profile.updatedAt).toLocaleDateString("de-DE")}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="min-w-0 rounded border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <LockKeyhole className="h-3.5 w-3.5" />
              {mode === "create" ? "Profil erstellen" : "Profil öffnen"}
            </div>

            {mode === "create" ? (
              <form onSubmit={handleCreateProfile} className="space-y-3">
                <input
                  type="text"
                  value={profileName}
                  onChange={(event) => setProfileName(event.target.value)}
                  placeholder="Profilname"
                  className="w-full rounded border border-slate-200 px-3 py-2 text-xs outline-none transition-all focus:border-slate-900"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Passwort festlegen"
                  className="w-full rounded border border-slate-200 px-3 py-2 text-xs outline-none transition-all focus:border-slate-900"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded bg-slate-900 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-white transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                >
                  {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Erstellen
                </button>
              </form>
            ) : (
              <form onSubmit={handleOpenProfile} className="space-y-3">
                <div className="rounded border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
                  {selectedProfile?.name || "Profil auswählen"}
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Passwort eingeben"
                  className="w-full rounded border border-slate-200 px-3 py-2 text-xs outline-none transition-all focus:border-slate-900"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={submitting || !selectedProfile}
                  className="flex w-full items-center justify-center gap-2 rounded bg-slate-900 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-white transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                >
                  {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                  Öffnen
                </button>
              </form>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
