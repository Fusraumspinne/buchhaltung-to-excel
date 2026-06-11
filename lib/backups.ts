import { randomUUID } from "crypto";
import { Prisma, SheetCategory as PrismaSheetCategory } from "@prisma/client";
import {
  BackupSnapshot,
  BackupSummary,
  ColumnConfig,
  SheetConfig,
  SheetRow,
  createGesamtbetragColumn,
  createId,
  GESAMTBETRAG_COLUMN_ID,
  SHEET_COLORS,
} from "@/lib/types";

export const BACKUP_LIMIT = 25;
export const BACKUP_VERSION = 1;

type AuthenticatedProfile = {
  id: string;
  name: string;
};

type Tx = Prisma.TransactionClient;

type DbSheet = {
  id: string;
  name: string;
  category: PrismaSheetCategory;
  color: string;
  columns: Prisma.JsonValue;
  sortOrder: number;
  rows?: DbRow[];
};

type DbRow = {
  sheetId: string;
  rowId: number;
  datum: string;
  values: Prisma.JsonValue;
  sortOrder?: number;
};

type DbBackup = {
  id: string;
  label: string | null;
  createdAt: Date;
  sheetCount: number;
  rowCount: number;
};

const SHEET_CATEGORIES = new Set(["einnahmen", "ausgaben", "sonstiges"]);
const COLUMN_TYPES = new Set(["text", "number", "boolean", "date"]);

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

function jsonObject(value: Prisma.JsonValue): Record<string, string | number | boolean | undefined> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const result: Record<string, string | number | boolean | undefined> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (
      typeof entry === "string" ||
      typeof entry === "number" ||
      typeof entry === "boolean"
    ) {
      result[key] = entry;
    }
  }
  return result;
}

function booleanValue(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    return ["true", "1", "on", "yes", "ja"].includes(value.trim().toLowerCase());
  }
  return false;
}

function normalizeLabel(value: unknown) {
  const label = typeof value === "string" ? value.trim() : "";
  return label || null;
}

function normalizeColumn(raw: unknown): ColumnConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const entry = raw as Record<string, unknown>;
  const title = typeof entry.title === "string" ? entry.title.trim() : "";
  if (!title) return null;

  const id =
    typeof entry.id === "string" && entry.id.trim()
      ? entry.id.trim()
      : createId("col");
  const type = COLUMN_TYPES.has(String(entry.type)) ? entry.type : "text";

  return {
    id,
    title,
    type: type as ColumnConfig["type"],
    required: Boolean(entry.required),
  };
}

function normalizeSheet(raw: unknown, index: number): SheetConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const entry = raw as Record<string, unknown>;

  const id =
    typeof entry.id === "string" && entry.id.trim()
      ? entry.id.trim()
      : createId("sheet");
  const name =
    typeof entry.name === "string" && entry.name.trim()
      ? entry.name.trim()
      : `Sheet ${index + 1}`;
  const category = SHEET_CATEGORIES.has(String(entry.category))
    ? entry.category
    : "sonstiges";
  const color =
    typeof entry.color === "string" && entry.color.trim()
      ? entry.color.trim()
      : SHEET_COLORS[index % SHEET_COLORS.length];
  const columnsRaw = Array.isArray(entry.columns) ? entry.columns : [];
  const usedColumnIds = new Set<string>();
  const columns: ColumnConfig[] = [];

  for (const rawColumn of columnsRaw) {
    const column = normalizeColumn(rawColumn);
    if (!column || usedColumnIds.has(column.id)) continue;
    usedColumnIds.add(column.id);
    columns.push(column);
  }

  if (
    category !== "sonstiges" &&
    !columns.some((column) => column.id === GESAMTBETRAG_COLUMN_ID)
  ) {
    columns.unshift(createGesamtbetragColumn());
  }

  return {
    id,
    name,
    category: category as SheetConfig["category"],
    color,
    columns,
  };
}

