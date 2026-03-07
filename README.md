Cool, schlank, zuverlässig — dieses kleine Next.js-Tool hilft dir, deine Buchhaltungs-Einträge schnell zu verwalten, als Excel zu exportieren und wieder zu importieren. Ideal für einen minimalistischen Workflow: Einträge anlegen, prüfen, exportieren, analysieren.

**Kernaussage:** exportiere saubere Excel-Dateien mit echten Formeln, importiere ohne Phantom-Einträge und nutze das kompakte Dashboard für schnelle Analysen (Woche / Monat / Jahr).

---

**Highlights**

- Sauberer Import/Export: Summenzeilen (z. B. GESAMT) werden beim Re-Import ignoriert.
- Formeln statt Festwerte: Exportierte Summen sind Excel-Formeln, nicht harte Zahlen.
- Datum pro Eintrag: `Darlehen`, `Ausgaben` und `Verkauf` haben jetzt ein echtes `Datum`-Feld.
- Kompaktes Dashboard: schlichte, responsive Charts (Recharts) für Netto-Verlauf und Einnahmen vs. Ausgaben.
- Robuster Parser: Zahlenformate (DE/EN), Währungszeichen und Formelergebnisse werden berücksichtigt.

---

**Schnellstart (Entwicklung)**

1. Abhängigkeiten installieren

```bash
npm install
```

2. Dev-Server starten

```bash
npm run dev
```

3. Öffne die App

Besuche http://localhost:3000 in deinem Browser.

---

**Wichtige Dateien**

- Übersicht & UI: [app/page.tsx](app/page.tsx)
- Import/Export-Logik und Parser: [app/page.tsx](app/page.tsx)
- Datentypen: [lib/types.ts](lib/types.ts)
- Tabellen-Komponenten: [components/*-table.tsx](components)
- Dashboard (Analytics): [components/dashboard-analytics.tsx](components/dashboard-analytics.tsx)

---

**Wie der Import/Export funktioniert (kurz):**

- Beim Export erstellt das Tool: `Kassenbuch`, `Darlehen`, `Ausgaben`, `Verkauf` Sheets. Summen werden als Excel-Formeln gesetzt, damit Nachbearbeitung in Excel die Werte automatisch aktualisiert.
- Beim Import werden Kopfzeilen gematcht (robust gegen Spaltenverschiebungen). Metazeilen wie `GESAMT`, `SUMME`, oder `Einträge:` und komplett leere Zeilen werden verworfen, so entstehen keine Phantom-Datensätze.

Tip: Wenn du eine ältere Excel-Version ohne `Datum`-Spalte importierst, wird automatisch `heute` als Fallback gesetzt — rückwärtskompatibel.

---

Design- und UX-Philosophie

- Minimalistisch: dezente Farben, klare Ränder, übersichtliche Buttons.
- Mobile-first: Tabellen & Dashboard skalieren, Charts sind kompakt.
- Kein bloat: Charts nutzen `recharts` für gute Optik ohne großen Overhead.

---

Fehlerbehebung & Hinweise

- Keine Einträge nach Import? Prüfe, ob die Datei echte Datenzeilen enthält (nicht nur Summenzeilen).
- Wenn Zahlen merkwürdig formatiert sind (z. B. Währungssymbole oder NBSP), hilft der Parser — meldet mir Beispiele, wenn etwas fehlt.

---

Contributing

Wenn du Features möchtest (z. B. CSV-Import, PDF-Export, oder erweiterte Filter im Dashboard), öffne ein Issue oder erstelle einen PR — ich helfe beim Review.

---

Viel Spaß beim Verwalten deiner Zahlen.