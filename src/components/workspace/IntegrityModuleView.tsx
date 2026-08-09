import React, { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Clock,
  MessageSquare,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Skeleton } from "../ui/Skeleton";
import { integrityApi, integrityFileApi, type ApiState } from "./integrityApi";
import { IntegrityConfigurationStatus } from "./integrity/IntegrityConfigurationStatus";
import { useIntegrityCasePermissions } from "./integrity/useIntegrityCasePermissions";

type Props = {
  tenant: { id: string; name?: string };
  user: { permissions?: string[] } | unknown;
  onBack: () => void;
};

function operationalDueAt(item: any) {
  const candidates = [
    !item.first_action_at && item.first_response_due_at,
    item.treatment_due_at,
  ].filter(Boolean) as string[];
  return candidates.sort()[0] || item.sla_due_at || null;
}

export function IntegrityModuleView({ tenant, user, onBack }: Props) {
  const permissions = (user as any)?.permissions || [];
  const canSettings = permissions.includes("integrity.settings.manage");
  const canAssign =
    permissions.includes("integrity.cases.assign") ||
    permissions.includes("integrity.cases.manage");
  const canManageEvidence = permissions.includes("integrity.evidence.manage");
  const [section, setSection] = useState<"dashboard" | "cases" | "settings">(
    "dashboard",
  );
  const [caseId, setCaseId] = useState<string | null>(null);
  if (caseId)
    return (
      <CaseDetailOperational
        tenantId={tenant.id}
        caseId={caseId}
        canAssign={canAssign}
        canManageEvidence={canManageEvidence}
        permissions={permissions}
        onBack={() => setCaseId(null)}
      />
    );
  return (
    <div className="min-h-full bg-[#F6F5F2] text-[#202322]">
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-[#DDD8CF] bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex items-center gap-3">
          <button
            aria-label="Voltar"
            onClick={onBack}
            className="rounded-lg p-2 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#3457D5]/10">
            <ShieldCheck className="h-5 w-5 text-[#3457D5]" />
          </div>
          <div>
            <h1 className="font-bold">Ordum Integridade</h1>
            <p className="text-xs text-[#626866]">Cockpit de tratamento</p>
          </div>
        </div>
        <nav
          className="flex gap-1 rounded-xl bg-[#F6F5F2] p-1"
          aria-label="Áreas do Integridade"
        >
          <NavButton
            active={section === "dashboard"}
            onClick={() => setSection("dashboard")}
            icon={<BarChart3 className="h-4 w-4" />}
          >
            Visão geral
          </NavButton>
          <NavButton
            active={section === "cases"}
            onClick={() => setSection("cases")}
            icon={<ShieldCheck className="h-4 w-4" />}
          >
            Casos
          </NavButton>
          {canSettings && (
            <NavButton
              active={section === "settings"}
              onClick={() => setSection("settings")}
              icon={<Settings className="h-4 w-4" />}
            >
              Configurações
            </NavButton>
          )}
        </nav>
      </header>
      {section === "dashboard" && (
        <Dashboard
          tenantId={tenant.id}
          onOpenCases={() => setSection("cases")}
        />
      )}
      {section === "cases" && (
        <CaseList tenantId={tenant.id} onSelect={setCaseId} />
      )}
      {section === "settings" && canSettings && (
        <SettingsPanel tenantId={tenant.id} />
      )}
    </div>
  );
}

function Dashboard({
  tenantId,
  onOpenCases,
}: {
  tenantId: string;
  onOpenCases: () => void;
}) {
  const [state, setState] = useState<ApiState<any>>({
    data: null,
    loading: true,
    error: "",
  });
  useEffect(() => {
    integrityApi<any>(tenantId, "/dashboard")
      .then((data) => setState({ data, loading: false, error: "" }))
      .catch((error) =>
        setState({ data: null, loading: false, error: error.message }),
      );
  }, [tenantId]);
  if (state.loading)
    return (
      <Panel>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="mt-6 h-52 rounded-2xl" />
      </Panel>
    );
  if (state.error)
    return (
      <Panel>
        <ErrorState message={state.error} />
      </Panel>
    );
  const metrics = [
    ["Abertos", state.data.open],
    ["Novos", state.data.received],
    ["Em triagem", state.data.triage],
    ["Em investigação", state.data.investigation],
    ["Aguardando informação", state.data.waiting_information],
    ["1ª resposta vencida", state.data.first_response_overdue],
    ["Tratamento vencido", state.data.treatment_overdue],
    ["Tarefas vencidas", state.data.tasks_overdue],
    ["Encerrados", state.data.closed],
  ];
  return (
    <Panel>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Visão operacional</h2>
          <p className="mt-1 text-sm text-[#626866]">
            Indicadores calculados a partir dos casos reais deste tenant.
          </p>
        </div>
        <Button onClick={onOpenCases}>Abrir caixa de casos</Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value]) => (
          <div
            key={label as string}
            className="rounded-2xl border border-[#DDD8CF] bg-white p-5"
          >
            <div className="text-xs font-bold uppercase tracking-wider text-[#626866]">
              {label}
            </div>
            <div className="mt-3 text-3xl font-bold">{value ?? "—"}</div>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Summary
          icon={<Clock />}
          label="Primeira ação média"
          value={
            state.data.average_first_action_hours == null
              ? "—"
              : `${state.data.average_first_action_hours}h`
          }
        />
        <Summary
          icon={<CheckCircle2 />}
          label="Resolução média"
          value={
            state.data.average_resolution_hours == null
              ? "—"
              : `${state.data.average_resolution_hours}h`
          }
        />
        <Summary
          icon={<AlertTriangle />}
          label="SLA nas próximas 24h"
          value={String(state.data.sla_due_soon ?? "—")}
        />
      </div>
      <p className="mt-4 text-right text-xs text-[#626866]">
        Atualizado em {new Date(state.data.updated_at).toLocaleString("pt-BR")}
      </p>
    </Panel>
  );
}

