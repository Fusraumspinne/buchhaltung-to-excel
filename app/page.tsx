"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { CheckCircle2, CloudOff, Download, FileSpreadsheet, Info, Loader2 } from "lucide-react";
import { AlertModal } from "@/components/alert-modal";
import { DashboardAnalytics } from "@/components/dashboard-analytics";
import { DynamicTable } from "@/components/dynamic-table";
import { KassenbuchTable } from "@/components/kassenbuch-table";
import { NavigationTabs } from "@/components/navigation-tabs";
import { Pagination } from "@/components/pagination";
import { SheetConfigModal } from "@/components/sheet-config-modal";
import { SummaryCards } from "@/components/summary-cards";
import {
  SheetConfig,
  SheetRow,
  KassenbuchEntry,
  GESAMTBETRAG_COLUMN_ID,
} from "@/lib/types";

function today() {
  return new Date().toISOString().split("T")[0];
}

function getNextGlobalId(data: Record<string, SheetRow[]>): number {
  let maxId = 0;
  for (const rows of Object.values(data)) {
    for (const row of rows) {
      if (row._id > maxId) maxId = row._id;
    }
  }
  return maxId + 1;
}

function columnNumberToLetters(columnNumber: number) {
  let value = Math.max(1, Math.floor(columnNumber));
  let letters = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    value = Math.floor((value - 1) / 26);
  }
  return letters;
}

