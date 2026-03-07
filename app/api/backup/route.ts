import { put } from "@vercel/blob";
import { NextRequest } from "next/server";
import { isRequestAuthorized } from "@/lib/auth";
import { assertBlobConfig, sanitizeBackupFilename, toBackupBlobPath } from "@/lib/blob-backups";

export async function POST(req: NextRequest) {
  try {
    if (!isRequestAuthorized(req)) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const filenameParam = url.searchParams.get("filename") || `backup_${Date.now()}.xlsx`;
    const safeName = sanitizeBackupFilename(filenameParam);
    assertBlobConfig();

    const arrayBuffer = await req.arrayBuffer();
    const blob = await put(toBackupBlobPath(safeName), arrayBuffer, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    return new Response(JSON.stringify({ ok: true, path: blob.pathname }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    console.error("Error saving backup:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
