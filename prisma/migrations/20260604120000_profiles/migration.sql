DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "accounting_sheets") THEN
    RAISE EXCEPTION 'Existing accounting sheets require a manual profile migration.';
  END IF;
END $$;

CREATE TABLE "accounting_profiles" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "accounting_profiles_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "accounting_sheets" ADD COLUMN "profile_id" TEXT;

ALTER TABLE "accounting_sheets" ALTER COLUMN "profile_id" SET NOT NULL;

CREATE INDEX "accounting_sheets_profile_id_idx" ON "accounting_sheets"("profile_id");
CREATE UNIQUE INDEX "accounting_sheets_profile_id_id_key" ON "accounting_sheets"("profile_id", "id");

ALTER TABLE "accounting_sheets"
ADD CONSTRAINT "accounting_sheets_profile_id_fkey"
FOREIGN KEY ("profile_id")
REFERENCES "accounting_profiles"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "accounting_rows" ADD COLUMN "profile_id" TEXT;

ALTER TABLE "accounting_rows" ALTER COLUMN "profile_id" SET NOT NULL;

ALTER TABLE "accounting_rows" DROP CONSTRAINT "accounting_rows_sheet_id_fkey";
ALTER TABLE "accounting_rows" DROP CONSTRAINT "accounting_rows_pkey";
DROP INDEX IF EXISTS "accounting_rows_row_id_key";
DROP INDEX IF EXISTS "accounting_rows_sheet_id_idx";

ALTER TABLE "accounting_rows"
ADD CONSTRAINT "accounting_rows_pkey" PRIMARY KEY ("profile_id", "row_id");

CREATE UNIQUE INDEX "accounting_rows_profile_id_sheet_id_row_id_key"
ON "accounting_rows"("profile_id", "sheet_id", "row_id");

CREATE INDEX "accounting_rows_profile_id_sheet_id_idx"
ON "accounting_rows"("profile_id", "sheet_id");

ALTER TABLE "accounting_rows"
ADD CONSTRAINT "accounting_rows_profile_id_sheet_id_fkey"
FOREIGN KEY ("profile_id", "sheet_id")
REFERENCES "accounting_sheets"("profile_id", "id")
ON DELETE CASCADE
ON UPDATE CASCADE;
