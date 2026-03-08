import { head, put } from "@vercel/blob";

export const BACKUP_BLOB_PREFIX = "backups/";
export const BACKUP_INDEX_BLOB_PATH = `${BACKUP_BLOB_PREFIX}index.json`;

export interface BackupIndexEntry {
  name: string;
  path: string;
  date: string;
  size: number;
}

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

export function normalizeBackupIndexEntry(entry: Partial<BackupIndexEntry>): BackupIndexEntry | null {
  const name = sanitizeBackupFilename(String(entry.name || ""));
  const path = toBackupBlobPath(name);
  const date = String(entry.date || "");
  const size = Number(entry.size || 0);

  if (!name || !date || !Number.isFinite(size) || size < 0) {
    return null;
  }

  return {
    name,
    path,
    date,
    size,
  };
}

export async function getBackupIndex(): Promise<BackupIndexEntry[]> {
  try {
    const meta = await head(BACKUP_INDEX_BLOB_PATH);
    if (meta && meta.url) {
      const resp = await fetch(meta.url, {
        headers: {
          Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
        },
      });
      if (resp.ok) {
        const parsed = await resp.json();
        if (Array.isArray(parsed)) {
          return parsed.map(normalizeBackupIndexEntry).filter(Boolean) as BackupIndexEntry[];
        }
      } else {
        throw new Error("Failed to fetch index from url, status: " + resp.status);
      }
    }
  } catch (err: any) {
    if (!String(err).includes('BlobNotFoundError')) {
      console.warn('Backup index missing or invalid', err);
    }
  }
  return [];
}

export async function saveBackupIndex(entries: BackupIndexEntry[]) {
  const data = JSON.stringify(entries, null, 2);
  await put(BACKUP_INDEX_BLOB_PATH, data, {
    access: 'private',
    addRandomSuffix: false,
    contentType: 'application/json',
    allowOverwrite: true,
  });
}

