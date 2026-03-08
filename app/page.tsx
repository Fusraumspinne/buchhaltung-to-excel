"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import * as ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { Download, FileSpreadsheet, Info } from "lucide-react";
import { AlertModal } from "@/components/alert-modal";
import { AusgabenTable } from "@/components/ausgaben-table";
import { DarlehenTable } from "@/components/darlehen-table";
import { DashboardAnalytics } from "@/components/dashboard-analytics";
import { KassenbuchTable } from "@/components/kassenbuch-table";
import { NavigationTabs } from "@/components/navigation-tabs";
import { Pagination } from "@/components/pagination";
import { SummaryCards } from "@/components/summary-cards";
import { VerkaufTable } from "@/components/verkauf-table";
import { BackupList } from "@/components/backup-list";
import {
  AusgabenEntry,
  DarlehenEntry,
  DarlehenKaeuferAnteil,
  KassenbuchEntry,
  TabKey,
  VerkaufEntry,
} from "@/lib/types";

function today() {
  return new Date().toISOString().split("T")[0];
}

function parseCellText(value: ExcelJS.CellValue | null | undefined) {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (value instanceof Date) {
    return value.toISOString().split("T")[0];
  }
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") {
      return value.text;
    }
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("");
    }
    if ("result" in value && value.result !== null && value.result !== undefined) {
      return String(value.result);
    }
  }
  return String(value);
}

