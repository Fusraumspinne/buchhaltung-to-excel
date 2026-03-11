"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import * as ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { Download, FileSpreadsheet, Info } from "lucide-react";
import { AlertModal } from "@/components/alert-modal";
import { DashboardAnalytics } from "@/components/dashboard-analytics";
import { DynamicTable } from "@/components/dynamic-table";
import { KassenbuchTable } from "@/components/kassenbuch-table";
import { NavigationTabs } from "@/components/navigation-tabs";
import { Pagination } from "@/components/pagination";
import { SheetConfigModal } from "@/components/sheet-config-modal";
import { SummaryCards } from "@/components/summary-cards";
import { BackupList } from "@/components/backup-list";
import {
  SheetConfig,
  SheetRow,
  KassenbuchEntry,
  GESAMTBETRAG_COLUMN_ID,
  createId,
  createGesamtbetragColumn,
  SHEET_COLORS,
} from "@/lib/types";

/* ─── Helpers ───────────────────────────────────────── */

function today() {
  return new Date().toISOString().split("T")[0];
}

function parseCellText(value: ExcelJS.CellValue | null | undefined) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date) return value.toISOString().split("T")[0];
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("richText" in value && Array.isArray(value.richText))
      return value.richText.map((part) => part.text).join("");
    if ("result" in value && value.result !== null && value.result !== undefined)
      return String(value.result);
  }
  return String(value);
}