function normalizeRow(raw: unknown, columns: ColumnConfig[], rowId: number): SheetRow {
  const row =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const columnById = new Map(columns.map((column) => [column.id, column]));
  const normalizedRow: SheetRow = {
    _id: rowId,
    _datum:
      typeof row._datum === "string" && row._datum.trim()
        ? row._datum.trim()
        : new Date().toISOString().split("T")[0],
    _locked: booleanValue(row._locked),
  };

  for (const [key, value] of Object.entries(row)) {
    if (key === "_id" || key === "_datum" || key === "_locked") continue;
    const column = columnById.get(key);
    if (!column) continue;

    if (column.type === "number") {
      const numeric = Number(value);
      normalizedRow[key] = Number.isFinite(numeric) ? numeric : 0;
    } else if (column.type === "boolean") {
      normalizedRow[key] = booleanValue(value);
    } else if (column.type === "date") {
      normalizedRow[key] = typeof value === "string" ? value.trim() : "";
    } else if (typeof value === "string" || typeof value === "number") {
      normalizedRow[key] = String(value);
    } else {
      normalizedRow[key] = "";
    }
  }

  return normalizedRow;
}

function splitRow(row: SheetRow) {
  const { _id, _datum, ...values } = row;
  const cleanedValues: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(values)) {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      cleanedValues[key] = value;
    }
  }

  return {
    rowId: _id,
    datum: _datum,
    values: cleanedValues,
  };
}

function mapSheet(sheet: DbSheet): SheetConfig {
  return {
    id: sheet.id,
    name: sheet.name,
    category: sheet.category as SheetConfig["category"],
    color: sheet.color,
    columns: Array.isArray(sheet.columns)
      ? sheet.columns
          .map(normalizeColumn)
          .filter((column): column is ColumnConfig => Boolean(column))
      : [],
  };
}

function mapRow(row: DbRow): SheetRow {
  return {
    _id: row.rowId,
    _datum: row.datum,
    ...jsonObject(row.values),
  };
}

export function mapBackup(backup: DbBackup): BackupSummary {
  return {
    id: backup.id,
    label: backup.label,
    createdAt: backup.createdAt.toISOString(),
    sheetCount: backup.sheetCount,
    rowCount: backup.rowCount,
  };
}

export async function buildBackupSnapshot(
  tx: Tx,
  profile: AuthenticatedProfile
): Promise<BackupSnapshot> {
  const sheets = await tx.accountingSheet.findMany({
    where: { profileId: profile.id },
    orderBy: [
      { sortOrder: "asc" },
      { createdAt: "asc" },
      { id: "asc" },
    ],
    include: {
      rows: {
        orderBy: [
          { sortOrder: "asc" },
          { rowId: "desc" },
        ],
      },
    },
  });

  const appSheets = sheets.map(mapSheet);
  const data: Record<string, SheetRow[]> = {};

  for (let index = 0; index < sheets.length; index++) {
    const sheet = sheets[index];
    const appSheet = appSheets[index];
    data[appSheet.id] = sheet.rows.map(mapRow);
  }

  return {
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    profile: {
      id: profile.id,
      name: profile.name,
    },
    sheets: appSheets,
    data,
  };
}

function backupCounts(snapshot: BackupSnapshot) {
  const sheetCount = snapshot.sheets.length;
  const rowCount = Object.values(snapshot.data).reduce(
    (sum, rows) => sum + rows.length,
    0
  );

  return { sheetCount, rowCount };
}

