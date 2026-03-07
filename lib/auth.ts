import type { NextRequest } from "next/server";

export const AUTH_COOKIE_NAME = "app_access";
export const LOGIN_PATH = "/login";

function getConfiguredPassword() {
  return process.env.PASSWORD;
}

export function isPasswordValid(password: string) {
  const configured = getConfiguredPassword();
  return Boolean(configured) && password === configured;
}

export function isRequestAuthorized(request: NextRequest) {
  const configured = getConfiguredPassword();
  const cookieValue = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  return Boolean(configured) && cookieValue === configured;
}
