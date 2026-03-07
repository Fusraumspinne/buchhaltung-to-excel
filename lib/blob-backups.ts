export const BACKUP_BLOB_PREFIX = "backups/";

export function sanitizeBackupFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function toBackupBlobPath(filename: string) {
  return `${BACKUP_BLOB_PREFIX}${sanitizeBackupFilename(filename)}`;
}

export function fromBackupBlobPath(pathname: string) {
  const stripped = pathname.startsWith(BACKUP_BLOB_PREFIX)
    ? pathname.slice(BACKUP_BLOB_PREFIX.length)
    : pathname;
  return sanitizeBackupFilename(stripped);
}

export function assertBlobConfig() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN fehlt. Verbinde das Projekt mit Vercel Blob und fuehre lokal `vercel env pull .env.local` aus.",
    );
  }
}