export async function pruneBackups(tx: Tx, profileId: string) {
  const staleBackups = await tx.accountingBackup.findMany({
    where: { profileId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: BACKUP_LIMIT,
    select: { id: true },
  });

  if (staleBackups.length === 0) return;

  await tx.accountingBackup.deleteMany({
    where: {
      profileId,
      id: { in: staleBackups.map((backup) => backup.id) },
    },
  });
}

export async function createStoredBackup(
  tx: Tx,
  profile: AuthenticatedProfile,
  label?: string | null
) {
  const snapshot = await buildBackupSnapshot(tx, profile);
  const counts = backupCounts(snapshot);

  const backup = await tx.accountingBackup.create({
    data: {
      id: randomUUID(),
      profileId: profile.id,
      label: normalizeLabel(label),
      snapshot: toInputJson(snapshot),
      sheetCount: counts.sheetCount,
      rowCount: counts.rowCount,
    },
    select: {
      id: true,
      label: true,
      createdAt: true,
      sheetCount: true,
      rowCount: true,
    },
  });

  await pruneBackups(tx, profile.id);

  return mapBackup(backup);
}

export function readBackupSnapshot(value: Prisma.JsonValue): BackupSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Backup ist kein gültiger JSON-Snapshot.");
  }

  const raw = value as Record<string, unknown>;
  const profileRaw =
    raw.profile && typeof raw.profile === "object"
      ? (raw.profile as Record<string, unknown>)
      : {};
  const sheetsRaw = Array.isArray(raw.sheets) ? raw.sheets : [];
  const dataRaw =
    raw.data && typeof raw.data === "object" && !Array.isArray(raw.data)
      ? (raw.data as Record<string, unknown>)
      : {};

  const usedSheetIds = new Set<string>();
  const sheets: SheetConfig[] = [];

  sheetsRaw.forEach((rawSheet, index) => {
    const sheet = normalizeSheet(rawSheet, index);
    if (!sheet || usedSheetIds.has(sheet.id)) return;
    usedSheetIds.add(sheet.id);
    sheets.push(sheet);
  });

  const data: Record<string, SheetRow[]> = {};
  const usedRowIds = new Set<number>();
  let nextRowId = 1;

  const nextFreeRowId = () => {
    while (usedRowIds.has(nextRowId)) nextRowId++;
    const id = nextRowId;
    usedRowIds.add(id);
    nextRowId++;
    return id;
  };

  for (const sheet of sheets) {
    const rawRowsValue = dataRaw[sheet.id];
    const rowsRaw = Array.isArray(rawRowsValue) ? rawRowsValue : [];
    data[sheet.id] = rowsRaw.map((rawRow) => {
      const candidate =
        rawRow && typeof rawRow === "object"
          ? Number((rawRow as Record<string, unknown>)._id)
          : 0;
      const rowId =
        Number.isInteger(candidate) && candidate > 0 && !usedRowIds.has(candidate)
          ? candidate
          : nextFreeRowId();

      usedRowIds.add(rowId);
      if (rowId >= nextRowId) nextRowId = rowId + 1;

      return normalizeRow(rawRow, sheet.columns, rowId);
    });
  }

  return {
    version: Number(raw.version) || BACKUP_VERSION,
    createdAt:
      typeof raw.createdAt === "string" && raw.createdAt.trim()
        ? raw.createdAt.trim()
        : new Date().toISOString(),
    profile: {
      id:
        typeof profileRaw.id === "string" && profileRaw.id.trim()
          ? profileRaw.id.trim()
          : "",
      name:
        typeof profileRaw.name === "string" && profileRaw.name.trim()
          ? profileRaw.name.trim()
          : "Profil",
    },
    sheets,
    data,
  };
}

export async function restoreBackupSnapshot(
  tx: Tx,
  profileId: string,
  snapshot: BackupSnapshot
) {
  await tx.accountingSheet.deleteMany({
    where: { profileId },
  });

  for (let index = 0; index < snapshot.sheets.length; index++) {
    const sheet = snapshot.sheets[index];
    await tx.accountingSheet.create({
      data: {
        id: sheet.id,
        profileId,
        name: sheet.name,
        category: sheet.category as PrismaSheetCategory,
        color: sheet.color,
        columns: toInputJson(sheet.columns),
        sortOrder: index,
      },
    });

    const rows = snapshot.data[sheet.id] || [];
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      const { datum, values } = splitRow(row);
      await tx.accountingRow.create({
        data: {
          profileId,
          sheetId: sheet.id,
          rowId: row._id,
          datum,
          values: toInputJson(values),
          sortOrder: rowIndex,
        },
      });
    }
  }

  await tx.accountingProfile.update({
    where: { id: profileId },
    data: { updatedAt: new Date() },
  });
}
