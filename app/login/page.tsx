"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        console.log(data.error || "Falsches Passwort.");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      console.log("Verbindung zum Server fehlgeschlagen.");
    } finally {
      setLoading(false);
      setPassword("");
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4 font-sans text-slate-900">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-lg border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex justify-center items-center">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Lock className="w-3.5 h-3.5" /> Zugriff geschützt
            </h3>
          </div>

          <div className="p-8">
            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6 text-slate-400" />
            </div>

            <p className="text-[11px] text-slate-500 text-center mb-6">
              Bitte gib das Passwort ein, um die Buchhaltung zu öffnen.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Passwort eingeben..."
                className="w-full px-3 py-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all"
                autoFocus
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white py-2 rounded text-[11px] font-bold uppercase tracking-wider transition-all flex justify-center items-center gap-2 shadow-sm cursor-pointer"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Anmelden"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
