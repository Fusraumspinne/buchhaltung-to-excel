import { get } from "@vercel/blob";
import { NextRequest } from "next/server";
import { isRequestAuthorized } from "@/lib/auth";
import { assertBlobConfig, sanitizeBackupFilename, toBackupBlobPath } from "@/lib/blob-backups";

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
    const url = new URL(req.url);
    const filename = url.searchParams.get("filename");

    if (!isRequestAuthorized(req)) {
      return new Response("Unauthorized", { status: 401 });
    }
    
    if (!filename) {
      return new Response("Missing filename", { status: 400 });
    }

    assertBlobConfig();
    const safeName = sanitizeBackupFilename(filename);
    const blob = await get(toBackupBlobPath(safeName), { access: 'private' });

    if (!blob || !blob.stream) {
      return new Response("Backup not found", { status: 404 });
    }

    return new Response(blob.stream, {
      status: 200,
      headers: {
        "content-type": blob.blob.contentType || "application/octet-stream",
        "content-disposition": `attachment; filename="${safeName}"`,
      },
    });
  } catch (err: any) {
    if (String(err).includes("BlobNotFoundError")) {
      return new Response("Backup not found", { status: 404 });
    }
    console.error("Error downloading backup:", err);
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
    return new Response(String(err), { status: 500 });
  }
}
