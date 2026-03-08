import { list } from "@vercel/blob";
import { NextRequest } from "next/server";
import { isRequestAuthorized } from "@/lib/auth";
import { assertBlobConfig, BACKUP_BLOB_PREFIX, fromBackupBlobPath } from "@/lib/blob-backups";

function isBlobConnectionError(error: unknown) {
  const message = String(error || "").toLowerCase();
  return (
    message.includes("fetch failed") ||
    message.includes("econn") ||
    message.includes("enotfound") ||
    message.includes("etimedout") ||
    message.includes("socket")
  );
}

export async function GET(req: NextRequest) {
  try {
    if (!isRequestAuthorized(req)) {
      return new Response(JSON.stringify({ error: "Falsches Passwort" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }

    const url = new URL(req.url);

    const limit = parseInt(url.searchParams.get("limit") || "5");
    const offset = parseInt(url.searchParams.get("offset") || "0");
    assertBlobConfig();

    const targetCount = offset + limit;
    let cursor: string | undefined;
    let hasMore = true;
    const allBlobs: Array<{
      pathname: string;
      uploadedAt: Date;
      size: number;
    }> = [];

    while (hasMore) {
      const result = await list({
        prefix: BACKUP_BLOB_PREFIX,
        cursor,
        limit: 1000,
      });

      hasMore = result.hasMore;
      cursor = result.cursor;

      for (const blob of result.blobs) {
        allBlobs.push({
          pathname: blob.pathname,
          uploadedAt: blob.uploadedAt,
          size: blob.size,
        });
      }

      if (!hasMore && allBlobs.length === 0) {
        return new Response(JSON.stringify({ backups: [], total: 0 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      if (!hasMore || allBlobs.length >= targetCount) {
        break;
      }
    }

    while (hasMore) {
      const result = await list({
        prefix: BACKUP_BLOB_PREFIX,
        cursor,
        limit: 1000,
      });
      hasMore = result.hasMore;
      cursor = result.cursor;
      for (const blob of result.blobs) {
        allBlobs.push({
          pathname: blob.pathname,
          uploadedAt: blob.uploadedAt,
          size: blob.size,
        });
      }
    }

    const files = allBlobs
      .map((blob) => ({
        name: fromBackupBlobPath(blob.pathname),
        date: blob.uploadedAt.toISOString(),
        size: blob.size,
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const paginated = files.slice(offset, offset + limit);

    return new Response(JSON.stringify({ backups: paginated, total: files.length }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    console.error("Error listing backups:", err);
    if (isBlobConnectionError(err)) {
      return new Response(
        JSON.stringify({
          ok: false,
          code: "BLOB_UNREACHABLE",
          error: "Zu diesem Server kann keine Verbindung mehr aufgebaut werden.",
        }),
        {
          status: 503,
          headers: { "content-type": "application/json" },
        },
      );
    }
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
