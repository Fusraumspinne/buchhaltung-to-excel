import { Prisma, SheetCategory as PrismaSheetCategory } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedProfile, unauthorizedResponse } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import {
  ColumnConfig,
  SheetConfig,
  SheetRow,
  createGesamtbetragColumn,
  createId,
  GESAMTBETRAG_COLUMN_ID,
  SHEET_COLORS,
} from "@/lib/types";

export const runtime = "nodejs";

const SHEET_CATEGORIES = new Set(["einnahmen", "ausgaben", "sonstiges"]);
const COLUMN_TYPES = new Set(["text", "number", "boolean", "date"]);

interface RouteContext {
  params: Promise<{ sheetId: string }>;
}

type DbSheet = {
  id: string;
  name: string;
  category: PrismaSheetCategory;
  color: string;
  columns: Prisma.JsonValue;
  sortOrder: number;
};

function errorResponse(error: unknown, fallback: string) {
  console.error(fallback, error);
  return NextResponse.json(
    {
      ok: false,
      error: error instanceof Error ? error.message : fallback,
    },
    { status: 500 }
  );
}

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

function normalizeSheet(raw: unknown, index: number, forcedId: string): SheetConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const entry = raw as Record<string, unknown>;

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
    id: forcedId,
    name,
    category: category as SheetConfig["category"],
    color,
    columns,
  };
}

function normalizeRow(raw: unknown, columns: ColumnConfig[]): SheetRow {
  const row =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const rawId = Number(row._id);
  const id = Number.isInteger(rawId) && rawId > 0 ? rawId : 1;
  const columnById = new Map(columns.map((column) => [column.id, column]));
  const normalizedRow: SheetRow = {
    _id: id,
    _datum:
      typeof row._datum === "string" && row._datum.trim()
        ? row._datum.trim()
        : new Date().toISOString().split("T")[0],
  };

  for (const [key, value] of Object.entries(row)) {
    if (key === "_id" || key === "_datum") continue;
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

export async function PUT(request: NextRequest, context: RouteContext) {
  const profile = await getAuthenticatedProfile(request);
  if (!profile) {
    return unauthorizedResponse();
  }

  const { sheetId } = await context.params;
  const decodedSheetId = decodeURIComponent(sheetId);

  try {
    const prisma = getPrisma();
    const body = await request.json().catch(() => ({}));

    const sheet = await prisma.$transaction(async (tx) => {
      const existing = await tx.accountingSheet.findUnique({
        where: {
          profileId_id: {
            profileId: profile.id,
            id: decodedSheetId,
          },
        },
        include: { rows: true },
      });
      if (!existing) throw new Error("Sheet nicht gefunden.");

      const nextSheet = normalizeSheet(body, existing.sortOrder, decodedSheetId);
      if (!nextSheet) throw new Error("Ungültiges Sheet.");

      const updated = await tx.accountingSheet.update({
        where: {
          profileId_id: {
            profileId: profile.id,
            id: decodedSheetId,
          },
        },
        data: {
          name: nextSheet.name,
          category: nextSheet.category as PrismaSheetCategory,
          color: nextSheet.color,
          columns: toInputJson(nextSheet.columns),
        },
      });

      for (const row of existing.rows) {
        const normalizedRow = normalizeRow(
          { _id: row.rowId, _datum: row.datum, ...jsonObject(row.values) },
          nextSheet.columns
        );
        const { datum, values } = splitRow(normalizedRow);

        await tx.accountingRow.update({
          where: {
            profileId_sheetId_rowId: {
              profileId: profile.id,
              sheetId: decodedSheetId,
              rowId: row.rowId,
            },
          },
          data: {
            datum,
            values: toInputJson(values),
          },
        });
      }

      await tx.accountingProfile.update({
        where: { id: profile.id },
        data: { updatedAt: new Date() },
      });

      return updated;
    });

    return NextResponse.json({ ok: true, sheet: mapSheet(sheet) });
  } catch (error) {
    return errorResponse(error, "Sheet konnte nicht gespeichert werden.");
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const profile = await getAuthenticatedProfile(request);
  if (!profile) {
    return unauthorizedResponse();
  }

  const { sheetId } = await context.params;
  const decodedSheetId = decodeURIComponent(sheetId);

  try {
    const prisma = getPrisma();
    await prisma.$transaction(async (tx) => {
      const deleted = await tx.accountingSheet.deleteMany({
        where: {
          id: decodedSheetId,
          profileId: profile.id,
        },
      });
      if (deleted.count === 0) throw new Error("Sheet nicht gefunden.");

      await tx.accountingProfile.update({
        where: { id: profile.id },
        data: { updatedAt: new Date() },
      });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "Sheet konnte nicht gelöscht werden.");
  }
}
