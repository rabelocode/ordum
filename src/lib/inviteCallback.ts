import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { readInviteCallback } from "./inviteCallbackParams";

type InviteCallbackResult = { session: Session | null; error?: string };
const CALLBACK_ROUTE = "/#/auth/accept-invite";

export async function recoverInviteSession(href = window.location.href): Promise<InviteCallbackResult> {
  const callback = readInviteCallback(href);
  if (callback.error) return { session: null, error: callback.error };

  let session: Session | null = null;
  if (callback.accessToken && callback.refreshToken) {
    const result = await supabase.auth.setSession({ access_token: callback.accessToken, refresh_token: callback.refreshToken });
    if (result.error) return { session: null, error: result.error.message };
    session = result.data.session;
  } else if (callback.code) {
    const current = await supabase.auth.getSession();
    if (current.data.session) session = current.data.session;
    else {
      const result = await supabase.auth.exchangeCodeForSession(callback.code);
      if (result.error) return { session: null, error: result.error.message };
      session = result.data.session;
    }
  } else {
    const current = await supabase.auth.getSession();
    if (current.error) return { session: null, error: current.error.message };
    session = current.data.session;
  }

  if (callback.isInvite && session && typeof window !== "undefined") {
    window.history.replaceState({}, "", `${window.location.origin}${CALLBACK_ROUTE}`);
  }
  return { session };
}