function parseCellNumber(value: ExcelJS.CellValue | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value === "object" && "result" in value && typeof value.result === "number")
    return Number.isFinite(value.result) ? value.result : 0;

  const raw = parseCellText(value).trim();
  if (!raw) return 0;

  const cleaned = raw.replace(/[\s\u00A0€$£]/g, "");
  const commaCount = (cleaned.match(/,/g) || []).length;
  const dotCount = (cleaned.match(/\./g) || []).length;

  let normalized = cleaned;
  if (commaCount > 0 && dotCount > 0) {
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (commaCount > 0 && dotCount === 0) {
    normalized = cleaned.replace(",", ".");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isMetaRowLabel(value: ExcelJS.CellValue | null | undefined) {
  const normalized = parseCellText(value).trim().toLowerCase();
  return (
    normalized === "gesamt" ||
    normalized === "summe" ||
    normalized === "total" ||
    normalized.startsWith("eintr")
  );
}

function isEffectivelyEmpty(values: Array<ExcelJS.CellValue | null | undefined>) {
  return values.every((value) => parseCellText(value).trim() === "");
}

function normalizeHeaderLabel(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
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
  "📌 Schnellstart\n• Neues Sheet: Klick auf '+' in der Tab-Leiste.\n• Name vergeben, Kategorie wählen (Einnahmen/Ausgaben/Sonstiges), Farbe auswählen.\n• Spalten hinzufügen (Typen: Text oder Zahl).\n• Einträge erfassen: Zeile hinzufügen, Datum setzen, Werte eintragen.",
  "🧱 Sheet-Konfiguration\n• Jedes Sheet besteht aus: id, name, category, color, columns.\n• Jede Spalte besteht aus: id, title, type (Text/Zahl), required.\n• Für Einnahmen/Ausgaben ist 'Gesamtbetrag' ein Pflichtfeld.\n• Spaltenänderungen wirken sofort auf neue/aktuelle Eingabemasken.",
  "🧾 Dateneingabe\n• Zeilen speichern _id (global eindeutig) und _datum.\n• Zahlen werden als echte Number-Werte gespeichert.\n• Text bleibt unverändert als String.\n• Löschen von Einträgen und Sheets erfolgt mit Bestätigung.",
  "📤 Export (Excel)\n• Export erstellt immer: _Konfiguration, Kassenbuch und je Sheet ein Tabellenblatt.\n• _Konfiguration enthält die komplette Struktur als JSON.\n• Zahlen werden als #,##0.00 formatiert.\n• Blattnamen werden automatisch bereinigt und eindeutig gemacht.",
  "📥 Import (Excel)\n• Mit _Konfiguration: exakte Wiederherstellung von Struktur und Daten.\n• Ohne _Konfiguration: Legacy-Erkennung per Header/Typenheuristik.\n• Parser toleriert Währungssymbole, Leerzeichen, Komma/Punkt-Formate.\n• Meta- und Summenzeilen werden beim Import übersprungen.",
  "💾 Speicher & Backups\n• Lokale Speicherung in localStorage: buchhaltung_data.\n• Beim Start kann der letzte lokale Stand geladen werden.\n• Nach Export optional Cloud-Backup über /api/backup.\n• Backup-Download lädt Datei und stellt sie direkt wieder her.",
  "📊 Analyse\n• Dashboard und Kassenbuch aggregieren nur Einnahmen/Ausgaben.\n• Sonstiges-Sheets fließen nicht in die Finanzkennzahlen ein.\n• Kassenbuch berechnet laufenden Saldo je Eintrag.\n• Reihenfolge basiert auf globaler ID.",
  "⌨️ Navigation dieser Hilfe\n• Nutze die Pfeile unten: ← für zurück, → für weiter.\n• Auf der ersten Seite schließt ← die Hilfe.\n• Auf der letzten Seite schließt → die Hilfe.\n• Du kannst die Hilfe jederzeit über das Info-Symbol erneut öffnen."
];

export default function Home() {
  const [sheets, setSheets] = useState<SheetConfig[]>([]);
  const [data, setData] = useState<Record<string, SheetRow[]>>({});
  const [activeTab, setActiveTab] = useState("dashboard");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [editingSheet, setEditingSheet] = useState<SheetConfig | undefined>();

  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm?: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
  }>({ isOpen: false, title: "", message: "" });

  const showAlert = (title: string, message: string) => {
    setAlertConfig({ isOpen: true, title, message });
  };

  const showConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    confirmLabel = "Bestätigen",
    cancelLabel = "Abbrechen"
  ) => {
    setAlertConfig({ isOpen: true, title, message, onConfirm, confirmLabel, cancelLabel });
  };

  const showHelp = () => {
    showAlert(
      "Informationen zur Nutzung",
      "📊 SHEETS KONFIGURIEREN\n" +
        "• Erstelle eigene Sheets mit dem '+' Button in der Tab-Leiste.\n" +
        "• Wähle eine Kategorie: Einnahmen, Ausgaben oder Sonstiges.\n" +
      "• Definiere Spalten mit den Typen Text oder Zahl.\n" +
        "• Einnahmen/Ausgaben-Sheets haben automatisch ein Pflichtfeld 'Gesamtbetrag'.\n\n" +
        "💻 DATENSPEICHERUNG\n" +
        "• Daten werden automatisch im lokalen Speicher gespeichert.\n" +
        "• Nutze Import/Export für Excel-Dateien.\n\n" +
        "💾 EXPORT & BACKUPS\n" +
        "• Der Export speichert alle Sheets als separate Arbeitsblätter.\n" +
        "• Die Sheet-Konfiguration wird mitgespeichert und beim Import wiederhergestellt.\n\n" +
        "📈 ANALYSE\n" +
        "• Dashboard und Kassenbuch aggregieren alle Einnahmen- und Ausgaben-Sheets.\n" +
        "• Sonstiges-Sheets werden in der Finanzanalyse nicht berücksichtigt."
    );
  };

  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    const savedData = localStorage.getItem("buchhaltung_data");
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (Array.isArray(parsed.sheets)) {
          const hasEntries = parsed.sheets.length > 0;
          if (!hasEntries) {
            setHasInitialized(true);
            return;
          }

          const date = new Date(parsed.timestamp).toLocaleString("de-DE", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });

          showConfirm(
            "Letzten Stand laden?",
            `Es wurde ein gespeicherter Stand vom ${date} gefunden (${parsed.sheets.length} Sheet(s)). Möchtest du diesen laden? Dieser ist nicht der neuste aus der Cloud, sondern der zuletzte lokale Stand auf diesem Gerät.`,
            () => {
              setSheets(parsed.sheets || []);
              setData(parsed.data || {});
              setHasInitialized(true);
            },
            "Laden"
          );
        } else {
          setHasInitialized(true);
        }
      } catch {
        setHasInitialized(true);
      }
    } else {
      setHasInitialized(true);
    }
  }, []);

  useEffect(() => {
    if (!hasInitialized) return;
    if (sheets.length === 0 && Object.keys(data).length === 0) return;

    localStorage.setItem(
      "buchhaltung_data",
      JSON.stringify({
        sheets,
        data,
        timestamp: new Date().toISOString(),
      })
    );
  }, [sheets, data, hasInitialized]);

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
      const workbook = new ExcelJS.Workbook();
      const worksheetNameBySheetId = createWorksheetNameMap(sheets);

      const configSheet = workbook.addWorksheet("_Konfiguration");
      configSheet.getColumn(1).width = 120;
      configSheet.getCell("A1").value = "SHEET_CONFIGURATION";
      configSheet.getCell("A1").font = { bold: true };
      configSheet.getCell("A2").value = JSON.stringify(
        sheets.map((sheet) => ({
          ...sheet,
          exportSheetName: worksheetNameBySheetId[sheet.id],
        }))
      );
      configSheet.getCell("A2").font = { size: 8 };

      const kassenbuchSheet = workbook.addWorksheet("Kassenbuch");
      kassenbuchSheet.columns = [
        { header: "ID", key: "id", width: 10 },
        { header: "Datum", key: "datum", width: 14 },
        { header: "Typ", key: "typ", width: 20 },
        { header: "Einnahmen", key: "einnahmen", width: 14 },
        { header: "Ausgaben", key: "ausgaben", width: 14 },
        { header: "Saldo", key: "saldo", width: 14 },
      ];
      kassenbuchRows.forEach((row) => kassenbuchSheet.addRow(row));

      const kbEndRow = kassenbuchRows.length + 2;
      const kbTotalRow = kassenbuchSheet.addRow({
        id: "GESAMT",
        einnahmen: { formula: `SUM(D2:D${kbEndRow})` },
        ausgaben: { formula: `SUM(E2:E${kbEndRow})` },
        saldo: { formula: `D${kbEndRow + 1}-E${kbEndRow + 1}` },
      });
      kbTotalRow.font = { bold: true };

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

        const endRow = rows.length + 2;
        const footerRowValues: Record<string, any> = { _id: "GESAMT" };
        let hasNumberColumn = false;

        sheet.columns.forEach((col, idx) => {
          if (col.type === "number") {
            const colLetter = columnNumberToLetters(idx + 3);
            footerRowValues[col.id] = {
              formula: `SUM(${colLetter}2:${colLetter}${endRow})`,
            };
            hasNumberColumn = true;
          }
        });

        if (hasNumberColumn) {
          const totalRow = ws.addRow(footerRowValues);
          totalRow.font = { bold: true };
          sheet.columns.forEach((col, idx) => {
            if (col.type === "number") {
              totalRow.getCell(idx + 3).numFmt = "#,##0.00";
            }
          });
        }

        const now = new Date();
        const lastEdited =
          now.toLocaleDateString("de-DE") +
          " " +
          now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
        const metaText = `${sheet.name} (${sheet.category}) - Erstellt: ${lastEdited}`;
        ws.insertRow(1, [metaText]);
        ws.mergeCells(1, 1, 1, cols.length);
        ws.getRow(1).alignment = { wrapText: true };
        ws.getRow(1).font = { italic: true, size: 10 };
        ws.getRow(2).font = { bold: true };

        ws.eachRow((row, rowNum) => {
          if (rowNum <= 2) return;
          row.eachCell((cell, colNum) => {
            const colConfig = sheet.columns[colNum - 3];
            if (colConfig && colConfig.type === "number") {
              cell.numFmt = "#,##0.00";
            }
          });
        });
      }

      const now = new Date();
      const lastEdited =
        now.toLocaleDateString("de-DE") +
        " " +
        now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
      kassenbuchSheet.insertRow(1, [
        `Kassenbuch - Erstellt: ${lastEdited}`,
      ]);
      kassenbuchSheet.mergeCells(1, 1, 1, 6);
      kassenbuchSheet.getRow(1).alignment = { wrapText: true };
      kassenbuchSheet.getRow(1).font = { italic: true, size: 10 };
      kassenbuchSheet.getRow(2).font = { bold: true };

      kassenbuchSheet.eachRow((row, rowNum) => {
        if (rowNum <= 2) return;
        row.eachCell((cell, colNum) => {
          if (colNum >= 4 && colNum <= 6) {
            cell.numFmt = "#,##0.00";
          }
        });
      });

      const dateStr = now.toLocaleDateString("de-DE").replace(/\./g, "-");
      const timeStr = now
        .toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
        .replace(/:/g, "-");
      const filename = `buchhaltung_${dateStr}_${timeStr}.xlsx`;

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), filename);

      showConfirm(
        "Backup erstellen",
        "Möchtest du diese Daten auch als Backup in der Cloud speichern?",
        async () => {
          try {
            const resp = await fetch(
              `/api/backup?filename=${encodeURIComponent(filename)}`,
              {
                method: "POST",
                headers: { "content-type": "application/octet-stream" },
                body: buffer,
              }
            );
            if (!resp.ok) {
              const d = await resp.json().catch(() => null);
              if (d?.code === "BLOB_UNREACHABLE") {
                showAlert("Fehler", "Backup Server aktuell nicht erreichbar.");
              } else {
                showAlert("Fehler", "Backup Upload fehlgeschlagen.");
              }
            } else {
              showAlert(
                "Erfolg",
                "Backup wurde erfolgreich hochgeladen."
              );
              setActiveTab("backups");
            }
          } catch {
            showAlert("Fehler", "Backup Upload fehlgeschlagen.");
          }
        },
        "Backup erstellen",
        "Nein"
      );
    } catch (error) {
      console.error("Fehler beim Export:", error);
      showAlert(
        "Fehler beim Export",
        "Die Daten konnten nicht zuverlässig exportiert werden. Prüfe Sheet-Namen und versuche es erneut."
      );
    }
  };

  const processWorkbook = async (workbook: ExcelJS.Workbook) => {
    const normalizeConfigSheets = (raw: unknown): Array<SheetConfig & { exportSheetName?: string }> => {
      if (!Array.isArray(raw)) return [];

      const normalized: Array<SheetConfig & { exportSheetName?: string }> = [];
      const usedSheetIds = new Set<string>();

      for (let i = 0; i < raw.length; i++) {
        const entry = raw[i];
        if (!entry || typeof entry !== "object") continue;

        const e = entry as Record<string, unknown>;
        const category: SheetConfig["category"] =
          e.category === "einnahmen" || e.category === "ausgaben" || e.category === "sonstiges"
            ? e.category
            : "sonstiges";

        let sheetId =
          typeof e.id === "string" && e.id.trim() ? e.id.trim() : createId("sheet");
        while (usedSheetIds.has(sheetId)) {
          sheetId = createId("sheet");
        }
        usedSheetIds.add(sheetId);

        const baseName = typeof e.name === "string" && e.name.trim() ? e.name.trim() : `Sheet ${i + 1}`;
        const color =
          typeof e.color === "string" && e.color.trim()
            ? e.color
            : SHEET_COLORS[i % SHEET_COLORS.length];

        const columnsRaw = Array.isArray(e.columns) ? e.columns : [];
        const usedColumnIds = new Set<string>();
        const columns: SheetConfig["columns"] = [];

        for (let c = 0; c < columnsRaw.length; c++) {
          const rawCol = columnsRaw[c];
          if (!rawCol || typeof rawCol !== "object") continue;
          const col = rawCol as Record<string, unknown>;
          const title = typeof col.title === "string" ? col.title.trim() : "";
          if (!title) continue;

          let colId = typeof col.id === "string" && col.id.trim() ? col.id.trim() : createId("col");
          while (usedColumnIds.has(colId)) {
            colId = createId("col");
          }
          usedColumnIds.add(colId);

          const type = col.type === "number" ? "number" : "text";
          const required = Boolean(col.required);
          columns.push({ id: colId, title, type, required });
        }

        if (category !== "sonstiges" && !columns.some((col) => col.id === GESAMTBETRAG_COLUMN_ID)) {
          columns.unshift(createGesamtbetragColumn());
        }

        normalized.push({
          id: sheetId,
          name: baseName,
          category,
          color,
          columns,
          exportSheetName:
            typeof e.exportSheetName === "string" && e.exportSheetName.trim()
              ? e.exportSheetName.trim()
              : undefined,
        });
      }

      return normalized;
    };

    const configSheet = workbook.worksheets.find(
      (ws) => ws.name === "_Konfiguration"
    );

    if (configSheet) {
      const marker = parseCellText(configSheet.getCell("A1").value);
      if (marker === "SHEET_CONFIGURATION") {
        const configJson = parseCellText(configSheet.getCell("A2").value);
        try {
          const importedSheets = normalizeConfigSheets(JSON.parse(configJson));
          if (importedSheets.length === 0) {
            throw new Error("Leere oder ungültige Konfiguration in _Konfiguration.");
          }
          const importedData: Record<string, SheetRow[]> = {};

          for (const sheetConfig of importedSheets) {
            const preferredName = sheetConfig.exportSheetName || sheetConfig.name;
            const ws = workbook.worksheets.find(
              (w) => w.name === preferredName || w.name === sheetConfig.name
            );
            if (!ws) {
              importedData[sheetConfig.id] = [];
              continue;
            }

            const headerMap = new Map<string, number>();
            ws.getRow(2).eachCell((cell, colNumber) => {
              const norm = normalizeHeaderLabel(parseCellText(cell.value));
              if (norm) headerMap.set(norm, colNumber);
            });

            const idCol = headerMap.get("id") || 1;
            const datumCol = headerMap.get("datum") || 2;

            const colIndices = new Map<string, number>();
            for (const col of sheetConfig.columns) {
              const norm = normalizeHeaderLabel(col.title);
              const idx = headerMap.get(norm);
              if (idx) colIndices.set(col.id, idx);
            }

            const rows: SheetRow[] = [];
            const usedIds = new Set<number>();
            let nextId = 1;

            ws.eachRow((row, rowNum) => {
              if (rowNum <= 2) return;

              const cellValues = Array.from(
                { length: ws.columnCount },
                (_, i) => row.getCell(i + 1).value
              );
              if (isMetaRowLabel(row.getCell(idCol).value) || isEffectivelyEmpty(cellValues))
                return;

              const rawId = Number(parseCellText(row.getCell(idCol).value));
              let id: number;
              if (Number.isInteger(rawId) && rawId > 0 && !usedIds.has(rawId)) {
                id = rawId;
              } else {
                while (usedIds.has(nextId)) nextId++;
                id = nextId;
              }
              usedIds.add(id);
              nextId = Math.max(nextId, id + 1);

              const sheetRow: SheetRow = {
                _id: id,
                _datum: parseCellText(row.getCell(datumCol).value) || today(),
              };

              for (const col of sheetConfig.columns) {
                const colIdx = colIndices.get(col.id);
                if (!colIdx) continue;
                const cellVal = row.getCell(colIdx).value;
                if (col.type === "number") {
                  sheetRow[col.id] = parseCellNumber(cellVal);
                } else {
                  sheetRow[col.id] = parseCellText(cellVal);
                }
              }

              rows.push(sheetRow);
            });

            importedData[sheetConfig.id] = rows.sort((a, b) => b._id - a._id);
          }

          setSheets(importedSheets.map(({ exportSheetName, ...sheet }) => sheet));
          setData(importedData);
          setHasInitialized(true);
          setActiveTab("dashboard");
          return;
        } catch {
        }
      }
    }

    const importedSheets: SheetConfig[] = [];
    const importedData: Record<string, SheetRow[]> = {};
    const usedGlobalIds = new Set<number>();
    let nextGlobalId = 1;

    const readOrCreateId = (value: ExcelJS.CellValue | null | undefined) => {
      const candidate = Number(parseCellText(value));
      if (Number.isInteger(candidate) && candidate > 0 && !usedGlobalIds.has(candidate)) {
        usedGlobalIds.add(candidate);
        nextGlobalId = Math.max(nextGlobalId, candidate + 1);
        return candidate;
      }
      while (usedGlobalIds.has(nextGlobalId)) nextGlobalId++;
      const id = nextGlobalId;
      usedGlobalIds.add(id);
      nextGlobalId++;
      return id;
    };

    for (const ws of workbook.worksheets) {
      const wsName = ws.name;
      if (
        wsName === "_Konfiguration" ||
        wsName.toLowerCase() === "kassenbuch"
      )
        continue;

      const row1Text = parseCellText(ws.getRow(1).getCell(1).value);
      const hasMetaRow = row1Text.length > 30 || /erstellt|buchhaltung|hinweis/i.test(row1Text);
      const headerRowNum = hasMetaRow ? 2 : 1;
      const dataStartRow = headerRowNum + 1;

      const headers: { col: number; title: string }[] = [];
      ws.getRow(headerRowNum).eachCell((cell, colNumber) => {
        const title = parseCellText(cell.value).trim();
        if (title) headers.push({ col: colNumber, title });
      });

      if (headers.length === 0) continue;

      const nameLower = wsName.toLowerCase();
      let category: SheetConfig["category"] = "sonstiges";
      if (/ausgabe|expense|kosten/i.test(nameLower)) category = "ausgaben";
      else if (/einnahme|darlehen|verkauf|income|sale|revenue/i.test(nameLower))
        category = "einnahmen";

      const columns: SheetConfig["columns"] = [];
      const colIndexMap = new Map<string, number>();

      let idColIdx = -1;
      let datumColIdx = -1;

      for (const h of headers) {
        const norm = normalizeHeaderLabel(h.title);
        if (norm === "id") {
          idColIdx = h.col;
          continue;
        }
        if (norm === "datum" || norm === "date") {
          datumColIdx = h.col;
          continue;
        }

        let isNumeric = true;
        let sampleCount = 0;
        ws.eachRow((row, rowNum) => {
          if (rowNum < dataStartRow || sampleCount >= 5) return;
          const val = row.getCell(h.col).value;
          if (parseCellText(val).trim() === "") return;
          sampleCount++;
          if (parseCellNumber(val) === 0 && parseCellText(val).trim() !== "0") {
            isNumeric = false;
          }
        });

        const isGesamtbetrag =
          /gesamtbetrag|preis|betrag|summe|price|amount/i.test(h.title) &&
          isNumeric &&
          category !== "sonstiges";

        const colId = isGesamtbetrag
          ? GESAMTBETRAG_COLUMN_ID
          : createId("col");

        columns.push({
          id: colId,
          title: h.title,
          type: isNumeric ? "number" : "text",
          required: isGesamtbetrag,
        });
        colIndexMap.set(colId, h.col);
      }

      if (
        category !== "sonstiges" &&
        !columns.some((c) => c.id === GESAMTBETRAG_COLUMN_ID)
      ) {
        columns.unshift(createGesamtbetragColumn());
      }

      const sheetId = createId("sheet");
      const colorIdx = importedSheets.length % SHEET_COLORS.length;

      const sheetConfig: SheetConfig = {
        id: sheetId,
        name: wsName,
        category,
        color: SHEET_COLORS[colorIdx],
        columns,
      };

      const rows: SheetRow[] = [];
      ws.eachRow((row, rowNum) => {
        if (rowNum < dataStartRow) return;

        const cellValues = Array.from(
          { length: ws.columnCount },
          (_, i) => row.getCell(i + 1).value
        );
        const firstCellVal = idColIdx >= 0 ? row.getCell(idColIdx).value : row.getCell(1).value;
        if (isMetaRowLabel(firstCellVal) || isEffectivelyEmpty(cellValues))
          return;

        const sheetRow: SheetRow = {
          _id: readOrCreateId(idColIdx >= 0 ? row.getCell(idColIdx).value : undefined),
          _datum:
            datumColIdx >= 0
              ? parseCellText(row.getCell(datumColIdx).value) || today()
              : today(),
        };

        for (const col of columns) {
          const idx = colIndexMap.get(col.id);
          if (!idx) continue;
          const cellVal = row.getCell(idx).value;
          if (col.type === "number") {
            sheetRow[col.id] = parseCellNumber(cellVal);
          } else {
            sheetRow[col.id] = parseCellText(cellVal);
          }
        }

        rows.push(sheetRow);
      });

      importedSheets.push(sheetConfig);
      importedData[sheetId] = rows.sort((a, b) => b._id - a._id);
    }

    if (importedSheets.length === 0) {
      throw new Error("Keine gültigen importierbaren Arbeitsblätter gefunden.");
    }

    setSheets(importedSheets);
    setData(importedData);
    setHasInitialized(true);
    setActiveTab("dashboard");
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!/\.xlsx$/i.test(file.name)) {
      showAlert("Fehler beim Import", "Bitte wähle eine gültige .xlsx-Datei aus.");
      e.target.value = "";
      return;
    }

    if (file.size === 0) {
      showAlert("Fehler beim Import", "Die gewählte Datei ist leer.");
      e.target.value = "";
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const arrayBuffer = await file.arrayBuffer();
      await workbook.xlsx.load(arrayBuffer as ArrayBuffer);
      await processWorkbook(workbook);
    } catch (error: unknown) {
      console.error("Fehler beim Laden:", error);
      showAlert(
        "Fehler beim Import",
        `Die Excel-Datei konnte nicht gelesen werden. ${
          error instanceof Error ? error.message : "Bitte überprüfe das Format."
        }`
      );
    }
    e.target.value = "";
  };

  const handleRestoreBackup = async (filename: string) => {
    try {
      const resp = await fetch(
        `/api/backup/download?filename=${encodeURIComponent(filename)}`
      );
      if (!resp.ok) {
        const d = await resp.json().catch(() => null);
        if (d?.code === "BLOB_UNREACHABLE") {
          showAlert(
            "Backup-Server nicht erreichbar",
            "Backups sind gerade nicht verfügbar."
          );
          return;
        }
        throw new Error("Download failed");
      }
      const buffer = await resp.arrayBuffer();
      saveAs(new Blob([buffer]), filename);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      await processWorkbook(workbook);
      showAlert(
        "Backup geladen",
        `Das Backup "${filename}" wurde erfolgreich wiederhergestellt.`
      );
    } catch (error) {
      console.error("Fehler beim Backup-Restore:", error);
      showAlert("Fehler", "Backup konnte nicht geladen werden.");
    }
  };

  const activeSheet = sheets.find((s) => s.id === activeTab);
  const activeRows = activeSheet ? data[activeSheet.id] || [] : [];
  const paginatedRows = activeRows.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

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
          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-nowrap">
            <label className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-600 shadow-sm transition-all hover:bg-slate-50 sm:flex-none sm:justify-start sm:py-1.5">
              <Download className="w-3.5 h-3.5 rotate-180" /> Import
              <input
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
            <button
              onClick={exportToExcel}
              className="flex flex-1 items-center justify-center gap-1.5 rounded bg-slate-900 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-white shadow-md shadow-slate-200 transition-all hover:bg-slate-800 cursor-pointer sm:flex-none sm:justify-start sm:py-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Export
            </button>
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

        {activeTab === "backups" && (
          <BackupList onRestore={handleRestoreBackup} />
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
        confirmLabel={alertConfig.confirmLabel}
        cancelLabel={alertConfig.cancelLabel}
        onClose={() => {
          setAlertConfig((prev) => ({ ...prev, isOpen: false }));
          if (!hasInitialized && alertConfig.title === "Letzten Stand laden?") {
            setHasInitialized(true);
          }
        }}
      />
    </div>
  );
}