function CaseList({
  tenantId,
  onSelect,
}: {
  tenantId: string;
  onSelect: (id: string) => void;
}) {
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    severity: "",
    sla: "",
  });
  const [page, setPage] = useState(1);
  const [state, setState] = useState<ApiState<any>>({
    data: null,
    loading: true,
    error: "",
  });
  const load = useCallback(() => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    const query = new URLSearchParams({
      page: String(page),
      limit: "25",
      ...Object.fromEntries(
        Object.entries(filters).filter(([, value]) => value),
      ),
    });
    integrityApi<any>(tenantId, `/cases?${query}`)
      .then((data) => setState({ data, loading: false, error: "" }))
      .catch((error) =>
        setState({ data: null, loading: false, error: error.message }),
      );
  }, [
    tenantId,
    page,
    filters.search,
    filters.status,
    filters.severity,
    filters.sla,
  ]);
  useEffect(load, [load]);
  return (
    <Panel>
      <div className="mb-5">
        <h2 className="text-2xl font-bold">Caixa de casos</h2>
        <p className="mt-1 text-sm text-[#626866]">
          Pesquisa, prioridade, risco e prazo em uma única fila.
        </p>
      </div>
      <div className="mb-5 grid gap-3 rounded-2xl border border-[#DDD8CF] bg-white p-4 md:grid-cols-4">
        <label className="relative md:col-span-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            aria-label="Buscar protocolo ou assunto"
            className="pl-9"
            placeholder="Buscar"
            value={filters.search}
            onChange={(event) => {
              setPage(1);
              setFilters({ ...filters, search: event.target.value });
            }}
          />
        </label>
        <FilterSelect
          label="Status"
          value={filters.status}
          onChange={(value) => {
            setPage(1);
            setFilters({ ...filters, status: value });
          }}
          options={[
            ["received", "Novo"],
            ["triage", "Triagem"],
            ["investigation", "Investigação"],
            ["waiting_information", "Aguardando"],
            ["decision", "Decisão"],
            ["closed", "Encerrado"],
          ]}
        />
        <FilterSelect
          label="Severidade"
          value={filters.severity}
          onChange={(value) => {
            setPage(1);
            setFilters({ ...filters, severity: value });
          }}
          options={[
            ["low", "Baixa"],
            ["medium", "Média"],
            ["high", "Alta"],
            ["critical", "Crítica"],
          ]}
        />
        <FilterSelect
          label="SLA"
          value={filters.sla}
          onChange={(value) => {
            setPage(1);
            setFilters({ ...filters, sla: value });
          }}
          options={[
            ["due_soon", "Próximas 24h"],
            ["overdue", "Vencido"],
          ]}
        />
      </div>
      {state.loading ? (
        <div className="space-y-3">
          {Array.from({ length: 7 }).map((_, index) => (
            <Skeleton key={index} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : state.error ? (
        <ErrorState message={state.error} />
      ) : state.data.cases.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-[#DDD8CF] bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="bg-[#F6F5F2] text-xs uppercase tracking-wide text-[#626866]">
                  <tr>
                    <th className="px-5 py-3">Protocolo</th>
                    <th>Assunto</th>
                    <th>Status</th>
                    <th>Severidade</th>
                    <th>Categoria</th>
                    <th>Unidade</th>
                    <th>SLA</th>
                  </tr>
                </thead>
                <tbody>
                  {state.data.cases.map((item: any) => (
                    <tr
                      key={item.id}
                      tabIndex={0}
                      onClick={() => onSelect(item.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") onSelect(item.id);
                      }}
                      className="cursor-pointer border-t border-[#EEEAE3] hover:bg-blue-50/40 focus:bg-blue-50"
                    >
                      <td className="px-5 py-4 font-mono font-bold text-[#3457D5]">
                        {item.protocol}
                      </td>
                      <td className="max-w-[240px] truncate">
                        {item.integrity_reports?.subject || "Sem assunto"}
                      </td>
                      <td>{statusLabel(item.status)}</td>
                      <td>
                        <Risk value={item.severity} />
                      </td>
                      <td>{item.integrity_categories?.name || "—"}</td>
                      <td>{item.integrity_units?.name || "—"}</td>
                      <td
                        className={
                          operationalDueAt(item) &&
                          new Date(operationalDueAt(item)!) < new Date() &&
                          !["closed", "archived"].includes(item.status)
                            ? "font-bold text-red-700"
                            : ""
                        }
                      >
                        {operationalDueAt(item)
                          ? new Date(
                              operationalDueAt(item)!,
                            ).toLocaleDateString("pt-BR")
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <span>{state.data.total} caso(s)</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                disabled={page >= state.data.total_pages}
                onClick={() => setPage(page + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        </>
      )}
    </Panel>
  );
}

function CaseDetailOperational({
  tenantId,
  caseId,
  canAssign,
  canManageEvidence,
  permissions,
  onBack,
}: {
  tenantId: string;
  caseId: string;
  canAssign: boolean;
  canManageEvidence: boolean;
  permissions: string[];
  onBack: () => void;
}) {
  const {
    canInvestigate,
    canWriteNote,
    canSendMessage,
    canClose,
    canReopen,
    canRecommend,
    canReadIdentity,
  } = useIntegrityCasePermissions(permissions);
  const [state, setState] = useState<ApiState<any>>({
    data: null,
    loading: true,
    error: "",
  });
  const [timeline, setTimeline] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [evidence, setEvidence] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [note, setNote] = useState("");
  const [publicMessage, setPublicMessage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [assignee, setAssignee] = useState("");
  const [assignmentReason, setAssignmentReason] = useState("");
  const [publicEvidence, setPublicEvidence] = useState(false);
  const [deletingEvidence, setDeletingEvidence] = useState<string | null>(null);
  const [deletionReason, setDeletionReason] = useState("");
  const [identity, setIdentity] = useState<any>(undefined);
  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const [
        detail,
        events,
        communication,
        taskData,
        evidenceData,
        memberData,
      ] = await Promise.all([
        integrityApi<any>(tenantId, `/cases/${caseId}`),
        integrityApi<any>(tenantId, `/cases/${caseId}/timeline`),
        integrityApi<any>(tenantId, `/cases/${caseId}/messages`),
        integrityApi<any>(tenantId, `/cases/${caseId}/tasks`),
        integrityApi<any>(tenantId, `/cases/${caseId}/evidence`),
        canAssign || canInvestigate
          ? integrityApi<any>(tenantId, "/members")
          : Promise.resolve({ members: [] }),
      ]);
      setState({ data: detail.case, loading: false, error: "" });
      setTimeline(events.events);
      setMessages(communication.messages);
      setTasks(taskData.tasks);
      setEvidence(evidenceData.evidence);
      setMembers(memberData.members);
    } catch (error: any) {
      setState({ data: null, loading: false, error: error.message });
    }
  }, [tenantId, caseId, canAssign, canInvestigate]);
  useEffect(() => {
    load();
  }, [load]);
  async function action(work: () => Promise<unknown>, success: string) {
    setBusy(true);
    setFeedback("");
    try {
      await work();
      setFeedback(success);
      await load();
    } catch (error: any) {
      setFeedback(error.message);
    } finally {
      setBusy(false);
    }
  }
  async function transition(to_status: string) {
    const reason = ["closed", "reopened", "archived"].includes(to_status)
      ? note.trim()
      : note.trim() || undefined;
    await action(
      () =>
        integrityApi(tenantId, `/cases/${caseId}/transitions`, {
          method: "POST",
          body: JSON.stringify({
            to_status,
            reason,
            lock_version: state.data.lock_version,
          }),
        }),
      "Status atualizado.",
    );
  }
  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    await action(
      () =>
        integrityApi(tenantId, `/cases/${caseId}/messages`, {
          method: "POST",
          body: JSON.stringify({
            body: note,
            visible_to_reporter: publicMessage,
          }),
        }),
      "Mensagem registrada.",
    );
    setNote("");
  }
  async function assign(event: React.FormEvent) {
    event.preventDefault();
    await action(
      () =>
        integrityApi(tenantId, `/cases/${caseId}/assignments`, {
          method: "POST",
          body: JSON.stringify({
            membership_id: assignee,
            reason: assignmentReason,
          }),
        }),
      "Responsável atribuído.",
    );
    setAssignmentReason("");
  }
  async function createTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action(
      () =>
        integrityApi(tenantId, `/cases/${caseId}/tasks`, {
          method: "POST",
          body: JSON.stringify({
            title: form.get("title"),
            due_at: form.get("due_at")
              ? new Date(String(form.get("due_at"))).toISOString()
              : null,
            priority: form.get("priority"),
            assignee_membership_id: form.get("assignee") || null,
            description: null,
          }),
        }),
      "Tarefa criada.",
    );
    event.currentTarget.reset();
  }
  async function updateTask(taskId: string, status: string) {
    await action(
      () =>
        integrityApi(tenantId, `/cases/${caseId}/tasks/${taskId}`, {
          method: "PATCH",
          body: JSON.stringify({
            status,
            reason:
              status === "done" ? "Tarefa concluída." : "Tarefa reaberta.",
          }),
        }),
      "Tarefa atualizada.",
    );
  }
  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    await action(
      () =>
        integrityFileApi(tenantId, `/cases/${caseId}/evidence`, file, {
          "x-visible-to-reporter": String(publicEvidence),
        }),
      "Evidência enviada com segurança.",
    );
    event.target.value = "";
  }
  async function removeEvidence(item: any) {
    await action(
      () =>
        integrityApi(tenantId, `/cases/${caseId}/evidence/${item.id}`, {
          method: "DELETE",
          body: JSON.stringify({ reason: deletionReason }),
        }),
      "Evidência excluída e registrada na auditoria.",
    );
    setDeletingEvidence(null);
    setDeletionReason("");
  }
  async function download(item: any) {
    await action(async () => {
      const result = await integrityApi<any>(
        tenantId,
        `/cases/${caseId}/evidence/${item.id}/url`,
        { method: "POST" },
      );
      window.open(result.url, "_blank", "noopener,noreferrer");
    }, "URL segura liberada por 2 minutos.");
  }
  async function decide(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action(
      () =>
        integrityApi(tenantId, `/cases/${caseId}/decision`, {
          method: "POST",
          body: JSON.stringify({
            final_classification: form.get("classification"),
            conclusion: form.get("conclusion"),
            measures_taken: form.get("measures"),
            internal_justification: form.get("justification"),
            reporter_outcome: form.get("outcome") || null,
            lock_version: state.data.lock_version,
          }),
        }),
      "Decisão registrada e caso encerrado.",
    );
  }
  async function recommend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action(
      () => integrityApi(tenantId, `/cases/${caseId}/recommendation`, {
        method: "POST",
        body: JSON.stringify({ recommendation: form.get("recommendation"), justification: form.get("recommendation_justification") }),
      }),
      "Recomendação registrada na timeline.",
    );
    event.currentTarget.reset();
  }
  async function revealIdentity() {
    await action(async () => {
      const result = await integrityApi<any>(tenantId, `/cases/${caseId}/identity`);
      setIdentity(result.identity || null);
    }, "Identidade protegida consultada com autorização.");
  }
  if (state.loading)
    return (
      <Panel>
        <Skeleton className="h-16 rounded-xl" />
        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          <Skeleton className="h-[520px] rounded-2xl lg:col-span-2" />
          <Skeleton className="h-[520px] rounded-2xl" />
        </div>
      </Panel>
    );
  if (state.error)
    return (
      <Panel>
        <button
          onClick={onBack}
          className="mb-4 flex items-center gap-2 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>
        <ErrorState message={state.error} />
      </Panel>
    );
  const item = state.data;
  const report = item.integrity_reports;
  return (
    <div className="min-h-full bg-[#F6F5F2]">
      <header className="border-b bg-white px-4 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button aria-label="Voltar" onClick={onBack}>
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="font-mono text-sm font-bold text-[#3457D5]">
                {item.protocol}
              </div>
              <h1 className="text-xl font-bold">
                {report.subject || "Caso de Integridade"}
              </h1>
            </div>
          </div>
          <div className="flex gap-2">
            <Risk value={item.severity} />
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold">
              {statusLabel(item.status)}
            </span>
          </div>
        </div>
      </header>
      <Panel>
        {feedback && (
          <div
            role="status"
            className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm"
          >
            {feedback}
          </div>
        )}
        <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-5">
            <Card title="Denúncia original">
              <dl className="grid gap-3 sm:grid-cols-3">
                <Meta
                  label="Categoria"
                  value={item.integrity_categories?.name}
                />
                <Meta label="Unidade" value={item.integrity_units?.name} />
                <Meta
                  label="Data"
                  value={
                    report.occurred_at
                      ? new Date(report.occurred_at).toLocaleDateString("pt-BR")
                      : "Não informada"
                  }
                />
              </dl>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-7">
                {report.description}
              </p>
              {report.reporter_mode === "identified" && canReadIdentity && (
                <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm">
                  {identity === undefined ? (
                    <Button type="button" size="sm" variant="outline" onClick={revealIdentity} disabled={busy}>Consultar identidade protegida</Button>
                  ) : identity ? (
                    <dl className="grid gap-2 sm:grid-cols-3"><Meta label="Nome" value={identity.name} /><Meta label="E-mail" value={identity.email || "—"} /><Meta label="Telefone" value={identity.phone || "—"} /></dl>
                  ) : <p>Identidade não informada.</p>}
                </div>
              )}
            </Card>
            <Card title="Tarefas de investigação">
              {canInvestigate && <form onSubmit={createTask} className="grid gap-2 sm:grid-cols-2">
                <Input
                  name="title"
                  required
                  minLength={2}
                  placeholder="Nova tarefa"
                />
                <Input name="due_at" type="datetime-local" />
                <select
                  name="priority"
                  className="rounded-xl border p-2 text-sm"
                >
                  <option value="normal">Prioridade normal</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
                <select
                  name="assignee"
                  className="rounded-xl border p-2 text-sm"
                >
                  <option value="">Sem responsável</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
                <Button type="submit" disabled={busy}>
                  Criar tarefa
                </Button>
              </form>}
              <div className="mt-4 space-y-2">
                {tasks.length === 0 ? (
                  <p className="rounded-xl border border-dashed p-4 text-center text-sm text-gray-500">
                    Nenhuma tarefa.
                  </p>
                ) : (
                  tasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#F6F5F2] p-3 text-sm"
                    >
                      <div>
                        <strong>{task.title}</strong>
                        <div
                          className={
                            task.due_at &&
                            new Date(task.due_at) < new Date() &&
                            !["done", "cancelled"].includes(task.status)
                              ? "text-red-700"
                              : "text-gray-500"
                          }
                        >
                          {task.due_at
                            ? new Date(task.due_at).toLocaleString("pt-BR")
                            : "Sem prazo"}{" "}
                          · {task.priority}
                        </div>
                      </div>
                      {canInvestigate && (task.status === "done" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateTask(task.id, "open")}
                        >
                          Reabrir
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => updateTask(task.id, "done")}
                        >
                          Concluir
                        </Button>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </Card>
            <Card title="Evidências">
              {canManageEvidence && (
                <label className="block rounded-xl border border-dashed p-4 text-center text-sm font-medium">
                  Adicionar evidência
                  <input
                    type="file"
                    onChange={upload}
                    disabled={busy}
                    className="mt-2 block w-full text-sm"
                  />
                </label>
              )}
              {canManageEvidence && (
                <label className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={publicEvidence}
                    onChange={(event) =>
                      setPublicEvidence(event.target.checked)
                    }
                  />
                  Permitir acesso pelo denunciante no acompanhamento
                </label>
              )}
              <div className="mt-3 space-y-2">
                {evidence.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Nenhuma evidência registrada.
                  </p>
                ) : (
                  evidence.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl bg-[#F6F5F2] p-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => download(item)}
                          className="text-left font-medium text-[#3457D5]"
                        >
                          {item.files.original_name} ·{" "}
                          {Math.ceil((item.files.size_bytes || 0) / 1024)} KB
                        </button>
                        {canManageEvidence && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDeletingEvidence(item.id)}
                            disabled={busy}
                          >
                            Excluir
                          </Button>
                        )}
                      </div>
                      {item.visible_to_reporter && (
                        <span className="mt-2 inline-block rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800">
                          Visível ao denunciante
                        </span>
                      )}
                      {deletingEvidence === item.id && (
                        <div className="mt-3 rounded-xl border border-red-200 bg-white p-3">
                          <label className="text-xs font-bold text-red-800">
                            Motivo obrigatório
                          </label>
                          <Input
                            value={deletionReason}
                            onChange={(event) =>
                              setDeletionReason(event.target.value)
                            }
                            minLength={3}
                            className="mt-1"
                          />
                          <div className="mt-2 flex gap-2">
                            <Button
                              size="sm"
                              disabled={
                                busy || deletionReason.trim().length < 3
                              }
                              onClick={() => removeEvidence(item)}
                            >
                              Confirmar exclusão
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setDeletingEvidence(null);
                                setDeletionReason("");
                              }}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </Card>
            <Card title="Comunicação e notas">
              <div className="space-y-2">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`rounded-xl p-3 text-sm ${message.visible_to_reporter ? "bg-blue-50" : "bg-amber-50"}`}
                  >
                    <strong>
                      {message.visible_to_reporter
                        ? "Visível ao denunciante"
                        : "Nota interna"}
                    </strong>
                    <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
                  </div>
                ))}
              </div>
              {(canWriteNote || canSendMessage) && <form onSubmit={sendMessage} className="mt-4 space-y-2">
                <textarea
                  required
                  minLength={2}
                  maxLength={5000}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={4}
                  className="w-full rounded-xl border p-3"
                />
                <label className="flex gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={publicMessage}
                    onChange={(event) => setPublicMessage(event.target.checked)}
                    disabled={!canSendMessage}
                  />
                  Enviar ao denunciante
                </label>
                <Button type="submit" disabled={busy || (publicMessage ? !canSendMessage : !canWriteNote)}>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Registrar
                </Button>
              </form>}
            </Card>
            {canRecommend && ["investigation", "decision"].includes(item.status) && (
              <Card title="Recomendação">
                <form onSubmit={recommend} className="space-y-3">
                  <textarea name="recommendation" required minLength={10} rows={3} className="w-full rounded-xl border p-3" placeholder="Recomendação ao decisor" />
                  <textarea name="recommendation_justification" required minLength={10} rows={3} className="w-full rounded-xl border p-3" placeholder="Fundamentação interna" />
                  <Button type="submit" disabled={busy}>Registrar recomendação</Button>
                </form>
              </Card>
            )}
            {item.status === "decision" && canClose && (
              <Card title="Decisão e encerramento">
                <form onSubmit={decide} className="space-y-3">
                  <Input
                    name="classification"
                    required
                    minLength={3}
                    placeholder="Classificação final"
                  />
                  <textarea
                    name="conclusion"
                    required
                    minLength={3}
                    rows={3}
                    className="w-full rounded-xl border p-3"
                    placeholder="Conclusão interna"
                  />
                  <textarea
                    name="measures"
                    required
                    minLength={3}
                    rows={3}
                    className="w-full rounded-xl border p-3"
                    placeholder="Providências adotadas"
                  />
                  <textarea
                    name="justification"
                    required
                    minLength={3}
                    rows={3}
                    className="w-full rounded-xl border p-3"
                    placeholder="Fundamentação interna"
                  />
                  <textarea
                    name="outcome"
                    rows={3}
                    className="w-full rounded-xl border p-3"
                    placeholder="Resultado comunicável ao denunciante (opcional)"
                  />
                  <Button type="submit" disabled={busy}>
                    Registrar decisão e encerrar
                  </Button>
                </form>
              </Card>
            )}
          </div>
          <aside className="space-y-5">
            <Card title="Tratamento">
              <Meta
                label="Primeira resposta"
                value={
                  item.first_response_due_at
                    ? new Date(item.first_response_due_at).toLocaleString(
                        "pt-BR",
                      )
                    : "—"
                }
              />
              <Meta
                label="Tratamento"
                value={
                  item.treatment_due_at
                    ? new Date(item.treatment_due_at).toLocaleString("pt-BR")
                    : "—"
                }
              />
              {canAssign && (
                <form onSubmit={assign} className="space-y-2 border-t pt-3">
                  <select
                    required
                    value={assignee}
                    onChange={(event) => setAssignee(event.target.value)}
                    className="w-full rounded-xl border p-2 text-sm"
                  >
                    <option value="">Atribuir responsável</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                  <Input
                    required
                    minLength={3}
                    value={assignmentReason}
                    onChange={(event) =>
                      setAssignmentReason(event.target.value)
                    }
                    placeholder="Motivo"
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={busy || !assignee}
                  >
                    Atribuir
                  </Button>
                </form>
              )}
              {(item.status === "closed" ? canReopen : canInvestigate) && <div className="mt-4 grid gap-2">
                <TransitionButtons
                  status={item.status}
                  disabled={busy}
                  onTransition={transition}
                />
              </div>}
            </Card>
            <Card title="Timeline">
              <div className="max-h-[600px] space-y-4 overflow-auto">
                {timeline.map((event) => (
                  <div
                    key={event.id}
                    className="border-l-2 border-blue-100 pl-3 text-sm"
                  >
                    <strong>{eventLabel(event.event_type)}</strong>
                    <div className="text-xs text-gray-500">
                      {new Date(event.created_at).toLocaleString("pt-BR")}
                    </div>
                    {event.note && <p>{event.note}</p>}
                  </div>
                ))}
              </div>
            </Card>
          </aside>
        </div>
      </Panel>
    </div>
  );
}

function CaseDetail({
  tenantId,
  caseId,
  canAssign,
  onBack,
}: {
  tenantId: string;
  caseId: string;
  canAssign: boolean;
  onBack: () => void;
}) {
  const [state, setState] = useState<ApiState<any>>({
    data: null,
    loading: true,
    error: "",
  });
  const [timeline, setTimeline] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [assignee, setAssignee] = useState("");
  const [assignmentReason, setAssignmentReason] = useState("");
  const [note, setNote] = useState("");
  const [publicMessage, setPublicMessage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const [detail, events, communication, memberData] = await Promise.all([
        integrityApi<any>(tenantId, `/cases/${caseId}`),
        integrityApi<any>(tenantId, `/cases/${caseId}/timeline`),
        integrityApi<any>(tenantId, `/cases/${caseId}/messages`),
        canAssign
          ? integrityApi<any>(tenantId, "/members")
          : Promise.resolve({ members: [] }),
      ]);
      setState({ data: detail.case, loading: false, error: "" });
      setTimeline(events.events);
      setMessages(communication.messages);
      setMembers(memberData.members);
    } catch (error: any) {
      setState({ data: null, loading: false, error: error.message });
    }
  }, [tenantId, caseId, canAssign]);
  useEffect(() => {
    load();
  }, [load]);
  async function transition(to_status: string) {
    const reason = ["closed", "reopened"].includes(to_status)
      ? note.trim()
      : note.trim() || undefined;
    setBusy(true);
    setActionError("");
    try {
      await integrityApi(tenantId, `/cases/${caseId}/transitions`, {
        method: "POST",
        body: JSON.stringify({
          to_status,
          reason,
          lock_version: state.data.lock_version,
        }),
      });
      setNote("");
      await load();
    } catch (error: any) {
      setActionError(error.message);
    } finally {
      setBusy(false);
    }
  }
  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setActionError("");
    try {
      await integrityApi(tenantId, `/cases/${caseId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          body: note,
          visible_to_reporter: publicMessage,
        }),
      });
      setNote("");
      await load();
    } catch (error: any) {
      setActionError(error.message);
    } finally {
      setBusy(false);
    }
  }
  async function assign(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setActionError("");
    try {
      await integrityApi(tenantId, `/cases/${caseId}/assignments`, {
        method: "POST",
        body: JSON.stringify({
          membership_id: assignee,
          reason: assignmentReason,
        }),
      });
      setAssignmentReason("");
      await load();
    } catch (error: any) {
      setActionError(error.message);
    } finally {
      setBusy(false);
    }
  }
  if (state.loading)
    return (
      <Panel>
        <Skeleton className="h-16 rounded-xl" />
        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          <Skeleton className="h-[520px] rounded-2xl lg:col-span-2" />
          <Skeleton className="h-[520px] rounded-2xl" />
        </div>
      </Panel>
    );
  if (state.error)
    return (
      <Panel>
        <button
          onClick={onBack}
          className="mb-4 flex items-center gap-2 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>
        <ErrorState message={state.error} />
      </Panel>
    );
  const item = state.data;
  const report = item.integrity_reports;
  return (
    <div className="min-h-full bg-[#F6F5F2]">
      <header className="border-b border-[#DDD8CF] bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              aria-label="Voltar"
              onClick={onBack}
              className="rounded-lg p-2 hover:bg-gray-100"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <div className="font-mono text-sm font-bold text-[#3457D5]">
                {item.protocol}
              </div>
              <h1 className="text-xl font-bold">
                {report.subject || "Caso de Integridade"}
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Risk value={item.severity} />
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold">
              {statusLabel(item.status)}
            </span>
          </div>
        </div>
      </header>
      <Panel>
        {actionError && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {actionError}
          </div>
        )}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
          <div className="space-y-5">
            <Card title="Denúncia original">
              <dl className="mb-5 grid gap-4 text-sm sm:grid-cols-3">
                <Meta
                  label="Categoria"
                  value={item.integrity_categories?.name}
                />
                <Meta label="Unidade" value={item.integrity_units?.name} />
                <Meta
                  label="Ocorrido em"
                  value={
                    report.occurred_at
                      ? new Date(report.occurred_at).toLocaleDateString("pt-BR")
                      : "Não informado"
                  }
                />
              </dl>
              <p className="whitespace-pre-wrap text-sm leading-7 text-[#3F4543]">
                {report.description}
              </p>
            </Card>
            <Card title="Comunicação e notas">
              <div className="space-y-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`rounded-xl p-4 text-sm ${message.visible_to_reporter ? "border border-blue-100 bg-blue-50" : "border border-amber-100 bg-amber-50"}`}
                  >
                    <div className="mb-2 text-xs font-bold">
                      {message.visible_to_reporter
                        ? "Visível ao denunciante"
                        : "Nota interna"}{" "}
                      · {new Date(message.created_at).toLocaleString("pt-BR")}
                    </div>
                    <p className="whitespace-pre-wrap">{message.body}</p>
                  </div>
                ))}
              </div>
              <form onSubmit={sendMessage} className="mt-4 space-y-3">
                <textarea
                  required
                  minLength={2}
                  maxLength={5000}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-[#DDD8CF] p-3 text-sm"
                  placeholder="Escreva uma nota ou comunicação"
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={publicMessage}
                    onChange={(event) => setPublicMessage(event.target.checked)}
                  />
                  Enviar ao denunciante
                </label>
                <Button disabled={busy} type="submit">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Registrar mensagem
                </Button>
              </form>
            </Card>
          </div>
          <aside className="space-y-5">
            <Card title="Tratamento">
              <Meta label="Prioridade" value={item.priority} />
              <Meta
                label="SLA"
                value={
                  item.sla_due_at
                    ? new Date(item.sla_due_at).toLocaleString("pt-BR")
                    : "Não definido"
                }
              />
              <Meta
                label="Responsável"
                value={
                  item.owner_membership_id
                    ? "Responsável atribuído"
                    : "Não atribuído"
                }
              />
              {canAssign && (
                <form
                  onSubmit={assign}
                  className="mt-4 space-y-2 border-t pt-4"
                >
                  <label className="block text-xs font-bold">
                    Atribuir responsável
                    <select
                      required
                      value={assignee}
                      onChange={(event) => setAssignee(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-[#DDD8CF] bg-white p-2 text-sm font-normal"
                    >
                      <option value="">Selecione</option>
                      {members.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Input
                    required
                    minLength={3}
                    maxLength={500}
                    value={assignmentReason}
                    onChange={(event) =>
                      setAssignmentReason(event.target.value)
                    }
                    placeholder="Motivo da atribuição"
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={busy || !assignee}
                  >
                    Atribuir
                  </Button>
                </form>
              )}
              <div className="mt-4 grid gap-2">
                <TransitionButtons
                  status={item.status}
                  disabled={busy}
                  onTransition={transition}
                />
              </div>
              {["decision", "closed"].includes(item.status) && (
                <p className="mt-3 text-xs text-[#626866]">
                  Para encerrar ou reabrir, escreva o motivo no campo de
                  mensagem antes de confirmar.
                </p>
              )}
            </Card>
            <Card title="Timeline">
              <div className="max-h-[480px] space-y-4 overflow-auto">
                {timeline.map((event) => (
                  <div
                    key={event.id}
                    className="relative border-l-2 border-blue-100 pl-4 text-sm"
                  >
                    <div className="font-bold">
                      {eventLabel(event.event_type)}
                    </div>
                    <div className="text-xs text-[#626866]">
                      {new Date(event.created_at).toLocaleString("pt-BR")}
                    </div>
                    {event.note && <p className="mt-1 text-xs">{event.note}</p>}
                  </div>
                ))}
              </div>
            </Card>
          </aside>
        </div>
      </Panel>
    </div>
  );
}

function SettingsPanel({ tenantId }: { tenantId: string }) {
  const [state, setState] = useState<ApiState<any>>({
    data: null,
    loading: true,
    error: "",
  });
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  const loadSettings = useCallback(async () => {
    try {
      const data = await integrityApi<any>(tenantId, "/settings");
      setState({ data, loading: false, error: "" });
    } catch (error: any) {
      setState({ data: null, loading: false, error: error.message });
    }
  }, [tenantId]);
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);
  if (state.loading)
    return (
      <Panel>
        <Skeleton className="h-[520px] rounded-2xl" />
      </Panel>
    );
  if (state.error)
    return (
      <Panel>
        <ErrorState message={state.error} />
      </Panel>
    );
  const settings = state.data.settings || {
    introduction:
      "Este canal recebe relatos de integridade com tratamento confidencial.",
    instructions: "",
    allows_anonymous: true,
    allows_identified: false,
    default_sla_hours: 120,
    treatment_sla_hours: 720,
    automatic_acknowledgement: "Seu relato foi recebido e será analisado.",
    branding: {},
    attachment_policy: { enabled: false, max_files: 3, max_size_mb: 5 },
    communication_policy: {
      allow_reporter_messages: true,
      allow_case_messages: true,
    },
    routing_rules: [],
  };
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setSaved("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await integrityApi<any>(tenantId, "/settings", {
        method: "PUT",
        body: JSON.stringify({
          ...settings,
          introduction: form.get("introduction"),
          instructions: form.get("instructions") || null,
          allows_anonymous: form.get("allows_anonymous") === "on",
          allows_identified: form.get("allows_identified") === "on",
          default_sla_hours: Number(form.get("default_sla_hours")),
          treatment_sla_hours: Number(form.get("treatment_sla_hours") || 720),
          automatic_acknowledgement: form.get("automatic_acknowledgement"),
          branding: settings.branding || {},
          attachment_policy: {
            enabled: form.get("attachments_enabled") === "on",
            max_files: Number(form.get("max_files") || 3),
            max_size_mb: Number(form.get("max_size_mb") || 5),
          },
          communication_policy: {
            allow_reporter_messages:
              form.get("allow_reporter_messages") === "on",
            allow_case_messages: form.get("allow_case_messages") === "on",
          },
          default_assignee_membership_id:
            settings.default_assignee_membership_id || null,
          default_committee_id: settings.default_committee_id || null,
          routing_rules: settings.routing_rules || [],
        }),
      });
      setState({
        data: { ...state.data, settings: response.settings },
        loading: false,
        error: "",
      });
      setSaved("Configurações salvas.");
    } catch (error: any) {
      setSaved(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel>
      <IntegrityConfigurationStatus status={state.data.configuration_status} />
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Configurações do canal</h2>
        <p className="mt-1 text-sm text-[#626866]">
          Políticas gerais do Integridade para este tenant.
        </p>
      </div>
      <form
        onSubmit={submit}
        className="max-w-3xl space-y-5 rounded-2xl border border-[#DDD8CF] bg-white p-6"
      >
        <label className="block text-sm font-bold">
          Apresentação
          <textarea
            name="introduction"
            required
            minLength={10}
            defaultValue={settings.introduction}
            rows={4}
            className="mt-2 w-full rounded-xl border border-[#DDD8CF] p-3 font-normal"
          />
        </label>
        <label className="block text-sm font-bold">
          Instruções
          <textarea
            name="instructions"
            defaultValue={settings.instructions || ""}
            rows={4}
            className="mt-2 w-full rounded-xl border border-[#DDD8CF] p-3 font-normal"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-3 rounded-xl border p-4">
            <input
              name="allows_anonymous"
              type="checkbox"
              defaultChecked={settings.allows_anonymous}
            />
            Permitir relato anônimo
          </label>
          <label className="flex items-center gap-3 rounded-xl border p-4">
            <input
              name="allows_identified"
              type="checkbox"
              defaultChecked={settings.allows_identified}
            />
            Permitir relato identificado
          </label>
        </div>
        <label className="block text-sm font-bold">
          SLA padrão em horas
          <Input
            name="default_sla_hours"
            type="number"
            min={1}
            max={8760}
            defaultValue={settings.default_sla_hours}
            className="mt-2"
          />
        </label>
        <label className="block text-sm font-bold">
          SLA de tratamento em horas
          <Input
            name="treatment_sla_hours"
            type="number"
            min={1}
            max={17520}
            defaultValue={settings.treatment_sla_hours}
            className="mt-2"
          />
        </label>
        <div className="rounded-xl border border-[#DDD8CF] p-4">
          <label className="flex items-center gap-3 text-sm font-bold">
            <input
              name="attachments_enabled"
              type="checkbox"
              defaultChecked={settings.attachment_policy?.enabled}
            />
            Permitir anexos do denunciante
          </label>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold">
              Quantidade máxima
              <Input
                name="max_files"
                type="number"
                min={1}
                max={10}
                defaultValue={settings.attachment_policy?.max_files || 3}
                className="mt-1"
              />
            </label>
            <label className="text-xs font-bold">
              Tamanho máximo (MB)
              <Input
                name="max_size_mb"
                type="number"
                min={1}
                max={10}
                defaultValue={settings.attachment_policy?.max_size_mb || 5}
                className="mt-1"
              />
            </label>
          </div>
        </div>
        <fieldset className="rounded-xl border border-[#DDD8CF] p-4">
          <legend className="px-1 text-sm font-bold">Comunicação permitida</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-3 text-sm">
              <input
                name="allow_reporter_messages"
                type="checkbox"
                defaultChecked={
                  settings.communication_policy?.allow_reporter_messages !== false
                }
              />
              Denunciante pode complementar o relato
            </label>
            <label className="flex items-center gap-3 text-sm">
              <input
                name="allow_case_messages"
                type="checkbox"
                defaultChecked={
                  settings.communication_policy?.allow_case_messages !== false
                }
              />
              Comitê pode responder ao denunciante
            </label>
          </div>
        </fieldset>
        <label className="block text-sm font-bold">
          Mensagem automática
          <textarea
            name="automatic_acknowledgement"
            required
            minLength={5}
            defaultValue={settings.automatic_acknowledgement}
            rows={3}
            className="mt-2 w-full rounded-xl border border-[#DDD8CF] p-3 font-normal"
          />
        </label>
        {saved && (
          <p role="status" className="text-sm font-medium">
            {saved}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? "Salvando…" : "Salvar configurações"}
        </Button>
        <div className="grid gap-3 border-t pt-5 sm:grid-cols-3">
          <InfoCount
            icon={<ShieldCheck />}
            label="Canais"
            value={state.data.channels.length}
          />
          <InfoCount
            icon={<Users />}
            label="Unidades"
            value={state.data.units.length}
          />
          <InfoCount
            icon={<Settings />}
            label="Categorias"
            value={state.data.categories.length}
          />
        </div>
      </form>
      <SettingsCollections
        tenantId={tenantId}
        data={state.data}
        onCreated={(key, item) =>
          setState({
            data: { ...state.data, [key]: [...state.data[key], item] },
            loading: false,
            error: "",
          })
        }
      />
      <CommitteeRouting
        tenantId={tenantId}
        data={state.data}
        onReload={loadSettings}
        onCreated={(key, item) =>
          setState({
            data: { ...state.data, [key]: [...state.data[key], item] },
            loading: false,
            error: "",
          })
        }
        onUpdated={(key, item) =>
          setState({
            data: {
              ...state.data,
              [key]: state.data[key].map((current: any) =>
                current.id === item.id ? item : current,
              ),
            },
            loading: false,
            error: "",
          })
        }
      />
    </Panel>
  );
}

function CommitteeRouting({
  tenantId,
  data,
  onCreated,
  onUpdated,
  onReload,
}: {
  tenantId: string;
  data: any;
  onCreated: (key: string, item: any) => void;
  onUpdated: (key: string, item: any) => void;
  onReload: () => Promise<void>;
}) {
  const [feedback, setFeedback] = useState("");
  const memberName = (id: string) =>
    data.members.find((member: any) => member.id === id)?.name || "Membro indisponível";
  const committeeMembers = (committeeId: string) =>
    data.committee_members
      .filter((member: any) => member.committee_id === committeeId && member.active)
      .map((member: any) => member.membership_id);
  async function createCommittee(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const response = await integrityApi<any>(
        tenantId,
        "/settings/committees",
        {
          method: "POST",
          body: JSON.stringify({
            name: form.get("name"),
            description: null,
            member_ids: form.getAll("members"),
            active: true,
          }),
        },
      );
      onCreated("committees", response.committee);
      await onReload();
      formElement.reset();
      setFeedback("Comitê criado.");
    } catch (error: any) {
      setFeedback(error.message);
    }
  }
  async function updateCommittee(
    item: any,
    status: "active" | "inactive" | "archived",
    values?: { name: string; member_ids: string[] },
  ) {
    setFeedback("");
    try {
      const response = await integrityApi<any>(
        tenantId,
        `/settings/committees/${item.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            name: values?.name || item.name,
            description: item.description || null,
            member_ids: values?.member_ids || committeeMembers(item.id),
            active: status === "active",
            status,
          }),
        },
      );
      onUpdated("committees", response.committee);
      await onReload();
      setFeedback(`Comitê ${status === "active" ? "ativado" : status === "inactive" ? "desativado" : "arquivado"}.`);
    } catch (error: any) {
      setFeedback(error.message);
    }
  }
  async function editCommittee(event: React.FormEvent<HTMLFormElement>, item: any) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await updateCommittee(item, item.status || (item.active ? "active" : "inactive"), {
      name: String(form.get("committee_name") || "").trim(),
      member_ids: form.getAll("committee_members").map(String),
    });
  }
  async function createRule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const scenario = {
        category_id: form.get("category") || null,
        unit_id: form.get("unit") || null,
      };
      const preview = await integrityApi<any>(tenantId, "/settings/routing/preview", {
        method: "POST",
        body: JSON.stringify(scenario),
      });
      if (!preview.deterministic) {
        setFeedback("O cenário possui regras empatadas. Ajuste a prioridade antes de salvar.");
        return;
      }
      const response = await integrityApi<any>(tenantId, "/settings/routing", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          category_id: form.get("category") || null,
          unit_id: form.get("unit") || null,
          assignee_membership_id: form.get("assignee") || null,
          committee_id: form.get("committee") || null,
          priority: Number(form.get("priority") || 100),
          active: true,
          is_fallback: form.get("is_fallback") === "on",
        }),
      });
      onCreated("routing_rules", response.routing_rule);
      await onReload();
      formElement.reset();
      setFeedback("Regra criada.");
    } catch (error: any) {
      setFeedback(error.message);
    }
  }
  async function updateRule(item: any, status: "active" | "inactive" | "archived") {
    setFeedback("");
    try {
      const response = await integrityApi<any>(tenantId, `/settings/routing/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: item.name,
          category_id: item.category_id,
          unit_id: item.unit_id,
          assignee_membership_id: item.assignee_membership_id,
          committee_id: item.committee_id,
          priority: item.priority,
          active: status === "active",
          is_fallback: item.is_fallback,
          status,
        }),
      });
      onUpdated("routing_rules", response.routing_rule);
      await onReload();
      setFeedback(`Regra ${status === "active" ? "ativada" : status === "inactive" ? "desativada" : "arquivada"}.`);
    } catch (error: any) {
      setFeedback(error.message);
    }
  }
  return (
    <section className="mt-6 grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border bg-white p-5">
        <h3 className="font-bold">Comitê de ética</h3>
        <p className="mt-1 text-xs text-gray-500">
          Membros ativos autorizados para tratamento.
        </p>
        <div className="my-3 space-y-2">
          {data.committees.length ? (
            data.committees.map((item: any) => (
              <div
                key={item.id}
                className="rounded-lg bg-[#F6F5F2] p-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong>{item.name}</strong>
                  <span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold">{item.status || (item.active ? "active" : "inactive")}</span>
                </div>
                <p className="mt-1 text-xs text-[#626866]">
                  {committeeMembers(item.id).map(memberName).join(", ") || "Sem membros ativos"}
                </p>
                <form onSubmit={(event) => editCommittee(event, item)} className="mt-3 grid gap-2">
                  <Input name="committee_name" required minLength={2} defaultValue={item.name} aria-label="Nome do comitê" />
                  <label className="text-xs font-bold">
                    Membros ativos
                    <select
                      name="committee_members"
                      multiple
                      defaultValue={committeeMembers(item.id)}
                      className="mt-1 h-20 w-full rounded-xl border bg-white p-2 text-sm font-normal"
                    >
                      {data.members.map((member: any) => (
                        <option key={member.id} value={member.id}>{member.name}</option>
                      ))}
                    </select>
                  </label>
                  <Button type="submit" variant="outline">Salvar comitê</Button>
                </form>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(item.status || (item.active ? "active" : "inactive")) !== "active" && (
                    <Button type="button" variant="outline" onClick={() => updateCommittee(item, "active")}>Ativar</Button>
                  )}
                  {(item.status || (item.active ? "active" : "inactive")) === "active" && (
                    <Button type="button" variant="outline" onClick={() => updateCommittee(item, "inactive")}>Desativar</Button>
                  )}
                  {(item.status || "active") !== "archived" && (
                    <Button type="button" variant="outline" onClick={() => updateCommittee(item, "archived")}>Arquivar</Button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="rounded-lg border border-dashed p-3 text-center text-sm">
              Nenhum comitê.
            </p>
          )}
        </div>
        <form onSubmit={createCommittee} className="space-y-2 border-t pt-3">
          <Input
            name="name"
            required
            minLength={2}
            placeholder="Nome do comitê"
          />
          <label className="block text-xs font-bold">
            Membros
            <select
              name="members"
              multiple
              className="mt-1 h-24 w-full rounded-xl border p-2 text-sm"
            >
              {data.members.map((member: any) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="integrity">
            Criar comitê
          </Button>
        </form>
      </div>
      <div className="rounded-2xl border bg-white p-5">
        <h3 className="font-bold">Roteamento automático</h3>
        <p className="mt-1 text-xs text-gray-500">
          Categoria/unidade determinam responsável ou comitê.
        </p>
        <div className="my-3 space-y-2">
          {data.routing_rules.length ? (
            data.routing_rules.map((item: any) => (
              <div
                key={item.id}
                className="rounded-lg bg-[#F6F5F2] p-3 text-sm font-medium"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong>{item.name}</strong>
                  <span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold">{item.status || (item.active ? "active" : "inactive")}</span>
                </div>
                <p className="mt-1 text-xs text-[#626866]">
                  Prioridade {item.priority}{item.is_fallback ? " · fallback" : ""}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(item.status || (item.active ? "active" : "inactive")) !== "active" && (
                    <Button type="button" variant="outline" onClick={() => updateRule(item, "active")}>Ativar</Button>
                  )}
                  {(item.status || (item.active ? "active" : "inactive")) === "active" && (
                    <Button type="button" variant="outline" onClick={() => updateRule(item, "inactive")}>Desativar</Button>
                  )}
                  {(item.status || "active") !== "archived" && (
                    <Button type="button" variant="outline" onClick={() => updateRule(item, "archived")}>Arquivar</Button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="rounded-lg border border-dashed p-3 text-center text-sm">
              Nenhuma regra.
            </p>
          )}
        </div>
        <form onSubmit={createRule} className="grid gap-2 sm:grid-cols-2">
          <Input
            name="name"
            required
            minLength={2}
            placeholder="Nome da regra"
          />
          <select name="category" className="rounded-xl border p-2 text-sm">
            <option value="">Todas as categorias</option>
            {data.categories.map((item: any) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select name="unit" className="rounded-xl border p-2 text-sm">
            <option value="">Todas as unidades</option>
            {data.units.map((item: any) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select name="assignee" className="rounded-xl border p-2 text-sm">
            <option value="">Sem responsável direto</option>
            {data.members.map((item: any) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select name="committee" className="rounded-xl border p-2 text-sm">
            <option value="">Sem comitê</option>
            {data.committees.map((item: any) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <Input name="priority" type="number" min={0} max={10000} defaultValue={100} aria-label="Prioridade da regra" />
          <label className="flex items-center gap-2 rounded-xl border p-2 text-sm">
            <input name="is_fallback" type="checkbox" /> Regra fallback
          </label>
          <Button type="submit" variant="integrity">
            Testar e criar regra
          </Button>
        </form>
      </div>
      {feedback && (
        <p role="status" className="text-sm lg:col-span-2">
          {feedback}
        </p>
      )}
    </section>
  );
}

function SettingsCollections({
  tenantId,
  data,
  onCreated,
}: {
  tenantId: string;
  data: any;
  onCreated: (key: string, item: any) => void;
}) {
  const [feedback, setFeedback] = useState("");
  async function create(
    event: React.FormEvent<HTMLFormElement>,
    kind: "channels" | "categories" | "units",
  ) {
    event.preventDefault();
    setFeedback("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const name = String(form.get("name") || "").trim();
    const slug = String(form.get("slug") || "").trim();
    const payload =
      kind === "channels"
        ? {
            name,
            public_title: name,
            public_slug: slug,
            active: true,
            allows_anonymous: true,
            allows_identified: false,
          }
        : kind === "categories"
          ? {
              name,
              slug,
              description: null,
              default_risk_level: "medium",
              sla_hours: null,
              active: true,
            }
          : { name, code: slug || null, active: true };
    try {
      const response = await integrityApi<any>(tenantId, `/settings/${kind}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const item =
        response[
          kind === "channels"
            ? "channel"
            : kind === "categories"
              ? "category"
              : "unit"
        ];
      onCreated(kind, item);
      formElement.reset();
      setFeedback("Item criado com sucesso.");
    } catch (error: any) {
      setFeedback(error.message);
    }
  }
  return (
    <section className="mt-6 grid gap-4 lg:grid-cols-3">
      <CollectionCard
        title="Canais públicos"
        items={data.channels}
        render={(item) => (
          <span>
            <strong>{item.public_title || item.name}</strong>
            <small className="block text-[#626866]">
              /#/canal/{item.public_slug}
            </small>
          </span>
        )}
      >
        <QuickCreate
          onSubmit={(event) => create(event, "channels")}
          nameLabel="Nome do canal"
          slugLabel="slug-publico"
        />
      </CollectionCard>
      <CollectionCard
        title="Categorias"
        items={data.categories}
        render={(item) => (
          <span>
            <strong>{item.name}</strong>
            <small className="block text-[#626866]">
              SLA: {item.sla_hours || "padrão"}
            </small>
          </span>
        )}
      >
        <QuickCreate
          onSubmit={(event) => create(event, "categories")}
          nameLabel="Nova categoria"
          slugLabel="slug-categoria"
        />
      </CollectionCard>
      <CollectionCard
        title="Unidades"
        items={data.units}
        render={(item) => (
          <span>
            <strong>{item.name}</strong>
            <small className="block text-[#626866]">
              {item.code || "Sem código"}
            </small>
          </span>
        )}
      >
        <QuickCreate
          onSubmit={(event) => create(event, "units")}
          nameLabel="Nova unidade"
          slugLabel="Código opcional"
          slugRequired={false}
        />
      </CollectionCard>
      {feedback && (
        <p role="status" className="text-sm lg:col-span-3">
          {feedback}
        </p>
      )}
    </section>
  );
}

