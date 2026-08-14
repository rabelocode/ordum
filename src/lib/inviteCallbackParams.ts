export function readInviteCallback(href: string) {
  const url = new URL(href);
  const rawHash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
  const tokenOffset = rawHash.indexOf("access_token=");
  const tokenParams = new URLSearchParams(tokenOffset >= 0 ? rawHash.slice(tokenOffset) : rawHash);
  const type = tokenParams.get("type") || url.searchParams.get("type") || "";
  return {
    accessToken: tokenParams.get("access_token"),
    refreshToken: tokenParams.get("refresh_token"),
    code: url.searchParams.get("code"),
    error: tokenParams.get("error_description") || url.searchParams.get("error_description"),
    isInvite:
      url.pathname === "/auth/invite-callback" ||
      rawHash.includes("/auth/accept-invite") ||
      ["invite", "signup", "magiclink"].includes(type),
  };
}
