import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { isRequestAuthorized } from "@/lib/auth";

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

    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = path.join(process.cwd(), "backups", safeName);

    if (!fs.existsSync(filePath)) {
      return new Response("Backup not found", { status: 404 });
    }

    const buffer = fs.readFileSync(filePath);

    return new Response(buffer, {
      status: 200,
      headers: {
        "content-type": "application/octet-stream",
        "content-disposition": `attachment; filename="${safeName}"`,
      },
    });
  } catch (err) {
    console.error("Error downloading backup:", err);
    return new Response(String(err), { status: 500 });
  }
}