function CollectionCard({
  title,
  items,
  render,
  children,
}: {
  title: string;
  items: any[];
  render: (item: any) => React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#DDD8CF] bg-white p-5">
      <h3 className="font-bold">{title}</h3>
      <div className="my-4 max-h-48 space-y-2 overflow-auto">
        {items.length ? (
          items.map((item) => (
            <div key={item.id} className="rounded-xl bg-[#F6F5F2] p-3 text-sm">
              {render(item)}
            </div>
          ))
        ) : (
          <p className="rounded-xl border border-dashed p-4 text-center text-xs text-[#626866]">
            Nenhum item configurado.
          </p>
        )}
      </div>
      {children}
    </div>
  );
}
function QuickCreate({
  onSubmit,
  nameLabel,
  slugLabel,
  slugRequired = true,
}: {
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  nameLabel: string;
  slugLabel: string;
  slugRequired?: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-2 border-t pt-4">
      <Input name="name" required minLength={2} placeholder={nameLabel} />
      <Input
        name="slug"
        required={slugRequired}
        pattern={slugRequired ? "[a-z0-9]+(?:-[a-z0-9]+)*" : undefined}
        placeholder={slugLabel}
      />
      <Button type="submit" size="sm" variant="integrity" className="w-full">
        Adicionar
      </Button>
    </form>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</main>
  );
}
function NavButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold sm:text-sm ${active ? "bg-white text-[#3457D5] shadow-sm" : "text-[#626866]"}`}
    >
      {icon}
      <span className="hidden sm:inline">{children}</span>
    </button>
  );
}
function Summary({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-[#DDD8CF] bg-white p-5">
      <div className="text-[#3457D5]">{icon}</div>
      <div>
        <div className="text-xs text-[#626866]">{label}</div>
        <strong className="text-xl">{value}</strong>
      </div>
    </div>
  );
}
function ErrorState({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-700"
    >
      <AlertTriangle className="mx-auto mb-3 h-7 w-7" />
      {message}
    </div>
  );
}
function EmptyState() {
  return (
    <div className="rounded-2xl border-2 border-dashed border-[#DDD8CF] bg-white p-12 text-center">
      <ShieldCheck className="mx-auto h-9 w-9 text-[#3457D5]" />
      <h3 className="mt-3 font-bold">Nenhum caso encontrado</h3>
      <p className="mt-1 text-sm text-[#626866]">
        Quando um relato for recebido, ele aparecerá aqui.
      </p>
    </div>
  );
}
function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[][];
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-xl border border-[#DDD8CF] bg-white px-3 text-sm"
    >
      <option value="">{label}: todos</option>
      {options.map(([key, text]) => (
        <option key={key} value={key}>
          {text}
        </option>
      ))}
    </select>
  );
}
function Risk({ value }: { value: string }) {
  const classes =
    value === "critical"
      ? "bg-red-100 text-red-800"
      : value === "high"
        ? "bg-orange-100 text-orange-800"
        : value === "low"
          ? "bg-emerald-100 text-emerald-800"
          : "bg-yellow-100 text-yellow-800";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${classes}`}>
      {(
        {
          low: "Baixa",
          medium: "Média",
          high: "Alta",
          critical: "Crítica",
        } as any
      )[value] || value}
    </span>
  );
}
function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#DDD8CF] bg-white p-5">
      <h2 className="mb-4 font-bold">{title}</h2>
      {children}
    </section>
  );
}
function Meta({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="mb-3">
      <dt className="text-xs text-[#626866]">{label}</dt>
      <dd className="font-medium">{value || "—"}</dd>
    </div>
  );
}
function InfoCount({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-[#F6F5F2] p-3">
      <span className="text-[#3457D5]">{icon}</span>
      <span>
        <strong>{value}</strong>
        <small className="ml-1 text-[#626866]">{label}</small>
      </span>
    </div>
  );
}
function TransitionButtons({
  status,
  disabled,
  onTransition,
}: {
  status: string;
  disabled: boolean;
  onTransition: (status: string) => void;
}) {
  const next =
    (
      {
        received: [["triage", "Iniciar triagem"]],
        triage: [
          ["investigation", "Iniciar investigação"],
          ["waiting_information", "Solicitar informação"],
        ],
        investigation: [
          ["waiting_information", "Aguardar informação"],
          ["decision", "Registrar decisão"],
        ],
        waiting_information: [["investigation", "Retomar investigação"]],
        decision: [["closed", "Encerrar caso"]],
        closed: [["reopened", "Reabrir caso"]],
        reopened: [["triage", "Nova triagem"]],
      } as Record<string, string[][]>
    )[status] || [];
  return (
    <>
      {next.map(([key, label]) => (
        <Button
          key={key}
          variant={key === "closed" ? "default" : "outline"}
          disabled={disabled}
          onClick={() => onTransition(key)}
        >
          {label}
        </Button>
      ))}
    </>
  );
}
function statusLabel(status: string) {
  return (
    (
      {
        received: "Novo",
        triage: "Em triagem",
        investigation: "Em investigação",
        waiting_information: "Aguardando informação",
        decision: "Em decisão",
        closed: "Encerrado",
        reopened: "Reaberto",
        archived: "Arquivado",
      } as Record<string, string>
    )[status] || status
  );
}
function eventLabel(event: string) {
  return (
    (
      {
        report_received: "Relato recebido",
        status_changed: "Status alterado",
        assigned: "Responsável atribuído",
        conflict_registered: "Conflito de interesse registrado",
        reporter_message_sent: "Mensagem enviada ao denunciante",
        internal_note_added: "Nota interna registrada",
      } as Record<string, string>
    )[event] || event
  );
}
