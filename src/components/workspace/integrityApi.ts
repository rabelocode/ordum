import { supabase } from "../../lib/supabase";

export type ApiState<T> = { data: T | null; loading: boolean; error: string };

async function workspaceHeaders(tenantId: string, headers?: HeadersInit) {
  const session = await supabase.auth.getSession();
  return new Headers({
    Authorization: `Bearer ${session.data.session?.access_token || ""}`,
    "x-tenant-id": tenantId,
    ...Object.fromEntries(new Headers(headers)),
  });
}

export async function integrityApi<T>(tenantId: string, path: string, options: RequestInit = {}): Promise<T> {
  const headers = await workspaceHeaders(tenantId, options.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`/api/workspace/integrity${path}`, { ...options, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Não foi possível concluir a operação.");
  return body;
}

export async function integrityFileApi<T>(tenantId: string, path: string, file: File, extraHeaders: Record<string, string> = {}): Promise<T> {
  const headers = await workspaceHeaders(tenantId, { "Content-Type": file.type, "x-file-name": file.name, ...extraHeaders });
  const response = await fetch(`/api/workspace/integrity${path}`, { method: "POST", headers, body: file });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Não foi possível enviar o arquivo.");
  return body;
}
