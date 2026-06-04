import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedProfile, unauthorizedResponse } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { ColumnConfig, SheetRow, createId } from "@/lib/types";

export const runtime = "nodejs";

const COLUMN_TYPES = new Set(["text", "number", "boolean", "date"]);

interface RouteContext {
  params: Promise<{ sheetId: string; rowId: string }>;
}

type DbSheet = {
  columns: Prisma.JsonValue;
};

type DbRow = {
  rowId: number;
  datum: string;
  values: Prisma.JsonValue;
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

function parseRowId(value: string) {
  const rowId = Number(value);
  return Number.isInteger(rowId) && rowId > 0 ? rowId : null;
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

function sheetColumns(sheet: DbSheet): ColumnConfig[] {
  return Array.isArray(sheet.columns)
    ? sheet.columns
        .map(normalizeColumn)
        .filter((column): column is ColumnConfig => Boolean(column))
    : [];
}

function booleanValue(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    return ["true", "1", "on", "yes", "ja"].includes(value.trim().toLowerCase());
  }
  return false;
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
    datum: _datum,
    values: cleanedValues,
  };
}

function mapRow(row: DbRow): SheetRow {
  return {
    _id: row.rowId,
    _datum: row.datum,
    ...jsonObject(row.values),
  };
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const profile = await getAuthenticatedProfile(request);
  if (!profile) {
    return unauthorizedResponse();
  }

  const { sheetId, rowId: rawRowId } = await context.params;
  const decodedSheetId = decodeURIComponent(sheetId);
  const rowId = parseRowId(rawRowId);
  if (!rowId) {
    return NextResponse.json({ ok: false, error: "Ungültige Eintrag-ID." }, { status: 400 });
  }

  try {
    const prisma = getPrisma();
    const body = await request.json().catch(() => ({}));

    const row = await prisma.$transaction(async (tx) => {
      const [sheet, existing] = await Promise.all([
        tx.accountingSheet.findUnique({
          where: {
            profileId_id: {
              profileId: profile.id,
              id: decodedSheetId,
            },
          },
        }),
        tx.accountingRow.findUnique({
          where: {
            profileId_sheetId_rowId: {
              profileId: profile.id,
              sheetId: decodedSheetId,
              rowId,
            },
          },
        }),
      ]);
      if (!sheet || !existing) throw new Error("Eintrag nicht gefunden.");

      const patch =
        body && typeof body === "object" ? (body as Record<string, unknown>) : {};
      const currentRow = {
        _id: existing.rowId,
        _datum: existing.datum,
        ...jsonObject(existing.values),
      };
      const normalizedRow = normalizeRow(
        { ...currentRow, ...patch },
        sheetColumns(sheet),
        existing.rowId
      );
      const { datum, values } = splitRow(normalizedRow);

      const updated = await tx.accountingRow.update({
        where: {
          profileId_sheetId_rowId: {
            profileId: profile.id,
            sheetId: decodedSheetId,
            rowId,
          },
        },
        data: {
          datum,
          values: toInputJson(values),
        },
      });

      await tx.accountingProfile.update({
        where: { id: profile.id },
        data: { updatedAt: new Date() },
      });

      return updated;
    });

    return NextResponse.json({ ok: true, row: mapRow(row) });
  } catch (error) {
    return errorResponse(error, "Eintrag konnte nicht gespeichert werden.");
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const profile = await getAuthenticatedProfile(request);
  if (!profile) {
    return unauthorizedResponse();
  }

  const { sheetId, rowId: rawRowId } = await context.params;
  const decodedSheetId = decodeURIComponent(sheetId);
  const rowId = parseRowId(rawRowId);
  if (!rowId) {
    return NextResponse.json({ ok: false, error: "Ungültige Eintrag-ID." }, { status: 400 });
  }

  try {
    const prisma = getPrisma();
    await prisma.$transaction(async (tx) => {
      const deleted = await tx.accountingRow.deleteMany({
        where: {
          profileId: profile.id,
          sheetId: decodedSheetId,
          rowId,
        },
      });
      if (deleted.count === 0) throw new Error("Eintrag nicht gefunden.");

      await tx.accountingProfile.update({
        where: { id: profile.id },
        data: { updatedAt: new Date() },
      });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "Eintrag konnte nicht gelöscht werden.");
  }
}
