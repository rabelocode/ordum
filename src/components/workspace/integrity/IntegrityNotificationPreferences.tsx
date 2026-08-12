import { useCallback, useEffect, useState } from "react";
import { BellRing, Mail } from "lucide-react";
import { Button } from "../../ui/Button";
import { Skeleton } from "../../ui/Skeleton";
import { integrityApi } from "../integrityApi";
import { Card, ErrorState } from "./IntegrityUi";

const options=[
  ["cases_enabled","Casos","Novos relatos, atribuições e decisões que exigem atenção."],
  ["messages_enabled","Mensagens","Novas respostas enviadas pelo denunciante."],
  ["tasks_enabled","Tarefas","Atribuições, prazos e tarefas vencidas."],
  ["sla_enabled","Prazos e SLA","Alertas antes e depois do vencimento dos prazos."],
] as const;

export function IntegrityNotificationPreferences({ tenantId }: { tenantId: string }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setError("");
      setData(await integrityApi(tenantId, "/notifications/preferences"));
    } catch (failure: any) {
      setError(failure.message);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <ErrorState message={error} />;
  if (!data) return <Skeleton className="h-72 rounded-2xl" />;

  const preferences = data.preferences;

  return (
    <Card title="Suas notificações">
      <p className="-mt-2 mb-5 text-sm text-[#626866]">
        Escolha quais atualizações quer acompanhar. Alertas no sistema permanecem ativos para informações essenciais.
      </p>
      {feedback ? (
        <div role="status" className="mb-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-900">
          {feedback}
        </div>
      ) : null}
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setBusy(true);
          setFeedback("");
          try {
            const payload = {
              in_app_enabled: true,
              email_enabled: form.get("email_enabled") === "on",
              ...Object.fromEntries(options.map(([key]) => [key, form.get(key) === "on"])),
            };
            setData(
              await integrityApi(tenantId, "/notifications/preferences", {
                method: "PUT",
                body: JSON.stringify(payload),
              }),
            );
            setFeedback("Preferências salvas.");
          } catch (failure: any) {
            setFeedback(failure.message);
          } finally {
            setBusy(false);
          }
        }}
        className="space-y-4"
      >
        <div className="rounded-xl border border-[#DDD8CF] p-4">
          <div className="flex items-start gap-3">
            <BellRing className="mt-0.5 h-5 w-5 text-[#3457D5]" />
            <div className="flex-1">
              <strong>Notificações no sistema</strong>
              <p className="text-xs text-[#626866]">Sempre ativas para manter a operação segura.</p>
            </div>
            <input type="checkbox" checked readOnly aria-label="Notificações no sistema ativas" />
          </div>
        </div>
        <div className="rounded-xl border border-[#DDD8CF] p-4">
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 h-5 w-5 text-[#3457D5]" />
            <div className="flex-1">
              <strong>Notificações por e-mail</strong>
              <p className="text-xs text-[#626866]">
                {data.email_delivery === "configured"
                  ? "Os e-mails não incluem conteúdo sensível do caso."
                  : "Ainda indisponível. Sua equipe continuará recebendo os avisos dentro da Ordum."}
              </p>
            </div>
            <input
              name="email_enabled"
              type="checkbox"
              disabled={data.email_delivery !== "configured"}
              defaultChecked={preferences.email_enabled}
            />
          </div>
        </div>
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-black">Assuntos que quero acompanhar</legend>
          {options.map(([key, label, description]) => (
            <label key={key} className="flex cursor-pointer items-start gap-3 rounded-xl bg-[#F6F5F2] p-3">
              <input name={key} type="checkbox" defaultChecked={preferences[key] !== false} className="mt-1" />
              <span>
                <strong className="block text-sm">{label}</strong>
                <span className="text-xs text-[#626866]">{description}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <Button disabled={busy}>{busy ? "Salvando..." : "Salvar preferências"}</Button>
      </form>
    </Card>
  );
}

