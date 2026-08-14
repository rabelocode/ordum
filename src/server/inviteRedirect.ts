import type { Request } from "express";

export function inviteRedirectUrl(req?: Request) {
  const configured = process.env.PUBLIC_APP_URL || process.env.APP_URL || process.env.VITE_APP_URL;
  const deployment = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
  const requestOrigin = req ? req.headers.origin || `${req.protocol}://${req.get("host")}` : "";
  const origin = String(configured || requestOrigin || deployment || "https://ordum-ordum.vercel.app").replace(/\/$/, "");
  return `${origin}/auth/invite-callback`;
}
