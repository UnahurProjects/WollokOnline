import "server-only";

/** IP de origen del request (Vercel/proxy). Primer valor de x-forwarded-for. */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "desconocida";
}
