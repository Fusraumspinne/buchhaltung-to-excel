Cool, schlank, zuverlässig: Diese Next.js-App verwaltet Buchhaltungs-Sheets direkt in Supabase/Postgres und exportiert den aktuellen Stand als Excel-Datei mit Kassenbuch und allen eigenen Sheets.

**Kernaussage:** Profile werden auf der Startseite verwaltet. Jedes Profil hat ein eigenes Passwort und eigene Sheets/Einträge; der Excel-Export ist eine zusätzliche Dateiablage, nicht der primäre Speicher.

---

**Highlights**

- Direkte Datenbank-Speicherung mit Prisma und Supabase/Postgres.
- Profilbasierte Anmeldung: Jedes Profil schützt seine eigenen Sheets per Passwort.
- Profile können umbenannt werden; Passwörter lassen sich mit aktuellem Passwort ändern.
- Cookie-geschützte Daten-API: API-Routen arbeiten nur im aktuell authentifizierten Profil.
- Spaltentypen für Text, Zahl, Checkbox und Datum.
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
DATABASE_URL=postgresql://...
PROFILE_SESSION_SECRET=ein-langer-zufaelliger-secret
```

`PROFILE_SESSION_SECRET` signiert die Profil-Session-Cookies.

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

Besuche http://localhost:3000, erstelle ein Profil oder öffne ein vorhandenes Profil mit seinem Passwort.

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

- `AccountingProfile`: Profil mit Name und Passwort-Hash.
- `AccountingSheet`: Sheet-Konfiguration pro Profil mit Name, Kategorie, Farbe, Spalten, Spaltentypen und Sortierung.
- `AccountingRow`: Eintrag pro Profil/Sheet mit profilweit eindeutiger `rowId`, Datum und dynamischen Zellwerten in `values`.
- `SheetCategory`: `einnahmen`, `ausgaben`, `sonstiges`.

Migrationen liegen unter [prisma/migrations](prisma/migrations).

---

**API**

Profile/Auth:

- `GET /api/profiles`: lädt alle Profile für die Startseite.
- `POST /api/profiles`: erstellt ein Profil mit Passwort und setzt die Profil-Session.
- `PATCH /api/profiles/[profileId]`: benennt das aktive Profil um oder ändert sein Passwort.
- `POST /api/profiles/[profileId]/login`: prüft das Profilpasswort und setzt die Profil-Session.
- `POST /api/auth/logout`: löscht die aktive Profil-Session.

Daten-API:

- `GET /api/sheets`: lädt alle Sheets inklusive Einträge des aktiven Profils.
- `POST /api/sheets`: erstellt ein Sheet im aktiven Profil.
- `PUT /api/sheets/[sheetId]`: bearbeitet ein Sheet.
- `DELETE /api/sheets/[sheetId]`: löscht ein Sheet inklusive Einträge.
- `POST /api/sheets/[sheetId]/rows`: erstellt einen Eintrag.
- `PUT /api/sheets/[sheetId]/rows/[rowId]`: bearbeitet einen Eintrag.
- `DELETE /api/sheets/[sheetId]/rows/[rowId]`: löscht einen Eintrag.

Alle Daten-API-Routen prüfen serverseitig die signierte Profil-Session und filtern jede Datenbankoperation über `profileId`. Dadurch können Sheets oder Einträge aus anderen Profilen auch nicht durch direkt aufgerufene API-URLs bearbeitet werden.

---

**Export**

Der Export-Button erzeugt eine `.xlsx`-Datei mit:

1. `Kassenbuch`: vollständige chronologische Übersicht mit Einnahmen, Ausgaben, Saldo und Summenzeile.
2. Alle eigenen Sheets: jeweils als eigenes Arbeitsblatt mit ID, Datum, Spalten und Summenzeilen für Zahlenfelder.

Es gibt keinen Excel-Import und keine lokale Browser-Zwischenspeicherung. Die Datenbank ist die Quelle der Wahrheit.

---

**Wichtige Dateien**

- [app/page.tsx](app/page.tsx): Profilübersicht, Profil-Erstellung und Profil-Login.
- [app/profiles/[profileId]/page.tsx](app/profiles/[profileId]/page.tsx): UI, Dashboard, Kassenbuch und Excel-Export für ein Profil.
- [app/api/sheets/route.ts](app/api/sheets/route.ts): Laden und Erstellen von Sheets.
- [app/api/sheets/[sheetId]/route.ts](app/api/sheets/[sheetId]/route.ts): Sheet bearbeiten/löschen.
- [app/api/sheets/[sheetId]/rows/route.ts](app/api/sheets/[sheetId]/rows/route.ts): Einträge erstellen.
- [app/api/sheets/[sheetId]/rows/[rowId]/route.ts](app/api/sheets/[sheetId]/rows/[rowId]/route.ts): Einträge bearbeiten/löschen.
- [lib/db.ts](lib/db.ts): Prisma Client mit `@prisma/adapter-pg`.
- [lib/types.ts](lib/types.ts): gemeinsame App-Typen und Sheet-Helfer.
- [middleware.ts](middleware.ts): Zugriffsschutz für Seiten und API.

---

**Fehlerbehebung**

- Keine Daten beim Laden: Prüfe Profil-Session, `PROFILE_SESSION_SECRET`, `DATABASE_URL` und ob Migrationen gelaufen sind.
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