function parseCellNumber(value: ExcelJS.CellValue | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (value && typeof value === "object" && "result" in value && typeof value.result === "number") {
    return Number.isFinite(value.result) ? value.result : 0;
  }

  const raw = parseCellText(value).trim();
  if (!raw) {
    return 0;
  }

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

function getHeaderColumnMap(sheet: ExcelJS.Worksheet | undefined) {
  const map = new Map<string, number>();
  if (!sheet) {
    return map;
  }

  sheet.getRow(2).eachCell((cell, colNumber) => {
    const normalizedHeader = normalizeHeaderLabel(parseCellText(cell.value));
    if (normalizedHeader) {
      map.set(normalizedHeader, colNumber);
    }
  });

  return map;
}

function resolveColumnIndex(headerMap: Map<string, number>, aliases: string[], fallback: number) {
  for (const alias of aliases) {
    const found = headerMap.get(normalizeHeaderLabel(alias));
    if (found) {
      return found;
    }
  }
  return fallback;
}

function getDarlehenAnteileGesamt(row: DarlehenEntry) {
  return row.kaeuferAnteile.reduce((sum, item) => sum + Math.max(0, Number(item.anteil) || 0), 0);
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [darlehenRows, setDarlehenRows] = useState<DarlehenEntry[]>([]);
  const [ausgabenRows, setAusgabenRows] = useState<AusgabenEntry[]>([]);
  const [verkaufRows, setVerkaufRows] = useState<VerkaufEntry[]>([]);

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  // Persistence Logic
  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm?: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
  }>({
    isOpen: false,
    title: "",
    message: "",
  });

  const showHelp = () => {
    showAlert(
      "Informationen zur Nutzung",
      "⚠️ WICHTIG: Die Excel-Datei dient primär als Datenspeicher. Manuelle Änderungen (v.a. Struktur/Spalten) können die Datei korrumpieren. Einzelne Werte können korrigiert werden, solange keine Pflichtfelder (außer 'Beschreibung') leer bleiben.\n\n" +
      "💻 DATENSPEICHERUNG\n" +
      "• Die Seite lädt beim Start die zuletzt auf diesem Gerät bearbeiteten Daten aus dem lokalen Speicher, nicht zwingend den aktuellsten Cloud-Stand.\n" +
      "• Nutze den 'Import' Button, um zuvor exportierte Excel-Dateien wiederherzustellen.\n\n" +
      "💾 EXPORT & BACKUPS\n" +
      "• Der 'Export' speichert die Daten lokal als .xlsx und bietet die Option eines Cloud-Backups.\n" +
      "• Bitte gehe sparsam mit Backups um (nur bei wichtigen Änderungen), um monatliche API-Limits nicht zu überschreiten.\n\n" +
      "📊 NAVIGATION & ANALYSE\n" +
      "• AnalyseDashboard: Visualisiert Einnahmen/Ausgaben auf Wochen-, Monats- und Jahresbasis.\n" +
      "• Kassenbuch: Chronologische Übersicht aller Transaktionen inkl. Filter- und Sortierfunktionen.\n" +
      "• Eindeutige IDs: Alle Einträge (Darlehen, Ausgaben, Verkäufe) erhalten eine unique ID zur Nachverfolgbarkeit.\n\n" +
      "📝 NEUE EINTRÄGE\n" +
      "• Validierung: Damit ein Element gespeichert werden kann, müssen alle Felder ausgefüllt sein. Das einzige optionale Feld ist die 'Beschreibung'."
    );
  };

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

  const [hasInitialized, setHasInitialized] = useState(false);

  // Persistence Logic
  useEffect(() => {
    const savedData = localStorage.getItem("buchhaltung_data");
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        
        // Prüfen ob mindestens ein Eintrag vorhanden ist
        const hasEntries = 
          (parsed.darlehen?.length > 0) || 
          (parsed.ausgaben?.length > 0) || 
          (parsed.verkauf?.length > 0);

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
          `Es wurde ein gespeicherter Stand vom ${date} gefunden. Möchtest du diesen laden?`,
          () => {
            setDarlehenRows((parsed.darlehen || []).map((row: Partial<DarlehenEntry>) => normalizeDarlehenEntry(row)));
            setAusgabenRows(parsed.ausgaben || []);
            setVerkaufRows(parsed.verkauf || []);
            setHasInitialized(true);
          },
          "Laden"
        );
      } catch (e) {
        console.error("Error parsing saved data", e);
        setHasInitialized(true);
      }
    } else {
      setHasInitialized(true);
    }
  }, []);

  useEffect(() => {
    if (!hasInitialized) return;
    
    const dataToSave = {
      darlehen: darlehenRows,
      ausgaben: ausgabenRows,
      verkauf: verkaufRows,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem("buchhaltung_data", JSON.stringify(dataToSave));
  }, [darlehenRows, ausgabenRows, verkaufRows, hasInitialized]);

  const handleTabChange = (newTab: TabKey) => {
    const isIncomplete = () => {
      switch (activeTab) {
        case "darlehen":
          return darlehenRows.some((r) => !isValidDarlehenRow(r));
        case "ausgaben":
          return ausgabenRows.some(r => r.ausgabe.trim() === "" || r.geprueftVon.trim() === "" || r.preis === 0);
        case "verkauf":
          return verkaufRows.some(r => r.produkt.trim() === "" || r.geprueftVon.trim() === "" || r.preis === 0);
        default:
          return false;
      }
    };

    if (isIncomplete()) {
      showConfirm(
        "Unvollständige Daten",
        "Einige Einträge sind noch nicht vollständig ausgefüllt. Möchtest du sie verwerfen und die Seite wechseln?",
        () => {
          setDarlehenRows((prev) => prev.filter((r) => isValidDarlehenRow(r)));
          setAusgabenRows((prev) =>
            prev.filter((r) => r.ausgabe.trim() !== "" && r.geprueftVon.trim() !== "" && r.preis !== 0),
          );
          setVerkaufRows((prev) =>
            prev.filter((r) => r.produkt.trim() !== "" && r.geprueftVon.trim() !== "" && r.preis !== 0),
          );
          setActiveTab(newTab);
          setCurrentPage(1);
        },
        "Wechseln"
      );
      return;
    }

    setDarlehenRows((prev) => prev.filter((r) => isValidDarlehenRow(r)));
    setAusgabenRows((prev) =>
      prev.filter((r) => r.ausgabe.trim() !== "" && r.geprueftVon.trim() !== "" && r.preis !== 0),
    );
    setVerkaufRows((prev) =>
      prev.filter((r) => r.produkt.trim() !== "" && r.geprueftVon.trim() !== "" && r.preis !== 0),
    );
    setActiveTab(newTab);
    setCurrentPage(1);
  };

  const hasEmptyDarlehen = darlehenRows.some((r) => !isValidDarlehenRow(r));
  const hasEmptyAusgabe = ausgabenRows.some(
    (r) => r.ausgabe.trim() === "" || r.geprueftVon.trim() === "" || r.preis === 0,
  );
  const hasEmptyVerkauf = verkaufRows.some(
    (r) => r.produkt.trim() === "" || r.geprueftVon.trim() === "" || r.preis === 0,
  );

  const getNextId = (
    currentDarlehen: DarlehenEntry[],
    currentAusgaben: AusgabenEntry[],
    currentVerkauf: VerkaufEntry[],
  ) => {
    const ids = [
      ...currentDarlehen.map((r) => r.id),
      ...currentAusgaben.map((r) => r.id),
      ...currentVerkauf.map((r) => r.id),
    ];
    return ids.length > 0 ? Math.max(...ids) + 1 : 1;
  };

  const addDarlehen = () => {
    if (hasEmptyDarlehen) return;
    setDarlehenRows((prev) => [
      {
        id: getNextId(prev, ausgabenRows, verkaufRows),
        datum: today(),
        name: "",
        preis: 0,
        geprueftVon: "",
        kaeuferAnteile: [createDefaultKaeufer("", 1)],
      },
      ...prev,
    ]);
  };

  const addDarlehenKaeufer = (rowId: number) => {
    setDarlehenRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? row.kaeuferAnteile.every((item) => item.kaeufer.trim() !== "" && item.anteil > 0)
            ? { ...row, kaeuferAnteile: [...row.kaeuferAnteile, createDefaultKaeufer("", 0)] }
            : row
          : row,
      ),
    );
  };

  const removeDarlehenKaeufer = (rowId: number, anteilId: string) => {
    showConfirm(
      "Käufer entfernen",
      "Möchtest du diesen Käufer wirklich aus dem Eintrag entfernen?",
      () => {
        setDarlehenRows((prev) =>
          prev.map((row) => {
            if (row.id !== rowId) {
              return row;
            }
            const nextAnteile = row.kaeuferAnteile.filter((item) => item.id !== anteilId);
            return {
              ...row,
              kaeuferAnteile: nextAnteile.length > 0 ? nextAnteile : [createDefaultKaeufer("", 1)],
            };
          }),
        );
      },
      "Entfernen"
    );
  };

  const updateDarlehenKaeufer = (
    rowId: number,
    anteilId: string,
    field: "kaeufer" | "anteil",
    value: string | number,
  ) => {
    setDarlehenRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) {
          return row;
        }

        return {
          ...row,
          kaeuferAnteile: row.kaeuferAnteile.map((item) =>
            item.id === anteilId
              ? {
                  ...item,
                  [field]:
                    field === "anteil" ? Math.max(0, Number(value) || 0) : String(value),
                }
              : item,
          ),
        };
      }),
    );
  };

  const addAusgabe = () => {
    if (hasEmptyAusgabe) return;
    setAusgabenRows((prev) => [
      {
        id: getNextId(darlehenRows, prev, verkaufRows),
        datum: today(),
        ausgabe: "",
        preis: 0,
        beschreibung: "",
        geprueftVon: "",
      },
      ...prev,
    ]);
  };

  const addVerkauf = () => {
    if (hasEmptyVerkauf) return;
    setVerkaufRows((prev) => [
      {
        id: getNextId(darlehenRows, ausgabenRows, prev),
        datum: today(),
        produkt: "",
        preis: 0,
        beschreibung: "",
        geprueftVon: "",
      },
      ...prev,
    ]);
  };

  const totalDarlehen = useMemo(
    () => darlehenRows.reduce((sum, row) => sum + row.preis, 0),
    [darlehenRows],
  );
  const totalAusgaben = useMemo(
    () => ausgabenRows.reduce((sum, row) => sum + row.preis, 0),
    [ausgabenRows],
  );
  const totalVerkauf = useMemo(
    () => verkaufRows.reduce((sum, row) => sum + row.preis, 0),
    [verkaufRows],
  );
  const gesamtSaldo = totalDarlehen + totalVerkauf - totalAusgaben;

  const kassenbuchRows = useMemo<KassenbuchEntry[]>(() => {
    const fromDarlehen = darlehenRows.map((row) => ({
      id: row.id,
      datum: row.datum,
      typ: "Darlehen" as const,
      einnahmen: row.preis,
      ausgaben: 0,
      saldo: row.preis,
      geprueftVon: row.geprueftVon,
    }));

    const fromAusgaben = ausgabenRows.map((row) => ({
      id: row.id,
      datum: row.datum,
      typ: "Ausgabe" as const,
      einnahmen: 0,
      ausgaben: row.preis,
      saldo: -row.preis,
      geprueftVon: row.geprueftVon,
    }));

    const fromVerkauf = verkaufRows.map((row) => ({
      id: row.id,
      datum: row.datum,
      typ: "Verkauf" as const,
      einnahmen: row.preis,
      ausgaben: 0,
      saldo: row.preis,
      geprueftVon: row.geprueftVon,
    }));

    const allSorted = [...fromDarlehen, ...fromAusgaben, ...fromVerkauf].sort((a, b) => a.id - b.id);

    return allSorted.reduce<KassenbuchEntry[]>((acc, row) => {
      const previousSaldo = acc.length > 0 ? acc[acc.length - 1].saldo : 0;
      acc.push({
        ...row,
        saldo: previousSaldo + row.saldo,
      });
      return acc;
    }, []);
  }, [darlehenRows, ausgabenRows, verkaufRows]);

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();

    const kassenbuchSheet = workbook.addWorksheet("Kassenbuch");
    kassenbuchSheet.columns = [
      { header: "ID", key: "id", width: 10 },
      { header: "Datum", key: "datum", width: 14 },
      { header: "Typ", key: "typ", width: 16 },
      { header: "Einnahmen", key: "einnahmen", width: 14 },
      { header: "Ausgaben", key: "ausgaben", width: 14 },
      { header: "Saldo", key: "saldo", width: 14 },
      { header: "Geprueft von", key: "geprueftVon", width: 20 },
    ];
    kassenbuchRows.forEach((row) => {
      kassenbuchSheet.addRow(row);
    });
    
    const kbTotalRowNum = kassenbuchRows.length + 3;
    const kbTotalRow = kassenbuchSheet.addRow({
      id: "GESAMT",
      einnahmen: { formula: `SUM(D3:D${kbTotalRowNum - 1})` },
      ausgaben: { formula: `SUM(E3:E${kbTotalRowNum - 1})` },
      saldo: { formula: `D${kbTotalRowNum}-E${kbTotalRowNum}` },
    });
    kbTotalRow.font = { bold: true };

    const darlehenSheet = workbook.addWorksheet("Darlehen");
    darlehenSheet.columns = [
      { header: "ID", key: "id", width: 10 },
      { header: "Datum", key: "datum", width: 14 },
      { header: "Kaeuferanteile", key: "kaeuferAnteile", width: 38 },
      { header: "Gesamtbetrag", key: "preis", width: 16 },
      { header: "Geprueft von", key: "geprueftVon", width: 20 },
    ];
    [...darlehenRows].sort((a, b) => a.id - b.id).forEach((row) => {
      darlehenSheet.addRow({
        ...row,
        kaeuferAnteile: serializeKaeuferAnteile(row.kaeuferAnteile),
      });
    });
    
    const darlehenTotalRowNum = darlehenRows.length + 3;
    const darlehenTotalRow = darlehenSheet.addRow({
      id: "GESAMT",
      preis: { formula: `SUM(D3:D${darlehenTotalRowNum - 1})` },
    });
    darlehenTotalRow.font = { bold: true };

    const ausgabenSheet = workbook.addWorksheet("Ausgaben");
    ausgabenSheet.columns = [
      { header: "ID", key: "id", width: 10 },
      { header: "Datum", key: "datum", width: 14 },
      { header: "Ausgabe", key: "ausgabe", width: 24 },
      { header: "Preis", key: "preis", width: 14 },
      { header: "Beschreibung", key: "beschreibung", width: 34 },
      { header: "Geprueft von", key: "geprueftVon", width: 20 },
    ];
    [...ausgabenRows].sort((a, b) => a.id - b.id).forEach((row) => {
      ausgabenSheet.addRow(row);
    });
    
    const ausgabenTotalRowNum = ausgabenRows.length + 3;
    const ausgabenTotalRow = ausgabenSheet.addRow({
      id: "GESAMT",
      preis: { formula: `SUM(D3:D${ausgabenTotalRowNum - 1})` },
    });
    ausgabenTotalRow.font = { bold: true };

    const verkaufSheet = workbook.addWorksheet("Verkauf");
    verkaufSheet.columns = [
      { header: "ID", key: "id", width: 10 },
      { header: "Datum", key: "datum", width: 14 },
      { header: "Produkt", key: "produkt", width: 24 },
      { header: "Preis", key: "preis", width: 14 },
      { header: "Beschreibung", key: "beschreibung", width: 34 },
      { header: "Geprueft von", key: "geprueftVon", width: 20 },
    ];
    [...verkaufRows].sort((a, b) => a.id - b.id).forEach((row) => {
      verkaufSheet.addRow(row);
    });
    
    const verkaufTotalRowNum = verkaufRows.length + 3;
    const verkaufTotalRow = verkaufSheet.addRow({
      id: "GESAMT",
      preis: { formula: `SUM(D3:D${verkaufTotalRowNum - 1})` },
    });
    verkaufTotalRow.font = { bold: true };

    const now = new Date();
    const lastEdited = now.toLocaleDateString("de-DE") + " " + now.toLocaleTimeString("de-DE", { hour: '2-digit', minute: '2-digit' });
    const metaText = `Buchhaltung von: Riesener Fashion Company - Zuletzt Bearbeitet: ${lastEdited} - Hinweis: Das Bearbeiten der Excel-Datei kann zur Korruption führen und somit nicht mehr importiert werden, einzelne Werte in den Einträgen können ohne Bedenken geändert werden, nur sollten Felder nicht leer bleiben.`;

    [kassenbuchSheet, darlehenSheet, ausgabenSheet, verkaufSheet].forEach((sheet) => {
      sheet.insertRow(1, [metaText]);
      sheet.mergeCells(1, 1, 1, sheet.columns.length);
      sheet.getRow(1).alignment = { wrapText: true };
      sheet.getRow(1).font = { italic: true, size: 10 };

      sheet.getRow(2).font = { bold: true };

      sheet.eachRow((row, rowNum) => {
        if (rowNum <= 2) return;
        row.eachCell((cell, colNum) => {
          const header = sheet.getRow(2).getCell(colNum).text;
          if (["Preis", "Gesamtbetrag", "Einnahmen", "Ausgaben", "Saldo"].includes(header)) {
            cell.numFmt = "#,##0.00";
          }
        });
      });
    });

    const dateStr = now.toLocaleDateString("de-DE").replace(/\./g, "-");
    const timeStr = now.toLocaleTimeString("de-DE", { hour: '2-digit', minute: '2-digit' }).replace(/:/g, "-");
    const filename = `buchhaltung_${dateStr}_${timeStr}.xlsx`;

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), filename);

    showConfirm(
      "Backup erstellen",
      "Möchtest du diese Daten auch als Backup in der Cloud speichern, um sie später am Handy oder PC wiederherzustellen?",
      async () => {
        try {
          const resp = await fetch(`/api/backup?filename=${encodeURIComponent(filename)}`, {
            method: "POST",
            headers: { "content-type": "application/octet-stream" },
            body: buffer,
          });
          if (!resp.ok) {
            const data = await resp.json().catch(() => null);
            if (data?.code === "BLOB_UNREACHABLE") {
              showAlert("Fehler", "Backup server aktuell nicht erreichbar.");
            } else {
              showAlert("Fehler", "Backup Upload fehlgeschlagen.");
            }
          } else {
            showAlert("Erfolg", "Backup wurde erfolgreich hochgeladen und kann nun im Backups Tab geladen werden.");
            setActiveTab("backups");
          }
        } catch (err) {
          console.error("Backup upload error", err);
          showAlert("Fehler", "Backup Upload fehlgeschlagen.");
        }
      },
      "Backup erstellen",
      "Nein"
    );
  };

  const findSheet = (workbook: ExcelJS.Workbook, name: string) =>
    workbook.worksheets.find((sheet) => sheet.name.toLowerCase() === name.toLowerCase());

  const processWorkbook = async (workbook: ExcelJS.Workbook) => {
    const usedIds = new Set<number>();
    let nextImportedId = 1;

    const readOrCreateId = (value: ExcelJS.CellValue | null | undefined) => {
      const candidate = Number(parseCellText(value));
      if (Number.isInteger(candidate) && candidate > 0 && !usedIds.has(candidate)) {
        usedIds.add(candidate);
        nextImportedId = Math.max(nextImportedId, candidate + 1);
        return candidate;
      }
      while (usedIds.has(nextImportedId)) {
        nextImportedId += 1;
      }
      const generated = nextImportedId;
      usedIds.add(generated);
      nextImportedId += 1;
      return generated;
    };

    const importedDarlehen: DarlehenEntry[] = [];
    const importedAusgaben: AusgabenEntry[] = [];
    const importedVerkauf: VerkaufEntry[] = [];

    const darlehenSheet = findSheet(workbook, "Darlehen");
    const ausgabenSheet = findSheet(workbook, "Ausgaben");
    const verkaufSheet = findSheet(workbook, "Verkauf");

    const darlehenHeaderMap = getHeaderColumnMap(darlehenSheet);
    const darlehenHasNameColumn =
      darlehenHeaderMap.has(normalizeHeaderLabel("Darlehen")) ||
      darlehenHeaderMap.has(normalizeHeaderLabel("Name"));
    const darlehenHasAnzahlColumn = darlehenHeaderMap.has(normalizeHeaderLabel("Anzahl"));
    const darlehenColumns = {
      id: resolveColumnIndex(darlehenHeaderMap, ["ID"], 1),
      datum: resolveColumnIndex(darlehenHeaderMap, ["Datum"], 2),
      name: darlehenHasNameColumn
        ? resolveColumnIndex(darlehenHeaderMap, ["Darlehen", "Name"], 3)
        : -1,
      preis: resolveColumnIndex(darlehenHeaderMap, ["Gesamtbetrag", "Preis"], 4),
      anzahl: darlehenHasAnzahlColumn ? resolveColumnIndex(darlehenHeaderMap, ["Anzahl"], 4) : -1,
      kaeuferAnteile: resolveColumnIndex(
        darlehenHeaderMap,
        ["Kaeuferanteile", "Kauferanteile", "Anteile", "BuyerShares"],
        darlehenHasNameColumn ? 5 : 3,
      ),
      geprueftVon: resolveColumnIndex(
        darlehenHeaderMap,
        ["Geprueft von", "Gepruft von", "Pruefer", "Prufer"],
        darlehenHasNameColumn ? 6 : 5,
      ),
    };

    const ausgabenHeaderMap = getHeaderColumnMap(ausgabenSheet);
    const ausgabenHasDatum = ausgabenHeaderMap.has(normalizeHeaderLabel("Datum"));
    const ausgabenColumns = {
      id: resolveColumnIndex(ausgabenHeaderMap, ["ID"], 1),
      datum: ausgabenHasDatum ? resolveColumnIndex(ausgabenHeaderMap, ["Datum"], 2) : -1,
      ausgabe: resolveColumnIndex(ausgabenHeaderMap, ["Ausgabe"], ausgabenHasDatum ? 3 : 2),
      preis: resolveColumnIndex(ausgabenHeaderMap, ["Preis"], ausgabenHasDatum ? 4 : 3),
      beschreibung: resolveColumnIndex(ausgabenHeaderMap, ["Beschreibung", "Notiz"], ausgabenHasDatum ? 5 : 4),
      geprueftVon: resolveColumnIndex(ausgabenHeaderMap, ["Geprueft von", "Gepruft von", "Pruefer", "Prufer"], ausgabenHasDatum ? 6 : 5),
    };

    const verkaufHeaderMap = getHeaderColumnMap(verkaufSheet);
    const verkaufHasDatum = verkaufHeaderMap.has(normalizeHeaderLabel("Datum"));
    const verkaufColumns = {
      id: resolveColumnIndex(verkaufHeaderMap, ["ID"], 1),
      datum: verkaufHasDatum ? resolveColumnIndex(verkaufHeaderMap, ["Datum"], 2) : -1,
      produkt: resolveColumnIndex(verkaufHeaderMap, ["Produkt"], verkaufHasDatum ? 3 : 2),
      preis: resolveColumnIndex(verkaufHeaderMap, ["Preis"], verkaufHasDatum ? 4 : 3),
      beschreibung: resolveColumnIndex(verkaufHeaderMap, ["Beschreibung", "Notiz"], verkaufHasDatum ? 5 : 4),
      geprueftVon: resolveColumnIndex(verkaufHeaderMap, ["Geprueft von", "Gepruft von", "Pruefer", "Prufer"], verkaufHasDatum ? 6 : 5),
    };

    darlehenSheet?.eachRow((row, rowNumber) => {
      if (rowNumber <= 2) return;

      const darlehenCellValues = [
        row.getCell(darlehenColumns.id).value,
        row.getCell(darlehenColumns.datum).value,
        darlehenColumns.name > 0 ? row.getCell(darlehenColumns.name).value : null,
        row.getCell(darlehenColumns.preis).value,
        row.getCell(darlehenColumns.kaeuferAnteile).value,
        row.getCell(darlehenColumns.geprueftVon).value,
      ];

      if (isMetaRowLabel(row.getCell(darlehenColumns.id).value) || isEffectivelyEmpty(darlehenCellValues)) return;

      const oldAnzahl =
        darlehenColumns.anzahl > 0
          ? Math.max(0, Math.floor(parseCellNumber(row.getCell(darlehenColumns.anzahl).value)))
          : 0;
      const preisRaw = parseCellNumber(row.getCell(darlehenColumns.preis).value);
      const preis = preisRaw;
      const name =
        darlehenColumns.name > 0 ? parseCellText(row.getCell(darlehenColumns.name).value) : "";
      const kaeuferText = parseCellText(row.getCell(darlehenColumns.kaeuferAnteile).value);

      const entry = normalizeDarlehenEntry({
        id: readOrCreateId(row.getCell(darlehenColumns.id).value),
        datum: parseCellText(row.getCell(darlehenColumns.datum).value) || today(),
        name,
        preis,
        geprueftVon: parseCellText(row.getCell(darlehenColumns.geprueftVon).value),
        kaeuferAnteile:
          kaeuferText.trim() !== ""
            ? parseKaeuferAnteile(kaeuferText, name)
            : [createDefaultKaeufer(name, oldAnzahl > 0 ? oldAnzahl : 1)],
      });

      if (
        entry.name.trim() !== "" ||
        entry.preis !== 0 ||
        entry.geprueftVon.trim() !== "" ||
        entry.kaeuferAnteile.some((item) => item.kaeufer.trim() !== "" || item.anteil > 0)
      ) {
        importedDarlehen.push(entry);
      }
    });

    ausgabenSheet?.eachRow((row, rowNumber) => {
      if (rowNumber <= 2) return;
      const ausgabenCellValues = [row.getCell(ausgabenColumns.id).value, ausgabenColumns.datum > 0 ? row.getCell(ausgabenColumns.datum).value : null, row.getCell(ausgabenColumns.ausgabe).value, row.getCell(ausgabenColumns.preis).value, row.getCell(ausgabenColumns.beschreibung).value, row.getCell(ausgabenColumns.geprueftVon).value];
      if (isMetaRowLabel(row.getCell(ausgabenColumns.id).value) || isEffectivelyEmpty(ausgabenCellValues)) return;
      const entry: AusgabenEntry = {
        id: readOrCreateId(row.getCell(ausgabenColumns.id).value),
        datum: ausgabenColumns.datum > 0 ? parseCellText(row.getCell(ausgabenColumns.datum).value) || today() : today(),
        ausgabe: parseCellText(row.getCell(ausgabenColumns.ausgabe).value),
        preis: parseCellNumber(row.getCell(ausgabenColumns.preis).value),
        beschreibung: parseCellText(row.getCell(ausgabenColumns.beschreibung).value),
        geprueftVon: parseCellText(row.getCell(ausgabenColumns.geprueftVon).value),
      };
      if (entry.ausgabe.trim() !== "" || entry.preis !== 0 || entry.beschreibung.trim() !== "" || entry.geprueftVon.trim() !== "") {
        importedAusgaben.push(entry);
      }
    });

    verkaufSheet?.eachRow((row, rowNumber) => {
      if (rowNumber <= 2) return;
      const verkaufCellValues = [row.getCell(verkaufColumns.id).value, verkaufColumns.datum > 0 ? row.getCell(verkaufColumns.datum).value : null, row.getCell(verkaufColumns.produkt).value, row.getCell(verkaufColumns.preis).value, row.getCell(verkaufColumns.beschreibung).value, row.getCell(verkaufColumns.geprueftVon).value];
      if (isMetaRowLabel(row.getCell(verkaufColumns.id).value) || isEffectivelyEmpty(verkaufCellValues)) return;
      const entry: VerkaufEntry = {
        id: readOrCreateId(row.getCell(verkaufColumns.id).value),
        datum: verkaufColumns.datum > 0 ? parseCellText(row.getCell(verkaufColumns.datum).value) || today() : today(),
        produkt: parseCellText(row.getCell(verkaufColumns.produkt).value),
        preis: parseCellNumber(row.getCell(verkaufColumns.preis).value),
        beschreibung: parseCellText(row.getCell(verkaufColumns.beschreibung).value),
        geprueftVon: parseCellText(row.getCell(verkaufColumns.geprueftVon).value),
      };
      if (entry.produkt.trim() !== "" || entry.preis !== 0 || entry.beschreibung.trim() !== "" || entry.geprueftVon.trim() !== "") {
        importedVerkauf.push(entry);
      }
    });

    setDarlehenRows(importedDarlehen.sort((a, b) => b.id - a.id));
    setAusgabenRows(importedAusgaben.sort((a, b) => b.id - a.id));
    setVerkaufRows(importedVerkauf.sort((a, b) => b.id - a.id));
    setHasInitialized(true);
    setActiveTab("dashboard");
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const workbook = new ExcelJS.Workbook();
      const arrayBuffer = await file.arrayBuffer();
      await workbook.xlsx.load(arrayBuffer as ArrayBuffer);
      await processWorkbook(workbook);
    } catch (error) {
      console.error("Fehler beim Laden:", error);
      showAlert("Fehler beim Import", "Die Excel-Datei konnte nicht gelesen werden. Bitte überprüfe das Format.");
    }
    e.target.value = "";
  };

  const handleRestoreBackup = async (filename: string) => {
    try {
      const resp = await fetch(`/api/backup/download?filename=${encodeURIComponent(filename)}`);
      if (!resp.ok) {
        const data = await resp.json().catch(() => null);
        if (data?.code === "BLOB_UNREACHABLE") {
          showAlert(
            "Backup-Server nicht erreichbar",
            "Zu diesem Server kann keine Verbindung mehr aufgebaut werden. Die Anwendung funktioniert weiter, aber Backups sind gerade nicht verfuegbar.",
          );
          return;
        }
        throw new Error("Download failed");
      }
      const buffer = await resp.arrayBuffer();
      
      // Automatischer Download im Browser
      saveAs(new Blob([buffer]), filename);
      
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      await processWorkbook(workbook);
      showAlert("Backup geladen", `Das Backup "${filename}" wurde erfolgreich wiederhergestellt und heruntergeladen.`);
    } catch (err) {
      console.error("Error restoring backup:", err);
      showAlert("Fehler", "Backup konnte nicht geladen werden.");
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-6 bg-white text-slate-900 font-sans">
      <div className="max-w-5xl mx-auto border-x border-slate-100 sm:px-4">
        <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center mb-8 gap-4 pt-4">
          <h1 className="text-xl font-bold flex items-center gap-2 text-slate-800 tracking-tight">
            <FileSpreadsheet className="text-blue-500 w-5 h-5" /> BUCHHALTUNG
            <button 
              onClick={showHelp}
              className="p-1 hover:bg-slate-100 rounded-full transition-colors cursor-pointer text-slate-400 hover:text-slate-600"
              title="Informationen"
            >
              <Info className="w-4 h-4" />
            </button>
          </h1>
          <div className="flex gap-2">
            <label className="cursor-pointer bg-white hover:bg-slate-50 text-slate-600 px-3 py-1.5 rounded border border-slate-200 text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm">
              <Download className="w-3.5 h-3.5 rotate-180" /> Import
              <input type="file" accept=".xlsx" className="hidden" onChange={handleFileUpload} />
            </label>
            <button
              onClick={exportToExcel}
              className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md shadow-slate-200 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> <div className="text-[11px] font-bold uppercase tracking-wider">Export</div>
            </button>
          </div>
        </div>

        <SummaryCards
          totalDarlehen={totalDarlehen}
          totalAusgaben={totalAusgaben}
          totalVerkauf={totalVerkauf}
          gesamtSaldo={gesamtSaldo}
        />

        <NavigationTabs activeTab={activeTab} onChange={handleTabChange} />

        {activeTab === "dashboard" && <DashboardAnalytics rows={kassenbuchRows} />}
        {activeTab === "kassenbuch" && (
          <>
            <KassenbuchTable 
              rows={[...kassenbuchRows]
                .sort((a, b) => b.id - a.id)
                .slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)
              } 
            />
            <Pagination 
              currentPage={currentPage}
              totalPages={Math.ceil(kassenbuchRows.length / rowsPerPage)}
              onPageChange={setCurrentPage}
            />
          </>
        )}
        {activeTab === "darlehen" && (
          <>
            <DarlehenTable
              rows={darlehenRows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)}
              globalMaxId={
                [...darlehenRows, ...ausgabenRows, ...verkaufRows].reduce(
                  (max, r) => (r.id > max ? r.id : max),
                  0
                )
              }
              onAdd={() => {
                addDarlehen();
                setCurrentPage(1);
              }}
              onRemove={(id) => {
                const currentMaxId = [...darlehenRows, ...ausgabenRows, ...verkaufRows].reduce(
                  (max, r) => (r.id > max ? r.id : max),
                  0
                );
                if (id === currentMaxId) {
                  showConfirm(
                    "Eintrag löschen",
                    "Möchtest du diesen Eintrag wirklich löschen?",
                    () => setDarlehenRows((prev) => prev.filter((row) => row.id !== id)),
                    "Löschen"
                  );
                }
              }}
              onUpdate={(id, field, value) =>
                setDarlehenRows((prev) =>
                  prev.map((row) =>
                    row.id === id
                      ? {
                          ...row,
                          [field]: field === "preis" ? Math.max(0, Number(value) || 0) : value,
                        }
                      : row,
                  ),
                )
              }
              onAddKaeufer={addDarlehenKaeufer}
              onRemoveKaeufer={removeDarlehenKaeufer}
              onUpdateKaeufer={updateDarlehenKaeufer}
            />
            <Pagination 
              currentPage={currentPage}
              totalPages={Math.ceil(darlehenRows.length / rowsPerPage)}
              onPageChange={setCurrentPage}
            />
          </>
        )}
        {activeTab === "ausgaben" && (
          <>
            <AusgabenTable
              rows={ausgabenRows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)}
              globalMaxId={
                [...darlehenRows, ...ausgabenRows, ...verkaufRows].reduce(
                  (max, r) => (r.id > max ? r.id : max),
                  0
                )
              }
              onAdd={() => {
                addAusgabe();
                setCurrentPage(1);
              }}
              onRemove={(id) => {
                const currentMaxId = [...darlehenRows, ...ausgabenRows, ...verkaufRows].reduce(
                  (max, r) => (max === 0 || r.id > max ? r.id : max),
                  0
                );
                if (id === currentMaxId) {
                  showConfirm(
                    "Eintrag löschen",
                    "Möchtest du diesen Eintrag wirklich löschen?",
                    () => setAusgabenRows((prev) => prev.filter((row) => row.id !== id)),
                    "Löschen"
                  );
                }
              }}
              onUpdate={(id, field, value) =>
                setAusgabenRows((prev) =>
                  prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
                )
              }
            />
            <Pagination 
              currentPage={currentPage}
              totalPages={Math.ceil(ausgabenRows.length / rowsPerPage)}
              onPageChange={setCurrentPage}
            />
          </>
        )}
        {activeTab === "verkauf" && (
          <>
            <VerkaufTable
              rows={verkaufRows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)}
              globalMaxId={
                [...darlehenRows, ...ausgabenRows, ...verkaufRows].reduce(
                  (max, r) => (r.id > max ? r.id : max),
                  0
                )
              }
              onAdd={() => {
                addVerkauf();
                setCurrentPage(1);
              }}
              onRemove={(id) => {
                const currentMaxId = [...darlehenRows, ...ausgabenRows, ...verkaufRows].reduce(
                  (max, r) => (r.id > max ? r.id : max),
                  0
                );
                if (id === currentMaxId) {
                  showConfirm(
                    "Eintrag löschen",
                    "Möchtest du diesen Eintrag wirklich löschen?",
                    () => setVerkaufRows((prev) => prev.filter((row) => row.id !== id)),
                    "Löschen"
                  );
                }
              }}
              onUpdate={(id, field, value) =>
                setVerkaufRows((prev) =>
                  prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
                )
              }
            />
            <Pagination 
              currentPage={currentPage}
              totalPages={Math.ceil(verkaufRows.length / rowsPerPage)}
              onPageChange={setCurrentPage}
            />
          </>
        )}
        {activeTab === "backups" && <BackupList onRestore={handleRestoreBackup} />}
      </div>

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

