import { NextResponse } from "next/server";
import { clearProfileSessionCookies } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearProfileSessionCookies(response);
  return response;
}
