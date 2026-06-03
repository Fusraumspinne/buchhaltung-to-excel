Cool, schlank, zuverlässig: Diese Next.js-App verwaltet Buchhaltungs-Sheets direkt in Supabase/Postgres und exportiert den aktuellen Stand als Excel-Datei mit Kassenbuch und allen eigenen Sheets.

**Kernaussage:** Einträge werden über geschützte API-Routen sofort in der Datenbank gespeichert. Der Excel-Export ist eine zusätzliche Dateiablage, nicht der primäre Speicher.

---

**Highlights**

- Direkte Datenbank-Speicherung mit Prisma und Supabase/Postgres.
- Cookie-geschützte Daten-API: Nur eingeloggte Nutzer können Sheets und Einträge lesen oder ändern.
- Granulare API-Routen für Sheets und Einträge statt eines zentralen State-Endpunkts.
- Excel-Export mit `Kassenbuch` als erstem Arbeitsblatt und danach allen eigenen Sheets.
- Exportierte Summen sind Excel-Formeln, damit Nachbearbeitung in Excel weiterrechnet.
- Dashboard und Kassenbuch werden aus den gespeicherten Sheet-Einträgen berechnet.

---

**Schnellstart**

1. Abhängigkeiten installieren

```bash
npm install
```

2. Umgebung konfigurieren

Lege eine `.env` an oder ergänze die vorhandene Datei:

```bash
PASSWORD=dein-login-passwort
DATABASE_URL=postgresql://...
```

Optional kann die Runtime auch `SUPABASE_DATABASE_URL` verwenden. Für Prisma-Migrationen ist `DATABASE_URL` die klarste Empfehlung.

3. Prisma Client generieren

```bash
npm run db:generate
```

4. Datenbank migrieren

```bash
npm run db:migrate
```

Für Produktion oder Vercel:

```bash
npm run db:deploy
```

5. Dev-Server starten

```bash
npm run dev
```

6. App öffnen

Besuche http://localhost:3000 und logge dich mit `PASSWORD` ein.

---

**Wichtige Scripts**

- `npm run dev`: startet Next.js lokal.
- `npm run build`: generiert Prisma Client und baut die App.
- `npm run start`: startet den Produktionsserver nach einem Build.
- `npm run db:generate`: generiert den Prisma Client.
- `npm run db:migrate`: erstellt/führt lokale Prisma-Migrationen aus.
- `npm run db:deploy`: führt vorhandene Migrationen in Produktion aus.

---

**Datenmodell**

Das Prisma-Schema liegt in [prisma/schema.prisma](prisma/schema.prisma).

- `AccountingSheet`: Sheet-Konfiguration mit Name, Kategorie, Farbe, Spalten und Sortierung.
- `AccountingRow`: Eintrag pro Sheet mit globaler `rowId`, Datum und dynamischen Zellwerten in `values`.
- `SheetCategory`: `einnahmen`, `ausgaben`, `sonstiges`.

Migrationen liegen unter [prisma/migrations](prisma/migrations).

---

**API**

Auth:

- `POST /api/auth/login`: prüft `PASSWORD` und setzt den Login-Cookie für 30 Tage.
- `POST /api/auth/logout`: löscht den Login-Cookie.

Daten-API:

- `GET /api/sheets`: lädt alle Sheets inklusive Einträge.
- `POST /api/sheets`: erstellt ein Sheet.
- `PUT /api/sheets/[sheetId]`: bearbeitet ein Sheet.
- `DELETE /api/sheets/[sheetId]`: löscht ein Sheet inklusive Einträge.
- `POST /api/sheets/[sheetId]/rows`: erstellt einen Eintrag.
- `PUT /api/sheets/[sheetId]/rows/[rowId]`: bearbeitet einen Eintrag.
- `DELETE /api/sheets/[sheetId]/rows/[rowId]`: löscht einen Eintrag.

Alle Daten-API-Routen prüfen serverseitig den Login-Cookie. Zusätzlich blockt [middleware.ts](middleware.ts) nicht autorisierte `/api/*`-Requests mit `401 Unauthorized`, außer die Auth-Routen.

---

**Export**

Der Export-Button erzeugt eine `.xlsx`-Datei mit:

1. `Kassenbuch`: vollständige chronologische Übersicht mit Einnahmen, Ausgaben, Saldo und Summenzeile.
2. Alle eigenen Sheets: jeweils als eigenes Arbeitsblatt mit ID, Datum, Spalten und Summenzeilen für Zahlenfelder.

Es gibt keinen Excel-Import und keine lokale Browser-Zwischenspeicherung. Die Datenbank ist die Quelle der Wahrheit.

---

**Wichtige Dateien**

- [app/page.tsx](app/page.tsx): UI, Dashboard, Kassenbuch und Excel-Export.
- [app/api/sheets/route.ts](app/api/sheets/route.ts): Laden und Erstellen von Sheets.
- [app/api/sheets/[sheetId]/route.ts](app/api/sheets/[sheetId]/route.ts): Sheet bearbeiten/löschen.
- [app/api/sheets/[sheetId]/rows/route.ts](app/api/sheets/[sheetId]/rows/route.ts): Einträge erstellen.
- [app/api/sheets/[sheetId]/rows/[rowId]/route.ts](app/api/sheets/[sheetId]/rows/[rowId]/route.ts): Einträge bearbeiten/löschen.
- [lib/db.ts](lib/db.ts): Prisma Client mit `@prisma/adapter-pg`.
- [lib/types.ts](lib/types.ts): gemeinsame App-Typen und Sheet-Helfer.
- [middleware.ts](middleware.ts): Zugriffsschutz für Seiten und API.

---

**Fehlerbehebung**

- Keine Daten beim Laden: Prüfe Login-Cookie, `PASSWORD`, `DATABASE_URL` und ob Migrationen gelaufen sind.
- Speichern schlägt fehl: Prüfe die Supabase/Postgres-Verbindung und ob die Tabellen per Prisma-Migration existieren.
- Build scheitert an Google Fonts: In eingeschränkten Netzwerkumgebungen braucht `next build` Zugriff auf `fonts.googleapis.com`.
- Export ist leer: Prüfe, ob Sheets und Einträge in der App vorhanden sind.

---

**Aktueller Architekturstand**

- Kein Vercel Blob.
- Kein Backup-Tab.
- Kein Excel-Import.
- Kein `/api/accounting-state`.
- Keine `lib/accounting-state.ts`.
- Keine lokale Browser-Speicherung.
- Prisma + Migrationen sind der Datenbankpfad.

---

Viel Spaß beim Verwalten deiner Zahlen.
