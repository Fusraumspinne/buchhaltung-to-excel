import { NextRequest } from "next/server";
import { isRequestAuthorized } from "@/lib/auth";
import { assertBlobConfig, getBackupIndex } from "@/lib/blob-backups";

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
    const all = String(url.searchParams.get("all") || "").toLowerCase() === "true";
    assertBlobConfig();

    const allBlobs = await getBackupIndex();

    const files = allBlobs
      .map((entry) => ({
        name: entry.name,
        date: entry.date,
        size: entry.size,
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const paginated = all ? files : files.slice(offset, offset + limit);

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