function sanitizeWorksheetName(name: string) {
  const reserved = name.trim() || "Sheet";
  const cleaned = reserved
    .replace(/[\\/*?:\[\]]/g, "-")
    .replace(/^'+|'+$/g, "")
    .trim();
  const fallback = cleaned || "Sheet";
  return fallback.slice(0, 31);
}

function createWorksheetNameMap(sheets: SheetConfig[]) {
  const reservedLower = new Set(["_konfiguration", "kassenbuch"]);
  const used = new Set<string>(reservedLower);
  const map: Record<string, string> = {};

  for (const sheet of sheets) {
    const base = sanitizeWorksheetName(sheet.name);
    let candidate = base;
    let suffix = 2;

    while (used.has(candidate.toLowerCase())) {
      const nextSuffix = ` (${suffix})`;
      const maxBaseLen = Math.max(1, 31 - nextSuffix.length);
      candidate = `${base.slice(0, maxBaseLen)}${nextSuffix}`;
      suffix++;
    }

    used.add(candidate.toLowerCase());
    map[sheet.id] = candidate;
  }

  return map;
}

const HELP_GUIDE_PAGES = [
  "📌 Schnellstart\n• Erstelle ein neues Sheet über '+' in der Tab-Leiste.\n• Vergib einen klaren Namen (z. B. 'Rechnungen 2026') und wähle die passende Kategorie.\n• Lege zuerst die wichtigsten Spalten an (z. B. Beschreibung, Beleg-Nr., Gesamtbetrag).\n• Danach Einträge erfassen: Datum setzen, Werte eintragen, regelmäßig exportieren.\n\n✅ Empfehlung\n• Starte mit einer einfachen Struktur und erweitere erst später. Das reduziert Fehler beim Export.",
  "🧱 Sheets und Spalten richtig aufbauen\n• Ein Sheet beschreibt einen Datenbereich: Name, Kategorie, Farbe, Spalten.\n• Spalten können 'Text' oder 'Zahl' sein – für Berechnungen immer 'Zahl' verwenden.\n• In Einnahmen- und Ausgaben-Sheets ist 'Gesamtbetrag' Pflicht, weil Analyse/Kassenbuch darauf basieren.\n• Vermeide doppelte oder sehr ähnliche Spaltennamen, damit Daten klar lesbar bleiben.\n\n⚠️ Achtung\n• Wenn du eine Spalte entfernst, sind bestehende Werte dieser Spalte in den Zeilen nicht mehr sichtbar.",
  "🧾 Dateneingabe und Qualität\n• Jede Zeile bekommt intern eine globale ID (_id) und ein Datum (_datum).\n• Zahlen werden als echte numerische Werte gespeichert, Text als String.\n• Trage Beträge konsistent ein (bei Unsicherheit immer nur den Zahlenwert, ohne Text).\n• Nutze Löschen nur gezielt – es gibt eine Bestätigung, aber keine Mehrfach-Rückgängig-Funktion.\n\n✅ Empfehlung\n• Prüfe neue Einträge kurz im Kassenbuch oder Dashboard, um Tippfehler sofort zu sehen.",
  "📤 Export nach Excel\n• Beim Export wird zuerst das komplette Kassenbuch erzeugt.\n• Danach folgen alle eigenen Sheets als Tabellenblätter.\n• Zahlen werden mit einem Zahlenformat gespeichert, damit Excel sie korrekt weiterberechnet.\n• Blattnamen werden automatisch bereinigt und bei Bedarf eindeutig umbenannt.\n\n✅ Empfehlung\n• Nutze Export als zusätzliche Dateiablage, während die App selbst direkt in der Datenbank speichert.",
  "💾 Speichern in der Datenbank\n• Sheets und Einträge werden über Supabase/Postgres gespeichert.\n• Anpassungen werden automatisch an die Datenbank übertragen.\n• Beim Start lädt die App den aktuellen Stand vom Server.\n• Es gibt keine lokale Browser-Zwischenspeicherung mehr.\n\n⚠️ Achtung\n• Wenn die Datenbank nicht erreichbar ist, werden Änderungen erst wieder zuverlässig gespeichert, sobald die Verbindung funktioniert.",
  "📊 Dashboard und Kassenbuch verstehen\n• In die Finanzkennzahlen fließen nur Sheets der Kategorien Einnahmen und Ausgaben ein.\n• Sonstiges-Sheets bleiben für Dokumentation nutzbar, aber ohne Einfluss auf Salden/KPIs.\n• Das Kassenbuch berechnet den laufenden Saldo je Eintrag chronologisch nach globaler ID.\n• Unplausible Summen deuten oft auf fehlende oder falsch typisierte Gesamtbeträge hin.\n\n✅ Empfehlung\n• Wenn Zahlen unerwartet sind, zuerst die Kategorie und den Feldtyp 'Gesamtbetrag' prüfen.",
  "🛡️ Worauf du besonders achten solltest\n• Einheitliche Benennung: gleiche Begriffe für gleiche Inhalte (z. B. immer 'Rechnungsnummer').\n• Zahlenfelder nicht als Text pflegen – sonst fehlen sie in Auswertungen.\n• Nach strukturellen Änderungen (Spalten/Sheets) kurz einen Test-Export durchführen.\n\n✅ Best Practice\n• Arbeite in kleinen Schritten: ändern → prüfen → exportieren.",
];

export default function Home() {
  const [sheets, setSheets] = useState<SheetConfig[]>([]);
  const [data, setData] = useState<Record<string, SheetRow[]>>({});
  const [activeTab, setActiveTab] = useState("dashboard");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [editingSheet, setEditingSheet] = useState<SheetConfig | undefined>();
  const [hasInitialized, setHasInitialized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingMutationCountRef = useRef(0);
  const unmountedRef = useRef(false);

  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm?: () => void;
    onCancel?: () => void;
    onPrevious?: () => void;
    onNext?: () => void;
    previousLabel?: string;
    nextLabel?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    closeOnConfirm?: boolean;
    compactActions?: boolean;
  }>({ isOpen: false, title: "", message: "" });

  const showAlert = useCallback((title: string, message: string) => {
    setAlertConfig({ isOpen: true, title, message });
  }, []);

  const showConfirm = useCallback((
    title: string,
    message: string,
    onConfirm: () => void,
    confirmLabel = "Bestätigen",
    cancelLabel = "Abbrechen"
  ) => {
    setAlertConfig({ isOpen: true, title, message, onConfirm, confirmLabel, cancelLabel });
  }, []);

  const closeAlertModal = useCallback(() => {
    setAlertConfig((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const openHelpPage = (pageIndex: number) => {
    const totalPages = HELP_GUIDE_PAGES.length;
    const normalizedPage = Math.min(Math.max(pageIndex, 0), totalPages - 1);

    setAlertConfig({
      isOpen: true,
      title: `Informationen zur Nutzung (${normalizedPage + 1}/${totalPages})`,
      message: HELP_GUIDE_PAGES[normalizedPage],
      onPrevious: () => {
        if (normalizedPage === 0) {
          closeAlertModal();
          return;
        }
        openHelpPage(normalizedPage - 1);
      },
      onNext: () => {
        if (normalizedPage === totalPages - 1) {
          closeAlertModal();
          return;
        }
        openHelpPage(normalizedPage + 1);
      },
      previousLabel: "←",
      nextLabel: "→",
    });
  };

  const showHelp = () => {
    openHelpPage(0);
  };

  const requestJson = useCallback(
    async <T,>(url: string, init?: RequestInit): Promise<T> => {
      const response = await fetch(url, {
        ...init,
        credentials: "same-origin",
        headers: {
          ...(init?.body ? { "content-type": "application/json" } : {}),
          ...init?.headers,
        },
      });

      if (response.status === 401) {
        window.location.href = "/login";
        throw new Error("Unauthorized");
      }

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Datenbankaktion fehlgeschlagen.");
      }

      return payload as T;
    },
    []
  );

  const queueDatabaseMutation = useCallback(
    <T,>(task: () => Promise<T>) => {
      pendingMutationCountRef.current += 1;
      setIsSaving(true);
      setSaveError("");

      const queued = mutationQueueRef.current.then(task, task);
      mutationQueueRef.current = queued.then(
        () => undefined,
        () => undefined
      );

      queued
        .then(() => {
          if (!unmountedRef.current) {
            setLastSavedAt(new Date().toISOString());
          }
        })
        .catch((error) => {
          console.error("Database mutation failed:", error);
          if (!unmountedRef.current) {
            setSaveError(
              error instanceof Error
                ? error.message
                : "Daten konnten nicht gespeichert werden."
            );
          }
        })
        .finally(() => {
          pendingMutationCountRef.current = Math.max(
            0,
            pendingMutationCountRef.current - 1
          );
          if (
            pendingMutationCountRef.current === 0 &&
            !unmountedRef.current
          ) {
            setIsSaving(false);
          }
        });

      return queued;
    },
    []
  );

  useEffect(() => {
    return () => {
      unmountedRef.current = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadState = async () => {
      try {
        const response = await fetch("/api/sheets", {
          credentials: "same-origin",
        });
        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }

        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(
            payload?.error || "Datenbankstand konnte nicht geladen werden."
          );
        }

        if (cancelled) return;
        const remoteState = payload as {
          sheets?: SheetConfig[];
          data?: Record<string, SheetRow[]>;
          updatedAt?: string | null;
        };
        setSheets(Array.isArray(remoteState.sheets) ? remoteState.sheets : []);
        setData(
          remoteState.data && typeof remoteState.data === "object"
            ? remoteState.data
            : {}
        );
        setLastSavedAt(remoteState.updatedAt || null);
        setHasInitialized(true);
      } catch (error) {
        console.error("Initial database load failed:", error);
        if (cancelled) return;
        setSaveError(
          error instanceof Error
            ? error.message
            : "Datenbankstand konnte nicht geladen werden."
        );
        setHasInitialized(true);
        showAlert(
          "Datenbank nicht erreichbar",
          "Der gespeicherte Stand konnte nicht aus Supabase geladen werden. Prüfe die Datenbank-URL und Verbindung."
        );
      }
    };

    void loadState();

    return () => {
      cancelled = true;
    };
  }, [showAlert]);

  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    setCurrentPage(1);
  };

  const openNewSheetModal = () => {
    setEditingSheet(undefined);
    setConfigModalOpen(true);
  };

  const openEditSheetModal = (sheetId: string) => {
    const sheet = sheets.find((s) => s.id === sheetId);
    if (sheet) {
      setEditingSheet(sheet);
      setConfigModalOpen(true);
    }
  };

  const handleSaveSheet = (config: SheetConfig) => {
    const isExisting = sheets.some((sheet) => sheet.id === config.id);

    setSheets((prev) => {
      const existing = prev.findIndex((s) => s.id === config.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = config;
        return updated;
      }
      return [...prev, config];
    });

    setData((prev) => {
      if (!prev[config.id]) {
        return { ...prev, [config.id]: [] };
      }
      return prev;
    });

    setActiveTab(config.id);

    void queueDatabaseMutation(async () => {
      const payload = await requestJson<{ ok: boolean; sheet: SheetConfig }>(
        isExisting
          ? `/api/sheets/${encodeURIComponent(config.id)}`
          : "/api/sheets",
        {
          method: isExisting ? "PUT" : "POST",
          body: JSON.stringify(config),
        }
      );

      if (payload.sheet) {
        setSheets((prev) =>
          prev.map((sheet) => (sheet.id === config.id ? payload.sheet : sheet))
        );
      }

      return payload;
    });
  };

  const handleDeleteSheet = (sheetId: string) => {
    showConfirm(
      "Sheet löschen",
      "Möchtest du dieses Sheet und alle zugehörigen Daten wirklich löschen?",
      () => {
        setSheets((prev) => prev.filter((s) => s.id !== sheetId));
        setData((prev) => {
          const next = { ...prev };
          delete next[sheetId];
          return next;
        });
        setActiveTab("dashboard");
        setConfigModalOpen(false);
        void queueDatabaseMutation(() =>
          requestJson(`/api/sheets/${encodeURIComponent(sheetId)}`, {
            method: "DELETE",
          })
        );
      },
      "Löschen"
    );
  };

  const addRow = (sheetId: string) => {
    const nextId = getNextGlobalId(data);
    const sheet = sheets.find((s) => s.id === sheetId);
    if (!sheet) return;

    const newRow: SheetRow = { _id: nextId, _datum: today() };
    for (const col of sheet.columns) {
      if (col.type === "number") {
        newRow[col.id] = 0;
      } else {
        newRow[col.id] = "";
      }
    }

    setData((prev) => ({
      ...prev,
      [sheetId]: [newRow, ...(prev[sheetId] || [])],
    }));

    void queueDatabaseMutation(async () => {
      const payload = await requestJson<{ ok: boolean; row: SheetRow }>(
        `/api/sheets/${encodeURIComponent(sheetId)}/rows`,
        {
          method: "POST",
          body: JSON.stringify(newRow),
        }
      );

      if (payload.row && payload.row._id !== newRow._id) {
        setData((prev) => ({
          ...prev,
          [sheetId]: (prev[sheetId] || []).map((row) =>
            row._id === newRow._id ? payload.row : row
          ),
        }));
      }

      return payload;
    });
  };

  const removeRow = (sheetId: string, rowId: number) => {
    showConfirm(
      "Eintrag löschen",
      "Möchtest du diesen Eintrag wirklich löschen?",
      () => {
        setData((prev) => ({
          ...prev,
          [sheetId]: (prev[sheetId] || []).filter((r) => r._id !== rowId),
        }));
        void queueDatabaseMutation(() =>
          requestJson(
            `/api/sheets/${encodeURIComponent(sheetId)}/rows/${rowId}`,
            {
              method: "DELETE",
            }
          )
        );
      },
      "Löschen"
    );
  };

  const updateRow = (sheetId: string, rowId: number, field: string, value: string | number) => {
    setData((prev) => ({
      ...prev,
      [sheetId]: (prev[sheetId] || []).map((row) =>
        row._id === rowId ? { ...row, [field]: value } : row
      ),
    }));

    void queueDatabaseMutation(() =>
      requestJson(`/api/sheets/${encodeURIComponent(sheetId)}/rows/${rowId}`, {
        method: "PUT",
        body: JSON.stringify({ [field]: value }),
      })
    );
  };

  const kassenbuchRows = useMemo<KassenbuchEntry[]>(() => {
    const entries: Array<{
      id: number;
      datum: string;
      typ: string;
      einnahmen: number;
      ausgaben: number;
    }> = [];

    for (const sheet of sheets) {
      if (sheet.category === "sonstiges") continue;
      const rows = data[sheet.id] || [];
      for (const row of rows) {
        const betrag = Number(row[GESAMTBETRAG_COLUMN_ID]) || 0;
        entries.push({
          id: row._id,
          datum: row._datum,
          typ: sheet.name,
          einnahmen: sheet.category === "einnahmen" ? betrag : 0,
          ausgaben: sheet.category === "ausgaben" ? betrag : 0,
        });
      }
    }

    entries.sort((a, b) => a.id - b.id);

    let runningBalance = 0;
    return entries.map((entry) => {
      runningBalance += entry.einnahmen - entry.ausgaben;
      return { ...entry, saldo: runningBalance };
    });
  }, [sheets, data]);

  const exportToExcel = async () => {
    try {
      if (sheets.length === 0) {
        showAlert("Fehler beim Export", "Es gibt noch keine Sheets zum Exportieren.");
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const worksheetNameBySheetId = createWorksheetNameMap(sheets);

      const kassenbuchSheet = workbook.addWorksheet("Kassenbuch");
      kassenbuchSheet.columns = [
        { header: "ID", key: "id", width: 10 },
        { header: "Datum", key: "datum", width: 14 },
        { header: "Typ", key: "typ", width: 24 },
        { header: "Einnahmen", key: "einnahmen", width: 14 },
        { header: "Ausgaben", key: "ausgaben", width: 14 },
        { header: "Saldo", key: "saldo", width: 14 },
      ];
      kassenbuchRows.forEach((row) => kassenbuchSheet.addRow(row));

      if (kassenbuchRows.length > 0) {
        const lastDataRow = kassenbuchRows.length + 1;
        const totalRow = kassenbuchSheet.addRow({
          id: "GESAMT",
          einnahmen: { formula: `SUM(D2:D${lastDataRow})` },
          ausgaben: { formula: `SUM(E2:E${lastDataRow})` },
          saldo: { formula: `D${lastDataRow + 1}-E${lastDataRow + 1}` },
        });
        totalRow.font = { bold: true };
      }

      kassenbuchSheet.getRow(1).font = { bold: true };
      kassenbuchSheet.views = [{ state: "frozen", ySplit: 1 }];
      kassenbuchSheet.eachRow((row, rowNum) => {
        if (rowNum <= 1) return;
        row.eachCell((cell, colNum) => {
          if (colNum >= 4 && colNum <= 6) {
            cell.numFmt = "#,##0.00";
          }
        });
      });

      for (const sheet of sheets) {
        const wsName = worksheetNameBySheetId[sheet.id] || sanitizeWorksheetName(sheet.name);
        const ws = workbook.addWorksheet(wsName);

        const cols: Partial<ExcelJS.Column>[] = [
          { header: "ID", key: "_id", width: 10 },
          { header: "Datum", key: "_datum", width: 14 },
        ];
        for (const col of sheet.columns) {
          cols.push({
            header: col.title,
            key: col.id,
            width: col.type === "text" ? 24 : 16,
          });
        }
        ws.columns = cols;

        const rows = [...(data[sheet.id] || [])].sort((a, b) => a._id - b._id);
        rows.forEach((row) => ws.addRow(row));

        const lastDataRow = rows.length + 1;
        const footerRowValues: Record<string, string | ExcelJS.CellFormulaValue> = {
          _id: "GESAMT",
        };
        let hasNumberColumn = false;

        sheet.columns.forEach((col, idx) => {
          if (col.type === "number") {
            const colLetter = columnNumberToLetters(idx + 3);
            footerRowValues[col.id] = {
              formula: `SUM(${colLetter}2:${colLetter}${lastDataRow})`,
            };
            hasNumberColumn = true;
          }
        });

        if (hasNumberColumn && rows.length > 0) {
          const totalRow = ws.addRow(footerRowValues);
          totalRow.font = { bold: true };
          sheet.columns.forEach((col, idx) => {
            if (col.type === "number") {
              totalRow.getCell(idx + 3).numFmt = "#,##0.00";
            }
          });
        }

        ws.getRow(1).font = { bold: true };
        ws.views = [{ state: "frozen", ySplit: 1 }];

        ws.eachRow((row, rowNum) => {
          if (rowNum <= 1) return;
          row.eachCell((cell, colNum) => {
            const colConfig = sheet.columns[colNum - 3];
            if (colConfig && colConfig.type === "number") {
              cell.numFmt = "#,##0.00";
            }
          });
        });
      }

      const now = new Date();
      const dateStr = now.toLocaleDateString("de-DE").replace(/\./g, "-");
      const timeStr = now
        .toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
        .replace(/:/g, "-");
      const filename = `buchhaltung_${dateStr}_${timeStr}.xlsx`;

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), filename);
    } catch (error) {
      console.error("Fehler beim Export:", error);
      showAlert(
        "Fehler beim Export",
        "Die Daten konnten nicht zuverlässig exportiert werden. Prüfe Sheet-Namen und versuche es erneut."
      );
    }
  };

  const activeSheet = sheets.find((s) => s.id === activeTab);
  const activeRows = activeSheet ? data[activeSheet.id] || [] : [];
  const paginatedRows = activeRows.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );
  const saveStatusLabel = !hasInitialized
    ? "Lädt"
    : saveError
      ? "Speicherfehler"
      : isSaving
        ? "Speichert"
        : "Gespeichert";
  const saveStatusTitle = saveError
    ? saveError
    : lastSavedAt
      ? `Zuletzt gespeichert: ${new Date(lastSavedAt).toLocaleString("de-DE")}`
      : "Datenbank bereit";

  return (
    <div className="min-h-screen bg-white p-3 text-slate-900 sm:p-4 lg:p-6 font-sans">
      <div className="mx-auto max-w-6xl px-1 sm:px-2 md:px-4 md:border-x md:border-slate-100">
        <div className="mb-6 flex flex-col gap-3 pt-2 sm:mb-8 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:pt-4">
          <h1 className="flex flex-wrap items-center gap-2 text-lg font-bold tracking-tight text-slate-800 sm:text-xl">
            <FileSpreadsheet className="text-blue-500 w-5 h-5" /> BUCHHALTUNG
            <button
              onClick={showHelp}
              className="p-1 hover:bg-slate-100 rounded-full transition-colors cursor-pointer text-slate-400 hover:text-slate-600"
              title="Informationen"
            >
              <Info className="w-4 h-4" />
            </button>
          </h1>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
            <div
              className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${
                saveError ? "text-red-500" : "text-slate-400"
              }`}
              title={saveStatusTitle}
            >
              {!hasInitialized || isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : saveError ? (
                <CloudOff className="h-3.5 w-3.5" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              {saveStatusLabel}
            </div>
            <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-nowrap">
              <button
                onClick={exportToExcel}
                className="flex flex-1 items-center justify-center gap-1.5 rounded bg-slate-900 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-white shadow-md shadow-slate-200 transition-all hover:bg-slate-800 cursor-pointer sm:flex-none sm:justify-start sm:py-1.5"
              >
                <Download className="w-3.5 h-3.5" /> Export
              </button>
            </div>
          </div>
        </div>

        <SummaryCards sheets={sheets} data={data} />

        <NavigationTabs
          activeTab={activeTab}
          sheets={sheets}
          onChange={handleTabChange}
          onAddSheet={openNewSheetModal}
        />

        {activeTab === "dashboard" && (
          <DashboardAnalytics rows={kassenbuchRows} />
        )}

        {activeTab === "kassenbuch" && (
          <>
            <KassenbuchTable
              rows={[...kassenbuchRows]
                .sort((a, b) => b.id - a.id)
                .slice(
                  (currentPage - 1) * rowsPerPage,
                  currentPage * rowsPerPage
                )}
              sheets={sheets}
            />
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(kassenbuchRows.length / rowsPerPage)}
              onPageChange={setCurrentPage}
            />
          </>
        )}

        {activeSheet && (
          <>
            <DynamicTable
              config={activeSheet}
              rows={paginatedRows}
              allRows={activeRows}
              onAdd={() => {
                addRow(activeSheet.id);
                setCurrentPage(1);
              }}
              onRemove={(id) => removeRow(activeSheet.id, id)}
              onUpdate={(rowId, field, value) =>
                updateRow(activeSheet.id, rowId, field, value)
              }
              onConfigure={() => openEditSheetModal(activeSheet.id)}
            />
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(activeRows.length / rowsPerPage)}
              onPageChange={setCurrentPage}
            />
          </>
        )}

      </div>

      <SheetConfigModal
        isOpen={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
        onSave={handleSaveSheet}
        onDelete={
          editingSheet ? () => handleDeleteSheet(editingSheet.id) : undefined
        }
        initialConfig={editingSheet}
      />

      <AlertModal
        isOpen={alertConfig.isOpen}
        title={alertConfig.title}
        message={alertConfig.message}
        onConfirm={alertConfig.onConfirm}
        onCancel={alertConfig.onCancel}
        onPrevious={alertConfig.onPrevious}
        onNext={alertConfig.onNext}
        previousLabel={alertConfig.previousLabel}
        nextLabel={alertConfig.nextLabel}
        confirmLabel={alertConfig.confirmLabel}
        cancelLabel={alertConfig.cancelLabel}
        closeOnConfirm={alertConfig.closeOnConfirm}
        compactActions={alertConfig.compactActions}
        onClose={closeAlertModal}
      />
    </div>
  );
}
