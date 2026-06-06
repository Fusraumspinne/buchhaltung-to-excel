CREATE TABLE "accounting_backups" (
  "id" TEXT NOT NULL,
  "profile_id" TEXT NOT NULL,
  "label" TEXT,
  "snapshot" JSONB NOT NULL,
  "sheet_count" INTEGER NOT NULL DEFAULT 0,
  "row_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "accounting_backups_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "accounting_backups_profile_id_created_at_idx"
ON "accounting_backups"("profile_id", "created_at");

ALTER TABLE "accounting_backups"
ADD CONSTRAINT "accounting_backups_profile_id_fkey"
FOREIGN KEY ("profile_id")
REFERENCES "accounting_profiles"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