function createAnteilId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createDefaultKaeufer(kaeufer = "", anteil = 1): DarlehenKaeuferAnteil {
  return {
    id: createAnteilId(),
    kaeufer,
    anteil,
  };
}

function parseKaeuferAnteile(text: string, fallbackName = ""): DarlehenKaeuferAnteil[] {
  const raw = text.trim();
  if (!raw) {
    return [createDefaultKaeufer(fallbackName, 1)];
  }

  const parts = raw
    .split(/[;\n]/)
    .map((part) => part.trim())
    .filter(Boolean);

  const parsed = parts
    .map((part) => {
      const match = part.match(/^(.*?)\s*(?:\(([-\d.,]+)\s*%?\)|:\s*([-\d.,]+)\s*%?)?$/);
      if (!match) {
        return createDefaultKaeufer(part, 0);
      }

      const kaeufer = (match[1] || "").trim();
      const anteilRaw = (match[2] || match[3] || "0").replace(",", ".");
      const anteil = Number.isFinite(Number(anteilRaw)) ? Number(anteilRaw) : 0;

      return createDefaultKaeufer(kaeufer, Math.max(0, anteil));
    })
    .filter((item) => item.kaeufer !== "" || item.anteil > 0);

  if (parsed.length > 0) {
    return parsed;
  }

  return [createDefaultKaeufer(fallbackName, 1)];
}

