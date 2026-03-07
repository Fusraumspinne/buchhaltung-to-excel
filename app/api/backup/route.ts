import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { isRequestAuthorized } from "@/lib/auth";

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
    const safeName = filenameParam.replace(/[^a-zA-Z0-9._-]/g, "_");

    const backupsDir = path.join(process.cwd(), "backups");
    await fs.promises.mkdir(backupsDir, { recursive: true });

    const arrayBuffer = await req.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const filePath = path.join(backupsDir, safeName);
    await fs.promises.writeFile(filePath, buffer);

    return new Response(JSON.stringify({ ok: true, path: `/backups/${safeName}` }), {
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
