import { get } from "@vercel/blob";
import { NextRequest } from "next/server";
import { isRequestAuthorized } from "@/lib/auth";
import { assertBlobConfig, sanitizeBackupFilename, toBackupBlobPath } from "@/lib/blob-backups";

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
    const blob = await get(toBackupBlobPath(safeName), {
      access: "private",
    });

    if (!blob || blob.statusCode !== 200 || !blob.stream) {
      return new Response("Backup not found", { status: 404 });
    }

    return new Response(blob.stream, {
      status: 200,
      headers: {
        "content-type": blob.blob.contentType || "application/octet-stream",
        "content-disposition": `attachment; filename="${safeName}"`,
      },
    });
  } catch (err) {
    console.error("Error downloading backup:", err);
    return new Response(String(err), { status: 500 });
  }
}