function serializeKaeuferAnteile(anteile: DarlehenKaeuferAnteil[]) {
  if (!anteile || anteile.length === 0) return "";
  const parts = anteile.map((item) => {
    const name = item.kaeufer || "Unbekannt";
    const anteilNum = Number(item.anteil) || 0;
    const formatted = Number.isInteger(anteilNum) ? String(anteilNum) : String(anteilNum);
    return `${name} (${formatted})`;
  });
  return parts.join("; ");
}

function normalizeDarlehenEntry(row: Partial<DarlehenEntry>): DarlehenEntry {
  const anteile = Array.isArray(row.kaeuferAnteile)
    ? row.kaeuferAnteile.map((item) => ({
        id: item.id || createAnteilId(),
        kaeufer: item.kaeufer || "",
        anteil: Number.isFinite(Number(item.anteil)) ? Number(item.anteil) : 0,
      }))
    : [];

  return {
    id: Number(row.id) || 0,
    datum: row.datum || today(),
    name: row.name || "",
    preis: Number.isFinite(Number(row.preis)) ? Number(row.preis) : 0,
    geprueftVon: row.geprueftVon || "",
    kaeuferAnteile: anteile.length > 0 ? anteile : [createDefaultKaeufer(row.name || "", 1)],
  };
}

function isValidDarlehenRow(row: DarlehenEntry) {
  return (
    row.geprueftVon.trim() !== "" &&
    row.preis !== 0 &&
    row.kaeuferAnteile.length > 0 &&
    row.kaeuferAnteile.every((item) => item.kaeufer.trim() !== "" && item.anteil > 0)
  );
}