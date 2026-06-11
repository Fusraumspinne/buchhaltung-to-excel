ALTER TABLE "accounting_rows"
ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "accounting_rows_profile_id_sheet_id_sort_order_idx"
ON "accounting_rows"("profile_id", "sheet_id", "sort_order");
