import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  Loader2,
  Save,
  Ban,
  PlayCircle,
  X,
  ShieldCheck,
} from "lucide-react";
import { useAccess } from "../../core/auth/AccessContext";
import { AssignLeadModal } from "../../components/admin/AssignLeadModal";
import { DetailSkeleton } from "../../components/ui/LoadingSkeletons";
import { userFacingApiError, userFacingException } from "../../lib/userFacingError";

const TABS = [
  { id: "overview", label: "Resumo" },
  { id: "products", label: "Produtos" },
  { id: "commercial", label: "Comercial" },
  { id: "financial", label: "Financeiro" },
  { id: "people", label: "Pessoas e acessos" },
  { id: "history", label: "Histórico" },
];

export function CompanyDetailPage({ tenantId }: { tenantId: string }) {
  const { session, hasPlatformPermission } = useAccess();
  const [tenant, setTenant] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [isActioning, setIsActioning] = useState(false);
  const [solutionKeys, setSolutionKeys] = useState<string[]>([]);
  const [integritySummary, setIntegritySummary] = useState<any>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Status Action Modal State
  const [statusModalAction, setStatusModalAction] = useState<
    "suspend" | "reactivate" | null
  >(null);
  const [statusReason, setStatusReason] = useState("");

  async function loadTenant() {
    if (!session) return;
    try {
      const response = await fetch(`/api/admin/clients/${tenantId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setTenant(data);
        if (data.tenant_solutions) {
          setSolutionKeys(
            data.tenant_solutions
              .map((s: any) => s.solutions?.key)
              .filter(Boolean),
          );
        }
        const integrityResponse = await fetch(
          `/api/admin/clients/${tenantId}/integrity-summary`,
          {
            headers: { Authorization: `Bearer ${session.access_token}` },
          },
        );
        if (integrityResponse.ok)
          setIntegritySummary(await integrityResponse.json());
      } else {
        const errData = await response.json().catch(() => ({}));
        setError(userFacingApiError(errData,response.status,"Não foi possível carregar esta empresa. Tente novamente."));
      }
    } catch (e) {
      setError(
        userFacingException(e,"Não foi possível carregar esta empresa. Tente novamente."),
      );
    }
  }

  useEffect(() => {
    loadTenant();
  }, [session, tenantId]);

  const handleSaveSolutions = async () => {
    setError(null);
    setSuccess(null);
    setIsActioning(true);
    try {
      const response = await fetch(`/api/admin/clients/${tenantId}/solutions`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ solutionKeys }),
      });
      if (response.ok) {
        setSuccess("Soluções atualizadas com sucesso!");
        await loadTenant();
      } else {
        const errData = await response.json().catch(() => ({}));
        setError(userFacingApiError(errData,response.status,"Não foi possível atualizar os produtos. Revise as escolhas e tente novamente."));
      }
    } catch (e) {
      setError(userFacingException(e,"Não foi possível atualizar os produtos. Tente novamente."));
    } finally {
      setIsActioning(false);
    }
  };

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusModalAction || !statusReason.trim()) return;
    setError(null);
    setSuccess(null);
    setIsActioning(true);
    try {
      const resp = await fetch(
        `/api/admin/clients/${tenantId}/${statusModalAction}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ reason: statusReason.trim() }),
        },
      );
      const resData = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setError(userFacingApiError(resData,resp.status,"Não foi possível alterar a situação da empresa. Tente novamente."));
      } else {
        setSuccess(
          `Cliente ${statusModalAction === "suspend" ? "suspenso" : "reativado"} com sucesso!`,
        );
        setStatusModalAction(null);
        setStatusReason("");
        await loadTenant();
      }
    } catch (e) {
      setError(userFacingException(e,"Não foi possível alterar a situação da empresa. Tente novamente."));
    } finally {
      setIsActioning(false);
    }
  };

  const toggleSolution = (key: string) => {
    if (solutionKeys.includes(key)) {
      setSolutionKeys(solutionKeys.filter((k) => k !== key));
    } else {
      setSolutionKeys([...solutionKeys, key]);
    }
  };

  if (!tenant) return <DetailSkeleton />;
  const contracts = Array.isArray(tenant.commercial_contracts)
    ? tenant.commercial_contracts
    : tenant.commercial_contracts
      ? [tenant.commercial_contracts]
      : [];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="mb-6">
        <a
          href="#/admin/empresas"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Clientes
        </a>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 font-medium"
        >
          {error}
        </div>
      )}
      {success && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 font-medium"
        >
          {success}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-[#DDD8CF]/40 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-[#DDD8CF]/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-sm"
                style={{
                  backgroundColor: tenant.settings?.primaryColor || "#353938",
                }}
              >
                {tenant.settings?.logoInitials ||
                  tenant.name.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#202322]">
                  {tenant.name}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[#626866]"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tenant.status === "active" ? "bg-emerald-100 text-emerald-800" : tenant.status === "suspended" ? "bg-red-100 text-red-800" : "bg-gray-100"}`}>{clientStatusLabel(tenant.status)}</span><span>{contracts[0]?.billing_plans?.name || integritySummary?.plan?.name || "Plano não definido"}</span><span>·</span><span>{tenant.owner?.name || tenant.owner?.email || "Sem responsável Ordum"}</span></div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {tenant.status === "active" &&
                hasPlatformPermission("platform.clients.manage") && (
                  <button
                    disabled={isActioning}
                    onClick={() => {
                      setStatusModalAction("suspend");
                      setStatusReason("");
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 text-sm font-bold rounded-xl hover:bg-red-200 disabled:opacity-50 transition-colors"
                  >
                    <Ban className="w-4 h-4" /> Suspender
                  </button>
                )}
              {tenant.status === "suspended" &&
                hasPlatformPermission("platform.clients.manage") && (
                  <button
                    disabled={isActioning}
                    onClick={() => {
                      setStatusModalAction("reactivate");
                      setStatusReason("");
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 text-sm font-bold rounded-xl hover:bg-emerald-200 disabled:opacity-50 transition-colors"
                  >
                    <PlayCircle className="w-4 h-4" /> Reativar
                  </button>
                )}
              <button
                disabled={isActioning}
                onClick={() => setIsAssignModalOpen(true)}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                Transferir
              </button>
              <a
                href={`#/admin/onboarding?tenant=${tenant.id}`}
                className="px-4 py-2 bg-[#B66E45] text-white text-sm font-bold rounded-xl hover:bg-[#A05C38] transition-colors"
              >
                Implantação
              </a>
            </div>
          </div>
        </div>

        <div className="flex border-b border-[#DDD8CF]/40 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-4 text-sm font-bold whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab.id
                  ? "border-[#B66E45] text-[#202322]"
                  : "border-transparent text-gray-500 hover:text-gray-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-8">
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div><h2 className="text-xl font-black">Situação do cliente</h2><p className="mt-1 text-sm text-[#626866]">Informações essenciais para acompanhar esta conta.</p></div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <BusinessMetric label="Situação" value={clientLifecycleLabel(tenant.lifecycle_status || tenant.status)} />
                <BusinessMetric label="Plano" value={integritySummary?.plan?.name || "Não definido"} />
                <BusinessMetric label="Data de entrada" value={new Date(tenant.created_at).toLocaleDateString("pt-BR")} />
                <BusinessMetric label="Responsável Ordum" value={tenant.owner?.name || tenant.owner?.email || "Não atribuído"} />
              </div>
              <div className="grid gap-4 lg:grid-cols-2"><section className="rounded-2xl bg-[#F6F5F2] p-5"><h3 className="font-black">Implantação</h3><div className="mt-3 flex items-end justify-between"><div><div className="text-3xl font-black">{integritySummary?.onboarding?.progress_percent ?? 0}%</div><p className="text-sm text-[#626866]">{onboardingLabel(integritySummary?.onboarding?.status)}</p></div><a href={`#/admin/onboarding?tenant=${tenant.id}`} className="text-sm font-bold text-[#B66E45]">Acompanhar</a></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-[#DDD8CF]"><div className="h-full rounded-full bg-[#B66E45]" style={{width:`${integritySummary?.onboarding?.progress_percent ?? 0}%`}}/></div></section><section className="rounded-2xl bg-[#202322] p-5 text-white"><h3 className="font-black">Próxima ação recomendada</h3><p className="mt-2 text-sm text-white/70">{!integritySummary?.contracted?"Defina os produtos e o plano contratado.":!integritySummary?.configuration_complete?"Continue a implantação do Ordum Integridade.":integritySummary.channels_active===0?"Revise e publique o canal de denúncias.":"Acompanhe a saúde e o uso dos produtos ativos."}</p><button onClick={()=>setActiveTab(!integritySummary?.contracted?"products":"products")} className="mt-4 text-sm font-bold text-[#D2926D]">Abrir produtos →</button></section></div>
            </div>
          )}

          {activeTab === "products" && (
            <div className="space-y-6"><div><h2 className="text-xl font-black">Produtos contratados</h2><p className="mt-1 text-sm text-[#626866]">Ativação, implantação e saúde de cada solução Ordum.</p></div><div className="grid gap-4 lg:grid-cols-2"><ProductCard name="Ordum Integridade" color="#3457D5" active={Boolean(integritySummary?.contracted)} status={integritySummary?.solution_status} progress={integritySummary?.onboarding?.progress_percent} detail={integritySummary?.channels_active?"Canal publicado":"Canal ainda não publicado"} users={integritySummary?.active_users} onManage={()=>{window.location.hash=`#/admin/onboarding?tenant=${tenant.id}`;}}/>{solutionKeys.includes("people")?<ProductCard name="Ordum Pessoas" color="#16897A" active status="active" detail="Produto ativo"/>:null}{solutionKeys.includes("talent")?<ProductCard name="Ordum Talentos" color="#D98C32" active status="active" detail="Produto ativo"/>:null}</div>{hasPlatformPermission("platform.solutions.manage")?<button onClick={()=>setActiveTab("solutions")} className="text-sm font-bold text-[#B66E45]">Gerenciar plano e produtos</button>:null}</div>
          )}

          {activeTab === "commercial" && (
            <div className="space-y-6"><div><h2 className="text-xl font-black">Relacionamento comercial</h2><p className="mt-1 text-sm text-[#626866]">Responsável, propostas e contratos desta empresa.</p></div><section className="rounded-2xl bg-[#F6F5F2] p-5"><div className="text-sm text-[#626866]">Responsável Ordum</div><div className="mt-1 text-lg font-black">{tenant.owner?.name||tenant.owner?.email||"Não atribuído"}</div><div className="text-sm text-[#626866]">{tenant.assignment?.platform_teams?.name||"Sem equipe definida"}</div><button onClick={()=>setIsAssignModalOpen(true)} className="mt-4 text-sm font-bold text-[#B66E45]">Alterar responsável</button></section><div className="space-y-3">{contracts.length?contracts.map((contract:any)=><article key={contract.id} className="flex flex-col justify-between gap-3 rounded-2xl border border-[#DDD8CF] p-5 sm:flex-row sm:items-center"><div><strong>Contrato #{contract.contract_number}</strong><p className="mt-1 text-sm text-[#626866]">{contractStatusLabel(contract.status)} · {formatMoney(contract.amount_cents)}</p></div><a href="#/admin/contratos" className="text-sm font-bold text-[#B66E45]">Abrir contrato</a></article>):<div className="rounded-2xl border border-dashed p-8 text-center text-sm text-[#626866]">Nenhum contrato vinculado a esta empresa.</div>}</div></div>
          )}

          {activeTab === "people" && (
            <div className="space-y-7"><div><h2 className="text-xl font-black">Pessoas e acessos</h2><p className="mt-1 text-sm text-[#626866]">Usuários, unidades e domínios vinculados à empresa.</p></div><section><h3 className="font-black">Usuários</h3><div className="mt-3 grid gap-3 md:grid-cols-2">{tenant.memberships?.length?tenant.memberships.map((item:any)=><div key={item.id} className="rounded-xl bg-[#F6F5F2] p-4"><strong>{item.display_name||"Usuário"}</strong><p className="text-sm text-[#626866]">{accessStatusLabel(item.status)}{item.employment_level?` · ${employmentLabel(item.employment_level)}`:""}</p></div>):<p className="text-sm text-[#626866]">Nenhum usuário vinculado.</p>}</div></section><div className="grid gap-6 lg:grid-cols-2"><section><h3 className="font-black">Unidades</h3><div className="mt-3 space-y-2">{tenant.departments?.length?tenant.departments.map((item:any)=><div key={item.id} className="rounded-xl border border-[#DDD8CF] p-4"><strong>{item.name}</strong><p className="text-xs text-[#626866]">{item.active?"Ativa":"Inativa"}</p></div>):<p className="text-sm text-[#626866]">Nenhuma unidade cadastrada.</p>}</div></section><section><h3 className="font-black">Domínios</h3><div className="mt-3 space-y-2">{tenant.tenant_domains?.length?tenant.tenant_domains.map((item:any)=><div key={item.id} className="rounded-xl border border-[#DDD8CF] p-4"><strong>{item.hostname}</strong><p className="text-xs text-[#626866]">{item.is_primary?"Principal":"Alternativo"} · {item.verified_at?"Verificado":"Aguardando verificação"}</p></div>):<p className="text-sm text-[#626866]">Nenhum domínio cadastrado.</p>}</div></section></div></div>
          )}

          {activeTab === "history" && (
            <div className="space-y-5"><div><h2 className="text-xl font-black">Histórico da empresa</h2><p className="mt-1 text-sm text-[#626866]">Alterações administrativas relevantes, em linguagem operacional.</p></div>{tenant.audit?.length?tenant.audit.map((item:any)=><article key={item.id} className="border-l-2 border-[#D2926D] py-1 pl-4"><strong>{auditActionLabel(item.action)}</strong><p className="text-sm text-[#626866]">{item.actor_name||"Equipe Ordum"} · {new Date(item.created_at).toLocaleString("pt-BR")}</p></article>):<p className="rounded-xl border border-dashed p-8 text-center text-sm text-[#626866]">Nenhum evento registrado para esta empresa.</p>}</div>
          )}

          {activeTab === "solutions" && (
            <div className="space-y-6 max-w-2xl">
              <h2 className="text-lg font-bold">Soluções da Plataforma</h2>
              <div className="space-y-4">
                {[
                  { key: "integrity", name: "Canal de Integridade" },
                  { key: "people", name: "Pessoas e RH" },
                  { key: "talent", name: "Atração de Talentos" },
                ].map((sol) => (
                  <label
                    key={sol.key}
                    className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <input
                      disabled={
                        !hasPlatformPermission("platform.solutions.manage") ||
                        isActioning
                      }
                      type="checkbox"
                      className="w-5 h-5 text-[#B66E45] border-gray-300 rounded focus:ring-[#B66E45]"
                      checked={solutionKeys.includes(sol.key)}
                      onChange={() => toggleSolution(sol.key)}
                    />
                    <div>
                      <div className="font-medium text-[#202322]">
                        {sol.name}
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              {hasPlatformPermission("platform.solutions.manage") && (
                <div className="flex justify-end pt-4">
                  <button
                    onClick={handleSaveSolutions}
                    disabled={isActioning}
                    className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-[#B66E45] rounded-xl hover:bg-[#a05e38] disabled:opacity-50 transition-colors shadow-sm"
                  >
                    {isActioning ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Atualizar Soluções
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === "integrity" && (
            <div className="space-y-6">
              <div className="flex items-start gap-4 rounded-2xl border border-blue-100 bg-blue-50 p-5">
                <ShieldCheck className="mt-0.5 h-6 w-6 text-[#3457D5]" />
                <div>
                  <h2 className="font-bold text-[#202322]">
                    Control plane do Integridade
                  </h2>
                  <p className="mt-1 text-sm text-[#626866]">
                    Somente configuração, entitlement e indicadores agregados. O
                    conteúdo confidencial dos relatos não é disponibilizado ao
                    Admin Ordum.
                  </p>
                </div>
              </div>
              {!integritySummary ? (
                <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-gray-500">
                  Resumo operacional indisponível.
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      [
                        "Contratado",
                        integritySummary.contracted ? "Sim" : "Não",
                      ],
                      ["Status", integritySummary.solution_status],
                      ["Plano", integritySummary.plan?.name || "—"],
                      ["Entitlement", integritySummary.entitlement?.status || "—"],
                      ["Implantação", integritySummary.deployment_state || "não iniciada"],
                      ["Versão da configuração", `v${integritySummary.product_configuration_version || 1}`],
                      [
                        "Configuração",
                        integritySummary.configuration_complete
                          ? "Concluída"
                          : "Pendente",
                      ],
                      ["Usuários ativos", integritySummary.active_users],
                      [
                        "Canais ativos",
                        `${integritySummary.channels_active}/${integritySummary.channels_total}`,
                      ],
                      ["Casos agregados", integritySummary.cases_total],
                      ["Casos abertos", integritySummary.cases_open],
                      ["SLAs vencidos", integritySummary.sla_overdue],
                      ["Saúde", integritySummary.health],
                      [
                        "Armazenamento",
                        `${Math.ceil((integritySummary.storage_bytes || 0) / 1024)} KB`,
                      ],
                    ].map(([label, value]) => (
                      <div
                        key={String(label)}
                        className="rounded-2xl border border-[#DDD8CF] bg-white p-5"
                      >
                        <div className="text-xs font-bold uppercase tracking-wide text-gray-500">
                          {label}
                        </div>
                        <div className="mt-2 text-xl font-bold">
                          {value ?? "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-xl bg-gray-50 p-4">
                      <div className="text-xs text-gray-500">Ativado em</div>
                      <strong>
                        {integritySummary.activated_at
                          ? new Date(
                              integritySummary.activated_at,
                            ).toLocaleDateString("pt-BR")
                          : "—"}
                      </strong>
                    </div>
                    <div className="rounded-xl bg-gray-50 p-4">
                      <div className="text-xs text-gray-500">Último uso</div>
                      <strong>
                        {integritySummary.last_use_at
                          ? new Date(
                              integritySummary.last_use_at,
                            ).toLocaleString("pt-BR")
                          : "—"}
                      </strong>
                    </div>
                    <div className="rounded-xl bg-gray-50 p-4">
                      <div className="text-xs text-gray-500">Onboarding</div>
                      <strong>
                        {integritySummary.onboarding
                          ? `${integritySummary.onboarding.progress_percent}% · ${integritySummary.onboarding.status}`
                          : "Não iniciado"}
                      </strong>
                    </div>
                  </div>
                  <p className="rounded-xl border border-[#DDD8CF] bg-[#F6F5F2] p-4 text-sm text-[#626866]">
                    Erros operacionais:{" "}
                    {integritySummary.operational_errors == null
                      ? integritySummary.operational_errors_reason
                      : integritySummary.operational_errors}
                    . Fronteira de confidencialidade: somente dados agregados.
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#DDD8CF] bg-white p-4">
                    <p className="text-sm text-[#626866]">O workspace só pode ser aberto quando este administrador também possui membership explícita no tenant. Não existe impersonation silenciosa.</p>
                    {integritySummary.workspace_access?.available ? <a href={integritySummary.workspace_access.href} className="rounded-xl bg-[#202322] px-4 py-2 text-sm font-bold text-white">Abrir workspace autorizado</a> : <span className="rounded-full bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">Membership do tenant necessária</span>}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === "owners" && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold">Responsável Comercial</h2>
              {tenant.assignment ? (
                <div className="p-6 bg-gray-50 rounded-2xl border border-[#DDD8CF]/40">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <div className="text-sm font-medium text-gray-500 mb-1">
                        Equipe
                      </div>
                      <div className="text-lg font-bold text-[#202322]">
                        {tenant.assignment.platform_teams?.name}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-500 mb-1">
                        Vendedor
                      </div>
                      <div className="text-lg font-bold text-[#202322]">
                        {tenant.owner?.name ||
                          tenant.owner?.email ||
                          "Equipe (Sem dono específico)"}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center border-2 border-dashed border-[#DDD8CF] rounded-2xl text-gray-500">
                  Nenhum responsável comercial atribuído.
                </div>
              )}
            </div>
          )}

          {activeTab === "domains" && (
            <div className="space-y-3">
              <h2 className="text-lg font-bold">Domínios</h2>
              {tenant.tenant_domains?.length ? (
                tenant.tenant_domains.map((item: any) => (
                  <div key={item.id} className="rounded-xl border p-4">
                    <strong>{item.hostname}</strong>
                    <div className="text-xs text-gray-500">
                      {item.is_primary ? "Principal" : "Alternativo"} ·{" "}
                      {item.verified_at ? "verificado" : "pendente"}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">
                  Nenhum domínio cadastrado.
                </p>
              )}
            </div>
          )}

          {activeTab === "units" && (
            <div className="space-y-3">
              <h2 className="text-lg font-bold">Unidades organizacionais</h2>
              <p className="text-xs text-gray-500">
                Representadas pela estrutura de departamentos do tenant.
              </p>
              {tenant.departments?.length ? (
                tenant.departments.map((item: any) => (
                  <div key={item.id} className="rounded-xl border p-4">
                    <strong>{item.name}</strong>
                    <div className="text-xs text-gray-500">
                      {item.active ? "Ativa" : "Inativa"}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">
                  Nenhuma unidade cadastrada.
                </p>
              )}
            </div>
          )}

          {activeTab === "users" && (
            <div className="space-y-3">
              <h2 className="text-lg font-bold">Usuários e memberships</h2>
              {tenant.memberships?.length ? (
                tenant.memberships.map((item: any) => (
                  <div key={item.id} className="rounded-xl border p-4">
                    <strong>{item.employment_level}</strong>
                    <div className="text-xs text-gray-500">
                      {item.status} · {item.user_id}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">
                  Nenhum usuário vinculado.
                </p>
              )}
            </div>
          )}

          {activeTab === "financial" && (
            <div className="space-y-3">
              <h2 className="text-lg font-bold">
                Contrato, assinatura e pagamentos
              </h2>
              <div className="rounded-xl bg-gray-50 border p-4">
                <div>
                  Situação financeira:{" "}
                  <strong>
                    {billingAccessLabel(tenant.tenant_billing_state?.access_status)}
                  </strong>
                </div>
                <div className="text-sm text-gray-500">
                  Pago até: {tenant.tenant_billing_state?.paid_through || "—"} ·
                  carência até:{" "}
                  {tenant.tenant_billing_state?.grace_ends_at || "—"}
                </div>
              </div>
              {contracts.map((contract: any) => (
                <div key={contract.id} className="rounded-xl border p-4">
                  <strong>
                    Contrato #{contract.contract_number} · {contractStatusLabel(contract.status)}
                  </strong>
                  <div className="text-sm text-gray-500">
                    {Array.isArray(contract.billing_subscriptions)
                      ? contract.billing_subscriptions.length
                      : contract.billing_subscriptions
                        ? 1
                        : 0}{" "}
                    assinatura · {contract.billing_payments?.length || 0}{" "}
                    pagamentos
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "audit" && (
            <div className="space-y-3">
              <h2 className="text-lg font-bold">Auditoria do cliente</h2>
              {tenant.audit?.length ? (
                tenant.audit.map((item: any) => (
                  <div key={item.id} className="rounded-xl border p-4">
                    <strong>{item.action}</strong>
                    <div className="text-xs text-gray-500">
                      {new Date(item.created_at).toLocaleString("pt-BR")} ·{" "}
                      {item.severity}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">
                  Nenhum evento associado diretamente.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {isAssignModalOpen && (
        <AssignLeadModal
          isOpen={true}
          onClose={() => setIsAssignModalOpen(false)}
          onSuccess={() => {
            setIsAssignModalOpen(false);
            loadTenant();
          }}
          leadId={tenantId}
          currentAssignment={tenant.assignment}
          isClient={true}
        />
      )}

      {/* Modal Suspender / Reativar Cliente */}
      {statusModalAction && (
        <div className="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center">
          <form
            onSubmit={handleStatusSubmit}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#202322]">
                {statusModalAction === "suspend"
                  ? "Suspender Cliente"
                  : "Reativar Cliente"}
              </h3>
              <button
                type="button"
                onClick={() => setStatusModalAction(null)}
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600">
              Cliente: <strong>{tenant.name}</strong> ({tenant.slug})
            </p>
            <label className="block text-sm font-medium text-gray-700">
              Motivo da{" "}
              {statusModalAction === "suspend" ? "suspensão" : "reativação"} *
              <textarea
                required
                rows={3}
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="Informe o motivo da alteração de status do cliente (mínimo 5 caracteres)..."
                className="mt-1 w-full rounded-xl border border-[#DDD8CF] p-2.5 text-sm"
              />
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStatusModalAction(null)}
                className="rounded-xl border px-4 py-2 text-sm"
              >
                Cancelar
              </button>
              <button
                disabled={isActioning || statusReason.trim().length < 5}
                className={`rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-50 ${
                  statusModalAction === "suspend"
                    ? "bg-red-700"
                    : "bg-emerald-700"
                }`}
              >
                {isActioning ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : statusModalAction === "suspend" ? (
                  "Confirmar Suspensão"
                ) : (
                  "Confirmar Reativação"
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function BusinessMetric({label,value}:{label:string;value:React.ReactNode}){return <div className="rounded-2xl bg-[#F6F5F2] p-5"><div className="text-xs font-bold uppercase tracking-wide text-[#777D7A]">{label}</div><div className="mt-2 text-lg font-black text-[#202322]">{value||"—"}</div></div>}
function ProductCard({name,color,active,status,progress,detail,users,onManage}:{name:string;color:string;active:boolean;status?:string;progress?:number;detail:string;users?:number;onManage?:()=>void}){return <article className="rounded-2xl border border-[#DDD8CF] bg-white p-5"><div className="flex items-start justify-between"><div><span className="inline-block h-2.5 w-10 rounded-full" style={{backgroundColor:color}}/><h3 className="mt-3 text-lg font-black">{name}</h3></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${active?"bg-emerald-100 text-emerald-800":"bg-gray-100 text-gray-600"}`}>{active?solutionStatusLabel(status):"Não contratado"}</span></div><div className="mt-5 grid grid-cols-2 gap-3 text-sm"><div><span className="text-[#777D7A]">Implantação</span><p className="font-bold">{progress==null?"Não iniciada":`${progress}%`}</p></div><div><span className="text-[#777D7A]">Situação</span><p className="font-bold">{detail}</p></div>{users!=null?<div><span className="text-[#777D7A]">Usuários ativos</span><p className="font-bold">{users}</p></div>:null}</div>{onManage?<button onClick={onManage} className="mt-5 text-sm font-bold" style={{color}}>Gerenciar implantação →</button>:null}</article>}
function clientStatusLabel(value:string){return ({active:"Ativo",suspended:"Suspenso",cancelled:"Cancelado",trial:"Em teste"} as Record<string,string>)[value]||"Em configuração";}
function clientLifecycleLabel(value:string){return ({opportunity:"Oportunidade",approved:"Cliente aprovado",awaiting_payment:"Aguardando pagamento",onboarding:"Em implantação",active:"Ativo",at_risk:"Em risco",delinquent:"Pagamento em atraso",suspended:"Suspenso",cancelled:"Cancelado",closed:"Encerrado"} as Record<string,string>)[value]||clientStatusLabel(value);}
function solutionStatusLabel(value?:string){return ({active:"Ativo",trial:"Em teste",suspended:"Suspenso",cancelled:"Cancelado",not_contracted:"Não contratado"} as Record<string,string>)[value||""]||"Ativo";}
function onboardingLabel(value?:string){return ({not_started:"Não iniciada",in_progress:"Em andamento",blocked:"Precisa de atenção",completed:"Concluída",cancelled:"Cancelada"} as Record<string,string>)[value||""]||"Não iniciada";}
function contractStatusLabel(value:string){return ({draft:"Rascunho",pending_approval:"Aguardando aprovação",approved:"Aprovado",pending_payment:"Aguardando pagamento",active:"Ativo",past_due:"Pagamento em atraso",suspended:"Suspenso",cancelled:"Cancelado",expired:"Encerrado"} as Record<string,string>)[value]||"Em andamento";}
function billingAccessLabel(value?:string){return ({trial:"Período de teste",pending_payment:"Aguardando pagamento",active:"Em dia",grace:"Em período de regularização",suspended:"Suspensa",cancelled:"Encerrada",review:"Em análise"} as Record<string,string>)[value||""]||"Sem cobrança vinculada";}
function accessStatusLabel(value:string){return ({active:"Acesso ativo",invited:"Convite enviado",suspended:"Acesso suspenso",inactive:"Inativo"} as Record<string,string>)[value]||"Acesso pendente";}
function employmentLabel(value:string){return ({employee:"Colaborador",manager:"Gestor",director:"Diretoria",contractor:"Prestador"} as Record<string,string>)[value]||"Membro da empresa";}
function auditActionLabel(value:string){const text=value.replaceAll("."," ").replaceAll("_"," ");return ({"client suspended":"Empresa suspensa","client reactivated":"Empresa reativada","client assigned":"Responsável alterado","tenant solutions updated":"Produtos atualizados"} as Record<string,string>)[text]||"Atualização administrativa";}
function formatMoney(value:number){return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format((value||0)/100);}
