import React, { useMemo, useState } from "react";
import { Loader2, Mail, ShieldCheck, UserPlus } from "lucide-react";
import { useAccess } from "../../core/auth/AccessContext";
import { userFacingApiError, userFacingException } from "../../lib/userFacingError";

type Props = {
  tenantId: string;
  tenantName: string;
  contacts?: Array<{ name?: string; email?: string }>;
  memberships?: Array<{
    id: string;
    display_name?: string;
    status: string;
    employment_level?: string;
  }>;
  onChanged: () => Promise<void> | void;
};

export function TenantAccessPanel({
  tenantId,
  tenantName,
  contacts = [],
  memberships = [],
  onChanged,
}: Props) {
  const { session, hasPlatformPermission } = useAccess();
  const primaryContact = contacts[0] || {};
  const [showInvite, setShowInvite] = useState(false);
  const [name, setName] = useState(primaryContact.name || "");
  const [email, setEmail] = useState(primaryContact.email || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const canInvite =
    hasPlatformPermission("platform.clients.manage") ||
    hasPlatformPermission("platform.onboarding.manage");
  const activeCount = useMemo(
    () => memberships.filter((item) => item.status === "active").length,
    [memberships],
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!session || saving) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`/api/admin/clients/${tenantId}/invite-owner`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ name, email }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          userFacingApiError(
            body,
            response.status,
            "Não foi possível preparar este acesso. Revise os dados e tente novamente.",
          ),
        );
      setSuccess(
        body.invited
          ? `Convite enviado para ${email}. O acesso será liberado após o cadastro.`
          : body.invitationPending
            ? `O convite para ${email} continua pendente. A pessoa deve usar o link recebido para concluir o cadastro.`
          : `Acesso liberado para ${email}. A pessoa já pode entrar na Ordum.`,
      );
      setShowInvite(false);
      await onChanged();
    } catch (caught) {
      setError(
        userFacingException(
          caught,
          "Não foi possível preparar este acesso. Tente novamente.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-black">Equipe do cliente</h3>
          <p className="mt-1 text-sm text-[#626866]">
            {activeCount
              ? `${activeCount} pessoa${activeCount === 1 ? "" : "s"} com acesso ativo.`
              : "Convide o responsável para começar a configuração dos produtos."}
          </p>
        </div>
        {canInvite ? (
          <button
            type="button"
            onClick={() => {
              setShowInvite((value) => !value);
              setError("");
              setSuccess("");
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#202322] px-4 py-2.5 text-sm font-bold text-white"
          >
            <UserPlus className="h-4 w-4" />
            Convidar responsável
          </button>
        ) : null}
      </div>

      {success ? (
        <div role="status" className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <ShieldCheck className="h-5 w-5 shrink-0" />
          {success}
        </div>
      ) : null}
      {error ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {showInvite ? (
        <form onSubmit={submit} className="grid gap-4 rounded-2xl border border-[#DDD8CF] bg-[#F6F5F2] p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <div className="flex items-center gap-2 font-black">
              <Mail className="h-4 w-4 text-[#B66E45]" />
              Responsável por {tenantName}
            </div>
            <p className="mt-1 text-sm text-[#626866]">
              Essa pessoa administrará o ambiente do cliente e concluirá a implantação.
            </p>
          </div>
          <label className="text-sm font-bold">
            Nome completo
            <input
              required
              minLength={2}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[#CFC9BF] bg-white px-3 py-2.5 font-normal"
            />
          </label>
          <label className="text-sm font-bold">
            E-mail profissional
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[#CFC9BF] bg-white px-3 py-2.5 font-normal"
            />
          </label>
          <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setShowInvite(false)} className="rounded-xl border bg-white px-4 py-2.5 text-sm font-bold">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#B66E45] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Enviar convite
            </button>
          </div>
        </form>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        {memberships.length ? (
          memberships.map((item) => (
            <article key={item.id} className="rounded-xl bg-[#F6F5F2] p-4">
              <strong>{item.display_name || "Pessoa convidada"}</strong>
              <p className="text-sm text-[#626866]">
                {item.status === "active"
                  ? "Acesso ativo"
                  : item.status === "invited"
                    ? "Convite enviado"
                    : item.status === "suspended"
                      ? "Acesso suspenso"
                      : "Acesso inativo"}
              </p>
            </article>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-[#CFC9BF] p-6 text-center text-sm text-[#626866] md:col-span-2">
            Nenhuma pessoa possui acesso. Convide o responsável para continuar a implantação.
          </div>
        )}
      </div>
    </section>
  );
}
