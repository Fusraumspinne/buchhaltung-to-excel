import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { isRequestAuthorized } from "@/lib/auth";

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

    const backupsDir = path.join(process.cwd(), "backups");
    if (!fs.existsSync(backupsDir)) {
      return new Response(JSON.stringify({ backups: [], total: 0 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    const files = fs.readdirSync(backupsDir)
      .filter(f => f.endsWith(".xlsx"))
      .map(name => {
        const stats = fs.statSync(path.join(backupsDir, name));
        return {
          name,
          date: stats.mtime.toISOString(),
          size: stats.size,
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const paginated = files.slice(offset, offset + limit);

    return new Response(JSON.stringify({ backups: paginated, total: files.length }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    console.error("Error listing backups:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
