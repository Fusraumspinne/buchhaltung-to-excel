import { del, put } from "@vercel/blob";
import { NextRequest } from "next/server";
import { isRequestAuthorized } from "@/lib/auth";
import { assertBlobConfig, sanitizeBackupFilename, toBackupBlobPath, getBackupIndex, saveBackupIndex, normalizeBackupIndexEntry } from "@/lib/blob-backups";

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

function blobUnavailableResponse() {
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

    const index = await getBackupIndex();
    const newEntry = normalizeBackupIndexEntry({
      name: safeName,
      date: new Date().toISOString(),
      size: arrayBuffer.byteLength,
    });
    
    if (newEntry) {
      const filtered = index.filter((e) => e.name !== safeName);
      filtered.push(newEntry);
      await saveBackupIndex(filtered);
    }

    return new Response(JSON.stringify({ ok: true, path: blob.pathname }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    console.error("Error saving backup:", err);
    if (isBlobConnectionError(err)) {
      return blobUnavailableResponse();
    }
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!isRequestAuthorized(req)) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const deleteAll = url.searchParams.get("deleteAll");

    if (deleteAll === "true") {
      assertBlobConfig();
      const index = await getBackupIndex();
      const paths = index.map((e) => e.path);
      
      for (let i = 0; i < paths.length; i += 500) {
        await del(paths.slice(i, i + 500));
      }
      await saveBackupIndex([]);

      return new Response(JSON.stringify({ ok: true, deletedAll: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    const filenameParam = url.searchParams.get("filename");
    if (!filenameParam) {
      return new Response(JSON.stringify({ ok: false, error: "Missing filename" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const safeName = sanitizeBackupFilename(filenameParam);
    assertBlobConfig();
    await del(toBackupBlobPath(safeName));

    const index = await getBackupIndex();
    const filtered = index.filter((e) => e.name !== safeName);
    if (filtered.length !== index.length) {
      await saveBackupIndex(filtered);
    }

    return new Response(JSON.stringify({ ok: true, filename: safeName }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    console.error("Error deleting backup:", err);
    if (isBlobConnectionError(err)) {
      return blobUnavailableResponse();
    }
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
