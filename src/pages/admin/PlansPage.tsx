import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, Check, Layers3, PencilLine, Plus, X } from "lucide-react";
import { useAccess } from "../../core/auth/AccessContext";
import { MetricGridSkeleton } from "../../components/ui/LoadingSkeletons";
import { userFacingApiError, userFacingException } from "../../lib/userFacingError";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
type SolutionLimit = { users: string; storageGb: string };
type FormState = {
  code: string;
  name: string;
  description: string;
  amount: string;
  cycle: string;
  billingType: string;
  graceDays: string;
  trialDays: string;
  maxUsers: string;
  maxUnits: string;
  solutionIds: string[];
  solutionLimits: Record<string, SolutionLimit>;
};

const emptyForm = (): FormState => ({
  code: "",
  name: "",
  description: "",
  amount: "",
  cycle: "monthly",
  billingType: "UNDEFINED",
  graceDays: "5",
  trialDays: "14",
  maxUsers: "",
  maxUnits: "",
  solutionIds: [],
  solutionLimits: {},
});

export function PlansPage() {
  const { session, hasPlatformPermission } = useAccess();
  const [plans, setPlans] = useState<any[]>([]);
  const [solutions, setSolutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const request = useCallback(async (path: string, init?: RequestInit) => {
    const response = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
        ...init?.headers,
      },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(userFacingApiError(body, response.status, "Não foi possível concluir esta ação."));
    return body;
  }, [session]);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError("");
    try {
      const [planData, catalog] = await Promise.all([
        request("/api/admin/billing/plans"),
        request("/api/admin/commercial/catalog"),
      ]);
      setPlans(planData || []);
      setSolutions(catalog.solutions || []);
    } catch (caught) {
      setError(userFacingException(caught, "Não foi possível carregar os planos."));
    } finally {
      setLoading(false);
    }
  }, [request, session]);

  useEffect(() => { void load(); }, [load]);

  const selectedSolutions = useMemo(
    () => solutions.filter((solution) => form.solutionIds.includes(solution.id)),
    [form.solutionIds, solutions],
  );

  function startNew() {
    setForm(emptyForm());
    setShowForm(true);
    setError("");
    setSuccess("");
  }

  function startVersion(plan: any) {
    const price = (plan.billing_plan_prices || []).find((item: any) => item.active) || plan.billing_plan_prices?.[0];
    const selected = (plan.billing_plan_solutions || []).map((item: any) => item.solution_id);
    const limits: Record<string, SolutionLimit> = {};
    for (const item of plan.billing_plan_solutions || []) {
      limits[item.solution_id] = {
        users: item.limits?.users ? String(item.limits.users) : "",
        storageGb: item.limits?.storage_gb ? String(item.limits.storage_gb) : "",
      };
    }
    setForm({
      code: plan.code,
      name: plan.name,
      description: plan.description || "",
      amount: price ? String((price.amount_cents / 100).toFixed(2)).replace(".", ",") : "",
      cycle: price?.cycle || "monthly",
      billingType: price?.billing_type || "UNDEFINED",
      graceDays: String(plan.grace_days ?? 5),
      trialDays: String(plan.trial_days ?? 0),
      maxUsers: plan.limits?.users ? String(plan.limits.users) : "",
      maxUnits: plan.limits?.units ? String(plan.limits.units) : "",
      solutionIds: selected,
      solutionLimits: limits,
    });
    setShowForm(true);
    setError("");
    setSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleSolution(id: string) {
    setForm((current) => ({
      ...current,
      solutionIds: current.solutionIds.includes(id)
        ? current.solutionIds.filter((value) => value !== id)
        : [...current.solutionIds, id],
      solutionLimits: current.solutionLimits[id]
        ? current.solutionLimits
        : { ...current.solutionLimits, [id]: { users: "", storageGb: "" } },
    }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (!form.solutionIds.length) {
      setError("Escolha pelo menos um produto para este plano.");
      return;
    }
    const amount = parseBrl(form.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Informe uma mensalidade válida.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const solutionLimits = Object.fromEntries(
        form.solutionIds.map((id) => {
          const current = form.solutionLimits[id] || { users: "", storageGb: "" };
          return [id, {
            ...(current.users ? { users: Number(current.users) } : {}),
            ...(current.storageGb ? { storage_gb: Number(current.storageGb) } : {}),
          }];
        }),
      );
      await request("/api/admin/billing/plans", {
        method: "POST",
        body: JSON.stringify({
          code: form.code.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          name: form.name.trim(),
          description: form.description.trim(),
          amount_cents: Math.round(amount * 100),
          cycle: form.cycle,
          billing_type: form.billingType,
          grace_days: Number(form.graceDays),
          trial_days: Number(form.trialDays),
          limits: {
            ...(form.maxUsers ? { users: Number(form.maxUsers) } : {}),
            ...(form.maxUnits ? { units: Number(form.maxUnits) } : {}),
          },
          solution_limits: solutionLimits,
          solution_ids: form.solutionIds,
        }),
      });
      setSuccess("Plano publicado. As condições dos contratos existentes foram preservadas.");
      setShowForm(false);
      setForm(emptyForm());
      await load();
    } catch (caught) {
      setError(userFacingException(caught, "Não foi possível publicar esta versão."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#B66E45]">Financeiro</p><h1 className="mt-1 text-3xl font-black">Planos e preços</h1><p className="mt-1 text-sm text-[#626866]">Monte ofertas comerciais sem alterar contratos já assinados.</p></div>
        {hasPlatformPermission("platform.billing.manage") ? <button onClick={startNew} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#B66E45] px-4 py-2.5 text-sm font-bold text-white"><Plus className="h-4 w-4" /> Criar plano</button> : null}
      </header>

      {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
      {success ? <div role="status" className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><Check className="h-5 w-5 shrink-0" />{success}</div> : null}

      {showForm ? (
        <form onSubmit={submit} className="space-y-6 rounded-2xl border border-[#DDD8CF] bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-black">{plans.some((plan) => plan.code === form.code) ? "Editar condições do plano" : "Novo plano"}</h2><p className="mt-1 text-sm text-[#626866]">Defina a oferta que ficará disponível para novas propostas. Contratos atuais não serão alterados.</p></div><button type="button" onClick={() => setShowForm(false)} aria-label="Fechar" className="rounded-lg p-2 hover:bg-gray-100"><X className="h-5 w-5" /></button></div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Nome do plano"><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="input" placeholder="Ex.: Integridade Essencial" /></Field>
            <Field label="Código comercial"><input required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} className="input" placeholder="integridade-essencial" /></Field>
            <Field label="Período de teste"><div className="relative"><input required type="number" min="0" max="365" value={form.trialDays} onChange={(event) => setForm({ ...form, trialDays: event.target.value })} className="input pr-14" /><span className="absolute right-3 top-3 text-sm text-[#626866]">dias</span></div></Field>
            <Field label="Mensalidade"><input required inputMode="decimal" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} className="input" placeholder="299,00" /></Field>
            <Field label="Ciclo"><select value={form.cycle} onChange={(event) => setForm({ ...form, cycle: event.target.value })} className="input"><option value="monthly">Mensal</option><option value="quarterly">Trimestral</option><option value="semiannual">Semestral</option><option value="yearly">Anual</option></select></Field>
            <Field label="Forma de pagamento"><select value={form.billingType} onChange={(event) => setForm({ ...form, billingType: event.target.value })} className="input"><option value="UNDEFINED">Definir na contratação</option><option value="PIX">Pix</option><option value="BOLETO">Boleto</option><option value="CREDIT_CARD">Cartão</option></select></Field>
            <Field label="Carência após vencimento"><div className="relative"><input required type="number" min="0" max="90" value={form.graceDays} onChange={(event) => setForm({ ...form, graceDays: event.target.value })} className="input pr-14" /><span className="absolute right-3 top-3 text-sm text-[#626866]">dias</span></div></Field>
            <Field label="Usuários incluídos"><input type="number" min="1" value={form.maxUsers} onChange={(event) => setForm({ ...form, maxUsers: event.target.value })} className="input" placeholder="Sem limite definido" /></Field>
            <Field label="Unidades incluídas"><input type="number" min="1" value={form.maxUnits} onChange={(event) => setForm({ ...form, maxUnits: event.target.value })} className="input" placeholder="Sem limite definido" /></Field>
          </div>
          <Field label="Descrição comercial"><textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="input" placeholder="Explique para quem este plano foi criado e o que ele inclui." /></Field>
          <fieldset><legend className="font-black">Produtos incluídos</legend><p className="mt-1 text-sm text-[#626866]">Escolha os produtos que poderão ser contratados neste plano.</p><div className="mt-3 grid gap-3 md:grid-cols-3">{solutions.map((solution) => { const selected = form.solutionIds.includes(solution.id); return <button key={solution.id} type="button" onClick={() => toggleSolution(solution.id)} className={`rounded-2xl border p-4 text-left transition ${selected ? "border-[#B66E45] bg-[#FBF3EE]" : "border-[#DDD8CF] hover:border-[#B66E45]/60"}`}><div className="flex items-center justify-between gap-3"><strong>{solution.name}</strong><span className={`grid h-6 w-6 place-items-center rounded-full ${selected ? "bg-[#B66E45] text-white" : "bg-[#EEEAE3]"}`}>{selected ? <Check className="h-4 w-4" /> : null}</span></div></button>; })}</div></fieldset>
          {selectedSolutions.length ? <section><h3 className="font-black">Limites por produto</h3><p className="mt-1 text-sm text-[#626866]">Deixe vazio quando o contrato não precisar de um limite específico.</p><div className="mt-3 grid gap-3">{selectedSolutions.map((solution) => { const current = form.solutionLimits[solution.id] || { users: "", storageGb: "" }; return <article key={solution.id} className="grid gap-3 rounded-xl bg-[#F6F5F2] p-4 sm:grid-cols-[1fr_160px_160px] sm:items-end"><strong>{solution.name}</strong><Field label="Usuários"><input type="number" min="1" value={current.users} onChange={(event) => setForm({ ...form, solutionLimits: { ...form.solutionLimits, [solution.id]: { ...current, users: event.target.value } } })} className="input bg-white" /></Field><Field label="Armazenamento (GB)"><input type="number" min="1" value={current.storageGb} onChange={(event) => setForm({ ...form, solutionLimits: { ...form.solutionLimits, [solution.id]: { ...current, storageGb: event.target.value } } })} className="input bg-white" /></Field></article>; })}</div></section> : null}
          <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end"><button type="button" onClick={() => setShowForm(false)} className="rounded-xl border px-4 py-2.5 text-sm font-bold">Cancelar</button><button disabled={saving} className="rounded-xl bg-[#202322] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? "Publicando..." : "Publicar versão"}</button></div>
        </form>
      ) : null}

      {loading ? <MetricGridSkeleton count={3} /> : plans.length === 0 ? <section className="rounded-2xl border border-dashed bg-white p-12 text-center"><Layers3 className="mx-auto h-10 w-10 text-[#B66E45]" /><h2 className="mt-3 font-black">Crie o primeiro plano comercial</h2><p className="mt-1 text-sm text-[#626866]">Escolha os produtos, o período de teste e os valores que serão oferecidos.</p>{hasPlatformPermission("platform.billing.manage") ? <button onClick={startNew} className="mt-4 rounded-xl bg-[#202322] px-4 py-2.5 text-sm font-bold text-white">Criar plano</button> : null}</section> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{plans.map((plan) => { const price = (plan.billing_plan_prices || []).find((item: any) => item.active) || plan.billing_plan_prices?.[0]; return <article key={plan.id} className={`rounded-2xl border bg-white p-5 ${plan.active ? "border-[#B66E45]/50 shadow-sm" : "border-[#DDD8CF] opacity-70"}`}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-[#B66E45]">{plan.billing_plan_solutions?.map((item:any)=>item.solutions?.name).filter(Boolean).join(" · ")||"Produtos Ordum"}</p><h2 className="mt-1 text-xl font-black">{plan.name}</h2></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${plan.active ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"}`}>{plan.active ? "Disponível" : "Condição anterior"}</span></div><p className="mt-2 min-h-10 text-sm text-[#626866]">{plan.description || "Sem descrição comercial."}</p><div className="mt-5 text-2xl font-black">{price ? money.format(price.amount_cents / 100) : "Preço a definir"}</div><p className="mt-1 text-xs text-[#626866]">{cycleLabel(price?.cycle)} · {billingLabel(price?.billing_type)} · {plan.trial_days ? `${plan.trial_days} dias de teste` : "sem período de teste"}</p><div className="mt-4 border-t pt-4 text-sm text-[#626866]">{plan.limits?.users?`Até ${plan.limits.users} usuários`:"Usuários conforme contrato"}{plan.limits?.units?` · ${plan.limits.units} unidades`:""}</div>{hasPlatformPermission("platform.billing.manage") && plan.active ? <button onClick={() => startVersion(plan)} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#B66E45]"><PencilLine className="h-4 w-4" /> Editar condições</button> : null}{!plan.active ? <div className="mt-3 flex items-center gap-1 text-xs text-[#777D7A]"><Archive className="h-3.5 w-3.5" /> Preservado para contratos existentes.</div> : null}</article>; })}</div>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-bold">{label}<div className="mt-1.5 font-normal">{children}</div></label>; }
function cycleLabel(value?: string) { return ({ monthly: "Cobrança mensal", quarterly: "Cobrança trimestral", semiannual: "Cobrança semestral", yearly: "Cobrança anual" } as Record<string, string>)[value || ""] || "Ciclo a definir"; }
function billingLabel(value?: string) { return ({ PIX: "Pix", BOLETO: "Boleto", CREDIT_CARD: "Cartão", UNDEFINED: "Pagamento definido na contratação" } as Record<string, string>)[value || ""] || "Pagamento a definir"; }
function parseBrl(value: string) { const normalized = value.includes(",") ? value.replace(/\./g, "").replace(",", ".") : value; return Number(normalized); }
