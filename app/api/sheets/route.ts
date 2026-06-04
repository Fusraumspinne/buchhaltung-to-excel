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

type DbSheet = {
  id: string;
  name: string;
  category: PrismaSheetCategory;
  color: string;
  columns: Prisma.JsonValue;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

type DbRow = {
  sheetId: string;
  rowId: number;
  datum: string;
  values: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
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

export async function GET(request: NextRequest) {
  const profile = await getAuthenticatedProfile(request);
  if (!profile) {
    return unauthorizedResponse();
  }

  try {
    const prisma = getPrisma();
    const sheets = await prisma.accountingSheet.findMany({
      where: { profileId: profile.id },
      orderBy: [
        { sortOrder: "asc" },
        { createdAt: "asc" },
        { id: "asc" },
      ],
      include: {
        rows: {
          orderBy: { rowId: "desc" },
        },
      },
    });

    const appSheets = sheets.map(mapSheet);
    const data: Record<string, SheetRow[]> = {};
    let updatedAt: string | null = null;

    for (let index = 0; index < sheets.length; index++) {
      const sheet = sheets[index];
      const appSheet = appSheets[index];
      data[appSheet.id] = sheet.rows.map(mapRow);

      const sheetUpdatedAt = sheet.updatedAt.toISOString();
      if (!updatedAt || sheetUpdatedAt > updatedAt) updatedAt = sheetUpdatedAt;

      for (const row of sheet.rows) {
        const rowUpdatedAt = row.updatedAt.toISOString();
        if (!updatedAt || rowUpdatedAt > updatedAt) updatedAt = rowUpdatedAt;
      }
    }

    return NextResponse.json({
      ok: true,
      profile,
      sheets: appSheets,
      data,
      updatedAt,
    });
  } catch (error) {
    return errorResponse(error, "Datenbankstand konnte nicht geladen werden.");
  }
}

export async function POST(request: NextRequest) {
  const profile = await getAuthenticatedProfile(request);
  if (!profile) {
    return unauthorizedResponse();
  }

  try {
    const prisma = getPrisma();
    const body = await request.json().catch(() => ({}));
    const sortOrder = await prisma.accountingSheet.count({
      where: { profileId: profile.id },
    });
    const sheet = normalizeSheet(body, sortOrder);
    if (!sheet) throw new Error("Ungültiges Sheet.");

    const created = await prisma.$transaction(async (tx) => {
      const nextSheet = await tx.accountingSheet.create({
        data: {
          id: sheet.id,
          profileId: profile.id,
          name: sheet.name,
          category: sheet.category as PrismaSheetCategory,
          color: sheet.color,
          columns: toInputJson(sheet.columns),
          sortOrder,
        },
      });
      await tx.accountingProfile.update({
        where: { id: profile.id },
        data: { updatedAt: new Date() },
      });
      return nextSheet;
    });

    return NextResponse.json({ ok: true, sheet: mapSheet(created) });
  } catch (error) {
    return errorResponse(error, "Sheet konnte nicht erstellt werden.");
  }
}
