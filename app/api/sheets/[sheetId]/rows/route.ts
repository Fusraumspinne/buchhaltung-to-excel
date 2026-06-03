import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { isRequestAuthorized } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { ColumnConfig, SheetRow, createId } from "@/lib/types";

export const runtime = "nodejs";

const COLUMN_TYPES = new Set(["text", "number"]);

interface RouteContext {
  params: Promise<{ sheetId: string }>;
}

type DbSheet = {
  columns: Prisma.JsonValue;
};

type DbRow = {
  rowId: number;
  datum: string;
  values: Prisma.JsonValue;
};

function unauthorizedResponse() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

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
  const cleanedValues: Record<string, string | number> = {};

  for (const [key, value] of Object.entries(values)) {
    if (typeof value === "string" || typeof value === "number") {
      cleanedValues[key] = value;
    }
  }

  return {
    datum: _datum,
    values: cleanedValues,
  };
}

function jsonObject(value: Prisma.JsonValue): Record<string, string | number | undefined> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const result: Record<string, string | number | undefined> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string" || typeof entry === "number") {
      result[key] = entry;
    }
  }
  return result;
}

function mapRow(row: DbRow): SheetRow {
  return {
    _id: row.rowId,
    _datum: row.datum,
    ...jsonObject(row.values),
  };
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isRequestAuthorized(request)) {
    return unauthorizedResponse();
  }

  const { sheetId } = await context.params;
  const decodedSheetId = decodeURIComponent(sheetId);

  try {
    const prisma = getPrisma();
    const body = await request.json().catch(() => ({}));

    const row = await prisma.$transaction(async (tx) => {
      const sheet = await tx.accountingSheet.findUnique({
        where: { id: decodedSheetId },
      });
      if (!sheet) throw new Error("Sheet nicht gefunden.");

      const rowCandidate =
        body && typeof body === "object" ? (body as Record<string, unknown>) : {};
      const requestedId = Number(rowCandidate._id);
      let rowId = Number.isInteger(requestedId) && requestedId > 0 ? requestedId : 0;

      if (rowId) {
        const existingRowId = await tx.accountingRow.findUnique({ where: { rowId } });
        if (existingRowId) rowId = 0;
      }

      if (!rowId) {
        const max = await tx.accountingRow.aggregate({ _max: { rowId: true } });
        rowId = (max._max.rowId || 0) + 1;
      }

      const normalizedRow = normalizeRow(rowCandidate, sheetColumns(sheet), rowId);
      const { datum, values } = splitRow(normalizedRow);

      return tx.accountingRow.create({
        data: {
          sheetId: decodedSheetId,
          rowId: normalizedRow._id,
          datum,
          values: toInputJson(values),
        },
      });
    });

    return NextResponse.json({ ok: true, row: mapRow(row) });
  } catch (error) {
    return errorResponse(error, "Eintrag konnte nicht erstellt werden.");
  }
}
