import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, isPasswordValid } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const password = typeof body.password === "string" ? body.password : "";

    if (!isPasswordValid(password)) {
      return NextResponse.json({ error: "Falsches Passwort." }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: password,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    return response;
  } catch (error) {
    console.error("Login failed:", error);
    return NextResponse.json({ error: "Login fehlgeschlagen." }, { status: 500 });
  }
}
