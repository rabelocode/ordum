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

export async function integrityDownload(tenantId: string, path: string, fallbackName: string) {
  const headers = await workspaceHeaders(tenantId);
  const response = await fetch(`/api/workspace/integrity${path}`, { headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Não foi possível preparar a exportação.");
  }
  const disposition = response.headers.get("content-disposition") || "";
  const match = disposition.match(/filename="?([^";]+)"?/i);
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = match?.[1] || fallbackName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
