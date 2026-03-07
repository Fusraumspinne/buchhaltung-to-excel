"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import * as ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { Download, FileSpreadsheet } from "lucide-react";
import { AlertModal } from "@/components/alert-modal";
import { AusgabenTable } from "@/components/ausgaben-table";
import { DarlehenTable } from "@/components/darlehen-table";
import { DashboardAnalytics } from "@/components/dashboard-analytics";
import { KassenbuchTable } from "@/components/kassenbuch-table";
import { NavigationTabs } from "@/components/navigation-tabs";
import { Pagination } from "@/components/pagination";
import { SummaryCards } from "@/components/summary-cards";
import { VerkaufTable } from "@/components/verkauf-table";
import {
  AusgabenEntry,
  DarlehenEntry,
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

  sheet.getRow(1).eachCell((cell, colNumber) => {
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
  }>({
    isOpen: false,
    title: "",
    message: "",
  });

  const showAlert = (title: string, message: string) => {
    setAlertConfig({ isOpen: true, title, message });
  };

  const showConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    confirmLabel = "Bestätigen"
  ) => {
    setAlertConfig({ isOpen: true, title, message, onConfirm, confirmLabel });
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
            setDarlehenRows(parsed.darlehen || []);
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
          return darlehenRows.some(r => r.name.trim() === "" || r.geprueftVon.trim() === "" || r.preis === 0);
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
          setDarlehenRows((prev) =>
            prev.filter((r) => r.name.trim() !== "" && r.geprueftVon.trim() !== "" && r.preis !== 0),
          );
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

    setDarlehenRows((prev) =>
      prev.filter((r) => r.name.trim() !== "" && r.geprueftVon.trim() !== "" && r.preis !== 0),
    );
    setAusgabenRows((prev) =>
      prev.filter((r) => r.ausgabe.trim() !== "" && r.geprueftVon.trim() !== "" && r.preis !== 0),
    );
    setVerkaufRows((prev) =>
      prev.filter((r) => r.produkt.trim() !== "" && r.geprueftVon.trim() !== "" && r.preis !== 0),
    );
    setActiveTab(newTab);
    setCurrentPage(1);
  };

  const hasEmptyDarlehen = darlehenRows.some(
    (r) => r.name.trim() === "" || r.geprueftVon.trim() === "" || r.preis === 0,
  );
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
        anzahl: 1,
        preis: 0,
        geprueftVon: "",
      },
      ...prev,
    ]);
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
    () => darlehenRows.reduce((sum, row) => sum + row.preis * row.anzahl, 0),
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
      einnahmen: row.preis * row.anzahl,
      ausgaben: 0,
      saldo: row.preis * row.anzahl,
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
    
    const kbTotalRowNum = kassenbuchRows.length + 2;
    const kbTotalRow = kassenbuchSheet.addRow({
      id: "GESAMT",
      einnahmen: { formula: `SUM(D2:D${kbTotalRowNum - 1})` },
      ausgaben: { formula: `SUM(E2:E${kbTotalRowNum - 1})` },
      saldo: { formula: `D${kbTotalRowNum}-E${kbTotalRowNum}` },
    });
    kbTotalRow.font = { bold: true };

    const darlehenSheet = workbook.addWorksheet("Darlehen");
    darlehenSheet.columns = [
      { header: "ID", key: "id", width: 10 },
      { header: "Datum", key: "datum", width: 14 },
      { header: "Name", key: "name", width: 24 },
      { header: "Anzahl", key: "anzahl", width: 12 },
      { header: "Preis", key: "preis", width: 14 },
      { header: "Geprueft von", key: "geprueftVon", width: 20 },
    ];
    [...darlehenRows].sort((a, b) => a.id - b.id).forEach((row) => {
      darlehenSheet.addRow(row);
    });
    
    const darlehenTotalRowNum = darlehenRows.length + 2;
    const darlehenTotalRow = darlehenSheet.addRow({
      id: "GESAMT",
      anzahl: { formula: `SUM(D2:D${darlehenTotalRowNum - 1})` },
      preis: { formula: `SUMPRODUCT(D2:D${darlehenTotalRowNum - 1},E2:E${darlehenTotalRowNum - 1})` },
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
    
    const ausgabenTotalRowNum = ausgabenRows.length + 2;
    const ausgabenTotalRow = ausgabenSheet.addRow({
      id: "GESAMT",
      preis: { formula: `SUM(D2:D${ausgabenTotalRowNum - 1})` },
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
    
    const verkaufTotalRowNum = verkaufRows.length + 2;
    const verkaufTotalRow = verkaufSheet.addRow({
      id: "GESAMT",
      preis: { formula: `SUM(D2:D${verkaufTotalRowNum - 1})` },
    });
    verkaufTotalRow.font = { bold: true };

    [kassenbuchSheet, darlehenSheet, ausgabenSheet, verkaufSheet].forEach((sheet) => {
      sheet.getRow(1).font = { bold: true };
      
      sheet.eachRow((row, rowNum) => {
        if (rowNum === 1) return;
        row.eachCell((cell, colNum) => {
          const header = sheet.getRow(1).getCell(colNum).text;
          if (["Preis", "Einnahmen", "Ausgaben", "Saldo"].includes(header)) {
            cell.numFmt = "#,##0.00";
          }
        });
      });
    });

    const now = new Date();
    const dateStr = now.toLocaleDateString("de-DE").replace(/\./g, "-");
    const timeStr = now.toLocaleTimeString("de-DE", { hour: '2-digit', minute: '2-digit' }).replace(/:/g, "-");
    const filename = `buchhaltung_${dateStr}_${timeStr}.xlsx`;

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), filename);
  };

  const findSheet = (workbook: ExcelJS.Workbook, name: string) =>
    workbook.worksheets.find((sheet) => sheet.name.toLowerCase() === name.toLowerCase());

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const arrayBuffer = await file.arrayBuffer();
      await workbook.xlsx.load(arrayBuffer as ArrayBuffer);

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

      const ausgabenHeaderMap = getHeaderColumnMap(ausgabenSheet);
      const ausgabenHasDatum = ausgabenHeaderMap.has(normalizeHeaderLabel("Datum"));
      const ausgabenColumns = {
        id: resolveColumnIndex(ausgabenHeaderMap, ["ID"], 1),
        datum: ausgabenHasDatum
          ? resolveColumnIndex(ausgabenHeaderMap, ["Datum"], 2)
          : -1,
        ausgabe: resolveColumnIndex(ausgabenHeaderMap, ["Ausgabe"], ausgabenHasDatum ? 3 : 2),
        preis: resolveColumnIndex(ausgabenHeaderMap, ["Preis"], ausgabenHasDatum ? 4 : 3),
        beschreibung: resolveColumnIndex(
          ausgabenHeaderMap,
          ["Beschreibung", "Notiz"],
          ausgabenHasDatum ? 5 : 4,
        ),
        geprueftVon: resolveColumnIndex(
          ausgabenHeaderMap,
          ["Geprueft von", "Gepruft von", "Pruefer", "Prufer"],
          ausgabenHasDatum ? 6 : 5,
        ),
      };

      const verkaufHeaderMap = getHeaderColumnMap(verkaufSheet);
      const verkaufHasDatum = verkaufHeaderMap.has(normalizeHeaderLabel("Datum"));
      const verkaufColumns = {
        id: resolveColumnIndex(verkaufHeaderMap, ["ID"], 1),
        datum: verkaufHasDatum
          ? resolveColumnIndex(verkaufHeaderMap, ["Datum"], 2)
          : -1,
        produkt: resolveColumnIndex(verkaufHeaderMap, ["Produkt"], verkaufHasDatum ? 3 : 2),
        preis: resolveColumnIndex(verkaufHeaderMap, ["Preis"], verkaufHasDatum ? 4 : 3),
        beschreibung: resolveColumnIndex(
          verkaufHeaderMap,
          ["Beschreibung", "Notiz"],
          verkaufHasDatum ? 5 : 4,
        ),
        geprueftVon: resolveColumnIndex(
          verkaufHeaderMap,
          ["Geprueft von", "Gepruft von", "Pruefer", "Prufer"],
          verkaufHasDatum ? 6 : 5,
        ),
      };

      darlehenSheet?.eachRow((row, rowNumber) => {
        if (rowNumber === 1) {
          return;
        }

        if (
          isMetaRowLabel(row.getCell(1).value) ||
          isEffectivelyEmpty([
            row.getCell(1).value,
            row.getCell(2).value,
            row.getCell(3).value,
            row.getCell(4).value,
            row.getCell(5).value,
            row.getCell(6).value,
          ])
        ) {
          return;
        }

        const entry: DarlehenEntry = {
          id: readOrCreateId(row.getCell(1).value),
          datum: parseCellText(row.getCell(2).value) || today(),
          name: parseCellText(row.getCell(3).value),
          anzahl: Math.max(0, Math.floor(parseCellNumber(row.getCell(4).value))),
          preis: parseCellNumber(row.getCell(5).value),
          geprueftVon: parseCellText(row.getCell(6).value),
        };

        const isMeaningful =
          entry.name.trim() !== "" ||
          entry.anzahl > 0 ||
          entry.preis !== 0 ||
          entry.geprueftVon.trim() !== "";

        if (isMeaningful) {
          importedDarlehen.push(entry);
        }
      });

      ausgabenSheet?.eachRow((row, rowNumber) => {
        if (rowNumber === 1) {
          return;
        }

        const ausgabenCellValues = [
          row.getCell(ausgabenColumns.id).value,
          ausgabenColumns.datum > 0 ? row.getCell(ausgabenColumns.datum).value : null,
          row.getCell(ausgabenColumns.ausgabe).value,
          row.getCell(ausgabenColumns.preis).value,
          row.getCell(ausgabenColumns.beschreibung).value,
          row.getCell(ausgabenColumns.geprueftVon).value,
        ];

        if (
          isMetaRowLabel(row.getCell(ausgabenColumns.id).value) ||
          isEffectivelyEmpty(ausgabenCellValues)
        ) {
          return;
        }

        const entry: AusgabenEntry = {
          id: readOrCreateId(row.getCell(ausgabenColumns.id).value),
          datum:
            ausgabenColumns.datum > 0
              ? parseCellText(row.getCell(ausgabenColumns.datum).value) || today()
              : today(),
          ausgabe: parseCellText(row.getCell(ausgabenColumns.ausgabe).value),
          preis: parseCellNumber(row.getCell(ausgabenColumns.preis).value),
          beschreibung: parseCellText(row.getCell(ausgabenColumns.beschreibung).value),
          geprueftVon: parseCellText(row.getCell(ausgabenColumns.geprueftVon).value),
        };

        const isMeaningful =
          entry.ausgabe.trim() !== "" ||
          entry.preis !== 0 ||
          entry.beschreibung.trim() !== "" ||
          entry.geprueftVon.trim() !== "";

        if (isMeaningful) {
          importedAusgaben.push(entry);
        }
      });

      verkaufSheet?.eachRow((row, rowNumber) => {
        if (rowNumber === 1) {
          return;
        }

        const verkaufCellValues = [
          row.getCell(verkaufColumns.id).value,
          verkaufColumns.datum > 0 ? row.getCell(verkaufColumns.datum).value : null,
          row.getCell(verkaufColumns.produkt).value,
          row.getCell(verkaufColumns.preis).value,
          row.getCell(verkaufColumns.beschreibung).value,
          row.getCell(verkaufColumns.geprueftVon).value,
        ];

        if (
          isMetaRowLabel(row.getCell(verkaufColumns.id).value) ||
          isEffectivelyEmpty(verkaufCellValues)
        ) {
          return;
        }

        const entry: VerkaufEntry = {
          id: readOrCreateId(row.getCell(verkaufColumns.id).value),
          datum:
            verkaufColumns.datum > 0
              ? parseCellText(row.getCell(verkaufColumns.datum).value) || today()
              : today(),
          produkt: parseCellText(row.getCell(verkaufColumns.produkt).value),
          preis: parseCellNumber(row.getCell(verkaufColumns.preis).value),
          beschreibung: parseCellText(row.getCell(verkaufColumns.beschreibung).value),
          geprueftVon: parseCellText(row.getCell(verkaufColumns.geprueftVon).value),
        };

        const isMeaningful =
          entry.produkt.trim() !== "" ||
          entry.preis !== 0 ||
          entry.beschreibung.trim() !== "" ||
          entry.geprueftVon.trim() !== "";

        if (isMeaningful) {
          importedVerkauf.push(entry);
        }
      });

      setDarlehenRows(importedDarlehen.sort((a, b) => b.id - a.id));
      setAusgabenRows(importedAusgaben.sort((a, b) => b.id - a.id));
      setVerkaufRows(importedVerkauf.sort((a, b) => b.id - a.id));
      
      // Update hasInitialized to true just in case it wasn't already, 
      // ensuring the imported data gets saved to localStorage immediately via the effect
      setHasInitialized(true);
    } catch (error) {
      console.error("Fehler beim Laden:", error);
      showAlert("Fehler beim Import", "Die Excel-Datei konnte nicht gelesen werden. Bitte überprüfe das Format.");
    }

    e.target.value = "";
  };

  return (
    <div className="min-h-screen p-4 md:p-6 bg-white text-slate-900 font-sans">
      <div className="max-w-5xl mx-auto border-x border-slate-100 sm:px-4">
        <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center mb-8 gap-4 pt-4">
          <h1 className="text-xl font-bold flex items-center gap-2 text-slate-800 tracking-tight">
            <FileSpreadsheet className="text-blue-500 w-5 h-5" /> BUCHHALTUNG
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
                  prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
                )
              }
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
      </div>

      <AlertModal
        isOpen={alertConfig.isOpen}
        title={alertConfig.title}
        message={alertConfig.message}
        onConfirm={alertConfig.onConfirm}
        confirmLabel={alertConfig.confirmLabel}
        onClose={() => setAlertConfig((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}