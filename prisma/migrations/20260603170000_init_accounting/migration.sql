CREATE TYPE "SheetCategory" AS ENUM ('einnahmen', 'ausgaben', 'sonstiges');

CREATE TABLE "accounting_sheets" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" "SheetCategory" NOT NULL,
  "color" TEXT NOT NULL,
  "columns" JSONB NOT NULL DEFAULT '[]',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,

  CONSTRAINT "accounting_sheets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "accounting_rows" (
  "sheet_id" TEXT NOT NULL,
  "row_id" INTEGER NOT NULL,
  "datum" TEXT NOT NULL,
  "values" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,

  CONSTRAINT "accounting_rows_pkey" PRIMARY KEY ("sheet_id", "row_id")
);

CREATE INDEX "accounting_rows_sheet_id_idx" ON "accounting_rows"("sheet_id");

CREATE UNIQUE INDEX "accounting_rows_row_id_key" ON "accounting_rows"("row_id");

ALTER TABLE "accounting_rows"
ADD CONSTRAINT "accounting_rows_sheet_id_fkey"
FOREIGN KEY ("sheet_id")
REFERENCES "accounting_sheets"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
