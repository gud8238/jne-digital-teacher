export const cookieName = "jne_badge_session";
export function readSession(request: Request): string | null {
  const value = request.headers
    .get("cookie")
    ?.split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(cookieName + "="))
    ?.slice(cookieName.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}
export function sessionCookie(
  request: Request,
  token: string,
  clear = false,
): string {
  return `${cookieName}=${clear ? "" : token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${clear ? 0 : 14400}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
